import type Anthropic from "@anthropic-ai/sdk";
import { distanceMm, formatBuildOutcome, TOOLS } from "./tools";
import type { AgentAnchor, AgentEvent, AgentOutcome, BuildOutcome, BuildSpec, TokenUsage } from "./types";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const MAX_BUILD_ATTEMPTS = 6;
const MAX_STEPS = 14;

type Message = Anthropic.Beta.BetaMessage;
type MessageParam = Anthropic.Beta.BetaMessageParam;
type TurnParams = Omit<Anthropic.Beta.MessageCreateParamsNonStreaming, "stream">;

/** Runs one model request, streaming text through `onText`. Tests replace this with a fake. */
export type RunTurn = (params: TurnParams, onText: (delta: string) => void) => Promise<Message>;

export function anthropicTurn(client: Anthropic): RunTurn {
  return async (params, onText) => {
    const stream = client.beta.messages.stream(params);
    stream.on("text", onText);
    return stream.finalMessage();
  };
}

/** Where the loop reports what it saved-worthy: each model message and each spec version. */
export interface Recorder {
  message(m: {
    role: "user" | "assistant";
    content: MessageParam["content"];
    model?: string;
    usage?: TokenUsage;
  }): Promise<void>;
  version(v: {
    spec: Record<string, unknown>;
    anchors: AgentAnchor[];
    ok: boolean;
    errors: string[];
    createdBy: "agent";
  }): Promise<void>;
}

export interface AgentRun {
  outcome: AgentOutcome;
  attempts: number;
  /** The last spec that built, or the last one tried when none did. */
  bestSpec: Record<string, unknown> | null;
  messages: MessageParam[];
  usage: TokenUsage;
}

export interface AgentOptions {
  turn: RunTurn;
  model?: string;
  system: string;
  history: MessageParam[];
  anchors: AgentAnchor[];
  build: BuildSpec;
  emit: (event: AgentEvent) => void;
  maxAttempts?: number;
  /** Saves messages and versions as they happen. */
  record?: Recorder;
}

const emptyUsage = (): TokenUsage => ({
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
});

/** Tool-use loop for one user message. The agent only ever produces Part Spec JSON. */
export async function runAgent(options: AgentOptions): Promise<AgentRun> {
  const { turn, system, anchors, build, emit } = options;
  const maxAttempts = options.maxAttempts ?? MAX_BUILD_ATTEMPTS;
  const messages: MessageParam[] = [...options.history];
  const usage = emptyUsage();
  let attempts = 0;
  let bestSpec: Record<string, unknown> | null = null;
  let bestOk = false;
  let lastBuild: BuildOutcome | null = null;

  const params = (extra: Partial<TurnParams> = {}): TurnParams => ({
    model: options.model ?? DEFAULT_MODEL,
    max_tokens: 16000,
    // The system prompt is large and identical across turns, so cache it.
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    tools: TOOLS,
    messages,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    ...extra,
  });

  const finish = (outcome: AgentOutcome): AgentRun => {
    emit({ type: "done", outcome, attempts });
    return { outcome, attempts, bestSpec, messages, usage };
  };

  const ask = async (extra?: Partial<TurnParams>): Promise<Message> => {
    const message = await turn(params(extra), (delta) => emit({ type: "text", delta }));
    const u = message.usage;
    usage.input_tokens += u.input_tokens;
    usage.output_tokens += u.output_tokens;
    usage.cache_creation_input_tokens += u.cache_creation_input_tokens ?? 0;
    usage.cache_read_input_tokens += u.cache_read_input_tokens ?? 0;
    emit({ type: "usage", usage: { ...usage } });
    const content = message.content as Anthropic.Beta.BetaContentBlockParam[];
    messages.push({ role: "assistant", content });
    await options.record?.message({
      role: "assistant",
      content,
      model: message.model,
      usage: {
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
        cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
      },
    });
    return message;
  };

  for (let step = 0; step < MAX_STEPS; step++) {
    const message = await ask();
    if (message.stop_reason === "refusal") return finish("refused");
    if (message.stop_reason === "max_tokens") throw new Error("The reply was cut off. Try a shorter request.");

    const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (calls.length === 0) return finish("answered");

    const question = calls.find((c) => c.name === "ask_user");
    if (question) {
      const text = String((question.input as { question?: unknown }).question ?? "");
      emit({ type: "question", question: text });
      return finish("asked");
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      const input = (call.input ?? {}) as Record<string, unknown>;
      let content: string;
      let isError = false;
      if (call.name === "list_anchors") {
        content = JSON.stringify(anchors);
        emit({ type: "tool", name: call.name, summary: `${anchors.length} anchors` });
      } else if (call.name === "measure") {
        const d = distanceMm(anchors, input.from, input.to);
        isError = typeof d === "string";
        content = isError ? (d as string) : `${(d as number).toFixed(2)} mm`;
        emit({ type: "tool", name: call.name, summary: `${String(input.from)} to ${String(input.to)}` });
      } else if (call.name === "propose_spec") {
        const spec = input.spec;
        if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
          content = "propose_spec needs a spec object.";
          isError = true;
        } else if (attempts >= maxAttempts) {
          content = "No attempts left for this message. Summarize your best result and the remaining issues.";
          isError = true;
        } else {
          attempts += 1;
          const outcome = await build(spec as Record<string, unknown>, anchors);
          lastBuild = outcome;
          await options.record?.version({
            spec: spec as Record<string, unknown>,
            anchors,
            ok: outcome.ok,
            errors: outcome.ok ? [] : outcome.errors,
            createdBy: "agent",
          });
          if (outcome.ok || !bestOk) {
            bestSpec = spec as Record<string, unknown>;
            bestOk = outcome.ok;
          }
          content = formatBuildOutcome(outcome);
          isError = !outcome.ok;
          emit({
            type: "spec",
            attempt: attempts,
            ok: outcome.ok,
            errors: outcome.ok ? [] : outcome.errors,
            spec: spec as Record<string, unknown>,
          });
        }
      } else {
        content = `Unknown tool ${call.name}.`;
        isError = true;
      }
      results.push({ type: "tool_result", tool_use_id: call.id, content, is_error: isError });
    }
    messages.push({ role: "user", content: results });
    await options.record?.message({ role: "user", content: results });

    // Out of attempts with no working spec: one last reply, without tools, listing what is left.
    if (attempts >= maxAttempts && lastBuild && !lastBuild.ok) {
      await ask({ tool_choice: { type: "none" } });
      return finish("attempts_exhausted");
    }
  }
  return finish("step_limit");
}

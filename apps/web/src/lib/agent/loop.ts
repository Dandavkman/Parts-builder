import { lookupFastener } from "../fasteners";
import type Anthropic from "@anthropic-ai/sdk";
import { checkBuild } from "./checks";
import { describeLikeness, type CheckLikeness } from "./checker";
import { assessMaterials, describeAdvice, recommend } from "../materials";
import { CAD_TOOL, distanceMm, describeBuild, formatBuildOutcome, formatCadStep, MAX_CAD_STEPS, parseDimension, TOOLS, webSearchTool, type CadStepResult } from "./tools";
import type { AgentAnchor, AgentDimension, AgentEvent, AgentOutcome, BuildOutcome, BuildSpec, TokenUsage } from "./types";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const MAX_BUILD_ATTEMPTS = 6;
const MAX_STEPS = 14;
/** Pictures of the agent's own result it may receive per user message (each costs about 1,000 input tokens). */
export const MAX_RENDERS = 3;

export const RENDER_NOTE =
  "A picture of what you just built is attached: four views on one sheet, in this order: front (top left), side (top right), top (bottom left), angled (bottom right). Compare it with the user's photo. Name the biggest differences in outline, curves and proportions. If something is clearly wrong and you have attempts left, fix the biggest differences and build again; stop after 3 pictures, then tell the user what is still different.";

/** Added to a follow-up message, so the agent revises the part it can see instead of rebuilding from memory. */
export const START_NOTE =
  "This is the part as it stands now, before your changes for this message.";
export const START_PICTURE_NOTE =
  "A picture of it is attached: four views on one sheet, in this order: front (top left), side (top right), top (bottom left), angled (bottom right). Look at it next to the user's photo before you change anything, and change only what the user asked for plus anything that clearly does not match the photo.";
export const START_CAD_NOTE =
  "It is loaded as your working spec: carry on with cad_tool steps (inspect_part lists its features; remove_feature and new features change it). Do not call new_part unless the user wants a different part.";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: readonly string[] = ["low", "medium", "high", "xhigh", "max"];
/** The model that designs from photos. Reading shape from a picture is the hardest thing the agent does, so it gets the stronger model. */
export const DEFAULT_PHOTO_MODEL = "claude-opus-5-5";

/**
 * Which model and effort a message runs on. A design with a photo uses DESIGN_AGENT_PHOTO_MODEL (default Opus 5.5) at
 * DESIGN_AGENT_PHOTO_EFFORT (default high); everything else stays on DESIGN_AGENT_MODEL with the model's own default effort.
 */
export function agentModelFor(hasPhotos: boolean, env: Record<string, string | undefined> = process.env): { model: string; effort?: Effort } {
  if (!hasPhotos) return { model: env.DESIGN_AGENT_MODEL || DEFAULT_MODEL };
  const effort = (env.DESIGN_AGENT_PHOTO_EFFORT ?? "").trim().toLowerCase();
  return { model: env.DESIGN_AGENT_PHOTO_MODEL || DEFAULT_PHOTO_MODEL, effort: EFFORTS.includes(effort) ? (effort as Effort) : "high" };
}

/** Used in place of RENDER_NOTE when the independent checker has already compared the picture with the photo. */
export const PICTURE_NOTE =
  "A picture of what you just built is attached: four views on one sheet, in this order: front (top left), side (top right), top (bottom left), angled (bottom right). Use it with the likeness check above.";

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
    createdBy: "agent" | "slider";
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
  /** How hard the model thinks (output_config.effort). Left out, the model's default applies. */
  effort?: Effort;
  system: string;
  history: MessageParam[];
  anchors: AgentAnchor[];
  /** Named lengths from photos, lookups or the user. Listed to the agent, never sent to the geometry service. */
  dimensions?: AgentDimension[];
  build: BuildSpec;
  emit: (event: AgentEvent) => void;
  maxAttempts?: number;
  /** Saves messages and versions as they happen. */
  record?: Recorder;
  /** Remembers a dimension the agent recorded with `add_dimension`. */
  saveDimension?: (dimension: AgentDimension) => Promise<void>;
  /** Web searches this design may still use; 0 or undefined turns the web search tool off. */
  searchesLeft?: number;
  /** Runs one CAD tool-belt step. When set (Part Spec 4.2), the agent gets the cad_tool. */
  cadTool?: (tool: string, args: Record<string, unknown>) => Promise<CadStepResult>;
  /** Makes a picture of a built spec (base64 PNG) for the agent to compare with the photo. Left out, the agent gets no pictures. */
  render?: (spec: Record<string, unknown>, anchors: AgentAnchor[]) => Promise<string | null>;
  /** The last spec that built. The agent is shown a picture of it before it starts, and (when `startSpecIsCad`) cad_tool carries on editing it. */
  startSpec?: Record<string, unknown> | null;
  /** A separate request that compares each picture with the user's photos. Left out (no photos, or switched off), the agent compares for itself. */
  checkLikeness?: CheckLikeness;
  /** True when `startSpec` is a CAD feature tree the tool belt can keep editing. */
  startSpecIsCad?: boolean;
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
  const dimensions = [...(options.dimensions ?? [])];
  const maxAttempts = options.maxAttempts ?? MAX_BUILD_ATTEMPTS;
  const messages: MessageParam[] = [...options.history];
  const usage = emptyUsage();
  let attempts = 0;
  let bestSpec: Record<string, unknown> | null = null;
  let bestOk = false;
  let lastBuild: BuildOutcome | null = null;
  // The spec the CAD tool belt is building up. We keep it, so the model never has to repeat it.
  let working: Record<string, unknown> | null = (options.cadTool && options.startSpecIsCad && options.startSpec) || null;
  let cadSteps = 0;
  let renders = 0;
  // Asks for a picture of a spec that just built. The picture goes to the model only; it is not saved with the conversation.
  const pictureOf = async (spec: Record<string, unknown>): Promise<string | null> => {
    if (!options.render || renders >= MAX_RENDERS) return null;
    renders += 1;
    return sayPicture(await options.render(spec, anchors));
  };
  // The Activity log says whether the agent really got a picture, so a silent failure can be seen.
  const sayPicture = (picture: string | null): string | null => {
    emit({ type: "tool", name: "picture", summary: picture ? "sent to the agent" : "could not be made" });
    return picture;
  };

  // Tokens the checker used since the last model message; saved with the next one so the cost screen counts them.
  let checkerUsage = emptyUsage();
  const addUsage = (to: TokenUsage, from: TokenUsage) => {
    to.input_tokens += from.input_tokens;
    to.output_tokens += from.output_tokens;
    to.cache_creation_input_tokens += from.cache_creation_input_tokens;
    to.cache_read_input_tokens += from.cache_read_input_tokens;
  };
  const secondOpinion = async (picture: string | null): Promise<string | null> => {
    if (!picture || !options.checkLikeness) return null;
    const result = await options.checkLikeness(picture);
    const found = result?.differences.length ?? 0;
    emit({
      type: "tool",
      name: "checker",
      summary: !result ? "could not run" : result.matches ? "the shape matches the photo" : `${found} ${found === 1 ? "difference" : "differences"} from the photo`,
    });
    if (!result) return null;
    addUsage(usage, result.usage);
    addUsage(checkerUsage, result.usage);
    return describeLikeness(result);
  };

  // A follow-up message: show the agent the part as it stands (this request only; it is not saved).
  const last = messages.at(-1);
  if (options.startSpec && last?.role === "user") {
    const picture = options.render ? sayPicture(await options.render(options.startSpec, anchors)) : null;
    const note = [START_NOTE, ...(picture ? [START_PICTURE_NOTE] : []), ...(working ? [START_CAD_NOTE] : [])].join(" ");
    const before: Anthropic.Beta.BetaContentBlockParam[] = typeof last.content === "string" ? [{ type: "text", text: last.content }] : last.content;
    messages[messages.length - 1] = {
      role: "user",
      content: [
        ...before,
        { type: "text", text: note },
        ...(picture ? [{ type: "image" as const, source: { type: "base64" as const, media_type: "image/png" as const, data: picture } }] : []),
      ],
    };
  }

  // Web search is a Console setting; if the API says it is not available, carry on without it.
  let searchOn = (options.searchesLeft ?? 0) > 0;

  const params = (extra: Partial<TurnParams> = {}): TurnParams => ({
    model: options.model ?? DEFAULT_MODEL,
    // Thinking counts toward this, so leave room for it.
    max_tokens: 32000,
    ...(options.effort ? { output_config: { effort: options.effort } } : {}),
    // The system prompt is large and identical across turns, so cache it.
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    tools: [...TOOLS, ...(options.cadTool ? [CAD_TOOL] : []), ...(searchOn ? [webSearchTool(options.searchesLeft!)] : [])],
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
    let message: Message;
    try {
      message = await turn(params(extra), (delta) => emit({ type: "text", delta }));
    } catch (error) {
      if (!searchOn || !/web_search|web search/i.test(String((error as Error)?.message))) throw error;
      searchOn = false;
      message = await turn(params(extra), (delta) => emit({ type: "text", delta }));
    }
    const u = message.usage;
    usage.input_tokens += u.input_tokens;
    usage.output_tokens += u.output_tokens;
    usage.cache_creation_input_tokens += u.cache_creation_input_tokens ?? 0;
    usage.cache_read_input_tokens += u.cache_read_input_tokens ?? 0;
    emit({ type: "usage", usage: { ...usage } });
    const content = message.content as Anthropic.Beta.BetaContentBlockParam[];
    messages.push({ role: "assistant", content });
    const spent: TokenUsage = {
      input_tokens: u.input_tokens,
      output_tokens: u.output_tokens,
      cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
    };
    addUsage(spent, checkerUsage);
    checkerUsage = emptyUsage();
    await options.record?.message({ role: "assistant", content, model: message.model, usage: spent });
    return message;
  };

  for (let step = 0; step < MAX_STEPS; step++) {
    const message = await ask();
    if (message.stop_reason === "refusal") return finish("refused");
    if (message.stop_reason === "max_tokens") throw new Error("The reply was cut off. Try a shorter request.");

    // A long web search can pause the turn; sending the conversation back as it is lets it carry on.
    if (message.stop_reason === "pause_turn") continue;

    const calls = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (calls.length === 0) return finish("answered");

    const question = calls.find((c) => c.name === "ask_user");
    if (question) {
      const text = String((question.input as { question?: unknown }).question ?? "");
      emit({ type: "question", question: text });
      return finish("asked");
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    const withPictures: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      const input = (call.input ?? {}) as Record<string, unknown>;
      let content: string;
      let picture: string | null = null;
      let isError = false;
      if (call.name === "list_anchors") {
        content = JSON.stringify(dimensions.length ? { anchors, dimensions } : anchors);
        emit({
          type: "tool",
          name: call.name,
          summary: `${anchors.length} anchors${dimensions.length ? `, ${dimensions.length} dimensions` : ""}`,
        });
      } else if (call.name === "add_dimension") {
        const parsed = parseDimension(input);
        if (typeof parsed === "string") {
          content = parsed;
          isError = true;
        } else {
          await options.saveDimension?.(parsed);
          if (parsed.confidence === "published") {
            // Found online: kept as a suggestion until the user confirms it, so it cannot reach a build.
            content = `Saved ${parsed.id} = ${parsed.value_mm} mm as a suggestion from ${parsed.source_url}. It cannot be used until the user presses Confirm. Stop here and tell them what you found, with the source, and ask them to confirm or correct it; it becomes available on your next turn.`;
            emit({ type: "dimension", dimension: parsed, pending: true });
          } else {
            const at = dimensions.findIndex((d) => d.id === parsed.id);
            if (at >= 0) dimensions[at] = parsed;
            else dimensions.push(parsed);
            content = `Recorded ${parsed.id} = ${parsed.value_mm} mm (${parsed.confidence}).`;
            emit({ type: "dimension", dimension: parsed });
          }
        }
      } else if (call.name === "measure") {
        const d = distanceMm(anchors, input.from, input.to);
        isError = typeof d === "string";
        content = isError ? (d as string) : `${(d as number).toFixed(2)} mm`;
        emit({ type: "tool", name: call.name, summary: `${String(input.from)} to ${String(input.to)}` });
      } else if (call.name === "fastener_lookup") {
        content = lookupFastener(input.size, input.kind);
        isError = /^(size must|kind must|Unknown size|No data)/.test(content);
        emit({ type: "tool", name: call.name, summary: `${String(input.size)} ${String(input.kind)}` });
      } else if (call.name === "cad_tool" && options.cadTool) {
        const tool = String(input.tool ?? "");
        const args = (typeof input.arguments === "object" && input.arguments !== null && !Array.isArray(input.arguments)
          ? input.arguments
          : {}) as Record<string, unknown>;
        if (cadSteps >= MAX_CAD_STEPS) {
          content = "No CAD steps left for this message. Summarize your best result and what is left.";
          isError = true;
        } else {
          cadSteps += 1;
          if (tool === "new_part") working = null;
          const result = await options.cadTool(tool, tool === "new_part" ? args : { ...args, spec: working ?? {} });
          content = formatCadStep(result);
          isError = !result.ok;
          emit({ type: "tool", name: `cad_tool:${tool}`, summary: result.ok ? "applied" : "not applied" });
          if (result.ok && result.spec) {
            working = result.spec;
            // Once there is geometry, build it like a proposed spec so the viewer, saved versions and checks all see it.
            // Several steps in one reply are built once, after the last of them.
            if ((result.summary?.solid_count ?? 0) > 0 && call === calls.filter((c) => c.name === "cad_tool").at(-1)) {
              const outcome = await build(result.spec, anchors);
              await options.record?.version({
                spec: result.spec,
                anchors,
                ok: outcome.ok,
                errors: outcome.ok ? [] : outcome.errors,
                createdBy: "agent",
              });
              if (outcome.ok || !bestOk) {
                bestSpec = result.spec;
                bestOk = outcome.ok;
              }
              const checks = outcome.ok ? checkBuild(result.spec, outcome.size_mm, dimensions) : [];
              const notes = [...describeBuild(outcome), ...checks];
              if (notes.length) content += `\n${notes.join("\n")}`;
              if (outcome.ok) picture = await pictureOf(result.spec);
              emit({
                type: "spec",
                attempt: attempts,
                ok: outcome.ok,
                errors: outcome.ok ? [] : outcome.errors,
                spec: result.spec,
                ...(checks.length ? { checks } : {}),
              });
              if (outcome.ok) {
                emit({ type: "materials", advice: describeAdvice(recommend(assessMaterials(result.spec, outcome.size_mm))) });
              }
            }
          }
        }
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
          const checks = outcome.ok ? checkBuild(spec as Record<string, unknown>, outcome.size_mm, dimensions) : [];
          content = formatBuildOutcome(outcome, checks);
          isError = !outcome.ok;
          if (outcome.ok) picture = await pictureOf(spec as Record<string, unknown>);
          emit({
            type: "spec",
            attempt: attempts,
            ok: outcome.ok,
            errors: outcome.ok ? [] : outcome.errors,
            spec: spec as Record<string, unknown>,
            ...(checks.length ? { checks } : {}),
          });
          if (outcome.ok) {
            emit({ type: "materials", advice: describeAdvice(recommend(assessMaterials(spec as Record<string, unknown>, outcome.size_mm))) });
          }
        }
      } else {
        content = `Unknown tool ${call.name}.`;
        isError = true;
      }
      const opinion = await secondOpinion(picture);
      if (opinion) content += `\n${opinion}`;
      results.push({ type: "tool_result", tool_use_id: call.id, content, is_error: isError });
      if (picture) {
        // The model sees the picture; the saved conversation keeps only the text, so history stays small.
        withPictures.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: [
            { type: "text", text: `${content}\n${opinion ? PICTURE_NOTE : RENDER_NOTE}` },
            { type: "image", source: { type: "base64", media_type: "image/png", data: picture } },
          ],
          is_error: isError,
        });
      } else withPictures.push(results[results.length - 1]);
    }
    messages.push({ role: "user", content: withPictures });
    await options.record?.message({ role: "user", content: results });

    // Out of attempts with no working spec: one last reply, without tools, listing what is left.
    if (attempts >= maxAttempts && lastBuild && !lastBuild.ok) {
      await ask({ tool_choice: { type: "none" } });
      return finish("attempts_exhausted");
    }
  }
  return finish("step_limit");
}

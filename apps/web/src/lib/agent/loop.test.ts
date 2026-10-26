import { describe, expect, it } from "vitest";
import { FIXTURE_ANCHORS } from "./fixture-anchors";
import { MAX_BUILD_ATTEMPTS, runAgent, type RunTurn } from "./loop";
import type { AgentDimension, AgentEvent, BuildSpec } from "./types";

type Block = Record<string, unknown>;

const usage = { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 2 };
const reply = (content: Block[], stop_reason = "tool_use") => ({ content, stop_reason, usage });
const call = (id: string, name: string, input: Block = {}) => ({ type: "tool_use", id, name, input });
const text = (t: string) => ({ type: "text", text: t });

/** A model that plays back a script, recording every request it was sent. */
function scripted(replies: ReturnType<typeof reply>[]) {
  const requests: Block[] = [];
  let i = 0;
  const turn = (async (params: unknown, onText: (d: string) => void) => {
    requests.push(JSON.parse(JSON.stringify(params)));
    const r = replies[i++];
    for (const b of r.content) if (b.type === "text") onText(String(b.text));
    return r;
  }) as unknown as RunTurn;
  return { turn, requests };
}

const run = (replies: ReturnType<typeof reply>[], build: BuildSpec, maxAttempts?: number, dimensions?: AgentDimension[]) => {
  const model = scripted(replies);
  const events: AgentEvent[] = [];
  const result = runAgent({
    turn: model.turn,
    system: "sys",
    history: [{ role: "user", content: "make a bracket" }],
    anchors: FIXTURE_ANCHORS,
    dimensions,
    build,
    emit: (e) => events.push(e),
    maxAttempts,
  });
  return { result, events, requests: model.requests };
};

const ok: BuildSpec = async () => ({ ok: true });
const bad: BuildSpec = async () => ({ ok: false, errors: ["hole 'h' is outside plate 'base'"] });

describe("runAgent", () => {
  it("answers without tools", async () => {
    const { result, events } = run([reply([text("Hi")], "end_turn")], ok);
    expect((await result).outcome).toBe("answered");
    expect(events.some((e) => e.type === "text")).toBe(true);
  });

  it("uses list_anchors and measure, then builds a spec", async () => {
    const { result, requests } = run(
      [
        reply([call("a", "list_anchors"), call("b", "measure", { from: "hole_a", to: "hole_b" })]),
        reply([call("c", "propose_spec", { spec: { name: "x" } })]),
        reply([text("Done")], "end_turn"),
      ],
      ok,
    );
    const r = await result;
    expect(r.outcome).toBe("answered");
    expect(r.attempts).toBe(1);
    expect(r.bestSpec).toEqual({ name: "x" });
    const results = (requests[1].messages as Block[]).at(-1)?.content as Block[];
    expect(results.map((b) => b.content)).toEqual([JSON.stringify(FIXTURE_ANCHORS), "80.00 mm"]);
    expect(results.every((b) => b.is_error === false)).toBe(true);
  });

  it("feeds builder errors back so the agent can fix the spec", async () => {
    let n = 0;
    const flaky: BuildSpec = async () => (n++ === 0 ? bad(null as never, []) : ok(null as never, []));
    const { result, requests } = run(
      [
        reply([call("a", "propose_spec", { spec: { v: 1 } })]),
        reply([call("b", "propose_spec", { spec: { v: 2 } })]),
        reply([text("Fixed")], "end_turn"),
      ],
      flaky,
    );
    const r = await result;
    expect(r.attempts).toBe(2);
    expect(r.bestSpec).toEqual({ v: 2 });
    const first = (requests[1].messages as Block[]).at(-1)?.content as Block[];
    expect(first[0].is_error).toBe(true);
    expect(String(first[0].content)).toContain("outside plate 'base'");
  });

  it("stops after the attempt limit and asks for a summary without tools", async () => {
    const replies = Array.from({ length: MAX_BUILD_ATTEMPTS }, (_, i) =>
      reply([call(`c${i}`, "propose_spec", { spec: { v: i } })]),
    );
    replies.push(reply([text("Best effort, with issues")], "end_turn"));
    const { result, requests } = run(replies, bad);
    const r = await result;
    expect(r.outcome).toBe("attempts_exhausted");
    expect(r.attempts).toBe(MAX_BUILD_ATTEMPTS);
    expect(requests.at(-1)?.tool_choice).toEqual({ type: "none" });
  });

  it("ends the turn when the agent asks the user", async () => {
    const { result, events } = run([reply([call("q", "ask_user", { question: "Which material?" })])], ok);
    expect((await result).outcome).toBe("asked");
    expect(events).toContainEqual({ type: "question", question: "Which material?" });
  });

  it("reports a refusal", async () => {
    const { result } = run([reply([], "refusal")], ok);
    expect((await result).outcome).toBe("refused");
  });

  it("adds up token counts", async () => {
    const { result } = run([reply([call("a", "list_anchors")]), reply([text("ok")], "end_turn")], ok);
    expect((await result).usage).toEqual({
      input_tokens: 20,
      output_tokens: 10,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 4,
    });
  });

  it("lists dimensions beside anchors, and keeps them out of builds", async () => {
    const dims: AgentDimension[] = [{ id: "vase_height", value_mm: 200, source: "photo", confidence: "estimated" }];
    let sentAnchors: unknown;
    const build: BuildSpec = async (_spec, anchors) => {
      sentAnchors = anchors;
      return { ok: true };
    };
    const { result, requests } = run(
      [
        reply([call("a", "list_anchors"), call("b", "propose_spec", { spec: { name: "v" } })]),
        reply([text("ok")], "end_turn"),
      ],
      build,
      undefined,
      dims,
    );
    await result;
    const toolResults = (requests[1].messages as { content: Block[] }[]).at(-1)!.content;
    expect(JSON.parse(String(toolResults[0].content))).toEqual({ anchors: FIXTURE_ANCHORS, dimensions: dims });
    expect(sentAnchors).toEqual(FIXTURE_ANCHORS);
  });

  it("records a dimension the agent adds, saves it, and lists it afterwards", async () => {
    const saved: AgentDimension[] = [];
    const model = scripted([
      reply([
        call("a", "add_dimension", { id: "vase_height", value_mm: 200, confidence: "estimated", note: "scaled from the coin" }),
        call("b", "add_dimension", { id: "Bad Id", value_mm: 5, confidence: "stated", note: "x" }),
        call("c", "list_anchors"),
      ]),
      reply([text("ok")], "end_turn"),
    ]);
    const events: AgentEvent[] = [];
    await runAgent({
      turn: model.turn,
      system: "sys",
      history: [{ role: "user", content: "make a vase" }],
      anchors: FIXTURE_ANCHORS,
      build: async () => ({ ok: true }),
      emit: (e) => events.push(e),
      saveDimension: async (d) => void saved.push(d),
    });
    expect(saved).toEqual([
      { id: "vase_height", value_mm: 200, source: "photo", confidence: "estimated", note: "scaled from the coin" },
    ]);
    expect(events.filter((e) => e.type === "dimension")).toHaveLength(1);
    const results = (model.requests[1].messages as { content: Block[] }[]).at(-1)!.content;
    expect(results[0].content).toContain("Recorded vase_height = 200 mm");
    expect(results[1].is_error).toBe(true);
    expect(String(results[2].content)).toContain("vase_height");
  });

  it("keeps a found value pending: saved, flagged, and not listed to the agent", async () => {
    const saved: AgentDimension[] = [];
    const model = scripted([
      reply([
        call("a", "add_dimension", { id: "case_width", value_mm: 74.5, confidence: "published", note: "spec sheet", source_url: "https://example.com/spec" }),
        call("b", "add_dimension", { id: "case_height", value_mm: 150, confidence: "published", note: "spec sheet" }),
        call("c", "list_anchors"),
      ]),
      reply([text("Please confirm.")], "end_turn"),
    ]);
    const events: AgentEvent[] = [];
    await runAgent({
      turn: model.turn,
      system: "sys",
      history: [{ role: "user", content: "case for the X100" }],
      anchors: FIXTURE_ANCHORS,
      build: async () => ({ ok: true }),
      emit: (e) => events.push(e),
      saveDimension: async (d) => void saved.push(d),
    });
    expect(saved.map((d) => d.id)).toEqual(["case_width"]);
    expect(events.find((e) => e.type === "dimension")).toMatchObject({ pending: true });
    const results = (model.requests[1].messages as { content: Block[] }[]).at(-1)!.content;
    expect(String(results[0].content)).toContain("cannot be used until the user presses Confirm");
    expect(results[1].is_error).toBe(true);
    expect(String(results[1].content)).toContain("source_url");
    expect(JSON.parse(String(results[2].content))).toEqual(FIXTURE_ANCHORS);
  });

  it("offers web search only while searches are left, and carries on after a paused turn", async () => {
    const model = scripted([reply([text("working")], "pause_turn"), reply([text("done")], "end_turn")]);
    await runAgent({
      turn: model.turn,
      system: "sys",
      history: [{ role: "user", content: "x" }],
      anchors: FIXTURE_ANCHORS,
      build: async () => ({ ok: true }),
      emit: () => {},
      searchesLeft: 3,
    });
    expect(model.requests).toHaveLength(2);
    for (const r of model.requests) {
      expect(r.tools).toContainEqual({ type: "web_search_20250305", name: "web_search", max_uses: 3 });
    }
    const off = scripted([reply([text("ok")], "end_turn")]);
    await runAgent({
      turn: off.turn,
      system: "sys",
      history: [{ role: "user", content: "x" }],
      anchors: FIXTURE_ANCHORS,
      build: async () => ({ ok: true }),
      emit: () => {},
      searchesLeft: 0,
    });
    expect(JSON.stringify(off.requests[0].tools)).not.toContain("web_search");
  });

  it("drops web search and retries if the API says the tool is not available", async () => {
    let calls = 0;
    const requests: Block[] = [];
    const turn = (async (params: unknown) => {
      requests.push(JSON.parse(JSON.stringify(params)));
      if (calls++ === 0) throw new Error("400 web_search tool is not enabled for this organization");
      return reply([text("ok")], "end_turn");
    }) as unknown as RunTurn;
    const run = await runAgent({
      turn,
      system: "sys",
      history: [{ role: "user", content: "x" }],
      anchors: FIXTURE_ANCHORS,
      build: async () => ({ ok: true }),
      emit: () => {},
      searchesLeft: 5,
    });
    expect(run.outcome).toBe("answered");
    expect(JSON.stringify(requests[0].tools)).toContain("web_search");
    expect(JSON.stringify(requests[1].tools)).not.toContain("web_search");
  });

  it("reports dimension and wall check results to the agent and the chat after a build", async () => {
    const dims: AgentDimension[] = [
      { id: "vase_height", value_mm: 200, source: "user", confidence: "stated", measures: "overall_height" },
    ];
    const build: BuildSpec = async () => ({ ok: true, size_mm: [80, 80, 195] });
    const { result, events, requests } = run(
      [reply([call("a", "propose_spec", { spec: { name: "v", features: [] } })]), reply([text("fixing")], "end_turn")],
      build,
      undefined,
      dims,
    );
    await result;
    const results = (requests[1].messages as { content: Block[] }[]).at(-1)!.content;
    expect(String(results[0].content)).toContain("Dimension check: 'vase_height'");
    expect(String(results[0].content)).toContain("5.0 mm too small");
    expect(results[0].is_error).toBe(false);
    expect(events.find((e) => e.type === "spec")).toMatchObject({ ok: true, checks: [expect.stringContaining("vase_height")] });
  });

  it("returns an error result for unknown anchors and non-object specs", async () => {
    const { result, requests } = run(
      [
        reply([call("a", "measure", { from: "nope", to: "hole_b" }), call("b", "propose_spec", { spec: "text" })]),
        reply([text("ok")], "end_turn"),
      ],
      ok,
    );
    await result;
    const results = (requests[1].messages as Block[]).at(-1)?.content as Block[];
    expect(results.map((b) => b.is_error)).toEqual([true, true]);
  });
});

import { describe, expect, it } from "vitest";
import { FIXTURE_ANCHORS } from "./fixture-anchors";
import { agentModelFor, DEFAULT_MODEL, DEFAULT_PHOTO_MODEL, MAX_BUILD_ATTEMPTS, MAX_RENDERS, NO_VIEW_NOTE, PICTURE_NOTE, RENDER_NOTE, runAgent, START_CAD_NOTE, START_NOTE, START_PICTURE_NOTE, type RunTurn } from "./loop";
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

  it("gives material advice after a build that worked, and not after one that failed", async () => {
    const thin = { features: [{ id: "v", type: "body", shell: { wall_thickness_mm: 1, open: "top" } }] };
    const built = run([reply([call("a", "propose_spec", { spec: thin })]), reply([text("Done")], "end_turn")], ok);
    await built.result;
    const advice = built.events.filter((e) => e.type === "materials");
    expect(advice).toHaveLength(1);
    expect(JSON.stringify(advice[0])).toContain("PLA (FDM): walls of 1 mm");
    const failed = run([reply([call("a", "propose_spec", { spec: thin })]), reply([text("Stuck")], "end_turn")], bad);
    await failed.result;
    expect(failed.events.some((e) => e.type === "materials")).toBe(false);
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

describe("runAgent with the CAD tool belt", () => {
  const stepOk = (spec: Record<string, unknown>, solids = 0) => ({
    ok: true,
    spec,
    summary: { features: [{}], free_solids: solids ? ["body"] : [], solid_count: solids },
  });

  function withCad(replies: ReturnType<typeof reply>[], cadTool: NonNullable<Parameters<typeof runAgent>[0]["cadTool"]>, build: BuildSpec = ok) {
    const model = scripted(replies);
    const events: AgentEvent[] = [];
    const versions: Record<string, unknown>[] = [];
    const result = runAgent({
      turn: model.turn,
      system: "sys",
      history: [{ role: "user", content: "make a cup" }],
      anchors: FIXTURE_ANCHORS,
      build,
      cadTool,
      emit: (e) => events.push(e),
      record: { message: async () => {}, version: async (v) => void versions.push(v.spec) },
    });
    return { result, events, requests: model.requests, versions };
  }

  it("offers cad_tool only when a cadTool is given", async () => {
    const plain = run([reply([text("Hi")], "end_turn")], ok);
    await plain.result;
    expect((plain.requests[0].tools as Block[]).some((t) => t.name === "cad_tool")).toBe(false);
    const cad = withCad([reply([text("Hi")], "end_turn")], async () => stepOk({}));
    await cad.result;
    expect((cad.requests[0].tools as Block[]).some((t) => t.name === "cad_tool")).toBe(true);
  });

  it("keeps the working spec between steps and builds once geometry exists", async () => {
    const seen: Record<string, unknown>[] = [];
    const cadTool = async (tool: string, args: Record<string, unknown>) => {
      seen.push({ tool, ...args });
      if (tool === "new_part") return stepOk({ name: "cup", features: [] });
      return stepOk({ name: "cup", features: [{ id: tool }] }, tool === "extrude" ? 1 : 0);
    };
    const { result, events, versions } = withCad(
      [
        reply([call("a", "cad_tool", { tool: "new_part", arguments: { name: "cup" } })]),
        reply([call("b", "cad_tool", { tool: "add_sketch", arguments: { id: "sk" } })]),
        reply([call("c", "cad_tool", { tool: "extrude", arguments: { id: "body" } })]),
        reply([text("Done")], "end_turn"),
      ],
      cadTool,
    );
    const r = await result;
    expect(r.outcome).toBe("answered");
    expect(r.attempts).toBe(0);
    expect(seen[1]).toMatchObject({ tool: "add_sketch", spec: { name: "cup", features: [] } });
    expect(seen[2]).toMatchObject({ tool: "extrude", spec: { features: [{ id: "add_sketch" }] } });
    expect(versions).toHaveLength(1);
    expect(r.bestSpec).toEqual({ name: "cup", features: [{ id: "extrude" }] });
    expect(events.filter((e) => e.type === "spec")).toHaveLength(1);
  });

  it("tells the model when a step is rejected and leaves the working spec alone", async () => {
    const specs: unknown[] = [];
    const cadTool = async (tool: string, args: Record<string, unknown>) => {
      specs.push(args.spec);
      return tool === "extrude" ? { ok: false, errors: ["'nope' is not a sketch"] } : stepOk({ features: ["kept"] });
    };
    const { result, requests } = withCad(
      [
        reply([call("a", "cad_tool", { tool: "add_sketch", arguments: { id: "sk" } })]),
        reply([call("b", "cad_tool", { tool: "extrude", arguments: { id: "e", sketch: "nope" } })]),
        reply([call("c", "cad_tool", { tool: "inspect_part" })]),
        reply([text("Stuck")], "end_turn"),
      ],
      cadTool,
    );
    await result;
    const rejected = (requests[2].messages as Block[]).at(-1)?.content as Block[];
    expect(rejected[0]).toMatchObject({ is_error: true });
    expect(String(rejected[0].content)).toContain("'nope' is not a sketch");
    expect(specs[2]).toEqual({ features: ["kept"] });
  });

  it("builds only after the last step when several come in one reply", async () => {
    let builds = 0;
    const { result } = withCad(
      [
        reply([call("a", "cad_tool", { tool: "extrude", arguments: {} }), call("b", "cad_tool", { tool: "hollow", arguments: {} })]),
        reply([text("Done")], "end_turn"),
      ],
      async () => stepOk({ features: [] }, 1),
      async () => {
        builds += 1;
        return { ok: true };
      },
    );
    await result;
    expect(builds).toBe(1);
  });
});


describe("pictures of the agent's own result", () => {
  const specCalls = (n: number) => Array.from({ length: n }, (_, i) => reply([call(`c${i}`, "propose_spec", { spec: { name: "x" } })]));

  function withRender(render: (() => Promise<string | null>) | undefined, n: number) {
    const model = scripted([...specCalls(n), reply([text("Done")], "end_turn")]);
    const saved: unknown[] = [];
    const result = runAgent({
      turn: model.turn,
      system: "sys",
      history: [{ role: "user", content: "make a wing" }],
      anchors: FIXTURE_ANCHORS,
      build: ok,
      emit: () => {},
      ...(render ? { render } : {}),
      record: { message: async (m) => void saved.push(m), version: async () => {} },
    });
    return { result, requests: model.requests, saved };
  }

  const lastResult = (request: Block) => {
    const messages = request.messages as { content: Block[] }[];
    return (messages.at(-1)!.content[0] as { content: unknown }).content;
  };

  it("sends the model a picture and a comparison note after a good build", async () => {
    const { result, requests } = withRender(async () => "UE5H", 1);
    await result;
    const content = lastResult(requests[1]) as Block[];
    expect(content[0]).toMatchObject({ type: "text" });
    expect(String(content[0].text)).toContain(RENDER_NOTE);
    expect(content[1]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/png", data: "UE5H" } });
  });

  it("keeps pictures out of the saved conversation", async () => {
    const { result, saved } = withRender(async () => "UE5H", 1);
    await result;
    expect(JSON.stringify(saved)).not.toContain("UE5H");
  });

  it("gives plain text when there is no renderer or it returns nothing", async () => {
    const none = withRender(undefined, 1);
    await none.result;
    expect(typeof lastResult(none.requests[1])).toBe("string");
    const failed = withRender(async () => null, 1);
    await failed.result;
    expect(typeof lastResult(failed.requests[1])).toBe("string");
  });

  it("stops asking for pictures after the per-message limit", async () => {
    let calls = 0;
    const { result } = withRender(async () => (calls++, "UE5H"), MAX_RENDERS + 2);
    await result;
    expect(calls).toBe(MAX_RENDERS);
  });
});

describe("a follow-up message starts from the part as it stands", () => {
  const current = { spec_version: "4.3", name: "wing", features: [] };

  function followUp(extra: Partial<Parameters<typeof runAgent>[0]>, replies = [reply([text("Done")], "end_turn")]) {
    const model = scripted(replies);
    const events: AgentEvent[] = [];
    const cadCalls: Block[] = [];
    const result = runAgent({
      turn: model.turn,
      system: "sys",
      history: [
        { role: "user", content: "make a wing" },
        { role: "assistant", content: "Done" },
        { role: "user", content: "make the end plates curve inward" },
      ],
      anchors: FIXTURE_ANCHORS,
      build: ok,
      emit: (e) => events.push(e),
      startSpec: current,
      cadTool: async (tool, args) => (cadCalls.push({ tool, args }), { ok: true, spec: { ...current, features: [{ id: "f" }] } }),
      ...extra,
    });
    return { result, requests: model.requests, events, cadCalls };
  }
  const lastUser = (request: Block) => (request.messages as { content: Block[] }[]).at(-1)!.content;

  it("shows the agent a picture of the current part and says so in the activity log", async () => {
    const { result, requests, events } = followUp({ render: async () => "UE5H" });
    await result;
    const content = lastUser(requests[0]);
    expect(content[0]).toMatchObject({ type: "text", text: "make the end plates curve inward" });
    expect(String(content[1].text)).toContain(START_NOTE);
    expect(String(content[1].text)).toContain(START_PICTURE_NOTE);
    expect(content[2]).toMatchObject({ type: "image", source: { data: "UE5H" } });
    expect(events).toContainEqual({ type: "tool", name: "picture", summary: "sent to the agent" });
  });

  it("reports a picture that could not be made and still sends the note", async () => {
    const { result, requests, events } = followUp({ render: async () => null });
    await result;
    const content = lastUser(requests[0]);
    expect(content).toHaveLength(2);
    expect(String(content[1].text)).not.toContain(START_PICTURE_NOTE);
    expect(events).toContainEqual({ type: "tool", name: "picture", summary: "could not be made" });
  });

  it("lets cad_tool carry on from the current CAD spec, and not from an older kind of spec", async () => {
    const step = [reply([call("a", "cad_tool", { tool: "fillet_edges", arguments: { id: "r" } })]), reply([text("Done")], "end_turn")];
    const cad = followUp({ startSpecIsCad: true }, step);
    await cad.result;
    expect(String(lastUser(cad.requests[0])[1].text)).toContain(START_CAD_NOTE);
    expect((cad.cadCalls[0].args as Block).spec).toEqual(current);
    const old = followUp({}, step);
    await old.result;
    expect(String(lastUser(old.requests[0])[1].text)).not.toContain(START_CAD_NOTE);
    expect((old.cadCalls[0].args as Block).spec).toEqual({});
  });

  it("does not count the starting picture against the per-message limit", async () => {
    let calls = 0;
    const builds = Array.from({ length: MAX_RENDERS }, (_, i) => reply([call(`c${i}`, "propose_spec", { spec: { name: "x" } })]));
    const { result } = followUp({ render: async () => (calls++, "UE5H") }, [...builds, reply([text("Done")], "end_turn")]);
    await result;
    expect(calls).toBe(MAX_RENDERS + 1);
  });
});

describe("agentModelFor", () => {
  it("keeps the usual model without photos and leaves effort to the model", () => {
    expect(agentModelFor(false, {})).toEqual({ model: DEFAULT_MODEL });
    expect(agentModelFor(false, { DESIGN_AGENT_MODEL: "m" })).toEqual({ model: "m" });
  });
  it("uses the stronger model at high effort for a design with a photo", () => {
    expect(agentModelFor(true, {})).toEqual({ model: DEFAULT_PHOTO_MODEL, effort: "high" });
    expect(agentModelFor(true, { DESIGN_AGENT_PHOTO_MODEL: "claude-sonnet-5-5", DESIGN_AGENT_PHOTO_EFFORT: "XHigh" })).toEqual({ model: "claude-sonnet-5-5", effort: "xhigh" });
    expect(agentModelFor(true, { DESIGN_AGENT_PHOTO_EFFORT: "lots" }).effort).toBe("high");
  });
  it("sends the effort with the request only when one is set", async () => {
    const withEffort = scripted([reply([text("Hi")], "end_turn")]);
    await runAgent({ turn: withEffort.turn, system: "s", history: [{ role: "user", content: "x" }], anchors: [], build: ok, emit: () => {}, effort: "high" });
    expect(withEffort.requests[0].output_config).toEqual({ effort: "high" });
    const without = scripted([reply([text("Hi")], "end_turn")]);
    await runAgent({ turn: without.turn, system: "s", history: [{ role: "user", content: "x" }], anchors: [], build: ok, emit: () => {} });
    expect(without.requests[0].output_config).toBeUndefined();
  });
});

describe("the independent likeness check", () => {
  const checkUsage = { input_tokens: 1000, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

  function checked(check: Parameters<typeof runAgent>[0]["checkLikeness"], render: () => Promise<string | null> = async () => "UE5H") {
    const model = scripted([reply([call("c", "propose_spec", { spec: { name: "x" } })]), reply([text("Done")], "end_turn")]);
    const events: AgentEvent[] = [];
    const saved: { role: string; content: unknown; usage?: unknown }[] = [];
    const result = runAgent({
      turn: model.turn,
      system: "sys",
      history: [{ role: "user", content: "make a wing" }],
      anchors: FIXTURE_ANCHORS,
      build: ok,
      emit: (e) => events.push(e),
      render,
      checkLikeness: check,
      record: { message: async (m) => void saved.push(m), version: async () => {} },
    });
    return { result, requests: model.requests, events, saved };
  }
  const toolResult = (request: Block) => ((request.messages as { content: Block[] }[]).at(-1)!.content[0] as { content: Block[] | string }).content;

  it("gives the builder the checker's differences with the picture and keeps them in the saved conversation", async () => {
    const { result, requests, events, saved } = checked(async () => ({ matches: false, differences: ["End plates are flat."], usage: checkUsage }));
    const r = await result;
    const content = toolResult(requests[1]) as Block[];
    expect(String(content[0].text)).toContain("1. End plates are flat.");
    expect(String(content[0].text)).toContain(PICTURE_NOTE);
    expect(String(content[0].text)).not.toContain(RENDER_NOTE);
    expect(JSON.stringify(saved.find((m) => m.role === "user"))).toContain("End plates are flat.");
    expect(events).toContainEqual({ type: "tool", name: "checker", summary: "1 difference from the photo" });
    // The checker's tokens are counted in the total and saved with the next model message.
    expect(r.usage.input_tokens).toBe(10 + 10 + 1000);
    expect(saved.filter((m) => m.role === "assistant").map((m) => (m.usage as { input_tokens: number }).input_tokens)).toEqual([10, 1010]);
  });

  it("says so when the shape matches", async () => {
    const { result, events } = checked(async () => ({ matches: true, differences: [], usage: checkUsage }));
    await result;
    expect(events).toContainEqual({ type: "tool", name: "checker", summary: "the shape matches the photo" });
  });

  it("falls back to the agent comparing for itself when the checker cannot run", async () => {
    const { result, requests, events } = checked(async () => null);
    await result;
    expect(String((toolResult(requests[1]) as Block[])[0].text)).toContain(RENDER_NOTE);
    expect(events).toContainEqual({ type: "tool", name: "checker", summary: "could not run" });
  });

  it("does not run without a picture", async () => {
    let calls = 0;
    const { result } = checked(async () => (calls++, null), async () => null);
    await result;
    expect(calls).toBe(0);
  });
});

describe("the photo's viewpoint", () => {
  const photo = { mediaType: "image/jpeg" as const, base64: "PHOTO" };

  function viewed(replies: ReturnType<typeof reply>[], extra: Partial<Parameters<typeof runAgent>[0]> = {}) {
    const model = scripted(replies);
    const events: AgentEvent[] = [];
    const views: unknown[] = [];
    const result = runAgent({
      turn: model.turn,
      system: "sys",
      history: [{ role: "user", content: "make this wing" }],
      anchors: FIXTURE_ANCHORS,
      build: ok,
      emit: (e) => events.push(e),
      render: async (_spec, _anchors, view) => (views.push(view ?? null), { data: "UE5H", scaleBarMm: 200, fromPhotoView: !!view }),
      photos: [photo],
      ...extra,
    });
    return { result, requests: model.requests, events, views };
  }
  const build = reply([call("c", "propose_spec", { spec: { name: "x" } })]);
  const done = reply([text("Done")], "end_turn");
  const resultOf = (request: Block) => ((request.messages as { content: Block[] }[]).at(-1)!.content[0] as { content: Block[] }).content;

  it("draws later pictures from the view the agent set, and puts the photo beside the part", async () => {
    const { result, requests, views, events } = viewed([reply([call("v", "set_photo_view", { azimuth_deg: 215, elevation_deg: 20 })]), build, done]);
    await result;
    expect(views).toEqual([{ azimuth_deg: 215, elevation_deg: 20 }]);
    const content = resultOf(requests[2]);
    expect(String(content[0].text)).toContain("the photo's viewpoint");
    expect(String(content[0].text)).toContain("200 mm");
    expect(String(content[0].text)).not.toContain(NO_VIEW_NOTE);
    expect(content.filter((b) => b.type === "image").map((b) => (b.source as { data: string }).data)).toEqual(["PHOTO", "UE5H"]);
    expect(events).toContainEqual({ type: "tool", name: "picture", summary: "sent to the agent, with the photo's viewpoint" });
  });

  it("reminds the agent to set the view when there is a photo and no view yet", async () => {
    const { result, requests, views } = viewed([build, done]);
    await result;
    expect(views).toEqual([null]);
    expect(String(resultOf(requests[1])[0].text)).toContain(NO_VIEW_NOTE);
  });

  it("starts from a view saved in an earlier message, and rejects a bad one", async () => {
    const { result, requests, views } = viewed([reply([call("v", "set_photo_view", { azimuth_deg: 10, elevation_deg: 400 })]), build, done], {
      photoView: { azimuth_deg: 40, elevation_deg: 30 },
    });
    await result;
    expect((requests[1].messages as { content: Block[] }[]).at(-1)!.content[0]).toMatchObject({ is_error: true });
    expect(views).toEqual([{ azimuth_deg: 40, elevation_deg: 30 }]);
  });
});

import { describe, expect, it } from "vitest";
import { applyEvent, initialChat, openDesign, parseLines, sendMessage } from "./chat-state";
import type { AgentEvent } from "./types";

const play = (events: AgentEvent[]) => events.reduce(applyEvent, sendMessage(initialChat, "make a plate"));

describe("check notes", () => {
  it("shows build check results right after the attempt", () => {
    const state = applyEvent(initialChat, {
      type: "spec",
      attempt: 1,
      ok: true,
      errors: [],
      spec: {},
      checks: ["Dimension check: 'h' is off"],
    });
    expect(state.items.map((i) => i.kind === "status" && i.text)).toEqual(["Attempt 1: the part built", "Dimension check: 'h' is off"]);
  });
});

describe("dimension events", () => {
  it("asks the user to confirm a value found online", () => {
    const state = applyEvent(initialChat, {
      type: "dimension",
      pending: true,
      dimension: { id: "case_width", value_mm: 74.5, source: "researched", source_url: "https://example.com/s", confidence: "published" },
    });
    expect(state.items.at(-1)).toMatchObject({ kind: "status", text: expect.stringContaining("Please confirm") });
  });

  it("shows a noted dimension with where it came from", () => {
    const state = applyEvent(initialChat, {
      type: "dimension",
      dimension: { id: "vase_height", value_mm: 200, source: "photo", confidence: "estimated" },
    });
    expect(state.items.at(-1)).toEqual({ kind: "status", text: "Noted vase_height = 200 mm (estimated from the photo)" });
  });
});

describe("chat state", () => {
  it("joins streamed text into one assistant message and ends not busy", () => {
    const s = play([
      { type: "design", design_id: "d1" },
      { type: "text", delta: "Hello " },
      { type: "text", delta: "there" },
      { type: "done", outcome: "answered", attempts: 0 },
    ]);
    expect(s.designId).toBe("d1");
    expect(s.busy).toBe(false);
    expect(s.items).toEqual([
      { kind: "user", text: "make a plate" },
      { kind: "assistant", text: "Hello there" },
    ]);
  });

  it("shows failed attempts with their errors and counts built ones", () => {
    const spec = { name: "x" };
    const s = play([
      { type: "spec", attempt: 1, ok: false, errors: ["hole 'h' is outside plate 'base'"], spec },
      { type: "spec", attempt: 2, ok: true, errors: [], spec },
    ]);
    expect(s.builtCount).toBe(1);
    expect(s.items.slice(1).map((i) => i.kind === "status" && i.text)).toEqual([
      "Attempt 1: 1 problem, fixing: hole 'h' is outside plate 'base'",
      "Attempt 2: the part built",
    ]);
  });

  it("shows questions, errors and the stop notes", () => {
    expect(play([{ type: "question", question: "Which material?" }]).items.at(-1)).toEqual({
      kind: "assistant",
      text: "Which material?",
    });
    const failed = play([{ type: "error", message: "Try again" }]);
    expect(failed.busy).toBe(false);
    expect(failed.items.at(-1)).toEqual({ kind: "error", text: "Try again" });
    expect(play([{ type: "done", outcome: "refused", attempts: 0 }]).items.at(-1)).toMatchObject({ kind: "status" });
  });
});

describe("parseLines", () => {
  it("keeps a partial last line for the next chunk and skips bad lines", () => {
    const first = parseLines('{"type":"text","delta":"a"}\nnot json\n{"type":"te');
    expect(first.events).toEqual([{ type: "text", delta: "a" }]);
    const second = parseLines(first.rest + 'xt","delta":"b"}\n');
    expect(second.events).toEqual([{ type: "text", delta: "b" }]);
    expect(second.rest).toBe("");
  });
});

describe("materials event", () => {
  it("shows the advice as a status line", () => {
    const state = applyEvent(initialChat, { type: "materials", advice: "Materials that suit this part: PETG." });
    expect(state.items).toEqual([{ kind: "status", text: "Materials that suit this part: PETG." }]);
  });
});

describe("openDesign", () => {
  it("replaces the page with a saved conversation", () => {
    const state = openDesign("d1", [{ kind: "user", text: "hi" }]);
    expect(state).toEqual({ designId: "d1", items: [{ kind: "user", text: "hi" }], builtCount: 0, busy: false });
  });
});

import { describe, expect, it } from "vitest";
import { itemsFromHistory } from "./transcript";

describe("itemsFromHistory", () => {
  it("rebuilds the visible conversation and leaves tool traffic out", () => {
    const items = itemsFromHistory([
      { role: "user", content: "a shift knob" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Which thread?" },
          { type: "tool_use", id: "q1", name: "ask_user", input: { question: "Which thread size?" } },
        ],
      },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "q1", content: "M10x1.5" }] },
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "p1", name: "propose_spec", input: { spec: {} } }],
      },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "p1", content: "Built." }] },
    ]);
    expect(items).toEqual([
      { kind: "user", text: "a shift knob" },
      { kind: "assistant", text: "Which thread?" },
      { kind: "assistant", text: "Which thread size?" },
      { kind: "user", text: "M10x1.5" },
    ]);
  });

  it("skips an interrupted question that was closed as skipped", () => {
    const items = itemsFromHistory([
      { role: "assistant", content: [{ type: "tool_use", id: "q1", name: "ask_user", input: { question: "Size?" } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "q1", content: "Skipped", is_error: true }] },
    ]);
    expect(items).toEqual([{ kind: "assistant", text: "Size?" }]);
  });

  it("joins the text blocks that web-search citations split a reply into", () => {
    const items = itemsFromHistory([
      {
        role: "assistant",
        content: [
          { type: "text", text: "Listings disagree. " },
          { type: "text", text: "One says stainless", citations: [{}] },
          { type: "text", text: ", and " },
          { type: "text", text: "another says ductile iron", citations: [{}] },
          { type: "text", text: ". Either way, nylon would fail." },
          { type: "tool_use", id: "q1", name: "ask_user", input: { question: "Use metal?" } },
        ],
      },
    ]);
    expect(items).toEqual([
      {
        kind: "assistant",
        text: "Listings disagree. One says stainless, and another says ductile iron. Either way, nylon would fail.",
      },
      { kind: "assistant", text: "Use metal?" },
    ]);
  });
});

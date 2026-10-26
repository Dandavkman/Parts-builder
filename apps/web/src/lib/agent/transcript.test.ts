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
});

import { describe, expect, it } from "vitest";
import { parseChatText, parseSpans } from "./chat-text";

describe("parseSpans", () => {
  it("marks **bold** and keeps the rest plain", () => {
    expect(parseSpans("The **Tapping:** hole is **8.8 mm**.")).toEqual([
      { text: "The ", bold: false },
      { text: "Tapping:", bold: true },
      { text: " hole is ", bold: false },
      { text: "8.8 mm", bold: true },
      { text: ".", bold: false },
    ]);
  });

  it("leaves a lone asterisk or unclosed ** alone", () => {
    expect(parseSpans("5 * 3 and **open")).toEqual([{ text: "5 * 3 and **open", bold: false }]);
  });
});

describe("parseChatText", () => {
  it("splits paragraphs and bullet lists, as in the agent's shift knob reply", () => {
    const blocks = parseChatText(
      "I made a knob.\nIt is 45 mm.\n\n- **Tapping:** tap it.\n- **Material:** PA12.\n\nTell me more.",
    );
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "list", "paragraph"]);
    const list = blocks[1];
    expect(list.type === "list" && list.items.length).toBe(2);
    const first = blocks[0];
    expect(first.type === "paragraph" && first.spans[0].text).toBe("I made a knob.\nIt is 45 mm.");
  });

  it("keeps text that is not markdown unchanged and does not treat HTML specially", () => {
    const blocks = parseChatText("<b>hi</b> & bye");
    expect(blocks).toEqual([{ type: "paragraph", spans: [{ text: "<b>hi</b> & bye", bold: false }] }]);
  });

  it("returns nothing for empty text", () => {
    expect(parseChatText("")).toEqual([]);
  });
});

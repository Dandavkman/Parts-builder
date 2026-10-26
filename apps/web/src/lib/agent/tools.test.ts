import { describe, expect, it } from "vitest";
import { countWebSearches, parseDimension, WEB_SEARCHES_PER_DESIGN } from "./tools";

describe("parseDimension", () => {
  const base = { id: "case_width", value_mm: 74.5, note: "spec sheet" };

  it("accepts stated and estimated values", () => {
    expect(parseDimension({ ...base, confidence: "stated" })).toMatchObject({ source: "user", confidence: "stated" });
    expect(parseDimension({ ...base, confidence: "estimated" })).toMatchObject({ source: "photo", confidence: "estimated" });
  });

  it("needs an https source for a published value", () => {
    const url = "https://example.com/specs/x100";
    expect(parseDimension({ ...base, confidence: "published", source_url: url })).toMatchObject({
      source: "researched",
      source_url: url,
    });
    for (const source_url of [undefined, "", "http://example.com/x", "javascript:alert(1)", "not a url"]) {
      expect(typeof parseDimension({ ...base, confidence: "published", source_url })).toBe("string");
    }
  });

  it("rejects bad ids, values and confidence", () => {
    expect(typeof parseDimension({ ...base, id: "Bad Id", confidence: "stated" })).toBe("string");
    expect(typeof parseDimension({ ...base, value_mm: 0, confidence: "stated" })).toBe("string");
    expect(typeof parseDimension({ ...base, value_mm: 6000, confidence: "stated" })).toBe("string");
    expect(typeof parseDimension({ ...base, confidence: "guess" })).toBe("string");
    expect(typeof parseDimension({ ...base, note: " ", confidence: "stated" })).toBe("string");
  });
});

describe("countWebSearches", () => {
  it("counts web searches in saved assistant messages", () => {
    const history = [
      { role: "user", content: "hi" },
      { role: "assistant", content: [{ type: "server_tool_use", name: "web_search" }, { type: "text" }] },
      { role: "assistant", content: [{ type: "server_tool_use", name: "web_search" }, { type: "tool_use", name: "add_dimension" }] },
    ];
    expect(countWebSearches(history)).toBe(2);
    expect(WEB_SEARCHES_PER_DESIGN - countWebSearches(history)).toBe(3);
    expect(countWebSearches([])).toBe(0);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIXTURE_ANCHORS } from "./fixture-anchors";
import { buildSystemPrompt, SPEC_REFERENCE } from "./prompt";
import { parseChat } from "./request";

const schemaPath = new URL(
  "../../../../../services/geometry/src/geometry/spec/part-spec.v1.schema.json",
  import.meta.url,
);

function featureTypes(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) node.forEach((n) => featureTypes(n, found));
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    const t = (o.properties as Record<string, { const?: string }> | undefined)?.type;
    if (typeof t?.const === "string") found.add(t.const);
    Object.values(o).forEach((v) => featureTypes(v, found));
  }
  return found;
}

describe("system prompt", () => {
  it("mentions every feature type in the v1 schema", () => {
    const types = featureTypes(JSON.parse(readFileSync(schemaPath, "utf8")));
    expect(types.size).toBeGreaterThanOrEqual(13);
    for (const type of types) expect(SPEC_REFERENCE).toContain(type);
  });

  it("lists the anchors and the blocked categories", () => {
    const prompt = buildSystemPrompt(FIXTURE_ANCHORS);
    for (const a of FIXTURE_ANCHORS) expect(prompt).toContain(a.id);
    expect(prompt).toMatch(/Blocked.*brakes.*suspension.*steering/s);
  });
});

describe("parseChat", () => {
  it("accepts alternating text turns ending with the user", () => {
    const messages = [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "c" },
    ];
    expect(parseChat({ messages })).toEqual(messages);
  });

  it.each([
    [null],
    [{ messages: [] }],
    [{ messages: [{ role: "assistant", content: "x" }] }],
    [{ messages: [{ role: "user", content: "" }] }],
    [{ messages: [{ role: "user", content: "x".repeat(4001) }] }],
    [{ messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] }],
  ])("rejects bad input %#", (body) => {
    expect(typeof parseChat(body)).toBe("string");
  });
});

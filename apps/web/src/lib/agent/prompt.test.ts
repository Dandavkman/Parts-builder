import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIXTURE_ANCHORS } from "./fixture-anchors";
import { PART_SPEC_V1_EXAMPLES, PART_SPEC_V1_SCHEMA } from "./generated/part-spec-v1-reference";
import { PART_SPEC_V2_EXAMPLES, PART_SPEC_V2_SCHEMA } from "./generated/part-spec-v2-reference";
import { agentSpecVersion, buildSystemPrompt, EVERYDAY_SAFETY_RULES, VEHICLE_SAFETY_RULES } from "./prompt";
import { parseRequest } from "./request";

const schemaPath = new URL(
  "../../../../../services/geometry/src/geometry/spec/part-spec.v1_1.schema.json",
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
  it("quotes the 1.1 schema and an example for every feature type", () => {
    const prompt = buildSystemPrompt(FIXTURE_ANCHORS);
    const types = featureTypes(JSON.parse(readFileSync(schemaPath, "utf8")));
    expect(types.size).toBeGreaterThanOrEqual(13);
    for (const type of types) expect(prompt).toContain(`"type":"${type}"`);
    expect(prompt).toContain(JSON.stringify(PART_SPEC_V1_SCHEMA));
    expect(prompt).toContain('"kind":"polygon"');
    expect(prompt).toContain('"kind":"circle"');
  });

  it("uses the schema and examples as they are in the repo (run pnpm generate if this fails)", () => {
    expect(PART_SPEC_V1_SCHEMA).toEqual(JSON.parse(readFileSync(schemaPath, "utf8")));
    expect(PART_SPEC_V1_EXAMPLES.length).toBeGreaterThanOrEqual(14);
  });

  it("tells the agent to look up products, cite sources and wait for confirmation", () => {
    const prompt = buildSystemPrompt(FIXTURE_ANCHORS);
    expect(prompt).toContain("Looking up measurements");
    expect(prompt).toContain("web_search");
    expect(prompt).toContain("source_url");
    expect(prompt).toContain("Do not build with a value they have not confirmed");
  });

  it("lists known dimensions with their source and confidence", () => {
    const prompt = buildSystemPrompt(FIXTURE_ANCHORS, [
      { id: "vase_height", value_mm: 200, source: "researched", source_url: "https://example.com/spec", confidence: "published" },
    ]);
    expect(prompt).toContain("vase_height = 200 mm (published, from researched, source https://example.com/spec)");
    expect(buildSystemPrompt(FIXTURE_ANCHORS)).not.toContain("Known dimensions");
  });

  it("lists the anchors and the blocked categories", () => {
    const prompt = buildSystemPrompt(FIXTURE_ANCHORS);
    for (const a of FIXTURE_ANCHORS) expect(prompt).toContain(a.id);
    expect(prompt).toMatch(/Blocked.*brakes.*suspension.*steering/s);
  });

  it("keeps the vehicle rules and adds the everyday rule set", () => {
    const prompt = buildSystemPrompt(FIXTURE_ANCHORS);
    expect(prompt).toContain(VEHICLE_SAFETY_RULES);
    expect(prompt).toContain(EVERYDAY_SAFETY_RULES);
    expect(VEHICLE_SAFETY_RULES).toContain(
      "Blocked (refuse in plain words, do not call propose_spec): brakes, suspension, steering, wheels and hubs, seat and seatbelt mounts, airbag areas, fuel system, tow points.",
    );
    expect(EVERYDAY_SAFETY_RULES).toMatch(/Blocked.*weapon.*medical.*child-restraint.*climbing/s);
    expect(EVERYDAY_SAFETY_RULES).toMatch(/Needs review.*food or drink.*mains-powered/s);
    expect(prompt).not.toMatch(/non-automotive/i);
  });
});

describe("parseRequest", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";

  it("accepts a message with or without a design", () => {
    expect(parseRequest({ message: "hi" })).toEqual({ designId: null, message: "hi", image: null });
    expect(parseRequest({ message: "hi", design_id: id })).toEqual({ designId: id, message: "hi", image: null });
  });

  it("accepts a small image and rejects bad ones", () => {
    const ok = parseRequest({ message: "hi", image: { media_type: "image/jpeg", data: "QUJD" } });
    expect(ok).toEqual({ designId: null, message: "hi", image: { mediaType: "image/jpeg", base64: "QUJD" } });
    for (const image of [
      { media_type: "image/gif", data: "QUJD" },
      { media_type: "image/png", data: "not base64!" },
      { media_type: "image/png", data: "" },
      { media_type: "image/png", data: "A".repeat(900_001) },
      { data: "QUJD" },
    ]) {
      expect(typeof parseRequest({ message: "hi", image })).toBe("string");
    }
  });

  it("explains how to scale a photo and lists reference sizes", () => {
    const prompt = buildSystemPrompt(FIXTURE_ANCHORS);
    expect(prompt).toContain("Photos and sizes");
    expect(prompt).toContain("bank or credit card 85.6 x 54.0 mm");
    expect(prompt).toContain("add_dimension");
  });

  it.each([
    [null],
    [{}],
    [{ message: "  " }],
    [{ message: 5 }],
    [{ message: "x".repeat(4001) }],
    [{ message: "hi", design_id: "not-a-uuid" }],
    [{ message: "hi", design_id: 7 }],
  ])("rejects bad input %#", (body) => {
    expect(typeof parseRequest(body)).toBe("string");
  });
});

describe("Part Spec 2.0 prompt (B1.17d)", () => {
  const v2Path = new URL("../../../../../services/geometry/src/geometry/spec/part-spec.v2.schema.json", import.meta.url);

  it("stays on 1.1 unless DESIGN_AGENT_SPEC_VERSION is exactly 2.0", () => {
    expect(agentSpecVersion({})).toBe("1.1");
    expect(agentSpecVersion({ DESIGN_AGENT_SPEC_VERSION: "" })).toBe("1.1");
    expect(agentSpecVersion({ DESIGN_AGENT_SPEC_VERSION: "3" })).toBe("1.1");
    expect(agentSpecVersion({ DESIGN_AGENT_SPEC_VERSION: "2.0" })).toBe("2.0");
  });

  it("keeps the 1.1 prompt free of the body feature by default", () => {
    const prompt = buildSystemPrompt(FIXTURE_ANCHORS, [], "1.1");
    expect(prompt).not.toContain("Part Spec 2.0");
    expect(prompt).toContain(JSON.stringify(PART_SPEC_V1_SCHEMA));
  });

  it("quotes the 2.0 schema, every example and the body conventions", () => {
    const prompt = buildSystemPrompt(FIXTURE_ANCHORS, [], "2.0");
    expect(prompt).toContain(JSON.stringify(PART_SPEC_V2_SCHEMA));
    for (const example of PART_SPEC_V2_EXAMPLES) expect(prompt).toContain(JSON.stringify(example));
    expect(prompt).toContain('"revolve"');
    expect(prompt).toContain('"spec_version": "2.0"');
    expect(prompt).not.toContain('Part Spec is JSON: {"spec_version": "1.1"');
  });

  it("matches the schema file and includes bodies and every older feature", () => {
    expect(PART_SPEC_V2_SCHEMA).toEqual(JSON.parse(readFileSync(v2Path, "utf8")));
    const types = featureTypes(PART_SPEC_V2_SCHEMA);
    expect(types.has("body")).toBe(true);
    const quoted = new Set(PART_SPEC_V2_EXAMPLES.flatMap((e) => ((e.features as { type: string }[]) ?? []).map((f) => f.type)));
    for (const t of types) expect(quoted.has(t), `no 2.0 example for ${t}`).toBe(true);
    expect(PART_SPEC_V2_EXAMPLES.every((e) => e.spec_version === "2.0")).toBe(true);
  });
});

import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { anthropicChecker, CHECKER_SYSTEM, checkEnabled, DEFAULT_CHECK_MODEL, describeLikeness, MAX_DIFFERENCES, parseLikeness } from "./checker";

const usage = { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: null, cache_read_input_tokens: null };

/** A stand-in client that records the request and returns one reply (or throws). */
function fakeClient(reply: unknown) {
  const requests: Record<string, unknown>[] = [];
  const client = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        requests.push(params);
        if (reply instanceof Error) throw reply;
        return reply;
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
}
const text = (t: string, stop_reason = "end_turn") => ({ content: [{ type: "thinking", thinking: "" }, { type: "text", text: t }], stop_reason, usage });
const photo = { mediaType: "image/jpeg" as const, base64: "PHOTO" };

describe("parseLikeness", () => {
  it("reads a verdict and trims the list", () => {
    const many = Array.from({ length: 9 }, (_, i) => `difference ${i}`);
    expect(parseLikeness(JSON.stringify({ matches: false, differences: many }))?.differences).toHaveLength(MAX_DIFFERENCES);
    expect(parseLikeness('{"matches":true,"differences":[]}')).toEqual({ matches: true, differences: [] });
  });
  it("does not call it a match while differences are listed", () => {
    expect(parseLikeness('{"matches":true,"differences":["End plates are flat."]}')?.matches).toBe(false);
  });
  it("rejects anything else", () => {
    expect(parseLikeness("not json")).toBeNull();
    expect(parseLikeness('{"matches":"yes","differences":[]}')).toBeNull();
    expect(parseLikeness("null")).toBeNull();
  });
});

describe("describeLikeness", () => {
  it("numbers the differences and tells the builder to fix them", () => {
    const told = describeLikeness({ matches: false, differences: ["End plates are flat.", "The gap is too small."] });
    expect(told).toContain("1. End plates are flat.");
    expect(told).toContain("2. The gap is too small.");
    expect(told).toContain("build again");
  });
  it("tells the builder to stop when the shape matches", () => {
    expect(describeLikeness({ matches: true, differences: [] })).toContain("Do not rebuild");
  });
});

describe("anthropicChecker", () => {
  it("sends only the photos and the picture, never the conversation", async () => {
    const { client, requests } = fakeClient(text('{"matches":false,"differences":["End plates are flat."]}'));
    const result = await anthropicChecker(client, [photo], DEFAULT_CHECK_MODEL)("RENDER");
    expect(result).toEqual({ matches: false, differences: ["End plates are flat."], usage: { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } });
    const request = requests[0];
    expect(request.model).toBe(DEFAULT_CHECK_MODEL);
    expect(request.system).toBe(CHECKER_SYSTEM);
    expect(request.tools).toBeUndefined();
    const messages = request.messages as { content: { type: string; source?: { data: string } }[] }[];
    expect(messages).toHaveLength(1);
    expect(messages[0].content.filter((b) => b.type === "image").map((b) => b.source?.data)).toEqual(["PHOTO", "RENDER"]);
  });
  it("gives null instead of throwing when the request fails, is refused or is not JSON", async () => {
    expect(await anthropicChecker(fakeClient(new Error("down")).client, [photo])("R")).toBeNull();
    expect(await anthropicChecker(fakeClient(text("{}", "refusal")).client, [photo])("R")).toBeNull();
    expect(await anthropicChecker(fakeClient(text("I think it looks fine")).client, [photo])("R")).toBeNull();
  });
});

describe("checkEnabled", () => {
  it("is on unless switched off", () => {
    expect(checkEnabled({})).toBe(true);
    expect(checkEnabled({ DESIGN_AGENT_CHECK: " OFF " })).toBe(false);
  });
});

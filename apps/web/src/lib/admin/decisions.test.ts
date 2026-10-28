import { describe, expect, it } from "vitest";
import { decideListing, decideTakedown } from "./decisions";

const reply = (status: number, body: unknown, spy?: (u: string, i: RequestInit) => void) =>
  (async (u: string, i: RequestInit) => {
    spy?.(u, i);
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;

describe("admin decisions", () => {
  it("sends a listing decision with both checks, defaulting them to false", async () => {
    let url = "";
    let body: Record<string, unknown> = {};
    const spy = reply(200, {}, (u, i) => ((url = u), (body = JSON.parse(String(i.body)))));
    expect(await decideListing("a b", { decision: "approve", notFactoryCopy: true }, spy)).toEqual({ ok: true });
    expect(url).toBe("/api/admin/listings/a%20b");
    expect(body).toMatchObject({ decision: "approve", checks: { notFactoryCopy: true, noTrademark: false } });
  });
  it("shows the server's reason, or a plain one when the network fails", async () => {
    expect(await decideListing("l", { decision: "reject" }, reply(400, { error: "A reason is required." }))).toEqual({ ok: false, error: "A reason is required." });
    expect(await decideTakedown("c", "remove", "n", reply(500, {}))).toEqual({ ok: false, error: "That did not work. Please try again." });
    expect(await decideTakedown("c", "dismiss", undefined, (async () => { throw new Error("x"); }) as unknown as typeof fetch)).toMatchObject({ ok: false });
  });
  it("sends the takedown decision and note", async () => {
    let body: Record<string, unknown> = {};
    await decideTakedown("c1", "uphold", "stays down", reply(200, {}, (_u, i) => (body = JSON.parse(String(i.body)))));
    expect(body).toEqual({ decision: "uphold", note: "stays down" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ inserted: [] as unknown[], deleted: 0 }));
vi.mock("../../../lib/db/client", () => ({
  DatabaseNotConfigured: class extends Error {},
  getDb: async () => ({
    insert: () => ({ values: (v: unknown) => ({ onConflictDoNothing: async () => void calls.inserted.push(v) }) }),
    delete: () => ({ where: async () => void calls.deleted++ }),
  }),
}));
vi.mock("../../../lib/rate-limit", async (orig) => ({ ...(await orig<typeof import("../../../lib/rate-limit")>()), hit: async () => ({ ok: true }) }));

import { DELETE, POST } from "./route";

const req = (method: string, body: unknown) => new Request("http://localhost/api/waitlist", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  calls.inserted = [];
  calls.deleted = 0;
});

describe("/api/waitlist", () => {
  it("adds a normalized address", async () => {
    expect((await POST(req("POST", { email: " A@B.co " }))).status).toBe(201);
    expect(calls.inserted).toEqual([{ email: "a@b.co" }]);
  });
  it("removes an address", async () => {
    expect((await DELETE(req("DELETE", { email: "a@b.co" }))).status).toBe(200);
    expect(calls.deleted).toBe(1);
  });
  it("rejects a bad address on both", async () => {
    expect((await POST(req("POST", { email: "x" }))).status).toBe(400);
    expect((await DELETE(req("DELETE", {}))).status).toBe(400);
    expect(calls.inserted).toEqual([]);
  });
});

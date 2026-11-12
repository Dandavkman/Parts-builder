import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ storage: null as null | { presignPut: (k: string, c: string, s: number) => Promise<string> }, created: [] as unknown[] }));
vi.mock("../../../lib/require-owner", () => ({ requireOwner: async () => ({ ownerId: "user_1" }) }));
vi.mock("../../../lib/db/client", () => ({ DatabaseNotConfigured: class extends Error {}, getDb: async () => ({}) }));
vi.mock("../../../lib/storage/r2", () => ({ getStorage: () => state.storage }));
vi.mock("../../../lib/scans/store", () => ({
  createScan: async (_db: unknown, owner: string, filename: string, size: number, key: (id: string) => string) => {
    state.created.push({ owner, filename, size, key: key("scan-id") });
    return "11111111-1111-1111-1111-111111111111";
  },
}));

import { GET, POST } from "./route";

const post = (body: unknown) => POST(new Request("http://localhost/api/scans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

beforeEach(() => {
  state.storage = null;
  state.created = [];
});

describe("/api/scans", () => {
  it("says whether upload is switched on", async () => {
    expect(await (await GET()).json()).toMatchObject({ enabled: false });
    state.storage = { presignPut: async () => "u" };
    expect(await (await GET()).json()).toMatchObject({ enabled: true });
  });
  it("rejects a wrong file type or a missing size without touching storage", async () => {
    state.storage = { presignPut: async () => "u" };
    expect((await post({ filename: "lid.exe", size_bytes: 10 })).status).toBe(400);
    expect((await post({ filename: "lid.stl" })).status).toBe(400);
    expect(state.created).toEqual([]);
  });
  it("answers 503 while storage is not configured", async () => {
    expect((await post({ filename: "lid.stl", size_bytes: 10 })).status).toBe(503);
  });
  it("records the scan and returns an upload URL; the key is under the owner and the scan id", async () => {
    state.storage = { presignPut: async (key, _c, seconds) => `https://r2.example/${key}?t=${seconds}` };
    const res = await post({ filename: "trunk lid.stl", size_bytes: 5000 });
    const body = (await res.json()) as { scan_id: string; upload_url: string };
    expect(res.status).toBe(200);
    expect(body.scan_id).toBe("11111111-1111-1111-1111-111111111111");
    expect(body.upload_url).toContain("scans/user_1/11111111-1111-1111-1111-111111111111/trunk_lid.stl");
    expect(body.upload_url).toContain("t=3600");
  });
});

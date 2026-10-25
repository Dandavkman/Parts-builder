import { afterEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_ANCHORS } from "./fixture-anchors";
import { buildFile } from "./geometry-client";

afterEach(() => vi.unstubAllGlobals());

describe("buildFile", () => {
  it("sends the spec with anchors by id and returns the file", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "model/stl", "content-disposition": 'attachment; filename="x.stl"' },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const built = await buildFile({ name: "x" }, FIXTURE_ANCHORS, "stl");
    expect(built).toMatchObject({ ok: true, contentType: "model/stl", contentDisposition: 'attachment; filename="x.stl"' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/build?format=stl");
    const sent = JSON.parse(init.body as string);
    expect(sent.anchors.hole_a).toEqual({ point_mm: [-40, 0, 0], normal: [0, 0, 1] });
  });

  it("turns a 422 into plain-sentence errors", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ errors: ["hole 'h' is outside plate 'base'"] }, { status: 422 }));
    expect(await buildFile({}, [], "step")).toEqual({ ok: false, errors: ["hole 'h' is outside plate 'base'"] });
  });

  it("throws on other failures", async () => {
    vi.stubGlobal("fetch", async () => new Response("no", { status: 401 }));
    await expect(buildFile({}, [], "glb")).rejects.toThrow("401");
  });
});

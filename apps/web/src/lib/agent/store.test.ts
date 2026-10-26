import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { runAgent, type RunTurn } from "./loop";
import { FIXTURE_ANCHORS } from "./fixture-anchors";
import {
  addPhoto,
  addReference,
  createDesign,
  getOwnedDesign,
  getOwnedVersion,
  listOwnedDesigns,
  listVersions,
  loadHistory,
  loadPhotos,
  loadReferences,
  MAX_PHOTOS_PER_DESIGN,
  recorderFor,
  saveDimension,
  setCurrentVersion,
  withPhotos,
  withUserMessage,
} from "./store";

let db: Db;

beforeAll(async () => {
  db = drizzle(new PGlite(), { schema }) as unknown as Db;
  await migrate(runnerFor(db));
});

const usage = { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 };

describe("design list, versions and undo", () => {
  it("lists only the owner's designs, and every version with its build result", async () => {
    const mine = await createDesign(db, "lister", "Mine");
    await createDesign(db, "someone_else", "Not mine");
    expect((await listOwnedDesigns(db, "lister")).map((d) => d.title)).toEqual(["Mine"]);
    const rec = recorderFor(db, mine);
    await rec.version({ spec: { spec_version: "1.1", name: "A" }, ok: true, errors: [], createdBy: "agent", anchors: [] });
    await rec.version({ spec: { spec_version: "1.1", name: "B" }, ok: false, errors: ["bad"], createdBy: "agent", anchors: [] });
    const versions = await listVersions(db, mine);
    expect(versions.map((v) => [v.version, v.name, v.buildOk])).toEqual([
      [1, "A", true],
      [2, "B", false],
    ]);
  });

  it("saves a slider edit as a new current version made by the slider", async () => {
    const id = await createDesign(db, "slider_user", "t");
    const rec = recorderFor(db, id);
    await rec.version({ spec: { name: "a" }, ok: true, errors: [], createdBy: "agent", anchors: [] });
    await rec.version({ spec: { name: "a" }, ok: true, errors: [], createdBy: "slider", anchors: [] });
    expect((await listVersions(db, id)).map((v) => [v.version, v.createdBy])).toEqual([
      [1, "agent"],
      [2, "slider"],
    ]);
    expect((await getOwnedDesign(db, id, "slider_user"))?.currentVersion).toBe(2);
  });

  it("makes an earlier version that built current, and refuses others", async () => {
    const id = await createDesign(db, "undoer", "t");
    const rec = recorderFor(db, id);
    await rec.version({ spec: { name: "v1" }, ok: true, errors: [], createdBy: "agent", anchors: [] });
    await rec.version({ spec: { name: "v2" }, ok: true, errors: [], createdBy: "agent", anchors: [] });
    await rec.version({ spec: { name: "v3" }, ok: false, errors: ["x"], createdBy: "agent", anchors: [] });
    expect((await getOwnedDesign(db, id, "undoer"))?.currentVersion).toBe(2);
    expect(await setCurrentVersion(db, id, "undoer", 1)).toBe("ok");
    expect((await getOwnedDesign(db, id, "undoer"))?.currentVersion).toBe(1);
    expect(await setCurrentVersion(db, id, "undoer", 2)).toBe("ok");
    expect(await setCurrentVersion(db, id, "undoer", 3)).toBe("not_built");
    expect(await setCurrentVersion(db, id, "undoer", 9)).toBe("not_found");
    expect(await setCurrentVersion(db, id, "intruder", 1)).toBe("not_found");
  });
});

describe("migrations", () => {
  it("can run again without changes", async () => {
    expect(await migrate(runnerFor(db))).toEqual([]);
  });
});

describe("design store", () => {
  it("only returns a design to its owner", async () => {
    const id = await createDesign(db, "user_a", "Oil cooler bracket");
    expect(await getOwnedDesign(db, id, "user_a")).toMatchObject({ id, title: "Oil cooler bracket", currentVersion: null });
    expect(await getOwnedDesign(db, id, "user_b")).toBeNull();
  });

  it("saves messages in order with token counts, and versions with their build result", async () => {
    const id = await createDesign(db, "user_a", "t");
    const rec = recorderFor(db, id);
    await rec.message({ role: "user", content: "make a plate" });
    await rec.message({ role: "assistant", content: [{ type: "text", text: "ok" }], model: "m", usage });
    await rec.version({ spec: { spec_version: "1.0", v: 1 }, ok: false, errors: ["too small"], createdBy: "agent", anchors: [] });
    await rec.version({ spec: { spec_version: "1.0", v: 2 }, ok: true, errors: [], createdBy: "agent", anchors: FIXTURE_ANCHORS });

    expect(await loadHistory(db, id)).toEqual([
      { role: "user", content: "make a plate" },
      { role: "assistant", content: [{ type: "text", text: "ok" }] },
    ]);
    const [assistant] = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.role, "assistant"));
    expect(assistant).toMatchObject({ inputTokens: 100, outputTokens: 20, cacheCreationInputTokens: 3, cacheReadInputTokens: 4, model: "m" });
    const versions = await db.select().from(schema.designVersions).where(eq(schema.designVersions.designId, id));
    expect(versions.map((v) => [v.version, v.buildOk, v.buildErrors, v.specSchemaVersion])).toEqual([
      [1, false, ["too small"], "1.0"],
      [2, true, [], "1.0"],
    ]);
    expect((await getOwnedDesign(db, id, "user_a"))?.currentVersion).toBe(2);

    // Downloads: a version by number or "current", with the anchors it was built against, owner only.
    expect((await getOwnedVersion(db, id, "user_a", "current"))?.version).toBe(2);
    expect((await getOwnedVersion(db, id, "user_a", 2))?.anchors).toEqual(FIXTURE_ANCHORS);
    expect((await getOwnedVersion(db, id, "user_a", 1))?.buildOk).toBe(false);
    expect(await getOwnedVersion(db, id, "user_a", 3)).toBeNull();
    expect(await getOwnedVersion(db, id, "user_b", 2)).toBeNull();
  });

  it("has no current version until one builds", async () => {
    const id = await createDesign(db, "user_a", "t");
    expect(await getOwnedVersion(db, id, "user_a", "current")).toBeNull();
  });

  it("saves a whole agent run: every attempt and message", async () => {
    const id = await createDesign(db, "user_a", "t");
    const replies = [
      { content: [{ type: "tool_use", id: "t1", name: "propose_spec", input: { spec: { spec_version: "1.0", n: 1 } } }], stop_reason: "tool_use", model: "m", usage },
      { content: [{ type: "text", text: "Done" }], stop_reason: "end_turn", model: "m", usage },
    ];
    let i = 0;
    const turn = (async () => replies[i++]) as unknown as RunTurn;
    const history = withUserMessage([], "go");
    const record = recorderFor(db, id);
    await record.message({ role: "user", content: "go" });
    await runAgent({ turn, system: "s", history, anchors: FIXTURE_ANCHORS, build: async () => ({ ok: true }), emit: () => {}, record });

    const rows = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.designId, id)).orderBy(schema.chatMessages.seq);
    expect(rows.map((r) => [r.seq, r.role])).toEqual([[1, "user"], [2, "assistant"], [3, "user"], [4, "assistant"]]);
    expect(rows.reduce((n, r) => n + r.outputTokens, 0)).toBe(40);
    expect((await getOwnedDesign(db, id, "user_a"))?.currentVersion).toBe(1);
    // The saved conversation is valid to send again: every tool call has a result.
    const saved = await loadHistory(db, id);
    expect(withUserMessage(saved, "next").at(-1)).toEqual({ role: "user", content: "next" });
  });
});

describe("withUserMessage", () => {
  it("answers an open ask_user with the user's text and closes other open calls", () => {
    const history = [
      { role: "user" as const, content: "hi" },
      {
        role: "assistant" as const,
        content: [
          { type: "tool_use" as const, id: "q", name: "ask_user", input: { question: "Material?" } },
          { type: "tool_use" as const, id: "m", name: "measure", input: {} },
        ],
      },
    ];
    expect(withUserMessage(history, "PA12").at(-1)).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "q", content: "PA12" },
        { type: "tool_result", tool_use_id: "m", content: "Skipped: the request was interrupted.", is_error: true },
      ],
    });
  });

  it("adds plain text when nothing is open", () => {
    expect(withUserMessage([], "hi")).toEqual([{ role: "user", content: "hi" }]);
  });
});

describe("references", () => {
  it("falls back to the fixture panel until a confirmed reference exists", async () => {
    const id = await createDesign(db, "ref_user", "t");
    expect(await loadReferences(db, id)).toEqual({ anchors: FIXTURE_ANCHORS, dimensions: [] });
    await addReference(db, id, {
      kind: "researched",
      label: "Spec sheet",
      dimensions: [{ id: "height", value_mm: 200, source: "researched", confidence: "published" }],
      confirmed: false,
    });
    expect((await loadReferences(db, id)).anchors).toEqual(FIXTURE_ANCHORS);
  });

  it("gives the agent only confirmed references, and drops the fixtures once there is one", async () => {
    const id = await createDesign(db, "ref_user2", "t");
    await addReference(db, id, {
      kind: "photo",
      label: "Photo with a 50 mm coin",
      dimensions: [{ id: "vase_height", value_mm: 200, source: "photo", confidence: "estimated" }],
      accuracyNote: "about 3 mm",
    });
    await addReference(db, id, {
      kind: "stated",
      label: "Typed",
      anchors: [{ id: "base", type: "plane", point_mm: [0, 0, 0], normal: [0, 0, 1] }],
      dimensions: [{ id: "width", value_mm: 80, source: "user", confidence: "stated" }],
    });
    const refs = await loadReferences(db, id);
    expect(refs.anchors.map((a) => a.id)).toEqual(["base"]);
    expect(refs.dimensions.map((d) => d.id)).toEqual(["vase_height", "width"]);
  });

  it("deletes references with their design", async () => {
    const id = await createDesign(db, "ref_user3", "t");
    await addReference(db, id, { kind: "stated", label: "x" });
    await db.delete(schema.designs).where(eq(schema.designs.id, id));
    expect(await db.select().from(schema.designReferences).where(eq(schema.designReferences.designId, id))).toEqual([]);
  });
});

describe("photos and recorded dimensions", () => {
  const photo = { mediaType: "image/jpeg" as const, base64: "QUJD" };

  it("keeps photos with the design up to the limit", async () => {
    const id = await createDesign(db, "photo_user", "t");
    for (let i = 0; i < MAX_PHOTOS_PER_DESIGN; i++) expect(await addPhoto(db, id, photo)).toBe(true);
    expect(await addPhoto(db, id, photo)).toBe(false);
    expect(await loadPhotos(db, id)).toHaveLength(MAX_PHOTOS_PER_DESIGN);
    const other = await createDesign(db, "photo_user", "t2");
    expect(await loadPhotos(db, other)).toEqual([]);
  });

  it("a photo reference replaces the fixture panel for the agent", async () => {
    const id = await createDesign(db, "photo_user2", "t");
    await addPhoto(db, id, photo);
    expect((await loadReferences(db, id)).anchors).toEqual([]);
  });

  it("puts photos first in the first user message, without touching the saved history", () => {
    const history = [{ role: "user" as const, content: "make a vase" }, { role: "assistant" as const, content: "ok" }];
    const sent = withPhotos(history, [photo]);
    expect(sent[0].content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "QUJD" } },
      { type: "text", text: "make a vase" },
    ]);
    expect(sent[1]).toBe(history[1]);
    expect(history[0].content).toBe("make a vase");
    expect(withPhotos(history, [])).toBe(history);
  });

  it("saves a dimension and replaces one with the same id", async () => {
    const id = await createDesign(db, "dim_user", "t");
    await saveDimension(db, id, { id: "height", value_mm: 100, source: "user", confidence: "stated" });
    await saveDimension(db, id, { id: "width", value_mm: 50, source: "user", confidence: "stated" });
    await saveDimension(db, id, { id: "height", value_mm: 120, source: "photo", confidence: "estimated" });
    const dims = (await loadReferences(db, id)).dimensions;
    expect(dims.map((d) => [d.id, d.value_mm]).sort()).toEqual([
      ["height", 120],
      ["width", 50],
    ]);
  });
});

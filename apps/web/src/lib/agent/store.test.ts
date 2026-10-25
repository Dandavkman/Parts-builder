import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { runAgent, type RunTurn } from "./loop";
import { FIXTURE_ANCHORS } from "./fixture-anchors";
import { createDesign, getOwnedDesign, loadHistory, recorderFor, withUserMessage } from "./store";

let db: Db;

beforeAll(async () => {
  db = drizzle(new PGlite(), { schema }) as unknown as Db;
  await migrate(runnerFor(db));
});

const usage = { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 };

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
    await rec.version({ spec: { spec_version: "1.0", v: 1 }, ok: false, errors: ["too small"], createdBy: "agent" });
    await rec.version({ spec: { spec_version: "1.0", v: 2 }, ok: true, errors: [], createdBy: "agent" });

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

import { desc, eq, gte } from "drizzle-orm";
import type { Db } from "../db/client";
import { designs, designVersions } from "../db/schema";
import type { LoggedDesign } from "./failure-report";
import { loadHistory } from "./store";

/** Designs created since `since`, newest first, with their saved conversation and every version. Owner ids are left out on purpose. */
export async function loadLoggedDesigns(db: Db, since: Date, limit = 200): Promise<LoggedDesign[]> {
  const rows = await db.select({ id: designs.id }).from(designs).where(gte(designs.createdAt, since)).orderBy(desc(designs.createdAt)).limit(limit);
  return Promise.all(
    rows.map(async ({ id }) => ({
      id,
      history: await loadHistory(db, id),
      versions: (
        await db
          .select({ version: designVersions.version, buildOk: designVersions.buildOk, buildErrors: designVersions.buildErrors })
          .from(designVersions)
          .where(eq(designVersions.designId, id))
      ).map((v) => ({ version: v.version, buildOk: v.buildOk, buildErrors: v.buildErrors })),
    })),
  );
}

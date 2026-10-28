import { buildFile, type GeometryFormat } from "../../../../../../lib/agent/geometry-client";
import { DatabaseNotConfigured, getDb } from "../../../../../../lib/db/client";
import { designVersions } from "../../../../../../lib/db/schema";
import { getOrder } from "../../../../../../lib/orders/store";
import { requireAdmin } from "../../../../../../lib/require-admin";
import { and, eq } from "drizzle-orm";
import { reportError } from "../../../../../../lib/observability";

const FORMATS: GeometryFormat[] = ["step", "stl", "glb"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Production file for an order, built from the exact version that was bought (`?format=step|stl|glb`, default step). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireAdmin();
  if ("response" in who) return who.response;
  const { id } = await params;
  const format = (new URL(request.url).searchParams.get("format") ?? "step") as GeometryFormat;
  if (!UUID.test(id)) return Response.json({ error: "Not an order." }, { status: 400 });
  if (!FORMATS.includes(format)) return Response.json({ error: "format must be step, stl or glb." }, { status: 400 });
  let order;
  let anchors;
  try {
    const db = await getDb();
    order = await getOrder(db, id);
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    const [row] = await db
      .select({ anchors: designVersions.anchors })
      .from(designVersions)
      .where(and(eq(designVersions.designId, order.designId), eq(designVersions.version, order.version)));
    anchors = row?.anchors ?? [];
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("database unavailable", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
  let built;
  try {
    built = await buildFile(order.specSnapshot, anchors, format);
  } catch {
    return Response.json({ error: "The geometry service is not reachable." }, { status: 502 });
  }
  if (!built.ok) return Response.json({ error: "That version no longer builds.", errors: built.errors }, { status: 422 });
  const headers: Record<string, string> = { "content-type": built.contentType, "cache-control": "private, no-store" };
  if (built.contentDisposition) headers["content-disposition"] = built.contentDisposition;
  return new Response(built.body, { headers });
}

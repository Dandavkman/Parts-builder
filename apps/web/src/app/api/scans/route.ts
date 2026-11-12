import { DatabaseNotConfigured, getDb } from "../../../lib/db/client";
import { reportError } from "../../../lib/observability";
import { requireOwner } from "../../../lib/require-owner";
import { createScan } from "../../../lib/scans/store";
import { MAX_SCAN_BYTES, scanKey, validateScanUpload } from "../../../lib/storage/scan-upload";
import { getStorage } from "../../../lib/storage/r2";

const UPLOAD_URL_SECONDS = 3600;

/** Whether scan upload is switched on (object storage configured). The page uses it to show or hide the Scan button. */
export async function GET() {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  return Response.json({ enabled: getStorage() !== null, max_bytes: MAX_SCAN_BYTES }, { headers: { "cache-control": "private, no-store" } });
}

/** `{ filename, size_bytes }`: records the scan and returns a one-hour URL the browser uploads the file to. The file never passes through this server. */
export async function POST(request: Request) {
  const who = await requireOwner();
  if ("response" in who) return who.response;
  const body = (await request.json().catch(() => null)) as { filename?: unknown; size_bytes?: unknown } | null;
  const checked = validateScanUpload(body?.filename, body?.size_bytes);
  if (!checked.ok) return Response.json({ error: checked.errors.join(" ") }, { status: 400 });
  const storage = getStorage();
  if (!storage) return Response.json({ error: "Scan upload is not switched on yet." }, { status: 503 });
  try {
    const filename = String(body!.filename);
    const scanId = await createScan(await getDb(), who.ownerId, filename, body!.size_bytes as number, (id) => scanKey(who.ownerId, id, filename));
    const key = scanKey(who.ownerId, scanId, filename);
    const contentType = "application/octet-stream";
    return Response.json({ scan_id: scanId, upload_url: await storage.presignPut(key, contentType, UPLOAD_URL_SECONDS), content_type: contentType });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfigured)) await reportError("scan upload failed to start", error);
    return Response.json({ error: "The database is not available." }, { status: 503 });
  }
}

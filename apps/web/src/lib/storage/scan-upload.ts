/** Rules for scan uploads (task B1.1): format, size and where the file is kept. */
export const SCAN_EXTENSIONS = [".stl", ".obj", ".ply", ".zip"] as const;
export const MAX_SCAN_BYTES = 1024 * 1024 * 1024;

export function validateScanUpload(filename: unknown, sizeBytes: unknown): { ok: true; extension: string } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const name = typeof filename === "string" ? filename.trim() : "";
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";
  if (!(SCAN_EXTENSIONS as readonly string[]).includes(extension)) {
    errors.push(`Scans must be ${SCAN_EXTENSIONS.join(", ")} files (zipped versions are fine).`);
  }
  if (typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    errors.push("The file size is missing.");
  } else if (sizeBytes > MAX_SCAN_BYTES) {
    errors.push("Scans can be up to 1 GB.");
  }
  return errors.length ? { ok: false, errors } : { ok: true, extension };
}

/** Where a user's own scan is stored. The filename is reduced to safe characters so it cannot climb out of its folder. */
export function scanKey(ownerId: string, scanId: string, filename: string): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(-80) || "scan";
  const owner = ownerId.replace(/[^A-Za-z0-9_-]/g, "_");
  return `scans/${owner}/${scanId}/${safe}`;
}

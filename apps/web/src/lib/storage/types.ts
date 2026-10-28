/**
 * File storage (Cloudflare R2 in production). Callers use this interface so tests run against an
 * in-memory fake and never reach the network (see docs/decisions.md, 2026-10-22).
 */
export interface ObjectStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  /** A URL the browser can PUT the file to directly, valid for `expiresSeconds`. */
  presignPut(key: string, contentType: string, expiresSeconds: number): Promise<string>;
  /** A URL the browser can GET the file from. Refused for library scans (plan rule 2). */
  presignGet(key: string, expiresSeconds: number): Promise<string>;
}

/** Library scans are never downloadable and the full-resolution file never reaches the browser. */
export const LIBRARY_PREFIX = "library/";

export class DownloadRefused extends Error {}

export function assertDownloadable(key: string): void {
  if (key.startsWith(LIBRARY_PREFIX)) throw new DownloadRefused("Library scans cannot be downloaded.");
}

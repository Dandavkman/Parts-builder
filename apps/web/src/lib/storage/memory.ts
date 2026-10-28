import { assertDownloadable, type ObjectStorage } from "./types";

/** In-process fake for tests and offline development. */
export function memoryStorage(): ObjectStorage & { keys(): string[] } {
  const files = new Map<string, Uint8Array>();
  return {
    async put(key, body) {
      files.set(key, body);
    },
    async get(key) {
      return files.get(key) ?? null;
    },
    async delete(key) {
      files.delete(key);
    },
    async presignPut(key, _contentType, expiresSeconds) {
      return `memory://put/${key}?expires=${expiresSeconds}`;
    },
    async presignGet(key, expiresSeconds) {
      assertDownloadable(key);
      return `memory://get/${key}?expires=${expiresSeconds}`;
    },
    keys: () => [...files.keys()],
  };
}

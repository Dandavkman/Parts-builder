export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

async function send<T>(path: string, body: unknown, doFetch: typeof fetch): Promise<ActionResult<T>> {
  try {
    const response = await doFetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    return response.ok ? { ok: true, data } : { ok: false, error: data.error ?? "That did not work. Please try again." };
  } catch {
    return { ok: false, error: "We could not reach the server. Check your connection and try again." };
  }
}

/** The calls the seller's store page makes. Each answers with data or one plain sentence; no React in here. */
export const storeActions = {
  open: (name: string, slug: string, doFetch: typeof fetch = fetch) => send("/api/stores", { name, slug }, doFetch),
  connect: (doFetch: typeof fetch = fetch) => send<{ url: string }>("/api/stores/connect", undefined, doFetch),
  publish: (doFetch: typeof fetch = fetch) => send("/api/stores/publish", undefined, doFetch),
  setPlatformBrand: (show: boolean, doFetch: typeof fetch = fetch) => send("/api/stores/branding", { showPlatformBrand: show }, doFetch),
};

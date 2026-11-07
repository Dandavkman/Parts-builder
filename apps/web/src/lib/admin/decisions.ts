export type DecisionResult = { ok: true } | { ok: false; error: string };

async function post(path: string, body: unknown, doFetch: typeof fetch): Promise<DecisionResult> {
  try {
    const response = await doFetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (response.ok) return { ok: true };
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? "That did not work. Please try again." };
  } catch {
    return { ok: false, error: "We could not reach the server. Check your connection and try again." };
  }
}

/** Approve (after both checks) or reject (with a reason) a listing waiting for review. */
export function decideListing(
  id: string,
  input: { decision: "approve" | "reject"; note?: string; notFactoryCopy?: boolean; noTrademark?: boolean },
  doFetch: typeof fetch = fetch,
): Promise<DecisionResult> {
  const { decision, note, notFactoryCopy, noTrademark } = input;
  return post(`/api/admin/listings/${encodeURIComponent(id)}`, { decision, note, checks: { notFactoryCopy: notFactoryCopy === true, noTrademark: noTrademark === true } }, doFetch);
}

/** Decide a takedown claim: remove or dismiss a new one; restore or uphold after a counter-notice. */
export function decideTakedown(id: string, decision: "remove" | "dismiss" | "restore" | "uphold", note: string | undefined, doFetch: typeof fetch = fetch): Promise<DecisionResult> {
  return post(`/api/admin/takedowns/${encodeURIComponent(id)}`, { decision, note }, doFetch);
}

/** Approve (hands it to the coding agent) or reject a piece of tester feedback. */
export function decideFeedbackAction(id: string, decision: "approve" | "reject", note: string | undefined, doFetch: typeof fetch = fetch): Promise<DecisionResult> {
  return post(`/api/admin/feedback/${encodeURIComponent(id)}`, { decision, note }, doFetch);
}

/** Record a payout already sent to a seller (bank or transfer reference required, so it is recorded once). Moves no money. */
export function recordPayoutAction(input: { storeId: string; amountCents: number; ref: string; note?: string }, doFetch: typeof fetch = fetch): Promise<DecisionResult> {
  return post("/api/admin/payouts", input, doFetch);
}

/** Dollars typed by the admin to whole cents, or null when it is not a positive amount. */
export function dollarsToCents(text: string): number | null {
  const n = Number(text.trim().replace(/^\$/, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

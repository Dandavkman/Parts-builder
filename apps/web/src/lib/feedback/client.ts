import { FEEDBACK_MAX, FEEDBACK_MIN } from "./limits";

export interface MyFeedback {
  id: string;
  body: string;
  status: string;
  createdAt: string;
}

/** What a tester reads next to their comment. The admin's notes are never shown. */
export function statusLabel(status: string): string {
  if (status === "approved") return "Approved, being worked on";
  if (status === "rejected") return "Reviewed, not planned";
  return "Waiting for review";
}

/** Why the comment cannot be sent yet, or null when it can. */
export function feedbackProblem(text: string): string | null {
  const n = text.trim().length;
  if (n < FEEDBACK_MIN) return `Add a little more detail (at least ${FEEDBACK_MIN} characters).`;
  if (n > FEEDBACK_MAX) return `Please keep it under ${FEEDBACK_MAX} characters.`;
  return null;
}

export async function loadMyFeedback(designId: string, doFetch: typeof fetch = fetch): Promise<MyFeedback[]> {
  try {
    const response = await doFetch(`/api/designs/${designId}/feedback`);
    if (!response.ok) return [];
    return ((await response.json()) as { feedback: MyFeedback[] }).feedback;
  } catch {
    return [];
  }
}

export async function sendFeedback(designId: string, body: string, doFetch: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await doFetch(`/api/designs/${designId}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
    if (response.ok) return { ok: true };
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? "That did not work. Please try again." };
  } catch {
    return { ok: false, error: "We could not reach the server. Check your connection and try again." };
  }
}

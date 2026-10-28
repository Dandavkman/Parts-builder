"use client";

import { useState } from "react";

/** Email box for the waitlist. Posts to /api/waitlist. */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (response?.ok) {
      setEmail("");
      setMessage("You are on the list. We will email you when ordering opens.");
    } else setMessage(data?.error ?? "Could not add you. Please try again.");
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-4 flex flex-wrap gap-2" aria-label="Join the waitlist">
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" placeholder="you@example.com" className="w-64 rounded border border-line-strong bg-transparent px-3 py-2" />
      <button type="submit" disabled={busy} className="rounded bg-primary px-4 py-2 text-on-primary disabled:opacity-50">
        Join the waitlist
      </button>
      {message && <p role="status" className="w-full text-sm">{message}</p>}
    </form>
  );
}

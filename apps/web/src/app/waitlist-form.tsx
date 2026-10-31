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
    <div className="w-full max-w-lg">
      <form onSubmit={(e) => void submit(e)} className="flex flex-wrap justify-center gap-2 rounded-full border border-line bg-card p-2 backdrop-blur-sm focus-within:border-accent" aria-label="Join the waitlist">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" placeholder="you@example.com" className="min-w-0 flex-1 basis-56 bg-transparent px-4 py-3 outline-none placeholder:text-subtle/80" />
        <button type="submit" disabled={busy} className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50">
          Join the waitlist
        </button>
      </form>
      {message && <p role="status" className="mt-3 text-center text-sm">{message}</p>}
    </div>
  );
}

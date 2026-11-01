"use client";

import Link from "next/link";
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

  async function remove() {
    setBusy(true);
    const response = await fetch("/api/waitlist", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (response?.ok) {
      setEmail("");
      setMessage("Done. That address is no longer on the list.");
    } else setMessage(data?.error ?? "Could not remove you. Please try again.");
  }

  return (
    <div className="w-full max-w-lg">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 sm:flex-row sm:gap-2 sm:rounded-full sm:border sm:border-line sm:bg-card sm:p-2 sm:backdrop-blur-sm sm:focus-within:border-accent" aria-label="Join the waitlist">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" placeholder="you@example.com" className="min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-3 outline-none backdrop-blur-sm placeholder:text-subtle/80 focus:border-accent sm:basis-56 sm:border-0 sm:bg-transparent sm:backdrop-blur-none" />
        <button type="submit" disabled={busy} className="w-full rounded-full bg-primary px-6 py-3 text-sm sm:w-auto font-medium text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50">
          Join the waitlist
        </button>
      </form>
      <p className="mt-3 text-center text-xs text-subtle">
        We use your email only to tell you when ordering opens. See the <Link href="/privacy" className="underline">privacy notice</Link>. To be taken off the list, type your address above and press{" "}
        <button type="button" disabled={busy || !email} onClick={() => void remove()} className="underline disabled:opacity-50">Remove me</button>.
      </p>
      {message && <p role="status" className="mt-3 text-center text-sm">{message}</p>}
    </div>
  );
}

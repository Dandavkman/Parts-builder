"use client";

import { useState } from "react";
import { useStoreActions } from "./use-store-actions";

const button = "rounded bg-primary px-3 py-2 text-sm text-on-primary disabled:opacity-60";

/** Open a store: name and address. */
export function OpenStoreForm() {
  const a = useStoreActions();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  return (
    <form
      className="mt-4 max-w-sm space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void a.open(name, slug);
      }}
    >
      <label className="block text-sm">
        <span className="text-muted">Store name</span>
        <input className="mt-1 w-full rounded border border-line-strong bg-page px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
      </label>
      <label className="block text-sm">
        <span className="text-muted">Store address (3 to 30 letters, digits and hyphens)</span>
        <input className="mt-1 w-full rounded border border-line-strong bg-page px-3 py-2" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} maxLength={30} required />
      </label>
      {a.error && <p className="text-sm text-danger" role="alert">{a.error}</p>}
      <button type="submit" disabled={a.busy} className={button}>Open my store</button>
    </form>
  );
}

/** Payout setup, publishing and the white-label switch for an open store. */
export function StoreControls({ connected, verified, published, showPlatformBrand }: { connected: boolean; verified: boolean; published: boolean; showPlatformBrand: boolean }) {
  const a = useStoreActions();
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {!verified && (
          <button type="button" disabled={a.busy} onClick={() => void a.connect()} className={button}>
            {connected ? "Continue payout setup" : "Set up payouts"}
          </button>
        )}
        {verified && !published && (
          <button type="button" disabled={a.busy} onClick={() => void a.publish()} className={button}>
            Publish my store
          </button>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showPlatformBrand} disabled={a.busy} onChange={(e) => void a.setPlatformBrand(e.target.checked)} />
        <span>Show &ldquo;Made by&rdquo; our name on my buyers&rsquo; emails and packing slips (off by default).</span>
      </label>
      {a.error && <p className="text-sm text-danger" role="alert">{a.error}</p>}
    </div>
  );
}

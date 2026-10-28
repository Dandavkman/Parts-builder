"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DecisionResult } from "../../lib/admin/decisions";

/** Runs one admin decision, shows its error, and refreshes the page data when it works. No markup. */
export function useDecision() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(call: () => Promise<DecisionResult>) {
    setBusy(true);
    setError(null);
    const result = await call();
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }
  return { busy, error, run };
}

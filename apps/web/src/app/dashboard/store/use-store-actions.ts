"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { storeActions, type ActionResult } from "../../../lib/stores/actions";

/** Actions on the seller's store page: each runs a call, shows its error, and refreshes the page data. No markup. */
export function useStoreActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(call: () => Promise<ActionResult<unknown>>, then?: (data: unknown) => void) {
    setBusy(true);
    setError(null);
    const result = await call();
    setBusy(false);
    if (!result.ok) return setError(result.error);
    if (then) then(result.data);
    router.refresh();
  }

  return {
    busy,
    error,
    open: (name: string, slug: string) => run(() => storeActions.open(name, slug)),
    connect: () => run(() => storeActions.connect(), (data) => window.location.assign((data as { url: string }).url)),
    publish: () => run(() => storeActions.publish()),
    setPlatformBrand: (show: boolean) => run(() => storeActions.setPlatformBrand(show)),
  };
}

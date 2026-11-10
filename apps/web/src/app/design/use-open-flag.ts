"use client";

import { useCallback, useEffect, useState } from "react";

/** An open/closed flag for a collapsible panel, remembered in this browser. Storage can be blocked, so every access is guarded. */
export function useOpenFlag(key: string, initial: boolean): [boolean, () => void] {
  const [open, setOpen] = useState(initial);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved !== null) setOpen(saved === "1");
    } catch {
      // Storage unavailable: keep the default.
    }
  }, [key]);
  const toggle = useCallback(() => {
    setOpen((o) => {
      try {
        window.localStorage.setItem(key, o ? "0" : "1");
      } catch {
        // Not remembered, still works.
      }
      return !o;
    });
  }, [key]);
  return [open, toggle];
}

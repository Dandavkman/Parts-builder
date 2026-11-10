"use client";

import { useCallback, useEffect, useRef } from "react";
import { isNearBottom } from "../../lib/viewer/stick";

/** Keeps a scroll box pinned to its newest content, unless the reader has scrolled up. Call `pin()` to force it (for example after sending). */
export function useStickToBottom<T extends HTMLElement>(content: unknown) {
  const ref = useRef<T>(null);
  const stuck = useRef(true);
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (el) stuck.current = isNearBottom(el.scrollHeight, el.scrollTop, el.clientHeight);
  }, []);
  const pin = useCallback(() => {
    stuck.current = true;
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [content]);
  return { ref, onScroll, pin };
}

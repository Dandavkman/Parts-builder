"use client";

import { useCallback, useEffect, useState } from "react";
import { feedbackProblem, loadMyFeedback, sendFeedback, type MyFeedback } from "../../lib/feedback/client";

/** Feedback tab state: the tester's earlier comments on this design and sending a new one. No markup. */
export function useFeedback(designId: string | null) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<MyFeedback[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const refresh = useCallback(async () => {
    if (designId) setItems(await loadMyFeedback(designId));
    else setItems([]);
  }, [designId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submit() {
    if (!designId) return;
    const problem = feedbackProblem(text);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const result = await sendFeedback(designId, text.trim());
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setText("");
    setSent(true);
    await refresh();
  }

  return { text, setText: (t: string) => { setText(t); setSent(false); }, items, busy, error, sent, submit, canSend: designId !== null };
}

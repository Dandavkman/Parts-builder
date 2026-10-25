"use client";

import { useRef, useState } from "react";
import { applyEvent, initialChat, parseLines, sendMessage } from "../../lib/agent/chat-state";
import { ModelViewer } from "../viewer/plate-viewer";

const PART_ERROR =
  "Could not load the part. The geometry service may be waking up (up to 40 seconds); send another message or reload.";

export function Workspace() {
  const [chat, setChat] = useState(initialChat);
  const [draft, setDraft] = useState("");
  const designIdRef = useRef<string | null>(null);

  async function send() {
    const text = draft.trim();
    if (!text || chat.busy) return;
    setDraft("");
    setChat((s) => sendMessage(s, text));
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, design_id: designIdRef.current }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setChat((s) => applyEvent(s, { type: "error", message: data.error ?? `Something went wrong (${response.status}).` }));
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseLines(buffer);
        buffer = rest;
        for (const event of events) {
          if (event.type === "design") designIdRef.current = event.design_id;
          setChat((s) => applyEvent(s, event));
        }
      }
      setChat((s) => (s.busy ? applyEvent(s, { type: "error", message: "The connection ended early. Try again." }) : s));
    } catch {
      setChat((s) => applyEvent(s, { type: "error", message: "Could not reach the design agent." }));
    }
  }

  const partUrl =
    chat.designId && chat.builtCount > 0
      ? `/api/designs/${chat.designId}/versions/current/download?format=glb&v=${chat.builtCount}`
      : null;
  const download = (format: string) => `/api/designs/${chat.designId}/versions/current/download?format=${format}`;

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="flex h-[560px] flex-col rounded border border-zinc-200 dark:border-zinc-800">
        <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
          {chat.items.length === 0 && (
            <p className="text-zinc-500">For example: a flat bracket that bolts to both holes, with a 20 mm hole in the middle.</p>
          )}
          {chat.items.map((item, i) => (
            <p
              key={i}
              className={
                item.kind === "user"
                  ? "ml-8 rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : item.kind === "assistant"
                    ? "mr-8 whitespace-pre-wrap rounded bg-zinc-100 px-3 py-2 dark:bg-zinc-800"
                    : item.kind === "error"
                      ? "rounded border border-red-300 px-3 py-2 text-red-700 dark:text-red-400"
                      : "px-1 text-xs text-zinc-500"
              }
            >
              {item.text}
            </p>
          ))}
          {chat.busy && <p className="px-1 text-xs text-zinc-500">Working...</p>}
        </div>
        <form
          className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={4000}
            placeholder="Describe the part"
            className="min-w-0 flex-1 rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={chat.busy || draft.trim() === ""}
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Send
          </button>
        </form>
      </section>

      <section className="flex h-[560px] flex-col">
        <div className="min-h-0 flex-1 overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
          {partUrl ? (
            <ModelViewer url={partUrl} errorMessage={PART_ERROR} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
              The part will appear here once the agent has built one.
            </div>
          )}
        </div>
        {partUrl && (
          <div className="mt-2 flex gap-3 text-sm">
            <span className="text-zinc-500">Download latest:</span>
            <a className="underline" href={download("step")}>STEP</a>
            <a className="underline" href={download("stl")}>STL</a>
          </div>
        )}
      </section>
    </div>
  );
}

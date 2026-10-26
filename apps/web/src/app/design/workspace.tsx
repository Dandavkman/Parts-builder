"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyEvent, initialChat, openDesign, parseLines, sendMessage, type ChatItem } from "../../lib/agent/chat-state";
import { setAtPath, type SpecNumber } from "../../lib/agent/spec-numbers";
import { ModelViewer } from "../viewer/plate-viewer";
import { Sliders } from "./sliders";

const PART_ERROR =
  "Could not load the part. The geometry service may be waking up (up to 40 seconds); send another message or reload.";

interface DesignRow {
  id: string;
  title: string;
}

interface VersionRow {
  version: number;
  createdBy: string;
  buildOk: boolean;
  name: string;
}

export function Workspace() {
  const [chat, setChat] = useState(initialChat);
  const [draft, setDraft] = useState("");
  const [designs, setDesigns] = useState<DesignRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const designIdRef = useRef<string | null>(null);

  const loadList = useCallback(async () => {
    const response = await fetch("/api/designs").catch(() => null);
    if (response?.ok) setDesigns(((await response.json()) as { designs: DesignRow[] }).designs);
  }, []);

  /** Loads a design's versions (and, when `reopen`, its conversation) from the server. */
  const loadDesign = useCallback(async (id: string, reopen: boolean) => {
    const response = await fetch(`/api/designs/${id}`).catch(() => null);
    if (!response?.ok) {
      setNotice("Could not load that design.");
      return;
    }
    const data = (await response.json()) as {
      design: { currentVersion: number | null };
      currentSpec: Record<string, unknown> | null;
      versions: VersionRow[];
      items: ChatItem[];
    };
    setNotice(null);
    setVersions(data.versions);
    setCurrent(data.design.currentVersion);
    setSpec(data.currentSpec);
    if (reopen) {
      designIdRef.current = id;
      setChat(openDesign(id, data.items));
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function newDesign() {
    designIdRef.current = null;
    setChat(initialChat);
    setVersions([]);
    setCurrent(null);
    setSpec(null);
    setNotice(null);
  }

  async function useVersion(version: number) {
    const id = designIdRef.current;
    if (!id || chat.busy) return;
    const response = await fetch(`/api/designs/${id}/current`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version }),
    }).catch(() => null);
    if (response?.ok) await loadDesign(id, false);
    else setNotice("Could not switch versions.");
  }

  /** A slider edit: rebuilt on the server without the AI; saved as a new version only if it builds. */
  async function commitSlider(item: SpecNumber, value: number) {
    const id = designIdRef.current;
    if (!id || !spec || current === null) return;
    const response = await fetch(`/api/designs/${id}/edit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ base_version: current, spec: setAtPath(spec, item.path, value) }),
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { ok?: boolean; errors?: string[]; error?: string } | null;
    if (data?.ok) {
      setNotice(null);
    } else {
      setNotice(data?.errors?.join("; ") ?? data?.error ?? "Could not apply that change.");
    }
    await loadDesign(id, false);
  }

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
    if (designIdRef.current) await loadDesign(designIdRef.current, false);
    void loadList();
  }

  const partUrl =
    chat.designId && current !== null ? `/api/designs/${chat.designId}/versions/${current}/download?format=glb` : null;
  const download = (format: string) => `/api/designs/${chat.designId}/versions/${current}/download?format=${format}`;

  return (
    <>
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <button type="button" onClick={newDesign} disabled={chat.busy} className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700">
        New design
      </button>
      {designs.length > 0 && (
        <select
          aria-label="Earlier designs"
          value={chat.designId ?? ""}
          disabled={chat.busy}
          onChange={(e) => e.target.value && void loadDesign(e.target.value, true)}
          className="max-w-xs rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
        >
          <option value="">Earlier designs...</option>
          {designs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      )}
      {notice && <span className="text-red-700 dark:text-red-400">{notice}</span>}
    </div>
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
            <span className="text-zinc-500">Download version {current}:</span>
            <a className="underline" href={download("step")}>STEP</a>
            <a className="underline" href={download("stl")}>STL</a>
          </div>
        )}
        {spec && <Sliders spec={spec} disabled={chat.busy} onCommit={(item, value) => void commitSlider(item, value)} />}
        {versions.length > 0 && (
          <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs" aria-label="Versions">
            {[...versions].reverse().map((v) => (
              <li key={v.version} className="flex items-center gap-2">
                <span className={v.version === current ? "font-semibold" : "text-zinc-500"}>
                  v{v.version} {v.name} ({v.createdBy}, {v.buildOk ? "built" : "did not build"})
                </span>
                {v.buildOk && v.version !== current && (
                  <button type="button" onClick={() => void useVersion(v.version)} disabled={chat.busy} className="underline disabled:opacity-40">
                    Use this version
                  </button>
                )}
                {v.version === current && <span className="text-zinc-500">showing</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
    </>
  );
}

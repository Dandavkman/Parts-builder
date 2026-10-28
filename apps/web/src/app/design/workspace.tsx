"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyEvent, initialChat, openDesign, parseLines, sendMessage, type ChatItem } from "../../lib/agent/chat-state";
import { setAtPath, type SpecNumber } from "../../lib/agent/spec-numbers";
import type { AgentDimension } from "../../lib/agent/types";
import { shrinkPhoto, type ShrunkPhoto } from "../../lib/photo";
import { ModelViewer } from "../viewer/plate-viewer";
import { OrderPanel } from "./order-panel";
import { Sliders } from "./sliders";
import { START_CHOICES, type StartChoice } from "./start-choices";

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
  const [photo, setPhoto] = useState<ShrunkPhoto | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [dimensions, setDimensions] = useState<AgentDimension[]>([]);
  const [pending, setPending] = useState<AgentDimension[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const designIdRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);

  const clearPhoto = useCallback(() => {
    setPhoto((p) => {
      if (p) URL.revokeObjectURL(p.previewUrl);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  function startWith(choice: StartChoice) {
    if (!choice.available) {
      setNotice(choice.hint);
      return;
    }
    setNotice(null);
    if (choice.id === "photo") {
      fileRef.current?.click();
      return;
    }
    if (choice.example) setDraft(choice.example);
    draftRef.current?.focus();
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    try {
      const shrunk = await shrinkPhoto(file);
      setPhoto((p) => {
        if (p) URL.revokeObjectURL(p.previewUrl);
        return shrunk;
      });
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not use that photo.");
    }
  }

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
      dimensions?: AgentDimension[];
      photoCount?: number;
      pendingDimensions?: AgentDimension[];
    };
    setNotice(null);
    setVersions(data.versions);
    setCurrent(data.design.currentVersion);
    setSpec(data.currentSpec);
    setDimensions(data.dimensions ?? []);
    setPhotoCount(data.photoCount ?? 0);
    setPending(data.pendingDimensions ?? []);
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
    setDimensions([]);
    setPending([]);
    setEdits({});
    setPhotoCount(0);
    clearPhoto();
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

  /** The user's answer to a value found online: confirm it (optionally corrected) or reject it. */
  async function answerSuggestion(item: AgentDimension, action: "confirm" | "reject") {
    const id = designIdRef.current;
    if (!id) return;
    const typed = Number(edits[item.id]);
    const response = await fetch(`/api/designs/${id}/dimensions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        action,
        ...(action === "confirm" && edits[item.id] !== undefined && Number.isFinite(typed) ? { value_mm: typed } : {}),
      }),
    }).catch(() => null);
    if (!response?.ok) setNotice("Could not save your answer.");
    await loadDesign(id, false);
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
    const attached = photo;
    setDraft("");
    clearPhoto();
    setChat((s) => sendMessage(s, attached ? `${text} (with a photo)` : text));
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          design_id: designIdRef.current,
          ...(attached ? { image: { media_type: attached.mediaType, data: attached.base64 } } : {}),
        }),
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
            <div className="grid gap-2 sm:grid-cols-2" aria-label="Ways to start">
              {START_CHOICES.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => startWith(choice)}
                  className={`rounded border border-zinc-300 p-3 text-left dark:border-zinc-700 ${choice.available ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : "opacity-60"}`}
                >
                  <span className="block font-medium">{choice.title}</span>
                  <span className="mt-1 block text-xs text-zinc-500">{choice.hint}</span>
                </button>
              ))}
            </div>
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
        {photo && (
          <div className="flex items-center gap-3 border-t border-zinc-200 px-3 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
            <img src={photo.previewUrl} alt="Photo to send" className="h-12 w-12 rounded object-cover" />
            <span>Photo ready. Tell me one real measurement, or put a card or coin next to the object.</span>
            <button type="button" onClick={clearPhoto} className="underline">
              Remove
            </button>
          </div>
        )}
        <form
          className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Add a photo"
            className="sr-only"
            onChange={(e) => void choosePhoto(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={chat.busy || photoCount >= 4}
            title={photoCount >= 4 ? "This design has the most photos allowed." : "Add a photo to start from"}
            className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-zinc-700"
          >
            Photo
          </button>
          <input
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={4000}
            placeholder={photo ? "Say what to make from this photo" : "Describe the part"}
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
        {pending.length > 0 && (
          <ul className="mt-2 space-y-1 rounded border border-amber-400 p-2 text-xs" aria-label="Found online">
            {pending.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <span>Found online: {d.id} =</span>
                <input
                  type="number"
                  min={0}
                  aria-label={`${d.id} in millimeters`}
                  value={edits[d.id] ?? String(d.value_mm)}
                  onChange={(e) => setEdits((s) => ({ ...s, [d.id]: e.target.value }))}
                  className="w-20 rounded border border-zinc-300 bg-transparent px-1 py-0.5 dark:border-zinc-700"
                />
                <span>mm</span>
                {d.source_url && (
                  <a className="underline" href={d.source_url} target="_blank" rel="noreferrer noopener">
                    source
                  </a>
                )}
                <button type="button" onClick={() => void answerSuggestion(d, "confirm")} disabled={chat.busy} className="rounded bg-zinc-900 px-2 py-0.5 text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900">
                  Confirm
                </button>
                <button type="button" onClick={() => void answerSuggestion(d, "reject")} disabled={chat.busy} className="underline disabled:opacity-40">
                  Not right
                </button>
              </li>
            ))}
          </ul>
        )}
        {dimensions.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs" aria-label="Known sizes">
            {dimensions.map((d) => (
              <li key={d.id} className="text-zinc-500">
                {d.id}: {d.value_mm} mm ({d.confidence === "stated" ? "from you" : d.confidence === "estimated" ? "estimated from a photo, please check" : "published"})
              </li>
            ))}
          </ul>
        )}
        {spec && <Sliders spec={spec} disabled={chat.busy} onCommit={(item, value) => void commitSlider(item, value)} />}
        {designIdRef.current && <OrderPanel key={`${designIdRef.current}-${current}`} designId={designIdRef.current} version={current} />}
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

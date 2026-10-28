"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyEvent, initialChat, openDesign, parseLines, sendMessage, type ChatItem } from "../../lib/agent/chat-state";
import { setAtPath, type SpecNumber } from "../../lib/agent/spec-numbers";
import type { AgentDimension } from "../../lib/agent/types";
import { shrinkPhoto, type ShrunkPhoto } from "../../lib/photo";
import type { StartChoice } from "./start-choices";

export interface DesignRow {
  id: string;
  title: string;
}

export interface VersionRow {
  version: number;
  createdBy: string;
  buildOk: boolean;
  name: string;
}

/**
 * All state and server calls of the design workspace. It renders nothing, so the screen can be restyled
 * or rebuilt freely: components only read what this returns and call the functions on it.
 */
export function useWorkspace() {
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

  // The dashboard links here with ?open=<design id>.
  const openedFromLink = useRef(false);
  useEffect(() => {
    if (openedFromLink.current) return;
    openedFromLink.current = true;
    const id = new URLSearchParams(window.location.search).get("open");
    if (id) void loadDesign(id, true);
  }, [loadDesign]);

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

  const partUrl = chat.designId && current !== null ? `/api/designs/${chat.designId}/versions/${current}/download?format=glb` : null;
  const downloadUrl = (format: string) => `/api/designs/${chat.designId}/versions/${current}/download?format=${format}`;

  return {
    chat,
    draft,
    setDraft,
    designs,
    versions,
    current,
    spec,
    notice,
    photo,
    photoCount,
    dimensions,
    pending,
    edits,
    setEdits,
    designId: designIdRef.current,
    fileRef,
    draftRef,
    partUrl,
    downloadUrl,
    clearPhoto,
    startWith,
    choosePhoto,
    loadDesign,
    newDesign,
    useVersion,
    answerSuggestion,
    commitSlider,
    send,
  };
}
export type Workspace = ReturnType<typeof useWorkspace>;

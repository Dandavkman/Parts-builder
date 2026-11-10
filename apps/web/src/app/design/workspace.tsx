"use client";

import { useState } from "react";
import { ChatPanel } from "./chat-panel";
import { DesignToolbar } from "./design-toolbar";
import { FeedbackPanel } from "./feedback-panel";
import { PartPanel } from "./part-panel";
import { useWorkspace } from "./use-workspace";

type Tab = "design" | "feedback";
const TABS: { id: Tab; label: string }[] = [
  { id: "design", label: "Design" },
  { id: "feedback", label: "Feedback" },
];

/** The design screen: wires the workspace state to its panels. Layout only; the logic is in use-workspace.ts. */
export function Workspace() {
  const w = useWorkspace();
  const [tab, setTab] = useState<Tab>("design");
  return (
    <>
      <DesignToolbar w={w} />
      <div role="tablist" aria-label="Design screen" className="mt-4 flex gap-4 border-b border-line text-sm">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={tab === t.id ? "border-b-2 border-primary pb-2 font-medium" : "pb-2 text-muted"}>
            {t.label}
          </button>
        ))}
      </div>
      {/* The design panels stay mounted so a chat in progress is not lost when switching tabs. */}
      <div hidden={tab !== "design"} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ChatPanel w={w} />
        <PartPanel w={w} />
      </div>
      {tab === "feedback" && (
        <div className="mt-4">
          <FeedbackPanel designId={w.chat.designId ?? w.designId} />
        </div>
      )}
    </>
  );
}

"use client";

import { ChatPanel } from "./chat-panel";
import { DesignToolbar } from "./design-toolbar";
import { PartPanel } from "./part-panel";
import { useWorkspace } from "./use-workspace";

/** The design screen: wires the workspace state to its panels. Layout only; the logic is in use-workspace.ts. */
export function Workspace() {
  const w = useWorkspace();
  return (
    <>
      <DesignToolbar w={w} />
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ChatPanel w={w} />
        <PartPanel w={w} />
      </div>
    </>
  );
}

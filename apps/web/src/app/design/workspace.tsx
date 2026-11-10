"use client";

import { ChatPanel } from "./chat-panel";
import { DesignToolbar } from "./design-toolbar";
import { FeedbackPanel } from "./feedback-panel";
import { PartPanel } from "./part-panel";
import { useWorkspace } from "./use-workspace";

/** The design screen: wires the workspace state to its panels. Layout only; the logic is in use-workspace.ts. */
export function Workspace() {
  const w = useWorkspace();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DesignToolbar w={w} />
      {/* Full height from lg up; stacked and page-scrolling on small screens. The chat panel stays mounted, so a chat in progress is never lost. */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-col lg:flex-[2]">
          <ChatPanel w={w} />
          <FeedbackPanel designId={w.chat.designId ?? w.designId} />
        </div>
        <PartPanel w={w} />
      </div>
    </div>
  );
}

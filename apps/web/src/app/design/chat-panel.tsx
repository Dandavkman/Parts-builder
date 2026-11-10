"use client";

import { parseChatText, type Span } from "../../lib/agent/chat-text";
import { START_CHOICES } from "./start-choices";
import type { Workspace } from "./use-workspace";

function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}
    </>
  );
}

/** An agent message: paragraphs, bullet lists and bold, with no HTML from the model ever inserted. */
function AssistantText({ text }: { text: string }) {
  return (
    <div className="mr-8 space-y-2 rounded bg-raised px-3 py-2">
      {parseChatText(text).map((block, i) =>
        block.type === "list" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>
                <Spans spans={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            <Spans spans={block.spans} />
          </p>
        ),
      )}
    </div>
  );
}

/** The conversation: start choices, messages, the photo tray and the message form. */
export function ChatPanel({ w }: { w: Workspace }) {
  const { chat, startWith, photo, clearPhoto, fileRef, draftRef, choosePhoto, photoCount, draft, setDraft, send } = w;
  return (
    <section className="flex h-[560px] flex-col rounded border border-line">
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite">
        {chat.items.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2" aria-label="Ways to start">
            {START_CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => startWith(choice)}
                className={`rounded border border-line-strong p-3 text-left ${choice.available ? "hover:bg-raised" : "opacity-60"}`}
              >
                <span className="block font-medium">{choice.title}</span>
                <span className="mt-1 block text-xs text-muted">{choice.hint}</span>
              </button>
            ))}
          </div>
        )}
        {chat.items.map((item, i) =>
          item.kind === "assistant" ? (
            <AssistantText key={i} text={item.text} />
          ) : (
          <p
            key={i}
            className={
              item.kind === "user"
                ? "ml-8 rounded bg-primary px-3 py-2 text-on-primary"
                : item.kind === "error"
                  ? "rounded border border-danger-line px-3 py-2 text-danger"
                  : "px-1 text-xs text-muted"
            }
          >
            {item.text}
          </p>
          ),
        )}
        {chat.busy && <p className="px-1 text-xs text-muted">Working...</p>}
      </div>
      {photo && (
        <div className="flex items-center gap-3 border-t border-line px-3 pt-3 text-xs text-muted">
          <img src={photo.previewUrl} alt="Photo to send" className="h-12 w-12 rounded object-cover" />
          <span>Photo ready. Tell me one real measurement, or put a card or coin next to the object.</span>
          <button type="button" onClick={clearPhoto} className="underline">
            Remove
          </button>
        </div>
      )}
      <form
        className="flex gap-2 border-t border-line p-3"
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
          className="rounded border border-line-strong px-3 py-2 text-sm disabled:opacity-40"
        >
          Photo
        </button>
        <input
          ref={draftRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={4000}
          placeholder={photo ? "Say what to make from this photo" : "Describe the part"}
          className="min-w-0 flex-1 rounded border border-line-strong bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={chat.busy || draft.trim() === ""}
          className="rounded bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </section>
  );
}

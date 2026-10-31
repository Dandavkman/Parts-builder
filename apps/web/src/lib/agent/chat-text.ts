/** The little bit of markdown the agent uses in chat: **bold**, "- " bullets and blank-line paragraphs. */
export interface Span {
  text: string;
  bold: boolean;
}

export type Block = { type: "paragraph"; spans: Span[] } | { type: "list"; items: Span[][] };

export function parseSpans(line: string): Span[] {
  const spans: Span[] = [];
  const parts = line.split(/\*\*(.+?)\*\*/g);
  parts.forEach((text, i) => {
    if (text) spans.push({ text, bold: i % 2 === 1 });
  });
  return spans;
}

/** Splits agent text into paragraphs and bullet lists. Anything else is shown as plain text. */
export function parseChatText(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", spans: parseSpans(paragraph.join("\n")) });
    paragraph = [];
  };
  for (const line of text.split("\n")) {
    const bullet = /^\s*[-*] +(.+)$/.exec(line);
    if (bullet) {
      flush();
      const last = blocks.at(-1);
      if (last?.type === "list") last.items.push(parseSpans(bullet[1]));
      else blocks.push({ type: "list", items: [parseSpans(bullet[1])] });
    } else if (line.trim() === "") {
      flush();
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

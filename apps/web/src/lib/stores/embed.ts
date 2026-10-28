const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The HTML a seller pastes on their own site to show a buy button for one listing. Loads `/embed.js` from our site. */
export function embedSnippet(origin: string, storeSlug: string, listingId: string): string {
  return [
    `<div data-parts-buy data-store="${esc(storeSlug)}" data-listing="${esc(listingId)}"></div>`,
    `<script async src="${esc(origin.replace(/\/+$/, ""))}/embed.js"></script>`,
  ].join("\n");
}

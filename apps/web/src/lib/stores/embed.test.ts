import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { embedSnippet } from "./embed";

describe("buy button", () => {
  it("builds a snippet that cannot break out of its attributes", () => {
    const s = embedSnippet("https://site.example/", 'a"b', "id<1>");
    expect(s).toContain('data-store="a&quot;b"');
    expect(s).toContain('data-listing="id&lt;1&gt;"');
    expect(s).toContain('<script async src="https://site.example/embed.js"></script>');
  });

  it("embed.js turns a placeholder into a link to the listing page and fills in the price", async () => {
    const code = readFileSync(join(__dirname, "../../../public/embed.js"), "utf8");
    const attrs: Record<string, string> = { "data-store": "knob-works", "data-listing": "abc" };
    const children: { href?: string; textContent?: string; style: Record<string, string> }[] = [];
    const el = { getAttribute: (n: string) => attrs[n] ?? null, setAttribute: (n: string, v: string) => (attrs[n] = v), appendChild: (c: never) => children.push(c) };
    const urls: string[] = [];
    const document = {
      currentScript: { src: "https://site.example/embed.js" },
      querySelectorAll: () => [el],
      createElement: () => ({ style: {} as Record<string, string>, set href(v: string) { (this as { _h?: string })._h = v; }, get href() { return (this as { _h?: string })._h ?? ""; } }),
    };
    const fetch = async (u: string) => {
      urls.push(u);
      return { ok: true, json: async () => ({ listings: [{ id: "abc", title: "Knob", retailCents: 1234 }] }) };
    };
    runInNewContext(code, { document, fetch, URL, encodeURIComponent });
    await new Promise((r) => setTimeout(r, 0));
    expect(children).toHaveLength(1);
    expect(children[0].href).toBe("https://site.example/shop/knob-works/abc");
    expect(children[0].textContent).toBe("Buy Knob - $12.34");
    expect(urls).toEqual(["https://site.example/api/shop/knob-works"]);
  });
});

import { describe, expect, it } from "vitest";
import { listForSale, listingDraft } from "./list-for-sale";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("listingDraft", () => {
  it("splits the margin above the floor", () => {
    const d = listingDraft(2000, "30", " Knob ");
    expect(d.ok && d.retailCents).toBe(3000);
    expect(d.ok && d.title).toBe("Knob");
    expect(d.ok && d.split.royaltyCents + (d.ok ? d.split.platformFeeCents : 0)).toBe(1000);
  });
  it("refuses a price below the floor, an empty title, or a bad number", () => {
    expect(listingDraft(2000, "10", "x")).toMatchObject({ ok: false });
    expect(listingDraft(2000, "30", " ")).toMatchObject({ ok: false });
    expect(listingDraft(2000, "abc", "x")).toMatchObject({ ok: false });
    expect(listingDraft(2000, "", "x")).toMatchObject({ ok: false });
  });
});

describe("listForSale", () => {
  const input = { designId: "d", quoteId: "q", retailCents: 3000, title: "Knob" };
  it("posts to the seller's own store", async () => {
    const calls: string[] = [];
    const f = (async (url: string) => {
      calls.push(url);
      return url === "/api/stores" ? json({ store: { id: "s1" } }) : json({ listing: { id: "l1" } }, 201);
    }) as unknown as typeof fetch;
    expect(await listForSale(input, f)).toEqual({ ok: true, data: { listingId: "l1" } });
    expect(calls).toEqual(["/api/stores", "/api/stores/s1/listings"]);
  });
  it("tells the seller to open a store first", async () => {
    const f = (async () => json({ store: null })) as unknown as typeof fetch;
    const r = await listForSale(input, f);
    expect(!r.ok && r.error).toMatch(/Open your store/);
  });
  it("passes on the server's sentence and survives a network failure", async () => {
    const f = (async (url: string) => (url === "/api/stores" ? json({ store: { id: "s1" } }) : json({ error: "Not allowed." }, 422))) as unknown as typeof fetch;
    expect(await listForSale(input, f)).toEqual({ ok: false, error: "Not allowed." });
    const down = (async () => {
      throw new Error("x");
    }) as unknown as typeof fetch;
    expect((await listForSale(input, down)).ok).toBe(false);
  });
});

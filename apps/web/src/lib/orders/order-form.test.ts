import { describe, expect, it } from "vitest";
import { emptyOrderForm, readOrderForm, submitListingOrder, type OrderForm } from "./order-form";

const filled: OrderForm = { ...emptyOrderForm, name: "Ada", line1: "1 Main St", city: "Denver", region: "CO", postal_code: "80202", email: " ada@example.com ", confirmNotSafetyCritical: true, acceptFitTerms: true };
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("readOrderForm", () => {
  it("builds the request body, trimming the email and dropping an empty one", () => {
    const r = readOrderForm(filled);
    expect(r).toMatchObject({ ok: true, payload: { email: "ada@example.com", confirmNotSafetyCritical: true, acceptFitTerms: true } });
    const none = readOrderForm({ ...filled, email: "" });
    expect(none.ok && "email" in none.payload).toBe(false);
  });
  it("lists every problem in plain words", () => {
    const r = readOrderForm({ ...emptyOrderForm, email: "nope" });
    expect(r.ok).toBe(false);
    const text = (!r.ok && r.errors.join(" ")) || "";
    expect(text).toContain("Name is required");
    expect(text).toContain("email address");
    expect(text).toContain("not safety-critical");
    expect(text).toContain("fit terms");
  });
});

describe("submitListingOrder", () => {
  it("does not call the server for an invalid form", async () => {
    let called = false;
    const out = await submitListingOrder("l1", emptyOrderForm, (async () => { called = true; return new Response("{}"); }) as unknown as typeof fetch);
    expect(out.kind).toBe("error");
    expect(called).toBe(false);
  });
  it("sends the order to the listing's route and follows the answer", async () => {
    let url = "";
    let body = "";
    const spy = (async (u: string, init: RequestInit) => { url = u; body = String(init.body); return new Response(JSON.stringify({ checkoutUrl: "https://pay.example/x" }), { status: 201 }); }) as unknown as typeof fetch;
    expect(await submitListingOrder("a b", filled, spy)).toEqual({ kind: "redirect", url: "https://pay.example/x" });
    expect(url).toBe("/api/listings/a%20b/order");
    expect(JSON.parse(body).shipping.city).toBe("Denver");
    expect(await submitListingOrder("l1", filled, reply(201, { order: { id: "o1" } }))).toEqual({ kind: "placed", orderId: "o1" });
  });
  it("asks to sign in, and shows the server's reason", async () => {
    expect(await submitListingOrder("l1", filled, reply(401, { error: "Sign in required" }))).toEqual({ kind: "sign_in" });
    expect(await submitListingOrder("l1", filled, reply(409, { error: "Making this part now costs more" }))).toEqual({ kind: "error", errors: ["Making this part now costs more"] });
    expect(await submitListingOrder("l1", filled, reply(503, { error: "Ordering is not open yet." }))).toEqual({ kind: "error", errors: ["Ordering is not open yet."] });
  });
  it("survives a network failure", async () => {
    const out = await submitListingOrder("l1", filled, (async () => { throw new Error("offline"); }) as unknown as typeof fetch);
    expect(out).toMatchObject({ kind: "error" });
  });
});

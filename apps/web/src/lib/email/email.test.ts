import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createDesign, recorderFor } from "../agent/store";
import { runnerFor, type Db } from "../db/client";
import { migrate } from "../db/migrations";
import * as schema from "../db/schema";
import { createOrder, type Order } from "../orders/store";
import { buildQuotes } from "../quotes/engine";
import { saveQuotes } from "../quotes/store";
import { getMailer, logMailer, validEmail, type Mailer } from "./mailer";
import { notifyOrder } from "./notify";
import { eventForMove, renderOrderEmail, type OrderEmailEvent } from "./templates";

const data = { orderId: "ord-1", materialName: "PETG (FDM)", quantity: 2, totalCents: 4510, trackingNumber: "1Z999", placeholder: false };

describe("templates", () => {
  it("renders every event with the order and, for shipping, the tracking number", () => {
    const events: OrderEmailEvent[] = ["order_confirmed", "sent_to_production", "shipped", "delivered", "review_approved", "review_rejected"];
    for (const e of events) {
      const mail = renderOrderEmail(e, data);
      expect(mail.subject.length).toBeGreaterThan(5);
      expect(mail.text).toContain("ord-1");
      expect(mail.text).toContain("$45.10");
    }
    expect(renderOrderEmail("shipped", data).text).toContain("1Z999");
  });

  it("marks emails made from placeholder prices as tests", () => {
    expect(renderOrderEmail("order_confirmed", { ...data, placeholder: true }).subject).toContain("TEST");
    expect(renderOrderEmail("order_confirmed", data).subject).not.toContain("TEST");
  });

  it("maps status moves to emails", () => {
    expect(eventForMove("sent_to_partner", "in_production")).toBe("sent_to_production");
    expect(eventForMove("in_production", "shipped")).toBe("shipped");
    expect(eventForMove("shipped", "delivered")).toBe("delivered");
    expect(eventForMove("in_review", "sent_to_partner")).toBe("review_approved");
    expect(eventForMove("in_review", "refunded")).toBe("review_rejected");
    expect(eventForMove("paid", "sent_to_partner")).toBeNull();
  });
});

describe("mailer", () => {
  it("only logs without a key and sender", () => {
    expect(getMailer({})).toBe(logMailer);
    expect(getMailer({ RESEND_API_KEY: "k" })).toBe(logMailer);
  });

  it("posts to the email service with the key", async () => {
    const doFetch = vi.fn(async () => new Response("{}", { status: 200 }));
    await getMailer({ RESEND_API_KEY: "k", EMAIL_FROM: "Parts <orders@example.com>" }, doFetch as unknown as typeof fetch).send({ to: "a@b.co", subject: "S", text: "T" });
    const [url, init] = doFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer k");
    expect(JSON.parse(String(init.body))).toMatchObject({ to: ["a@b.co"], subject: "S" });
  });

  it("throws when the service refuses", async () => {
    const doFetch = vi.fn(async () => new Response("no", { status: 422 }));
    await expect(getMailer({ RESEND_API_KEY: "k", EMAIL_FROM: "f" }, doFetch as unknown as typeof fetch).send({ to: "a@b.co", subject: "S", text: "T" })).rejects.toThrow(/422/);
  });

  it("checks email shape", () => {
    expect(validEmail("a@b.co")).toBe(true);
    for (const bad of ["a@b", "a b@c.de", "", 5, null]) expect(validEmail(bad)).toBe(false);
  });
});

describe("notifyOrder", () => {
  let db: Db;
  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema }) as unknown as Db;
    await migrate(runnerFor(db));
  });

  async function order(email?: string): Promise<Order> {
    const spec = { spec_version: "1.1", features: [{ type: "plate", id: "a", thickness_mm: 3 }] };
    const designId = await createDesign(db, "n1", "Part");
    await recorderFor(db, designId).version({ spec, ok: true, errors: [], createdBy: "agent", anchors: [] });
    const { quotes } = buildQuotes({ volume_mm3: 20_000, size_mm: [50, 40, 10], spec, quantity: 1 });
    const [quote] = await saveQuotes(db, designId, 1, quotes);
    const r = await createOrder(db, {
      ownerId: "n1", designId, quoteId: quote.id, contactEmail: email, confirmedNotSafetyCritical: true, acceptedFitTerms: true,
      address: { name: "A", line1: "1", city: "C", region: "R", postal_code: "1", country: "US" },
    });
    if (!r.ok) throw new Error("setup");
    return r.order;
  }

  const fake = () => {
    const send = vi.fn(async () => undefined);
    return { mailer: { name: "fake", send } as Mailer, send };
  };

  it("sends each event once, even if asked twice", async () => {
    const o = await order("buyer@example.com");
    const { mailer, send } = fake();
    expect(await notifyOrder(db, o, "order_confirmed", mailer)).toBe("sent");
    expect(await notifyOrder(db, o, "order_confirmed", mailer)).toBe("skipped");
    expect(await notifyOrder(db, o, "shipped", mailer)).toBe("sent");
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]).toMatchObject([{ to: "buyer@example.com" }]);
  });

  it("skips orders with no email address", async () => {
    const o = await order();
    const { mailer, send } = fake();
    expect(await notifyOrder(db, o, "order_confirmed", mailer)).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
  });

  it("lets a failed send be retried and never throws", async () => {
    const o = await order("buyer@example.com");
    const bad: Mailer = { name: "bad", send: async () => { throw new Error("down"); } };
    expect(await notifyOrder(db, o, "delivered", bad)).toBe("failed");
    const { mailer, send } = fake();
    expect(await notifyOrder(db, o, "delivered", mailer)).toBe("sent");
    expect(send).toHaveBeenCalledTimes(1);
  });
});

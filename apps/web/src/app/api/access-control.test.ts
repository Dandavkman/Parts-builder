import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROTECTED_PATHS } from "../../lib/auth-mode";

/**
 * Access-control sweep (task B2.12a). Every API route file is found on disk, so a route added later
 * without a sign-in check fails here instead of shipping open. Routes that are public on purpose are
 * listed in PUBLIC and must protect themselves another way.
 */
const who = vi.hoisted(() => ({ current: "signed-out" as "signed-out" | "user" }));

vi.mock("../../lib/require-owner", () => ({
  requireOwner: async () =>
    who.current === "user"
      ? { ownerId: "user_not_admin" }
      : { response: Response.json({ error: "Sign in required" }, { status: 401 }) },
}));

const here = dirname(fileURLToPath(import.meta.url));
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const UUID = "00000000-0000-0000-0000-000000000000";

/** Public on purpose: the Stripe webhook checks a signature, the waitlist takes an email from anyone. */
const PUBLIC = new Set(["stripe/webhook", "waitlist", "vehicles"]);

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? routeFiles(join(dir, e.name)) : e.name === "route.ts" ? [join(dir, e.name)] : [],
  );
}

const routes = routeFiles(here).map((file) => {
  const path = relative(here, dirname(file)).split("\\").join("/");
  return { file, path, url: `/api/${path.replace(/\[[^\]]+\]/g, UUID)}`, params: Object.fromEntries([...path.matchAll(/\[([^\]]+)\]/g)].map((m) => [m[1], m[1] === "version" ? "1" : UUID])) };
});

async function call(route: (typeof routes)[number], method: (typeof METHODS)[number]) {
  const mod = (await import(/* @vite-ignore */ route.file)) as Record<string, unknown>;
  const handler = mod[method] as ((r: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>) | undefined;
  if (!handler) return null;
  const request = new Request(`http://localhost${route.url}`, { method, headers: { "content-type": "application/json" }, body: method === "GET" ? undefined : "{}" });
  return handler(request, { params: Promise.resolve(route.params) });
}

beforeEach(() => {
  who.current = "signed-out";
});

describe("API routes", () => {
  it("finds the routes", () => {
    expect(routes.length).toBeGreaterThan(20);
  });

  it("every non-public route rejects a signed-out caller with 401", async () => {
    for (const route of routes.filter((r) => !PUBLIC.has(r.path))) {
      for (const method of METHODS) {
        const res = await call(route, method);
        // demo-plate predates require-owner and fails closed (503) when auth is not configured.
        const allowed = route.path === "demo-plate" ? [401, 503] : [401];
        if (res) expect({ route: route.path, method, ok: allowed.includes(res.status) }).toEqual({ route: route.path, method, ok: true });
      }
    }
  });

  it("every admin route rejects a signed-in non-admin with 403", async () => {
    who.current = "user";
    const adminRoutes = routes.filter((r) => r.path.startsWith("admin/"));
    expect(adminRoutes.length).toBeGreaterThanOrEqual(9);
    for (const route of adminRoutes) {
      for (const method of METHODS) {
        const res = await call(route, method);
        if (res) expect({ route: route.path, method, status: res.status }).toEqual({ route: route.path, method, status: 403 });
      }
    }
  });

  it("every non-public route is covered by the sign-in middleware's protected paths", () => {
    const prefixes = PROTECTED_PATHS.map((p) => p.replace("(.*)", ""));
    for (const route of routes.filter((r) => !PUBLIC.has(r.path))) {
      expect({ route: route.path, protectedByMiddleware: prefixes.some((p) => `/api/${route.path}`.startsWith(p)) }).toEqual({ route: route.path, protectedByMiddleware: true });
    }
  });

  it("the Stripe webhook refuses a request with no signature", async () => {
    const route = routes.find((r) => r.path === "stripe/webhook")!;
    const original = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    try {
      const res = await call(route, "POST");
      expect(res?.status).toBe(400);
    } finally {
      if (original === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = original;
    }
  });
});

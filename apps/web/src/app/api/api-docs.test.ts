import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** docs/api.md lists every route handler, so the redesign and other tools can rely on it. A new route must be added there. */
const here = dirname(fileURLToPath(import.meta.url));
const docs = readFileSync(join(here, "../../../../../docs/api.md"), "utf8");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? routeFiles(join(dir, e.name)) : e.name === "route.ts" ? [join(dir, e.name)] : [],
  );
}

describe("docs/api.md", () => {
  const handlers = routeFiles(here).flatMap((file) => {
    const path = `/api/${relative(here, dirname(file)).split("\\").join("/")}`;
    const source = readFileSync(file, "utf8");
    return [...source.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE|OPTIONS)\b/g)].map((m) => ({ path, method: m[1] }));
  });

  it("finds the routes", () => {
    expect(handlers.length).toBeGreaterThan(40);
  });

  it.each(handlers.map((h) => [h.method, h.path]))("documents %s %s", (method, path) => {
    expect(docs).toContain(`| \`${path}\` | ${method} |`);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

// Raw palette colours, `dark:` colour overrides and hex colours belong in globals.css only.
const RAW = /\b(?:bg|text|border|ring|fill|stroke|divide|placeholder|from|to|via)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b|\bdark:(?:bg|text|border)-|["'`]#[0-9a-fA-F]{3,8}["'`]/;

describe("design tokens", () => {
  it("keeps raw colours out of components", () => {
    const offenders: string[] = [];
    for (const file of files(join(__dirname, "app"))) {
      if (file.includes("plate-viewer")) continue; // 3D scene lighting and material, not page styling
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (RAW.test(line)) offenders.push(`${file.slice(__dirname.length + 1)}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});

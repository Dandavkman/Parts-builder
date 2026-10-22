// Generates TypeScript types from the Part Spec JSON Schemas, the single source of truth.
// Each schema version gets its own file; older versions stay buildable, so they stay typed.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compileFromFile } from "json-schema-to-typescript";

const versions = [
  { schema: "part-spec.schema.json", out: "part-spec.ts" },
  { schema: "part-spec.v1.schema.json", out: "part-spec-v1.ts" },
];

for (const { schema, out } of versions) {
  const ts = await compileFromFile(
    fileURLToPath(new URL(`../../../services/geometry/src/geometry/spec/${schema}`, import.meta.url)),
    {
      bannerComment: `/* Generated from services/geometry/src/geometry/spec/${schema}. Do not edit. Run \`pnpm generate\`. */`,
      additionalProperties: false,
    },
  );
  await writeFile(fileURLToPath(new URL(`../src/generated/${out}`, import.meta.url)), ts);
}

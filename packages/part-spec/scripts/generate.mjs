// Generates TypeScript types from the Part Spec JSON Schema, the single source of truth.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compileFromFile } from "json-schema-to-typescript";

const schema = fileURLToPath(
  new URL("../../../services/geometry/src/geometry/spec/part-spec.schema.json", import.meta.url),
);
const out = fileURLToPath(new URL("../src/generated/part-spec.ts", import.meta.url));

const ts = await compileFromFile(schema, {
  bannerComment:
    "/* Generated from services/geometry/src/geometry/spec/part-spec.schema.json. Do not edit. Run `pnpm generate`. */",
  additionalProperties: false,
});
await writeFile(out, ts);

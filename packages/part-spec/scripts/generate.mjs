// Generates TypeScript types from the Part Spec JSON Schemas, the single source of truth.
// Each schema version gets its own file; older versions stay buildable, so they stay typed.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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

// The design agent's prompt quotes the v1 schema and every example verbatim, so the model never
// has to guess field names. The web app cannot read files outside apps/web at run time, so the
// data is copied into a generated module there.
const specDir = fileURLToPath(new URL("../../../services/geometry/src/geometry/spec/", import.meta.url));
const schema = JSON.parse(await readFile(`${specDir}part-spec.v1.schema.json`, "utf8"));
const exampleFiles = (await readdir(`${specDir}examples/v1`)).filter((f) => f.endsWith(".json")).sort();
const examples = [];
for (const file of exampleFiles) {
  examples.push(JSON.parse(await readFile(`${specDir}examples/v1/${file}`, "utf8")));
}
const agentDir = fileURLToPath(new URL("../../../apps/web/src/lib/agent/generated/", import.meta.url));
await mkdir(agentDir, { recursive: true });
await writeFile(
  `${agentDir}part-spec-v1-reference.ts`,
  `/* Generated from services/geometry/src/geometry/spec (part-spec.v1.schema.json and examples/v1). Do not edit. Run \`pnpm generate\`. */
export const PART_SPEC_V1_SCHEMA: Record<string, unknown> = ${JSON.stringify(schema, null, 2)};

export const PART_SPEC_V1_EXAMPLES: Record<string, unknown>[] = ${JSON.stringify(examples, null, 2)};
`,
);

// Generates TypeScript types from the Part Spec JSON Schemas, the single source of truth.
// Each schema version gets its own file; older versions stay buildable, so they stay typed.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compileFromFile } from "json-schema-to-typescript";

const versions = [
  { schema: "part-spec.schema.json", out: "part-spec.ts" },
  { schema: "part-spec.v1.schema.json", out: "part-spec-v1.ts" },
  { schema: "part-spec.v1_1.schema.json", out: "part-spec-v1-1.ts" },
  { schema: "part-spec.v2.schema.json", out: "part-spec-v2.ts" },
  { schema: "part-spec.v2_1.schema.json", out: "part-spec-v2-1.ts" },
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

// The design agent's prompt quotes the latest schema (1.1) and every example verbatim, so the model never
// has to guess field names. The web app cannot read files outside apps/web at run time, so the
// data is copied into a generated module there.
const specDir = fileURLToPath(new URL("../../../services/geometry/src/geometry/spec/", import.meta.url));
const schema = JSON.parse(await readFile(`${specDir}part-spec.v1_1.schema.json`, "utf8"));
// v1 examples are valid 1.1 specs once their version is bumped (tests check this); 1.1 adds its own.
const examples = [];
for (const file of (await readdir(`${specDir}examples/v1`)).filter((f) => f.endsWith(".json")).sort()) {
  examples.push({ ...JSON.parse(await readFile(`${specDir}examples/v1/${file}`, "utf8")), spec_version: "1.1" });
}
for (const file of (await readdir(`${specDir}examples/v1_1`)).filter((f) => f.endsWith(".json")).sort()) {
  examples.push(JSON.parse(await readFile(`${specDir}examples/v1_1/${file}`, "utf8")));
}
const agentDir = fileURLToPath(new URL("../../../apps/web/src/lib/agent/generated/", import.meta.url));
await mkdir(agentDir, { recursive: true });
await writeFile(
  `${agentDir}part-spec-v1-reference.ts`,
  `/* Generated from services/geometry/src/geometry/spec (part-spec.v1_1.schema.json and examples). Do not edit. Run \`pnpm generate\`. */
export const PART_SPEC_V1_SCHEMA: Record<string, unknown> = ${JSON.stringify(schema, null, 2)};

export const PART_SPEC_V1_EXAMPLES: Record<string, unknown>[] = ${JSON.stringify(examples, null, 2)};
`,
);

// The same for Part Spec 2.0 (task B1.17d). The agent only quotes it when DESIGN_AGENT_SPEC_VERSION=2.0,
// which is switched on after the Fly geometry service has been redeployed. Every older example is a valid
// 2.0 spec once its version is bumped (tested), so all of them are quoted.
const schema2 = JSON.parse(await readFile(`${specDir}part-spec.v2.schema.json`, "utf8"));
const examples2 = examples.map((e) => ({ ...e, spec_version: "2.0" }));
for (const file of (await readdir(`${specDir}examples/v2`)).filter((f) => f.endsWith(".json")).sort()) {
  examples2.push(JSON.parse(await readFile(`${specDir}examples/v2/${file}`, "utf8")));
}
await writeFile(
  `${agentDir}part-spec-v2-reference.ts`,
  `/* Generated from services/geometry/src/geometry/spec (part-spec.v2.schema.json and examples). Do not edit. Run \`pnpm generate\`. */
export const PART_SPEC_V2_SCHEMA: Record<string, unknown> = ${JSON.stringify(schema2, null, 2)};

export const PART_SPEC_V2_EXAMPLES: Record<string, unknown>[] = ${JSON.stringify(examples2, null, 2)};
`,
);

// And for Part Spec 2.1 (blind bores, separate round-overs), quoted when DESIGN_AGENT_SPEC_VERSION=2.1.
// Every 2.0 example is a valid 2.1 spec once its version is bumped (tested).
const schema21 = JSON.parse(await readFile(`${specDir}part-spec.v2_1.schema.json`, "utf8"));
const examples21 = examples2.map((e) => ({ ...e, spec_version: "2.1" }));
for (const file of (await readdir(`${specDir}examples/v2_1`)).filter((f) => f.endsWith(".json")).sort()) {
  examples21.push(JSON.parse(await readFile(`${specDir}examples/v2_1/${file}`, "utf8")));
}
await writeFile(
  `${agentDir}part-spec-v2-1-reference.ts`,
  `/* Generated from services/geometry/src/geometry/spec (part-spec.v2_1.schema.json and examples). Do not edit. Run \`pnpm generate\`. */
export const PART_SPEC_V2_1_SCHEMA: Record<string, unknown> = ${JSON.stringify(schema21, null, 2)};

export const PART_SPEC_V2_1_EXAMPLES: Record<string, unknown>[] = ${JSON.stringify(examples21, null, 2)};
`,
);

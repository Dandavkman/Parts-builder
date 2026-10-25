import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { PACKAGE_NAME, PART_SPEC_VERSION, SUPPORTED_SPEC_VERSIONS } from "./index";

const specDir = fileURLToPath(
  new URL("../../../services/geometry/src/geometry/spec/", import.meta.url),
);
const schema = JSON.parse(readFileSync(`${specDir}part-spec.schema.json`, "utf8"));
const validate = new Ajv2020({ strict: false }).compile(schema);
const examples = readdirSync(`${specDir}examples`).filter((f) => f.endsWith(".json"));

describe("part-spec package", () => {
  it("is wired into the workspace", () => {
    expect(PACKAGE_NAME).toBe("@parts-builder/part-spec");
  });

  it("matches the schema versions", () => {
    expect(schema.properties.spec_version.enum).toEqual([...SUPPORTED_SPEC_VERSIONS]);
    expect(SUPPORTED_SPEC_VERSIONS.at(-1)).toBe(PART_SPEC_VERSION);
  });

  it.each(examples)("example %s is valid", (file) => {
    const spec = JSON.parse(readFileSync(`${specDir}examples/${file}`, "utf8"));
    expect(validate(spec), JSON.stringify(validate.errors)).toBe(true);
  });

  it("rejects a plate with negative thickness", () => {
    const spec = JSON.parse(readFileSync(`${specDir}examples/plate-with-two-holes.json`, "utf8"));
    spec.features[0].thickness_mm = -1;
    expect(validate(spec)).toBe(false);
  });
});

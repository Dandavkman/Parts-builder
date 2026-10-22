import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { PACKAGE_NAME, PART_SPEC_VERSION } from "./index";

const specDir = fileURLToPath(
  new URL("../../../services/geometry/src/geometry/spec/", import.meta.url),
);
const ajv = new Ajv2020({ strict: false });
const schema = JSON.parse(readFileSync(`${specDir}part-spec.v1.schema.json`, "utf8"));
const validate = ajv.compile(schema);
const v01Schema = JSON.parse(readFileSync(`${specDir}part-spec.schema.json`, "utf8"));
const validateV01 = ajv.compile(v01Schema);
const examples = readdirSync(`${specDir}examples/v1`).filter((f) => f.endsWith(".json"));
const v01Examples = readdirSync(`${specDir}examples`).filter((f) => f.endsWith(".json"));

describe("part-spec package", () => {
  it("is wired into the workspace", () => {
    expect(PACKAGE_NAME).toBe("@parts-builder/part-spec");
  });

  it("matches the schema version", () => {
    expect(schema.properties.spec_version.const).toBe(PART_SPEC_VERSION);
  });

  it.each(examples)("v1 example %s is valid", (file) => {
    const spec = JSON.parse(readFileSync(`${specDir}examples/v1/${file}`, "utf8"));
    expect(validate(spec), JSON.stringify(validate.errors)).toBe(true);
  });

  it.each(v01Examples)("v0.1 example %s still validates against the v0.1 schema", (file) => {
    const spec = JSON.parse(readFileSync(`${specDir}examples/${file}`, "utf8"));
    expect(validateV01(spec), JSON.stringify(validateV01.errors)).toBe(true);
  });

  it("rejects a plate with negative thickness", () => {
    const spec = JSON.parse(readFileSync(`${specDir}examples/v1/hole.json`, "utf8"));
    spec.features[0].thickness_mm = -1;
    expect(validate(spec)).toBe(false);
  });
});

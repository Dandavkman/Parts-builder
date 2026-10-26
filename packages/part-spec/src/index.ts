export const PACKAGE_NAME = "@parts-builder/part-spec";
/** The current Part Spec version. Older versions stay buildable. */
export const PART_SPEC_VERSION = "1.1";
export const SUPPORTED_SPEC_VERSIONS = ["0.1", "1.0", "1.1"] as const;
export type { PartSpecV1_1 as PartSpec } from "./generated/part-spec-v1-1";
export type { PartSpecV1 } from "./generated/part-spec-v1";
export type { PartSpec as PartSpecV0_1 } from "./generated/part-spec";

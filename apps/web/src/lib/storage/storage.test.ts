import { describe, expect, it } from "vitest";
import { memoryStorage } from "./memory";
import { r2Config } from "./r2";
import { MAX_SCAN_BYTES, scanKey, validateScanUpload } from "./scan-upload";
import { DownloadRefused } from "./types";

describe("memory storage", () => {
  it("stores, reads and deletes a file", async () => {
    const s = memoryStorage();
    await s.put("designs/a.stl", new Uint8Array([1, 2, 3]), "model/stl");
    expect([...(await s.get("designs/a.stl"))!]).toEqual([1, 2, 3]);
    await s.delete("designs/a.stl");
    expect(await s.get("designs/a.stl")).toBeNull();
  });

  it("never gives out a download link for a library scan, but does for a user's own file", async () => {
    const s = memoryStorage();
    await expect(s.presignGet("library/miata/engine-bay.ply", 60)).rejects.toBeInstanceOf(DownloadRefused);
    await expect(s.presignGet("scans/u1/s1/mine.ply", 60)).resolves.toContain("scans/u1/s1/mine.ply");
  });
});

describe("r2Config", () => {
  it("is null unless all four settings are present", () => {
    expect(r2Config({})).toBeNull();
    expect(r2Config({ R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c" })).toBeNull();
    expect(r2Config({ R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET: "d" })).toEqual({
      accountId: "a",
      accessKeyId: "b",
      secretAccessKey: "c",
      bucket: "d",
    });
  });
});

describe("scan upload rules", () => {
  it("accepts the allowed formats up to 1 GB, in any letter case", () => {
    expect(validateScanUpload("Engine.PLY", 500_000_000)).toEqual({ ok: true, extension: ".ply" });
    expect(validateScanUpload("a.zip", MAX_SCAN_BYTES).ok).toBe(true);
  });

  it("rejects other formats, missing sizes and oversize files", () => {
    expect(validateScanUpload("a.step", 10).ok).toBe(false);
    expect(validateScanUpload("noextension", 10).ok).toBe(false);
    expect(validateScanUpload("a.stl", 0).ok).toBe(false);
    expect(validateScanUpload("a.stl", "10").ok).toBe(false);
    expect(validateScanUpload("a.stl", MAX_SCAN_BYTES + 1).ok).toBe(false);
  });

  it("keeps a scan under its owner's folder whatever the filename says", () => {
    expect(scanKey("user_1", "s1", "../../etc/passwd")).toBe("scans/user_1/s1/_.._etc_passwd");
    expect(scanKey("user/../x", "s1", "a b.ply")).toBe("scans/user____x/s1/a_b.ply");
    expect(scanKey("u", "s", "...")).toBe("scans/u/s/scan");
  });
});

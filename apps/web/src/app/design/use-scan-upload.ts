"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_SCAN_BYTES, validateScanUpload } from "../../lib/storage/scan-upload";

export interface AttachedScan {
  id: string | null;
  name: string;
  sizeBytes: number;
  /** True once the server has the scan on the design. A scan uploaded before the first message is attached by that message. */
  attached: boolean;
}

/** Uploading a scan: asks the server for an upload URL, sends the file straight to storage with progress, then confirms. Renders nothing. */
export function useScanUpload(getDesignId: () => string | null) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [scan, setScan] = useState<AttachedScan | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/scans")
      .then((r) => (r.ok ? (r.json() as Promise<{ enabled: boolean }>) : { enabled: false }))
      .then((d) => setEnabled(d.enabled))
      .catch(() => setEnabled(false));
  }, []);

  const upload = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      const checked = validateScanUpload(file.name, file.size);
      if (!checked.ok) return setError(checked.errors.join(" "));
      setProgress(0);
      try {
        const start = await fetch("/api/scans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, size_bytes: file.size }) });
        const started = (await start.json().catch(() => ({}))) as { scan_id?: string; upload_url?: string; content_type?: string; error?: string };
        if (!start.ok || !started.scan_id || !started.upload_url) throw new Error(started.error ?? "Could not start the upload.");
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", started.upload_url!);
          xhr.setRequestHeader("content-type", started.content_type ?? "application/octet-stream");
          xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The upload was refused. Please try again.")));
          xhr.onerror = () => reject(new Error("The upload was interrupted. Please try again."));
          xhr.send(file);
        });
        const designId = getDesignId();
        const done = await fetch(`/api/scans/${started.scan_id}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(designId ? { design_id: designId } : {}) });
        if (!done.ok) throw new Error("The scan uploaded but could not be saved. Please try again.");
        setScan({ id: started.scan_id, name: file.name, sizeBytes: file.size, attached: designId !== null });
      } catch (e) {
        setError(e instanceof Error ? e.message : "The upload failed.");
      } finally {
        setProgress(null);
      }
    },
    [getDesignId],
  );

  return {
    enabled,
    scan,
    progress,
    error,
    upload,
    maxMb: Math.round(MAX_SCAN_BYTES / (1024 * 1024)),
    /** The scan id the next message should attach, when the scan was uploaded before the design existed. */
    pendingScanId: scan && !scan.attached ? scan.id : null,
    markAttached: () => setScan((s) => (s ? { ...s, attached: true } : s)),
    showExisting: (s: { filename: string; sizeBytes: number } | null) => setScan(s ? { id: null, name: s.filename, sizeBytes: s.sizeBytes, attached: true } : null),
    clear: () => {
      setScan(null);
      setError(null);
    },
  };
}

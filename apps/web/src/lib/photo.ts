/** The longest side a photo is shrunk to before upload (decision D4: photos stay small until file storage exists). */
export const MAX_PHOTO_SIDE_PX = 1600;
/** Must stay under the server's limit (`MAX_IMAGE_BASE64_CHARS`). */
const TARGET_BASE64_CHARS = 700_000;

/** The size that fits inside `max` on the longest side, never enlarging, keeping the proportions. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface ShrunkPhoto {
  mediaType: "image/jpeg";
  base64: string;
  /** An object URL for showing the photo; the caller revokes it. */
  previewUrl: string;
}

/** Shrinks a photo file to a JPEG that fits the upload limit. Runs in the browser. */
export async function shrinkPhoto(file: File): Promise<ShrunkPhoto> {
  const bitmap = await createImageBitmap(file);
  let side = MAX_PHOTO_SIDE_PX;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, side);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("This browser could not process the photo.");
    const base64 = await blobToBase64(blob);
    if (base64.length <= TARGET_BASE64_CHARS) {
      bitmap.close();
      return { mediaType: "image/jpeg", base64, previewUrl: URL.createObjectURL(blob) };
    }
    side = Math.round(side * 0.75);
  }
  bitmap.close();
  throw new Error("The photo is too detailed to shrink enough. Try another one.");
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the photo."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

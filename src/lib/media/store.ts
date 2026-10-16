import "server-only";
import { randomUUID } from "node:crypto";
import { PURPOSE_PREFIX, type UploadPurpose } from "@/lib/media/config";
import { derivativeKey, processImage, type ProcessedImage } from "@/lib/media/process";
import { deleteObjects, publicUrl, putObject } from "@/lib/media/r2";

export interface StoredImage extends Omit<ProcessedImage, "main" | "derivatives"> {
  key: string;
  url: string;
  mime_type: "image/webp";
}

/** Process raw bytes and publish main + derivatives under a fresh random key. */
export async function processAndPublish(raw: Buffer, purpose: UploadPurpose): Promise<StoredImage> {
  const img = await processImage(raw);
  // Random, non-guessable, never derived from the uploaded filename.
  const key = `${PURPOSE_PREFIX[purpose]}/${randomUUID()}/${randomUUID()}.webp`;
  await putObject(key, img.main, "image/webp");
  for (const d of img.derivatives) await putObject(derivativeKey(key, d.width), d.buffer, "image/webp");
  return {
    key,
    url: publicUrl(key),
    mime_type: "image/webp",
    width: img.width,
    height: img.height,
    bytes: img.bytes,
    checksum: img.checksum,
  };
}

/** Delete an image and its derivatives (best effort: orphans are harmless, just wasteful). */
export async function deleteImageKeys(keys: string[]): Promise<void> {
  const all = keys.flatMap((k) => [k, ...[480, 960, 1600].map((w) => derivativeKey(k, w))]);
  try {
    if (all.length) await deleteObjects(all);
  } catch (err) {
    console.error("[media] delete failed", err);
  }
}

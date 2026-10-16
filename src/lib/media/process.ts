import "server-only";
import { createHash } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import {
  ALLOWED_UPLOAD_MIME,
  DERIVATIVE_WIDTHS,
  MAX_DIMENSION,
  MAX_PIXELS,
  MAX_UPLOAD_BYTES,
  MIN_DIMENSION,
  PUBLISHED_MAX_WIDTH,
} from "@/lib/media/config";

export class MediaError extends Error {}

export interface ProcessedImage {
  width: number;
  height: number;
  bytes: number;
  checksum: string;
  /** Canonical image, <= 2000px wide. */
  main: Buffer;
  /** Responsive derivatives, widest first, only widths smaller than the image. */
  derivatives: { width: number; buffer: Buffer }[];
}

const FORMAT_TO_MIME: Record<string, (typeof ALLOWED_UPLOAD_MIME)[number]> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Treats the bytes as hostile. The declared type and extension are ignored:
 * the real format is read from the file signature, the decode is pixel-capped,
 * EXIF/GPS and other metadata are dropped, and everything is re-encoded to WebP
 * (so polyglot / embedded payloads don't survive). SVG and anything else is rejected.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length === 0 || input.length > MAX_UPLOAD_BYTES) {
    throw new MediaError("Image is empty or larger than 8 MB.");
  }

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new MediaError("That file isn't a readable JPEG, PNG or WebP image.");
  }
  if (!meta.format || !FORMAT_TO_MIME[meta.format]) {
    throw new MediaError("Only JPEG, PNG and WebP images are allowed.");
  }
  // Rotated-by-EXIF images report swapped dimensions after rotate().
  const swap = (meta.orientation ?? 1) >= 5;
  const w0 = swap ? meta.height : meta.width;
  const h0 = swap ? meta.width : meta.height;
  if (!w0 || !h0 || w0 > MAX_DIMENSION || h0 > MAX_DIMENSION) {
    throw new MediaError(`Image sides must be at most ${MAX_DIMENSION}px.`);
  }
  if (w0 < MIN_DIMENSION || h0 < MIN_DIMENSION) {
    throw new MediaError(`Image sides must be at least ${MIN_DIMENSION}px.`);
  }

  try {
    // rotate() bakes in the EXIF orientation; sharp drops all metadata by
    // default (no withMetadata()), so GPS/EXIF/ICC text never reaches storage.
    const base = () => sharp(input, { limitInputPixels: MAX_PIXELS }).rotate();
    const mainPipe = base().resize({ width: PUBLISHED_MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 82 });
    const { data: main, info } = await mainPipe.toBuffer({ resolveWithObject: true });

    const derivatives: ProcessedImage["derivatives"] = [];
    for (const width of [...DERIVATIVE_WIDTHS].reverse()) {
      if (width >= info.width) continue;
      derivatives.push({ width, buffer: await base().resize({ width }).webp({ quality: 78 }).toBuffer() });
    }

    return {
      width: info.width,
      height: info.height,
      bytes: main.length,
      checksum: createHash("sha256").update(main).digest("hex"),
      main,
      derivatives,
    };
  } catch (err) {
    if (err instanceof MediaError) throw err;
    throw new MediaError("We couldn't process that image. Try re-exporting it as JPEG or PNG.");
  }
}

export const derivativeKey = (mainKey: string, width: number) => mainKey.replace(/\.webp$/, `-${width}.webp`);

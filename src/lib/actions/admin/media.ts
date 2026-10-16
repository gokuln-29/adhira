"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media_uploads } from "@/lib/db/schema";
import { newId } from "@/lib/db/helpers";
import { authorize } from "@/lib/admin/auth";
import { hitRateLimit } from "@/lib/security/rate-limit";
import {
  ALLOWED_UPLOAD_MIME,
  MAX_UPLOAD_BYTES,
  PURPOSE_PREFIX,
  type UploadPurpose,
} from "@/lib/media/config";
import { MediaError } from "@/lib/media/process";
import { processAndPublish } from "@/lib/media/store";
import { deleteObject, getObject, headObject, isR2Configured, presignPut } from "@/lib/media/r2";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const INTENT_TTL_MS = 5 * 60 * 1000;
const PURPOSES = Object.keys(PURPOSE_PREFIX) as UploadPurpose[];

// Step 1: the server decides WHO may upload, WHAT and WHERE. The browser gets a
// presigned PUT valid for 5 minutes for exactly one random staging object.
export async function requestUploadIntent(input: {
  purpose: UploadPurpose;
  mime: string;
  bytes: number;
}): Promise<Result<{ uploadId: string; uploadUrl: string }>> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;
  if (!isR2Configured()) return { ok: false, error: "Image storage isn't configured." };
  if (!PURPOSES.includes(input.purpose)) return { ok: false, error: "Unknown upload type." };
  if (!(ALLOWED_UPLOAD_MIME as readonly string[]).includes(input.mime)) {
    return { ok: false, error: "Only JPEG, PNG and WebP images are allowed." };
  }
  if (!Number.isInteger(input.bytes) || input.bytes <= 0 || input.bytes > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Image must be 8 MB or smaller." };
  }
  // Per-admin throttle: 60 uploads / 10 min.
  if (!(await hitRateLimit(`upload:${auth.admin.id}`, 60, 600))) {
    return { ok: false, error: "Too many uploads. Please wait a few minutes." };
  }

  const uploadId = newId();
  const stagingKey = `staging/${newId()}`;
  await db.insert(media_uploads).values({
    id: uploadId,
    staging_key: stagingKey,
    purpose: input.purpose,
    declared_mime: input.mime,
    declared_bytes: input.bytes,
    admin_id: auth.admin.id,
    expires_at: new Date(Date.now() + INTENT_TTL_MS).toISOString(),
  });
  const uploadUrl = await presignPut(stagingKey, input.mime, input.bytes, INTENT_TTL_MS / 1000);
  return { ok: true, uploadId, uploadUrl };
}

// Step 3: read back what was really uploaded, verify the bytes, re-encode,
// strip metadata, make derivatives, publish, and only then hand back a URL.
export async function finalizeUpload(uploadId: string): Promise<
  Result<{ image: { url: string; key: string; width: number; height: number } }>
> {
  const auth = await authorize("editContent");
  if (!auth.ok) return auth;

  const rows = await db
    .select()
    .from(media_uploads)
    .where(and(eq(media_uploads.id, uploadId), eq(media_uploads.admin_id, auth.admin.id)))
    .limit(1);
  const up = rows[0];
  if (!up || up.status !== "pending") return { ok: false, error: "This upload is no longer valid." };

  const reject = async (error: string): Promise<{ ok: false; error: string }> => {
    await db.update(media_uploads).set({ status: "rejected" }).where(eq(media_uploads.id, uploadId));
    await deleteObject(up.staging_key).catch(() => {});
    console.warn("[media] upload rejected", { uploadId, admin: auth.admin.id, error });
    return { ok: false, error };
  };

  if (new Date(up.expires_at).getTime() < Date.now() - 60_000) return reject("The upload took too long. Please try again.");

  const head = await headObject(up.staging_key);
  if (!head) return reject("We didn't receive the file. Please try again.");
  if (head.bytes > MAX_UPLOAD_BYTES || head.bytes !== up.declared_bytes) return reject("The uploaded file doesn't match what was requested.");

  try {
    const stored = await processAndPublish(await getObject(up.staging_key), up.purpose);
    await db
      .update(media_uploads)
      .set({
        status: "processed",
        final_key: stored.key,
        width: stored.width,
        height: stored.height,
        bytes: stored.bytes,
        checksum: stored.checksum,
      })
      .where(eq(media_uploads.id, uploadId));
    await deleteObject(up.staging_key).catch(() => {});
    return { ok: true, image: { url: stored.url, key: stored.key, width: stored.width, height: stored.height } };
  } catch (err) {
    if (err instanceof MediaError) return reject(err.message);
    console.error("[media] processing failed", err);
    return reject("We couldn't process that image. Please try another file.");
  }
}

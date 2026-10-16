// Browser helper for the three-step upload (intent -> direct PUT -> finalize).
import { requestUploadIntent, finalizeUpload } from "@/lib/actions/admin/media";
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES, type UploadPurpose } from "@/lib/media/config";

export interface UploadedImage {
  url: string;
  key: string;
  width: number;
  height: number;
}

export async function uploadImage(file: File, purpose: UploadPurpose): Promise<UploadedImage> {
  // Early, friendly checks only: the server re-validates the real bytes.
  if (!(ALLOWED_UPLOAD_MIME as readonly string[]).includes(file.type)) {
    throw new Error("Please choose a JPEG, PNG or WebP image.");
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image must be 8 MB or smaller.");

  const intent = await requestUploadIntent({ purpose, mime: file.type, bytes: file.size });
  if (!intent.ok) throw new Error(intent.error);

  const put = await fetch(intent.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!put.ok) throw new Error("Upload failed. Please try again.");

  const done = await finalizeUpload(intent.uploadId);
  if (!done.ok) throw new Error(done.error);
  return done.image;
}

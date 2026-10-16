import "server-only";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 through its S3-compatible API. Credentials stay server-side;
// the browser only ever receives a short-lived, single-object presigned PUT.
// R2_ENDPOINT overrides the default for local MinIO.
let client: S3Client | undefined;

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_BUCKET &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      (process.env.R2_ACCOUNT_ID || process.env.R2_ENDPOINT) &&
      process.env.MEDIA_PUBLIC_URL,
  );
}

function s3(): S3Client {
  if (!isR2Configured()) throw new Error("R2 is not configured (see .env.example)");
  client ??= new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: Boolean(process.env.R2_ENDPOINT),
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

const bucket = () => process.env.R2_BUCKET!;

/** Public URL on the media domain for an object key. */
export function publicUrl(key: string): string {
  return `${process.env.MEDIA_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
}

/** Inverse of publicUrl(); null if the URL isn't on our media domain. */
export function keyFromPublicUrl(url: string): string | null {
  const base = `${process.env.MEDIA_PUBLIC_URL?.replace(/\/$/, "")}/`;
  return process.env.MEDIA_PUBLIC_URL && url.startsWith(base) ? url.slice(base.length) : null;
}

export async function presignPut(key: string, contentType: string, contentLength: number, expiresIn = 300) {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, ContentLength: contentLength }),
    { expiresIn },
  );
}

export async function headObject(key: string): Promise<{ bytes: number; contentType?: string } | null> {
  try {
    const r = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { bytes: r.ContentLength ?? 0, contentType: r.ContentType };
  } catch {
    return null;
  }
}

export async function getObject(key: string): Promise<Buffer> {
  const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return Buffer.from(await r.Body!.transformToByteArray());
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      // Keys are random and never overwritten, so they can be cached forever.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function deleteObjects(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) {
    await s3().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}

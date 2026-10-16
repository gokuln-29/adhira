// Server-side allow-list for image URLs an admin may save: our own media
// domain (R2) or the Unsplash seed host. Keeps arbitrary hosts out of pages.
export function isAllowedImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const media = process.env.MEDIA_PUBLIC_URL ? new URL(process.env.MEDIA_PUBLIC_URL).origin : null;
    return (media !== null && u.origin === media) || u.hostname === "images.unsplash.com";
  } catch {
    return false;
  }
}

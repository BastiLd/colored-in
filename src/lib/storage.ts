export const USER_ASSETS_BUCKET = "user-assets";

export function getStoragePathFromUrl(assetUrl: string): string | null {
  if (!assetUrl) return null;
  if (assetUrl.startsWith("data:") || assetUrl.startsWith("blob:")) {
    return null;
  }

  // If the URL is already a storage path (userId/filename) - most common case
  if (!assetUrl.startsWith("http") && assetUrl.includes("/")) {
    return assetUrl;
  }

  // If it's already a signed URL, extract the path
  if (assetUrl.includes("/storage/v1/object/sign/")) {
    try {
      const parsed = new URL(assetUrl);
      const match = parsed.pathname.match(
        /\/storage\/v1\/object\/sign\/[^/]+\/(.+)$/
      );
      if (match?.[1]) {
        return decodeURIComponent(match[1]);
      }
    } catch {
      // ignore invalid URL
    }
  }

  // Try to extract from public URL
  try {
    const parsed = new URL(assetUrl);
    const match = parsed.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)$/
    );
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // ignore invalid URL
  }

  return null;
}


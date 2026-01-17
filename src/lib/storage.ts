export const USER_ASSETS_BUCKET = "user-assets";

export function getStoragePathFromUrl(assetUrl: string): string | null {
  if (!assetUrl) return null;
  if (assetUrl.startsWith("data:") || assetUrl.startsWith("blob:")) {
    return null;
  }

  // If the URL is already a storage path (userId/filename)
  if (!assetUrl.startsWith("http") && assetUrl.includes("/")) {
    return assetUrl;
  }

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


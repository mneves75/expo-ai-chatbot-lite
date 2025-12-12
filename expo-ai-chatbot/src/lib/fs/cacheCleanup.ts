export function shouldDeleteCacheFileUri(
  uri: string,
  cacheDirectory: string | null | undefined,
): boolean {
  if (!uri) return false;
  if (!cacheDirectory) return false;
  return uri.startsWith(cacheDirectory);
}


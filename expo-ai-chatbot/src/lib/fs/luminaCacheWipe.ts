export function isLuminaTempFileName(fileName: string): boolean {
  if (!fileName) return false;
  // Keep these patterns very narrow to avoid deleting unrelated cache files.
  // - Exports created by Settings export flow.
  // - Rendered PDF pages created by the native PDF renderer for OCR (best-effort).
  return (
    /^lumina-export-\d{4}-\d{2}-\d{2}\.json$/i.test(fileName) ||
    /^lumina-pdf-page-.*\.(png|jpg|jpeg)$/i.test(fileName)
  );
}

export async function wipeLuminaCaches(): Promise<void> {
  const FileSystem = await import("expo-file-system");
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return;

  let entries: string[] = [];
  try {
    entries = await FileSystem.readDirectoryAsync(cacheDir);
  } catch {
    return;
  }

  const deletes = entries
    .filter((name) => isLuminaTempFileName(name))
    .map((name) =>
      FileSystem.deleteAsync(`${cacheDir}${name}`, { idempotent: true }).catch(
        () => {},
      ),
    );

  await Promise.all(deletes);
}


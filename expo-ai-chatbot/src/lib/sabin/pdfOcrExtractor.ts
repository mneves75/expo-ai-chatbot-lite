import { normalizeWhitespace } from "@/lib/sabin/textUtils";
import { renderPdfPagesToPngs } from "expo-lumina-pdf-renderer";

export type PdfOcrExtractionResult = {
  text: string;
  pagesProcessed: number;
};

export async function extractPdfTextWithOcrFromUri(
  pdfUri: string,
  options?: { maxPages?: number; scale?: number },
): Promise<PdfOcrExtractionResult> {
  const pageUris = await renderPdfPagesToPngs(pdfUri, options);

  const textRecognition = await import("expo-text-recognition");
  const getTextFromFrame: any = (textRecognition as any).getTextFromFrame;
  if (typeof getTextFromFrame !== "function") {
    throw new Error("OCR module not available");
  }

  const lines: string[] = [];

  for (const pageUri of pageUris) {
    // eslint-disable-next-line no-await-in-loop
    const pageLines: unknown = await getTextFromFrame(pageUri, false);
    if (Array.isArray(pageLines)) {
      for (const line of pageLines) {
        if (typeof line === "string" && line.trim().length > 0) lines.push(line);
      }
    }

    // Best-effort cleanup: remove rendered page file to reduce cache usage.
    // eslint-disable-next-line no-await-in-loop
    const FileSystem = await import("expo-file-system");
    // eslint-disable-next-line no-await-in-loop
    await FileSystem.deleteAsync(pageUri, { idempotent: true }).catch(() => {});
  }

  return {
    text: normalizeWhitespace(lines.join("\n")),
    pagesProcessed: pageUris.length,
  };
}

import { bytesToBase64 } from "@/lib/encoding/base64";
import { generateUUID } from "@/lib/utils";
import { extractPdfText } from "expo-lumina-pdf-renderer";

export type PdfTextExtractionResult = {
  text: string;
  pageCount: number;
};

export async function extractPdfTextFromUri(
  uri: string,
): Promise<PdfTextExtractionResult> {
  try {
    const result = await extractPdfText(uri);
    return { text: (result.text ?? "").trim(), pageCount: result.pageCount ?? 0 };
  } catch {
    // Compatibility fallback: if the dev client/native module hasn't been rebuilt yet,
    // fail "softly" and let the app fall back to OCR flows.
    return { text: "", pageCount: 0 };
  }
}

export async function extractPdfTextFromBytes(
  pdfBytes: Uint8Array,
): Promise<PdfTextExtractionResult> {
  const FileSystem = await import("expo-file-system");
  const tempUri = `${FileSystem.cacheDirectory}lumina-pdf-${generateUUID()}.pdf`;

  try {
    await FileSystem.writeAsStringAsync(tempUri, bytesToBase64(pdfBytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return await extractPdfTextFromUri(tempUri);
  } finally {
    try {
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
    } catch {
      // best-effort cache cleanup; failures should not block import.
    }
  }
}

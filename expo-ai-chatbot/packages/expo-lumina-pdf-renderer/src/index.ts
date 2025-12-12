import ExpoLuminaPdfRenderer from "./ExpoLuminaPdfRendererModule";

export type {
  RenderPdfPagesOptions,
  ExtractPdfTextResult,
} from "./ExpoLuminaPdfRendererModule";

export async function renderPdfPagesToPngs(
  pdfUri: string,
  options?: { maxPages?: number; scale?: number },
): Promise<string[]> {
  return ExpoLuminaPdfRenderer.renderPdfPagesToPngs(pdfUri, options);
}

export async function extractPdfText(
  pdfUri: string,
): Promise<{ text: string; pageCount: number }> {
  return ExpoLuminaPdfRenderer.extractPdfText(pdfUri);
}

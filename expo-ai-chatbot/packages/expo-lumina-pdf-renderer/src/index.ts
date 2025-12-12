import ExpoLuminaPdfRenderer from "./ExpoLuminaPdfRendererModule";

export type { RenderPdfPagesOptions } from "./ExpoLuminaPdfRendererModule";

export async function renderPdfPagesToPngs(
  pdfUri: string,
  options?: { maxPages?: number; scale?: number },
): Promise<string[]> {
  return ExpoLuminaPdfRenderer.renderPdfPagesToPngs(pdfUri, options);
}


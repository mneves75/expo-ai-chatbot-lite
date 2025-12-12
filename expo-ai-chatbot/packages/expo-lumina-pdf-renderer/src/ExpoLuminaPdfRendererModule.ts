import { requireNativeModule } from "expo-modules-core";

export type RenderPdfPagesOptions = {
  maxPages?: number;
  scale?: number;
};

export type ExtractPdfTextResult = {
  text: string;
  pageCount: number;
};

export type ExpoLuminaPdfRendererNativeModule = {
  renderPdfPagesToPngs(pdfUri: string, options?: RenderPdfPagesOptions): Promise<string[]>;
  extractPdfText(pdfUri: string): Promise<ExtractPdfTextResult>;
};

export default requireNativeModule<ExpoLuminaPdfRendererNativeModule>(
  "ExpoLuminaPdfRenderer",
);

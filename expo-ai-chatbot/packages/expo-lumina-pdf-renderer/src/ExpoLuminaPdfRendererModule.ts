import { requireNativeModule } from "expo-modules-core";

export type RenderPdfPagesOptions = {
  maxPages?: number;
  scale?: number;
};

export type ExpoLuminaPdfRendererNativeModule = {
  renderPdfPagesToPngs(pdfUri: string, options?: RenderPdfPagesOptions): Promise<string[]>;
};

export default requireNativeModule<ExpoLuminaPdfRendererNativeModule>(
  "ExpoLuminaPdfRenderer",
);


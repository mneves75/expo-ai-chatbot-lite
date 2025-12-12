import type { ImportMethod, SabinAnalysisResponse } from "@/lib/sabin/types";

export function applyConfidenceForImportMethod(
  analysis: SabinAnalysisResponse,
  method?: ImportMethod,
): SabinAnalysisResponse {
  const baseConfidence =
    method === "pdf_ocr" || method === "image_ocr" ? 0.8 : 1.0;

  return {
    ...analysis,
    results: analysis.results.map((r) => ({
      ...r,
      confidence: baseConfidence,
    })),
  };
}

export function needsReviewFromAnalysis(analysis: SabinAnalysisResponse): boolean {
  return analysis.results.some((r) => r.confidence < 0.85);
}


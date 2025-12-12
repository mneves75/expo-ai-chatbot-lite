import { applyConfidenceForImportMethod, needsReviewFromAnalysis } from "@/lib/sabin/confidence";
import type { SabinAnalysisResponse } from "@/lib/sabin/types";

const base: SabinAnalysisResponse = {
  summary: { mainFindings: "x", abnormalCount: 0, normalCount: 0 },
  results: [
    { id: "GLICOSE", examName: "Glicose", flag: "unknown", confidence: 1 },
  ],
};

test("sets lower confidence for OCR methods", () => {
  expect(applyConfidenceForImportMethod(base, "pdf_text").results[0]?.confidence).toBe(1);
  expect(applyConfidenceForImportMethod(base, "pdf_ocr").results[0]?.confidence).toBe(0.8);
  expect(applyConfidenceForImportMethod(base, "image_ocr").results[0]?.confidence).toBe(0.8);
});

test("needsReviewFromAnalysis checks confidence threshold", () => {
  expect(needsReviewFromAnalysis(applyConfidenceForImportMethod(base, "pdf_text"))).toBe(false);
  expect(needsReviewFromAnalysis(applyConfidenceForImportMethod(base, "pdf_ocr"))).toBe(true);
});


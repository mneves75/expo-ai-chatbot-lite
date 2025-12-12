import { isLikelyScannedPdfExtractedText } from "@/lib/sabin/scannedPdfHeuristics";

test("detects likely scanned pdf based on low extracted text", () => {
  expect(isLikelyScannedPdfExtractedText("")).toBe(true);
  expect(isLikelyScannedPdfExtractedText("   ")).toBe(true);
  expect(isLikelyScannedPdfExtractedText("hello")).toBe(true);
  expect(isLikelyScannedPdfExtractedText("x".repeat(199))).toBe(true);
  expect(isLikelyScannedPdfExtractedText("x".repeat(200))).toBe(false);
});

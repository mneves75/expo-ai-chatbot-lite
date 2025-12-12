export function isLikelyScannedPdfExtractedText(text: string): boolean {
  const trimmed = text.trim();
  // If PDF text-layer extraction yields no/very little text, it's often a scanned PDF.
  // Treat empty as "likely scanned" so the OCR fallback is offered.
  return trimmed.length < 200;
}

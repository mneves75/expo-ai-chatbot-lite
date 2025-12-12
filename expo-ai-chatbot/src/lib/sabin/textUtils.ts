export function normalizeWhitespace(input: string): string {
  return input
    // normalize common PDF/OCR whitespace oddities
    .replace(/\u00A0/g, " ") // NBSP
    .replace(/\u00AD/g, "") // soft hyphen
    .replace(/\r\n/g, "\n")
    // de-hyphenate line breaks ("pa-\nra" => "para")
    .replace(/([\p{L}])-\n\s*([\p{L}])/gu, "$1$2")
    // de-hyphenate some PDF text-layer artifacts ("pa- ra" => "para")
    .replace(/([\p{L}])-\s+([\p{L}])/gu, "$1$2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function parsePtNumber(input: string): number | null {
  const cleaned = input
    .trim()
    // remove thousands separators and normalize decimal comma
    .replace(/\./g, "")
    .replace(/,/g, ".");

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function formatDateDdMmYyyyToIso(input: string): string | null {
  const match = input.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

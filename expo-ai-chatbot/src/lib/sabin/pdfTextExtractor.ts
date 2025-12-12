import { base64ToBytes } from "@/lib/encoding/base64";

type PdfJs = {
  getDocument: (options: {
    data: Uint8Array;
    disableWorker?: boolean;
    useSystemFonts?: boolean;
  }) => { promise: Promise<any> };
};

async function loadPdfJs(): Promise<PdfJs> {
  // Prefer legacy CJS for Metro compatibility; fall back to ESM for test runners.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("pdfjs-dist/legacy/build/pdf.js") as PdfJs;
  } catch {}

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("pdfjs-dist/legacy/build/pdf") as PdfJs;
  } catch {}

  // Final fallback: ESM build (e.g. Bun)
  const mod: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return (mod?.default ?? mod) as PdfJs;
}

export type PdfTextExtractionResult = {
  text: string;
  pageCount: number;
};

export async function extractPdfTextFromBytes(
  pdfBytes: Uint8Array,
): Promise<PdfTextExtractionResult> {
  const pdfjs = await loadPdfJs();

  const loadingTask = pdfjs.getDocument({
    data: pdfBytes,
    disableWorker: true,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageCount: number = pdf.numPages ?? 0;

  let combinedText = "";

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await pdf.getPage(pageNumber);
    // eslint-disable-next-line no-await-in-loop
    const content = await page.getTextContent();

    const pageText: string = (content.items ?? [])
      .map((item: any) => (typeof item?.str === "string" ? item.str : ""))
      .filter(Boolean)
      .join(" ");

    combinedText += `${pageText}\n\n`;

    if (typeof page.cleanup === "function") {
      page.cleanup();
    }
  }

  if (typeof pdf.cleanup === "function") {
    pdf.cleanup();
  }

  return { text: combinedText.trim(), pageCount };
}

export async function extractPdfTextFromUri(
  uri: string,
): Promise<PdfTextExtractionResult> {
  const FileSystem = await import("expo-file-system");
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return extractPdfTextFromBytes(base64ToBytes(base64));
}

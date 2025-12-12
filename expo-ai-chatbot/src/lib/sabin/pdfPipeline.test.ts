import { extractPdfTextFromBytes } from "@/lib/sabin/pdfTextExtractor";
import { parseSabinReportText } from "@/lib/sabin/parser";
import { existsSync } from "node:fs";

const samplePath = "../DOCS/LAUDOS_SABIN/2021-07-21-sabin-PCR-COVID.pdf";
const maybeTest = existsSync(samplePath) ? test : test.skip;

maybeTest("extracts + parses a real Sabin PDF sample (PCR não detectado)", async () => {
  const file = Bun.file(samplePath);
  const ab = await file.arrayBuffer();

  const { text } = await extractPdfTextFromBytes(new Uint8Array(ab));
  const parsed = parseSabinReportText(text);

  expect(parsed.results.length).toBeGreaterThan(0);
  expect(
    parsed.results.some(
      (r) =>
        r.flag === "non_reactive" &&
        typeof r.resultText === "string" &&
        /n[ãa]o\s+detectado/i.test(r.resultText),
    ),
  ).toBe(true);
});

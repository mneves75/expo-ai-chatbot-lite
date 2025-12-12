import { extractPdfTextFromBytes } from "@/lib/sabin/pdfTextExtractor";
import { existsSync } from "node:fs";

const samplePath = "../DOCS/LAUDOS_SABIN/2021-07-21-sabin-PCR-COVID.pdf";
const maybeTest = existsSync(samplePath) ? test : test.skip;

maybeTest("extracts text from a sample Sabin PDF", async () => {
  const file = Bun.file(samplePath);
  const ab = await file.arrayBuffer();
  const { text, pageCount } = await extractPdfTextFromBytes(new Uint8Array(ab));

  expect(pageCount).toBeGreaterThan(0);
  expect(text.length).toBeGreaterThan(200);
  expect(/sabin/i.test(text)).toBe(true);
});

import { normalizeWhitespace } from "@/lib/sabin/textUtils";

export type ImageTextExtractionResult = {
  text: string;
};

export async function extractImageTextFromUri(
  uri: string,
): Promise<ImageTextExtractionResult> {
  // Lazy import so unit tests can run in Bun without the Expo runtime.
  const mod: any = await import("expo-text-recognition");
  const getTextFromFrame: any = mod?.getTextFromFrame ?? mod?.default?.getTextFromFrame;
  if (typeof getTextFromFrame !== "function") {
    throw new Error("OCR module not available");
  }

  const lines: unknown = await getTextFromFrame(uri, false);
  const rawText = Array.isArray(lines)
    ? lines.filter((l) => typeof l === "string").join("\n")
    : "";

  return { text: normalizeWhitespace(rawText) };
}

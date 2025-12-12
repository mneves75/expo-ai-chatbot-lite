import { extractPdfTextFromUri } from "@/lib/sabin/pdfTextExtractor";
import { extractPdfTextWithOcrFromUri } from "@/lib/sabin/pdfOcrExtractor";
import { looksLikeSabinReport } from "@/lib/sabin/detector";
import { parseSabinReportText } from "@/lib/sabin/parser";
import { normalizeWhitespace } from "@/lib/sabin/textUtils";
import { isLikelyScannedPdfExtractedText } from "@/lib/sabin/scannedPdfHeuristics";
import { applyConfidenceForImportMethod } from "@/lib/sabin/confidence";
import type { ReportPayload } from "@/lib/sabin/types";
import type { ImportMethod } from "@/lib/sabin/types";
import { initDb } from "@/lib/db/db";
import { insertReport } from "@/lib/db/reports";
import { shouldDeleteCacheFileUri } from "@/lib/fs/cacheCleanup";
import * as DocumentPicker from "expo-document-picker";
import { Link, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

type PickedPdf = {
  uri: string;
  name?: string;
  size?: number;
};

export default function ImportPdfScreen() {
  const router = useRouter();
  const [picked, setPicked] = useState<PickedPdf | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const [method, setMethod] = useState<ImportMethod | undefined>(undefined);
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const analysis = useMemo(() => {
    if (!rawText) return null;
    return applyConfidenceForImportMethod(parseSabinReportText(rawText), method);
  }, [rawText, method]);

  const looksSabin = useMemo(() => {
    if (!rawText) return null;
    return looksLikeSabinReport(rawText);
  }, [rawText]);

  const isProbablyScannedPdf = useMemo(() => {
    return isLikelyScannedPdfExtractedText(rawText);
  }, [rawText]);

  const canOcrPdf = Boolean(picked?.uri) && isProbablyScannedPdf;

  useEffect(() => {
    const uri = picked?.uri;
    if (!uri) return;

    return () => {
      void (async () => {
        const FileSystem = await import("expo-file-system");
        const cacheDir = FileSystem.cacheDirectory;
        if (shouldDeleteCacheFileUri(uri, cacheDir)) {
          await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
      })();
    };
  }, [picked?.uri]);

  async function pickPdf() {
    setError(null);
    setBusy(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: false,
        copyToCacheDirectory: true,
      });

      if ((result as any).canceled) return;

      const asset = Array.isArray((result as any).assets)
        ? (result as any).assets[0]
        : result;

      if (!asset?.uri) {
        throw new Error("No PDF selected");
      }

      const pickedPdf: PickedPdf = {
        uri: asset.uri,
        name: asset.name,
        size: asset.size,
      };

      setPicked(pickedPdf);
      setConfirmed(false);

      const extracted = await extractPdfTextFromUri(pickedPdf.uri);
      const normalized = normalizeWhitespace(extracted.text);
      setRawText(normalized);
      setMethod("pdf_text");
    } catch (e: any) {
      setError(e?.message ?? "Failed to import PDF");
    } finally {
      setBusy(false);
    }
  }

  async function runOcr() {
    if (!picked?.uri) return;
    setBusy(true);
    setError(null);
    try {
      const extracted = await extractPdfTextWithOcrFromUri(picked.uri, {
        maxPages: 200,
        scale: 2.0,
      });
      setRawText(extracted.text);
      setMethod("pdf_ocr");
      setConfirmed(false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to run OCR on PDF");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!analysis || !confirmed) return;

    setBusy(true);
    setError(null);

    try {
      await initDb();

      const payload: ReportPayload = {
        v: 1,
        source: {
          lab: "sabin",
          fileName: picked?.name,
          importedAt: new Date().toISOString(),
          method,
        },
        rawText,
        analysis,
      };

      const id = await insertReport(payload);
      router.replace(`/reports/${id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-white px-4 py-4 dark:bg-black">
      <View className="flex-row items-center gap-3">
        <Pressable
          disabled={busy}
          onPress={pickPdf}
          className="rounded-xl bg-black px-4 py-3 disabled:opacity-50 dark:bg-white"
        >
          <Text className="font-medium text-white dark:text-black">
            {busy ? "Processando…" : "Escolher PDF"}
          </Text>
        </Pressable>

        {analysis && (
          <Pressable
            disabled={busy || !confirmed}
            onPress={save}
            className="rounded-xl border border-neutral-200 px-4 py-3 disabled:opacity-50 dark:border-neutral-800"
          >
            <Text className="font-medium text-black dark:text-white">
              Salvar
            </Text>
          </Pressable>
        )}
      </View>

      {picked && (
        <View className="mt-3">
          <Text className="text-sm text-neutral-700 dark:text-neutral-300">
            Arquivo: {picked.name ?? picked.uri}
          </Text>
        </View>
      )}

      {canOcrPdf && (
        <View className="mt-3">
          <Pressable
            disabled={busy}
            onPress={runOcr}
            className="self-start rounded-xl border border-neutral-200 px-4 py-3 disabled:opacity-50 dark:border-neutral-800"
          >
            <Text className="font-medium text-black dark:text-white">
              {busy ? "Processando…" : "Executar OCR no PDF"}
            </Text>
          </Pressable>
        </View>
      )}

      {rawText.length > 0 && (
        <Pressable
          disabled={busy}
          onPress={() => setConfirmed((v) => !v)}
          className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 disabled:opacity-50 dark:border-neutral-800 dark:bg-black"
        >
          <Text className="text-sm text-black dark:text-white">
            {confirmed ? "✓" : "□"} Confirmo que o texto corresponde ao meu laudo
          </Text>
        </Pressable>
      )}

      {error && (
        <View className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
          <Text className="text-sm text-red-800 dark:text-red-200">{error}</Text>
        </View>
      )}

      {rawText ? (
        <>
          {isProbablyScannedPdf && (
            <View className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
              <Text className="text-sm text-amber-800 dark:text-amber-200">
                Este PDF parece não ter camada de texto (scan). OCR de PDF
                escaneado pode ser feito localmente.
              </Text>
              <View className="mt-3">
                <Pressable
                  disabled={busy}
                  onPress={runOcr}
                  className="self-start rounded-lg border border-amber-300 px-3 py-2 disabled:opacity-50 dark:border-amber-800"
                >
                  <Text className="text-sm text-amber-900 dark:text-amber-100">
                    {busy ? "Processando…" : "Executar OCR no PDF"}
                  </Text>
                </Pressable>
              </View>

              <View className="mt-3">
                <Link href="/import-image" asChild>
                  <Pressable className="self-start rounded-lg border border-amber-300 px-3 py-2 dark:border-amber-800">
                    <Text className="text-sm text-amber-900 dark:text-amber-100">
                      Ir para Escanear (imagem)
                    </Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          )}

          {looksSabin === false && (
            <View className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
              <Text className="text-sm text-amber-800 dark:text-amber-200">
                O texto extraído não parece ser um laudo Sabin. Você ainda pode
                salvar para leitura.
              </Text>
            </View>
          )}

          {analysis && (
            <View className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <Text className="text-sm font-semibold text-black dark:text-white">
                Resumo
              </Text>
              <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                {analysis.summary.mainFindings}
              </Text>
              <Text className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                Extraídos: {analysis.results.length} · Sinalizados:{" "}
                {analysis.summary.abnormalCount}
              </Text>
            </View>
          )}

          <View className="mt-6">
            <Text className="text-base font-semibold text-black dark:text-white">
              Texto (prévia)
            </Text>
            <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              Conteúdo permanece somente no aparelho.
            </Text>
          </View>

          <ScrollView className="mt-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <Text className="text-xs leading-5 text-neutral-800 dark:text-neutral-200">
              {rawText.slice(0, 6000)}
              {rawText.length > 6000 ? "\n\n(…)" : ""}
            </Text>
          </ScrollView>
        </>
      ) : (
        <View className="mt-6 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <Text className="text-neutral-700 dark:text-neutral-300">
            Selecione um PDF de laudo Sabin para extrair o texto localmente.
          </Text>
        </View>
      )}
    </View>
  );
}

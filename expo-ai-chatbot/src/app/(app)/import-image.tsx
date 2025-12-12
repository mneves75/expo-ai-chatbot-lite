import { extractImageTextFromUri } from "@/lib/sabin/imageTextExtractor";
import { looksLikeSabinReport } from "@/lib/sabin/detector";
import { parseSabinReportText } from "@/lib/sabin/parser";
import { applyConfidenceForImportMethod } from "@/lib/sabin/confidence";
import type { ReportPayload } from "@/lib/sabin/types";
import { initDb } from "@/lib/db/db";
import { insertReport } from "@/lib/db/reports";
import { shouldDeleteCacheFileUri } from "@/lib/fs/cacheCleanup";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

type PickedImage = {
  uri: string;
  fileName?: string;
};

export default function ImportImageScreen() {
  const router = useRouter();
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const analysis = useMemo(() => {
    if (!rawText) return null;
    return applyConfidenceForImportMethod(parseSabinReportText(rawText), "image_ocr");
  }, [rawText]);

  const looksSabin = useMemo(() => {
    if (!rawText) return null;
    return looksLikeSabinReport(rawText);
  }, [rawText]);

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

  async function pickFromLibrary() {
    setError(null);
    setBusy(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) throw new Error("No image selected");
      setPicked({ uri: asset.uri, fileName: asset.fileName });
      setConfirmed(false);

      const extracted = await extractImageTextFromUri(asset.uri);
      setRawText(extracted.text);
    } catch (e: any) {
      setError(e?.message ?? "Failed to scan image");
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    setError(null);
    setBusy(true);
    try {
      const res = await ImagePicker.launchCameraAsync({
        quality: 1,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) throw new Error("No photo captured");
      setPicked({ uri: asset.uri, fileName: asset.fileName });
      setConfirmed(false);

      const extracted = await extractImageTextFromUri(asset.uri);
      setRawText(extracted.text);
    } catch (e: any) {
      setError(e?.message ?? "Failed to capture photo");
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
          fileName: picked?.fileName,
          importedAt: new Date().toISOString(),
          method: "image_ocr",
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
          onPress={pickFromLibrary}
          className="rounded-xl bg-black px-4 py-3 disabled:opacity-50 dark:bg-white"
        >
          <Text className="font-medium text-white dark:text-black">
            {busy ? "Processando…" : "Escolher imagem"}
          </Text>
        </Pressable>

        <Pressable
          disabled={busy}
          onPress={takePhoto}
          className="rounded-xl border border-neutral-200 px-4 py-3 disabled:opacity-50 dark:border-neutral-800"
        >
          <Text className="font-medium text-black dark:text-white">
            Tirar foto
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
            Imagem: {picked.fileName ?? picked.uri}
          </Text>
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
            Selecione uma imagem/foto do laudo para OCR local (no aparelho).
          </Text>
        </View>
      )}
    </View>
  );
}

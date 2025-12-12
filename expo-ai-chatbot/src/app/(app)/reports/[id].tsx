import { initDb } from "@/lib/db/db";
import { getReportPayloadById } from "@/lib/db/reports";
import { needsReviewFromAnalysis } from "@/lib/sabin/confidence";
import type { ReportPayload } from "@/lib/sabin/types";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

export default function ReportDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        if (!id) throw new Error("Missing report id");
        await initDb();
        const p = await getReportPayloadById(id);
        if (!cancelled) setPayload(p);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load report");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const title = useMemo(() => {
    if (!payload) return "Laudo";
    return payload.analysis.summary.examDate
      ? `Sabin · ${payload.analysis.summary.examDate}`
      : "Sabin";
  }, [payload]);

  const needsReview = useMemo(() => {
    if (!payload) return false;
    return needsReviewFromAnalysis(payload.analysis);
  }, [payload]);

  const subtitle = useMemo(() => {
    if (!payload) return null;
    const parts: string[] = [];
    if (payload.analysis.summary.patientName) {
      parts.push(payload.analysis.summary.patientName);
    }
    if (payload.source.method === "pdf_text") parts.push("PDF (texto)");
    if (payload.source.method === "pdf_ocr") parts.push("PDF (OCR)");
    if (payload.source.method === "image_ocr") parts.push("Imagem (OCR)");
    return parts.length ? parts.join(" · ") : null;
  }, [payload]);

  return (
    <View className="flex-1 bg-white px-4 py-4 dark:bg-black">
      <Text className="text-lg font-semibold text-black dark:text-white">
        {title}
      </Text>

      {subtitle && (
        <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
          {subtitle}
        </Text>
      )}

      {needsReview && (
        <View className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <Text className="text-sm text-amber-800 dark:text-amber-200">
            Este laudo foi extraído via OCR. Recomenda-se conferir com o PDF/imagem
            original.
          </Text>
        </View>
      )}

      {error && (
        <View className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
          <Text className="text-sm text-red-800 dark:text-red-200">{error}</Text>
        </View>
      )}

      {payload && (
        <>
          <View className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
            <Text className="text-sm font-semibold text-black dark:text-white">
              Resumo
            </Text>
            <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
              {payload.analysis.summary.mainFindings}
            </Text>
          </View>

          <View className="mt-6 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-black dark:text-white">
              Marcadores
            </Text>
            <Pressable
              onPress={() => setShowRaw((v) => !v)}
              className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800"
            >
              <Text className="text-sm text-black dark:text-white">
                {showRaw ? "Ocultar texto" : "Ver texto"}
              </Text>
            </Pressable>
          </View>

          <ScrollView className="mt-3" contentContainerStyle={{ paddingBottom: 24 }}>
            {payload.analysis.results.length === 0 ? (
              <View className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                <Text className="text-neutral-700 dark:text-neutral-300">
                  Nenhum marcador foi extraído automaticamente.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {payload.analysis.results.map((r) => (
                  <View
                    key={r.id}
                    className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black"
                  >
                    <Text className="text-sm font-semibold text-black dark:text-white">
                      {r.examName}
                    </Text>
                    <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                      {typeof r.resultValue === "number"
                        ? `${r.resultValue}${r.unit ? ` ${r.unit}` : ""}`
                        : r.resultText ?? "—"}
                      {" · "}
                      {r.flag}
                      {r.referenceRange ? ` · ref: ${r.referenceRange}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {showRaw && (
              <View className="mt-6 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                <Text className="text-xs font-semibold text-black dark:text-white">
                  Texto bruto (armazenado criptografado)
                </Text>
                <Text className="mt-2 text-xs leading-5 text-neutral-800 dark:text-neutral-200">
                  {payload.rawText}
                </Text>
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

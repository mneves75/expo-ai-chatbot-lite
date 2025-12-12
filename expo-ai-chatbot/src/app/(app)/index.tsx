import { initDb } from "@/lib/db/db";
import type { ReportRow } from "@/lib/db/reports";
import { getReportPayloadById, listReports } from "@/lib/db/reports";
import type { LatestMarker } from "@/lib/db/markers";
import { getLatestMarkers } from "@/lib/db/markers";
import { markerLabel } from "@/lib/sabin/markerCatalog";
import { useFocusEffect } from "@react-navigation/native";
import { Link } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import type { ReportPayload } from "@/lib/sabin/types";

export default function HomePage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [latestMarkers, setLatestMarkers] = useState<LatestMarker[]>([]);
  const [latestReport, setLatestReport] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initDb();
      const rows = await listReports();
      setReports(rows);

      const markers = await getLatestMarkers(["GLICOSE", "HBA1C", "LDL", "HDL"]);
      setLatestMarkers(markers);

      if (rows[0]?.id) {
        const payload = await getReportPayloadById(rows[0].id);
        setLatestReport(payload);
      } else {
        setLatestReport(null);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View className="flex-1 bg-white px-4 py-4 dark:bg-black">
      <View className="flex-row items-center justify-between">
        <View className="flex-row gap-2">
          <Link href="/import" asChild>
            <Pressable className="rounded-xl bg-black px-4 py-3 dark:bg-white">
              <Text className="font-medium text-white dark:text-black">
                Importar PDF
              </Text>
            </Pressable>
          </Link>

          <Link href="/import-image" asChild>
            <Pressable className="rounded-xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <Text className="font-medium text-black dark:text-white">
                Escanear
              </Text>
            </Pressable>
          </Link>
        </View>

        <Link href="/settings" asChild>
          <Pressable className="rounded-xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <Text className="font-medium text-black dark:text-white">
              Ajustes
            </Text>
          </Pressable>
        </Link>
      </View>

      <View className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
        <Text className="text-sm text-neutral-700 dark:text-neutral-300">
          Dados locais no aparelho. Sem API, sem nuvem, sem servidor.
        </Text>
      </View>

      {error && (
        <View className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
          <Text className="text-sm text-red-800 dark:text-red-200">{error}</Text>
        </View>
      )}

      <View className="mt-6">
        <Text className="text-base font-semibold text-black dark:text-white">
          Último laudo
        </Text>
      </View>

      {latestReport ? (
        <View className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
          <Text className="text-sm font-semibold text-black dark:text-white">
            {latestReport.analysis.summary.examDate
              ? `Sabin · ${latestReport.analysis.summary.examDate}`
              : "Sabin"}
          </Text>
          {(latestReport.analysis.summary.patientName ||
            latestReport.source.method) && (
            <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              {[
                latestReport.analysis.summary.patientName,
                latestReport.source.method === "pdf_text"
                  ? "PDF (texto)"
                  : latestReport.source.method === "pdf_ocr"
                    ? "PDF (OCR)"
                    : latestReport.source.method === "image_ocr"
                      ? "Imagem (OCR)"
                      : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          )}
          <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            {latestReport.analysis.summary.mainFindings}
          </Text>
          <Text className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            Sinalizados: {latestReport.analysis.summary.abnormalCount} · Normais:{" "}
            {latestReport.analysis.summary.normalCount}
          </Text>

          {latestReport.analysis.results.slice(0, 3).length > 0 && (
            <View className="mt-3 gap-1">
              {latestReport.analysis.results.slice(0, 3).map((r) => (
                <Text
                  key={r.id}
                  className="text-xs text-neutral-700 dark:text-neutral-300"
                >
                  {markerLabel(r.id)}:{" "}
                  {typeof r.resultValue === "number"
                    ? `${r.resultValue}${r.unit ? ` ${r.unit}` : ""}`
                    : r.resultText ?? "—"}{" "}
                  ({r.flag})
                </Text>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View className="mt-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <Text className="text-neutral-700 dark:text-neutral-300">
            Importe um laudo para ver destaques.
          </Text>
        </View>
      )}

      <View className="mt-6">
        <Text className="text-base font-semibold text-black dark:text-white">
          Destaques
        </Text>
      </View>

      {latestMarkers.length > 0 ? (
        <View className="mt-3 gap-2">
          {latestMarkers.map((m) => (
            <Link key={m.markerId} href={`/markers/${m.markerId}`} asChild>
              <Pressable className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
                <Text className="text-sm font-semibold text-black dark:text-white">
                  {markerLabel(m.markerId)}
                </Text>
                <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  {typeof m.payload.resultValue === "number"
                    ? `${m.payload.resultValue}${m.payload.unit ? ` ${m.payload.unit}` : ""}`
                    : m.payload.resultText ?? "—"}
                  {" · "}
                  {m.flag}
                  {m.examDate ? ` · ${m.examDate}` : ""}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ) : (
        <View className="mt-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <Text className="text-neutral-700 dark:text-neutral-300">
            Importe um laudo para ver destaques.
          </Text>
        </View>
      )}

      <View className="mt-6">
        <Text className="text-base font-semibold text-black dark:text-white">
          Laudos
        </Text>
      </View>

      <ScrollView className="mt-3" contentContainerStyle={{ paddingBottom: 24 }}>
        {isLoading ? (
          <Text className="text-neutral-700 dark:text-neutral-300">
            Carregando…
          </Text>
        ) : reports.length === 0 ? (
          <View className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <Text className="text-neutral-700 dark:text-neutral-300">
              Nenhum exame importado ainda.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {reports.map((r) => (
              <Link key={r.id} href={`/reports/${r.id}`} asChild>
                <Pressable className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
                  <Text className="text-sm font-semibold text-black dark:text-white">
                    {r.exam_date ?? r.created_at.slice(0, 10)} · Sabin
                  </Text>
                  <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                    {r.abnormal_count} sinalizado(s) · {r.normal_count} normal
                  </Text>
                  {r.needs_review === 1 && (
                    <Text className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                      Precisa de revisão (OCR)
                    </Text>
                  )}
                </Pressable>
              </Link>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

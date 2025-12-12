import { initDb } from "@/lib/db/db";
import { listMarkerHistory } from "@/lib/db/markers";
import type { MarkerHistoryItem } from "@/lib/db/markers";
import { markerLabel } from "@/lib/sabin/markerCatalog";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

export default function MarkerDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const markerId = params.id ?? "";

  const [items, setItems] = useState<MarkerHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        if (!markerId) throw new Error("Missing marker id");
        await initDb();
        const rows = await listMarkerHistory(markerId, 20);
        if (!cancelled) setItems(rows);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load history");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [markerId]);

  const title = useMemo(() => markerLabel(markerId), [markerId]);

  return (
    <View className="flex-1 bg-white px-4 py-4 dark:bg-black">
      <Text className="text-lg font-semibold text-black dark:text-white">
        {title}
      </Text>

      {error && (
        <View className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
          <Text className="text-sm text-red-800 dark:text-red-200">{error}</Text>
        </View>
      )}

      <ScrollView className="mt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        {items.length === 0 ? (
          <View className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <Text className="text-neutral-700 dark:text-neutral-300">
              Nenhum histórico encontrado para este marcador.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {items.map((it) => (
              <View
                key={`${it.reportId}:${it.markerId}`}
                className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black"
              >
                <Text className="text-sm font-semibold text-black dark:text-white">
                  {it.examDate ?? it.createdAt.slice(0, 10)}
                </Text>
                <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                  {typeof it.payload.resultValue === "number"
                    ? `${it.payload.resultValue}${it.payload.unit ? ` ${it.payload.unit}` : ""}`
                    : it.payload.resultText ?? "—"}
                  {" · "}
                  {it.flag}
                </Text>
                {it.payload.referenceRange && (
                  <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    ref: {it.payload.referenceRange}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}


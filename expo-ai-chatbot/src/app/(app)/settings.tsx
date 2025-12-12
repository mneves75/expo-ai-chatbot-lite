import { Alert, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { deleteAllReports, getReportPayloadById, listReports } from "@/lib/db/reports";
import { deleteMasterKey } from "@/lib/crypto/masterKey";
import { initDb } from "@/lib/db/db";
import { buildReportsExportFile } from "@/lib/export/reportsExport";
import { wipeLuminaCaches } from "@/lib/fs/luminaCacheWipe";

export default function SettingsScreen() {
  const router = useRouter();

  function confirmDeleteAll() {
    Alert.alert(
      "Apagar dados",
      "Isso apaga todos os laudos deste aparelho. A ação é irreversível.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar tudo",
          style: "destructive",
          onPress: async () => {
            await initDb();
            await deleteAllReports();
            await deleteMasterKey();
            await wipeLuminaCaches().catch(() => {});
            router.replace("/");
          },
        },
      ],
    );
  }

  async function exportData() {
    let uri: string | null = null;
    try {
      await initDb();
      const rows = await listReports();

      const reports = [];
      for (const row of rows) {
        // eslint-disable-next-line no-await-in-loop
        const payload = await getReportPayloadById(row.id);
        reports.push({ id: row.id, createdAt: row.created_at, payload });
      }

      const exportBundle = buildReportsExportFile(reports);
      const json = JSON.stringify(exportBundle, null, 2);

      const FileSystem = await import("expo-file-system");
      const Sharing = await import("expo-sharing");

      const fileName = `lumina-export-${exportBundle.exportedAt.slice(0, 10)}.json`;
      uri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(uri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Exportado", `Arquivo salvo em cache: ${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "application/json",
        dialogTitle: "Exportar dados (JSON)",
        UTI: "public.json",
      } as any);
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Falha ao exportar dados");
    } finally {
      if (uri) {
        const FileSystem = await import("expo-file-system");
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    }
  }

  return (
    <View className="flex-1 bg-white px-4 py-4 dark:bg-black">
      <View className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
        <Text className="text-sm text-neutral-700 dark:text-neutral-300">
          Este app mantém os dados somente no aparelho e os salva criptografados.
        </Text>
      </View>

      <View className="mt-6">
        <Text className="text-base font-semibold text-black dark:text-white">
          Dados
        </Text>
      </View>

      <Pressable
        onPress={() => {
          Alert.alert(
            "Exportar dados",
            "O arquivo exportado conterá os laudos em texto claro (após descriptografia) porque você pediu exportação. Trate como dado sensível.",
            [
              { text: "Cancelar", style: "cancel" },
              { text: "Exportar", onPress: exportData },
            ],
          );
        }}
        className="mt-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-black"
      >
        <Text className="font-medium text-black dark:text-white">
          Exportar dados (JSON)
        </Text>
      </Pressable>

      <Pressable
        onPress={confirmDeleteAll}
        className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950"
      >
        <Text className="font-medium text-red-800 dark:text-red-200">
          Apagar todos os dados deste aparelho
        </Text>
      </Pressable>
    </View>
  );
}

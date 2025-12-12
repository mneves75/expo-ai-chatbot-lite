import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { hasUserConsented } from "@/lib/consent/consent";

export default function AppLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = await hasUserConsented();
        const currentLeaf = segments[segments.length - 1];
        const isOnboarding = currentLeaf === "onboarding";

        if (!ok && !isOnboarding) {
          router.replace("/onboarding");
          return;
        }
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, segments]);

  if (!isReady) {
    return <View className="flex-1 bg-white dark:bg-black" />;
  }

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="index"
        options={{ title: "Sabin Lumina", headerBackVisible: false }}
      />
      <Stack.Screen
        name="onboarding"
        options={{ title: "Bem-vindo", headerBackVisible: false }}
      />
      <Stack.Screen name="import" options={{ title: "Importar laudo (PDF)" }} />
      <Stack.Screen
        name="import-image"
        options={{ title: "Escanear laudo (imagem)" }}
      />
      <Stack.Screen name="markers/[id]" options={{ title: "Marcador" }} />
      <Stack.Screen name="reports/[id]" options={{ title: "Laudo" }} />
      <Stack.Screen name="settings" options={{ title: "Configurações" }} />
    </Stack>
  );
}

import { setUserConsented } from "@/lib/consent/consent";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function OnboardingScreen() {
  const router = useRouter();

  async function accept() {
    await setUserConsented();
    router.replace("/");
  }

  return (
    <View className="flex-1 bg-white px-4 py-6 dark:bg-black">
      <Text className="text-xl font-semibold text-black dark:text-white">
        Sabin Lumina
      </Text>

      <View className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <Text className="text-sm text-neutral-800 dark:text-neutral-200">
          Privacidade em primeiro lugar:
          {"\n\n"}- Seus dados ficam somente neste aparelho.
          {"\n"}- Armazenamento local criptografado.
          {"\n"}- Sem API, sem nuvem, sem servidor.
          {"\n\n"}Este app não fornece aconselhamento médico.
        </Text>
      </View>

      <Pressable
        onPress={accept}
        className="mt-6 rounded-xl bg-black px-4 py-3 dark:bg-white"
      >
        <Text className="text-center font-medium text-white dark:text-black">
          Aceitar e continuar
        </Text>
      </Pressable>
    </View>
  );
}


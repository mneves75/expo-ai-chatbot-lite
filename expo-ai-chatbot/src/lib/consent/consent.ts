const CONSENT_KEY = "lumina_consent_v1";

export async function hasUserConsented(): Promise<boolean> {
  const AsyncStorage = await import("@react-native-async-storage/async-storage");
  const value = await AsyncStorage.default.getItem(CONSENT_KEY);
  return value === "true";
}

export async function setUserConsented(): Promise<void> {
  const AsyncStorage = await import("@react-native-async-storage/async-storage");
  await AsyncStorage.default.setItem(CONSENT_KEY, "true");
}


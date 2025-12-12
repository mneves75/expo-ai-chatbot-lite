import * as SecureStore from "expo-secure-store";
import { base64ToBytes, bytesToBase64 } from "@/lib/encoding/base64";
import { randomBytes } from "@/lib/crypto/random";

const MASTER_KEY_STORE_KEY = "lumina_master_key_v1";

let cachedMasterKey: Uint8Array | null = null;

export async function getOrCreateMasterKey(): Promise<Uint8Array> {
  if (cachedMasterKey) return cachedMasterKey;

  const existing = await SecureStore.getItemAsync(MASTER_KEY_STORE_KEY);
  if (existing) {
    cachedMasterKey = base64ToBytes(existing);
    return cachedMasterKey;
  }

  const key = await randomBytes(32); // 256-bit
  await SecureStore.setItemAsync(MASTER_KEY_STORE_KEY, bytesToBase64(key));
  cachedMasterKey = key;
  return cachedMasterKey;
}

export async function deleteMasterKey(): Promise<void> {
  await SecureStore.deleteItemAsync(MASTER_KEY_STORE_KEY);
  cachedMasterKey = null;
}

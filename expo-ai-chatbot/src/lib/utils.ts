import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { v4 as uuidv4 } from "uuid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateUUID(): string {
  // Prefer the platform implementation when available (fast path on modern runtimes).
  // Fallback to uuid v4 (uses `crypto.getRandomValues`; see `polyfills.js` for RN setup).
  const cryptoObj: unknown = (globalThis as any)?.crypto;
  if (
    cryptoObj &&
    typeof (cryptoObj as { randomUUID?: unknown }).randomUUID === "function"
  ) {
    // Call as a method to preserve `this` binding in some runtimes (e.g. Bun).
    return (cryptoObj as { randomUUID: () => string }).randomUUID();
  }
  return uuidv4();
}

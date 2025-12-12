# Sabin Lumina (Expo)

Local-first “health vault” MVP: import a Sabin exam PDF on the device, extract its text locally, parse a small set of markers, and store everything encrypted in a local SQLite database. No API, no cloud, no server.

## Run locally

```bash
cd expo-ai-chatbot
bun install
bun start
```

## Verification

- App typecheck (production code only): `cd expo-ai-chatbot && bun run typecheck`
- Unit tests: `cd expo-ai-chatbot && bun test --timeout 30000`
- Expo health checks: `cd expo-ai-chatbot && npx expo-doctor`

Notes:
- `bun test` includes an offline-only guardrail test (`src/lib/policy/offlineGuard.test.ts`) to prevent accidental network usage in shipped code.
- PDF text extraction on iOS/Android is implemented in the native module `expo-ai-chatbot/packages/expo-lumina-pdf-renderer/`; after native changes, rebuild the dev client (`bun ios` / `bun android`).

## Key flows

- Onboarding: privacy notice + consent on first launch (`expo-ai-chatbot/src/app/(app)/onboarding.tsx`)
- Home: “Destaques” (latest marker values) + list of reports (`expo-ai-chatbot/src/app/(app)/index.tsx`)
- Marker history: tap a “Destaques” card to see recent values (`expo-ai-chatbot/src/app/(app)/markers/[id].tsx`)
- Import: select a PDF and extract text on-device (`expo-ai-chatbot/src/app/(app)/import.tsx`)
- For scanned PDFs (no text layer), use “Executar OCR no PDF” in the import screen to OCR pages locally.
- Scan: pick an image or take a photo and run on-device OCR (`expo-ai-chatbot/src/app/(app)/import-image.tsx`)
- Detail: view parsed markers and the raw text (decrypted in-memory) (`expo-ai-chatbot/src/app/(app)/reports/[id].tsx`)
- Settings: export all local data to JSON and/or delete all data + encryption key (`expo-ai-chatbot/src/app/(app)/settings.tsx`)

## Import confirmation

Before saving, the import screens require an explicit confirmation that the extracted text corresponds to the user’s report. This reduces accidental saves and makes the “text only” privacy boundary explicit.

## Data & privacy

- Reports are stored encrypted (AES-GCM) with a per-install master key saved in SecureStore.
- SQLite contains only minimal metadata in clear; the clinical payload and raw text are encrypted blobs.

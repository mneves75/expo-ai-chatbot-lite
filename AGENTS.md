# Repository Guidelines

This repository primarily contains an Expo (React Native) app for **Sabin Lumina**: an on-device “exam vault” that imports Sabin PDF laudos and extracts text locally (PDF text layer + OCR), then stores everything locally using SQLite with encrypted payloads.

## Project Structure & Module Organization

- `expo-ai-chatbot/`: main app (Expo + `expo-router`).
- `expo-ai-chatbot/src/app/(app)/`: screens (dashboard, import, reports, markers, settings).
- `expo-ai-chatbot/src/lib/sabin/`: PDF/text/OCR pipelines and deterministic parsing.
- `expo-ai-chatbot/src/lib/db/`: SQLite schema/migrations and encrypted report storage.
- `expo-ai-chatbot/src/lib/crypto/`: key management (SecureStore) + AES-GCM helpers.
- `expo-ai-chatbot/packages/expo-lumina-pdf-renderer/`: native module to render PDF pages to images for OCR.
- `DOCS/`: PRD and local sample inputs (e.g. `DOCS/PRD SABIN LUMINA.md`, `DOCS/LAUDOS_SABIN/`). Do not commit real patient data.

## Build, Test, and Development Commands

Run commands from `expo-ai-chatbot/` (there is no root `package.json`).

- Install + start: `cd expo-ai-chatbot && bun install && bun start`
- Native run: `bun ios` / `bun android`
- Unit tests: `bun test --timeout 30000`
- Expo health checks: `npx expo-doctor`

## Coding Style & Naming Conventions

- TypeScript/React; use 2-space indentation.
- Format with Prettier (`expo-ai-chatbot/.prettierrc`).
- File naming: `kebab-case.ts(x)`; exported components in `PascalCase`.
- Keep Lumina **offline-first**: avoid adding `fetch()`/network APIs unless the PRD explicitly requires them.

## Testing Guidelines

- Tests live in `expo-ai-chatbot/src/**/**/*.test.ts`.
- Prefer small, deterministic tests for parsers/crypto/DB helpers; avoid snapshotting large OCR output.
- Run: `cd expo-ai-chatbot && bun test --timeout 30000`.

## Commit & Pull Request Guidelines

- Prefer commit prefixes already used in history: `fix:`, `chore:`, `feat:`.
- PRs should include: scope (screens/lib/native), local run steps, screenshots for UI changes, and a note confirming “no API/cloud/server” behavior remains intact.
- Never include PHI/PII in commits; keep real laudos local-only.

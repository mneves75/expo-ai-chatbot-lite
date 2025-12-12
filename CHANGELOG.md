# Changelog

All notable changes to this repository will be documented in this file.

## 2025-12-12

### Added
- **Sabin Lumina (Expo app, on-device only):** import Sabin laudos as PDF or image, extract text locally (PDF text layer + on-device OCR), and store results locally.
- **Encrypted local storage:** report payloads are encrypted with AES‑GCM; the master key is stored in the device keystore via SecureStore; data lives in SQLite.
- **Native scanned-PDF OCR fallback:** renders PDF pages to images locally (iOS/Android module) to OCR scanned PDFs without any server.
- **Local dashboards:** latest report, report list, and marker history (local-only).

### Changed
- Removed cloud/server dependencies and network-first helpers to enforce “no API / no cloud / no server” operation.
- Removed unused legacy chat/weather UI components (including external-link buttons) to keep the Expo app focused on the on-device vault flows.
- Removed unused component helper files from the Expo `src/components/` folder to reduce dead code.
- Modernized the Expo SQLite wrapper to the current `expo-sqlite` API and removed unused template theme/UI plumbing (providers/toasts/design-system) to keep the shipped app minimal and maintainable.
- Added a dedicated Expo app typecheck config (`expo-ai-chatbot/tsconfig.typecheck.json`) so `bun run typecheck` checks only production code (tests are still verified by `bun test`).
- Switched report ID generation to crypto-grade UUID v4 (avoids `Math.random` collisions in persisted keys).
- Strengthened DB correctness: schema versioning (`PRAGMA user_version`), atomic “delete all reports”, and regression tests enforcing offline-only behavior.
- Fixed iOS/Metro bundling by removing any dependency on Node’s `crypto` module (randomness now uses Web Crypto when available, otherwise `expo-crypto`).
- Fixed iOS/Metro bundling for `pdfjs-dist` by enabling Babel support for static class blocks and polyfilling `Promise.withResolvers` when missing.
- Added native PDF text extraction for on-device parsing (PDFKit on iOS; pageCount-only on Android), avoiding Hermes-incompatible dynamic imports from `pdfjs-dist` in native bundles.

### Security
- Best-effort cleanup for temporary cache artifacts created during import/export and OCR rendering, to reduce unencrypted residue on device.

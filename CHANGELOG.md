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

### Security
- Best-effort cleanup for temporary cache artifacts created during import/export and OCR rendering, to reduce unencrypted residue on device.

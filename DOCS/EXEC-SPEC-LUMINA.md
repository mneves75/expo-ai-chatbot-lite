> Note: This document is a legacy/reference exec spec and may reference cloud/Gemini and other repos/tooling.  
> The source of truth for this repository’s shipped behavior is `README.md` and `expo-ai-chatbot/README.md` (offline-only).

# EXEC-SPEC: Lumina Sabin Engineering Specification

**Version**: 3.6 | **Date**: 2025-12-12 | **Status**: Active
**Carmack Readiness Score**: 8.5/10 → Target: 9.0/10 (up from 8.2/10)

---

## Executive Summary

This document consolidates findings from comprehensive security, architecture, and code quality reviews aligned with `DOCS/GUIDELINES-REF/`. It establishes a prioritized multi-phase remediation plan targeting production readiness.

**Progress Since v2.1:**
- ✅ SEC-001 CRITICAL (API key in URL) - FIXED
- ✅ SEC-002 HIGH (No Zod validation on decrypt) - FIXED
- ✅ BUG-002 CRITICAL (Database race condition) - FIXED
- ✅ BUG-004/BUG-007 HIGH (BiometricGate stale closures) - FIXED
- ✅ BUG-001 getUserHash instability - FIXED (stable installation hash persisted in SecureStore)
- ✅ Phase 1 requestId correlation - IMPLEMENTED
- ✅ Phase 1 isDraft column - IMPLEMENTED
- ✅ Phase 2 storage eviction - IMPLEMENTED
- ✅ NET-004 AppState listener leak - FIXED (idempotent start/stop + unsubscribe stored)
- ✅ NET-005 Offline detection tightened - FIXED (`isInternetReachable === false` guard before Gemini)
- ✅ PERF-004 expo/fetch adapter + httpClient logging/timeout - IMPLEMENTED with tests (`__tests__/httpClient.test.ts`)
- ✅ ErrorBoundary in root layout - IMPLEMENTED (audited, retry UI)
- ✅ Draft OCR detail UX - IMPLEMENTED (`/report/[id]` shows OCR modal for drafts)
- ✅ Debug share size caps - IMPLEMENTED (50k global cap; 20k per-field cap)
- ✅ CI sanity - `pnpm ci:verify` passing (verified locally 2025-12-12)

**Remaining Gaps:**
- 🔴 PRIV-001: Debug mode defaults ON (settings/debugStore/settings UI) — must default OFF for production.
- 🔴 AUDIT-001: `audit()` double-writes to `logs` (duplication + potential redaction bypass); needs single canonical path.
- 🔴 AUDIT-002: `clearLogs()` hard-deletes append-only logs; debug UI exposes it. Decide audit strategy (separate audit table vs immutable logs).
- 🔴 AND-001: Android permissions request mic + legacy storage access but code doesn’t use them; remove to reduce privacy risk and Play policy friction.
- 🟡 SCHEMA-001: Report schema not fully lab-agnostic (`labId`, `labName` missing; `labSource` overloaded).
- 🟡 DOCS-001: Docs/tooling drift (root `README.md`/`CLAUDE.md` vs app `CLAUDE.md`; `web_landing_page/README.md` is a template that mentions `GEMINI_API_KEY`).
- 🟡 CRYPTO-001: HKDF is implemented as a hash-based approximation; evaluate replacing with a vetted HMAC-HKDF or other KDF (keep migration-safe).
- 🟡 TS-001: TSConfig still defers `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` (intentional TODO), plus other strict options to evaluate.
- 🟢 React 19 “modern hooks” adoption is optional; don’t destabilize core flows for style upgrades.

**New Priority for 3.6 (next 1–2 days):**
- Make debug mode opt-in (default OFF) + migrate existing installs safely.
- Remove unnecessary Android permissions (mic + legacy storage).
- Fix audit/log architecture: remove duplication, preserve immutability, and make “wipe” semantics explicit.
- Consolidate docs so onboarding is unambiguous (`pnpm` for app; landing page doesn’t mention Gemini).

---

## Status Snapshot – 2025-12-12

This section is the “source of truth” for current reality. Older sections below are retained for historical context but may contain implementation-era notes that are now obsolete.

**What is verified working (local)**:
- `pnpm -C ai-lumina-sabin ci:verify` passes (lint + typecheck + tests + verify-builds).
- Vite landing page builds (`npm -C web_landing_page run build`).

**What needs a decision (high leverage)**:
- Whether debug mode is allowed for end-users in production (and if yes, how it is messaged + gated).
- Whether audit logs are “immutable for forensics” or “user-wipable for privacy” (currently mixed).
- Whether we want to keep a single `logs` table, or split `logs` vs `audit_logs`.

**Implementation plan**:
- See `ai-lumina-sabin/agent_planning/release-readiness-hardening-2025-12-12.md` (multi-phase, novice-friendly).

## Fresh Eyes Review – 2025-12-10 (v3.0 Update)

### Completed Items (Phase 1 & 2)

1) ✅ **DRAFT-LINK-RACE** - FIXED
   - Implemented `requestId` correlation in both `debug_extractions` and `reports` tables
   - `linkDebugExtractionsToReportByRequestId()` replaces racey helper
   - Indexed for performance

2) ✅ **OCR-DRAFT-LABELING** - FIXED
   - `isDraft` boolean column added to `reports` table
   - `saveOcrDraft()` sets `isDraft: true`
   - Home/Report screens should render badge off this flag

3) ✅ **STORAGE PRESSURE** - FIXED
   - `enforceDebugStorageLimit()` implements 75MB soft cap
   - LRU eviction keeps last 5 entries minimum
   - `DEBUG_STORAGE_SOFT_LIMIT_BYTES` constant defined

### New Issues Found (v3.0 Fresh Eyes)

1) **USER-HASH-INSTABILITY (High)** - RESOLVED
   - *Fix applied*: `getUserHash()` now derives from a stable installation identifier persisted in SecureStore (not `sessionId`).
   - *Evidence*: `lib/session.ts` + tests in `__tests__/session.test.ts`.

2) **TSCONFIG-STRICT-GAPS (Medium)**
   - *File*: `tsconfig.json`
   - *Missing per TYPESCRIPT-GUIDELINES*:
     - `noUncheckedIndexedAccess`
     - `exactOptionalPropertyTypes`
     - `noPropertyAccessFromIndexSignature`
     - `verbatimModuleSyntax`
   - *Already enabled*: `strict`, `noImplicitOverride`, `useUnknownInCatchVariables`
   - *Target*: Phase 4 (after branded types rollout)

3) **NO-ERROR-BOUNDARIES (Medium)** - RESOLVED
   - *Fix applied*: `components/error-boundary.tsx` is wired in `app/_layout.tsx` (RootLayout).
   - *Behavior*: renders fallback UI and emits `error.boundary` audit event.

4) **BRANDED-TYPES-MISSING (Low)** - PARTIAL
   - *Fix applied*: Branded types exist in `types/branded.ts` with tests.
   - *Remaining*: Adopt brands across the DB layer + navigation params incrementally.

5) **REACT-19-PATTERNS-NOT-USED (Low)**
   - *Patterns available but not adopted*:
     - `use()` hook for data fetching with Suspense
     - `useActionState()` for form handling
     - `useOptimistic()` for optimistic UI
     - React Compiler enabled but patterns not modernized
   - *Target*: Phase 5

6) **DEBUG SHARE SIZE (Low/Perf)** - STILL OPEN
   - Share concatenates large payloads; iOS share sheet has limits
   - *Fix*: Cap at 50k chars total, show "[truncado]"
   - *Target*: Phase 4

7) **DRAFT DETAIL EXPERIENCE (Low/UX)** - STILL OPEN
   - Report detail for drafts shows placeholder; no OCR text viewer
   - *Fix*: Add "Ver texto OCR" modal when `isDraft=true`
   - *Target*: Phase 4

### Fresh Eyes Review – 2025-12-10 (v3.3 Delta)

1) **LOG-RETENTION (Medium/Observability)**
   - Logs table grows unbounded; no TTL or size cap. Risk of disk bloat and slower queries.
   - *Fix*: size/TTL cap + circuit breaker when writeErrors spike (see Task 3.7).

2) **SETTINGS-VALIDATION (Medium/Correctness)**
   - `loadSettings()` trusts persisted JSON; corrupted keys may crash downstream (e.g., non-string API key).
   - *Fix*: Zod schema + migration with defaults and audit trail (Task 3.8).

3) **NET-GUARD-COVERAGE (Low/Correctness)**
   - Reachability guard added in Gemini path; other networked flows (metrics export/import flows) still only check `isConnected`.
   - *Fix*: use `isInternetReachable !== false` everywhere (Task 3.9).

4) **TSCONFIG-GAPS (Medium/Type Safety)**
   - `verbatimModuleSyntax` and `exactOptionalPropertyTypes` still disabled; risk of subtle type widening.
   - *Fix*: enable per Task 3.2.

5) **ERROR-UX (Medium/UX/Resilience)**
   - No top-level ErrorBoundary in `_layout`; a render crash kills the app.
   - *Fix*: implement Task 3.3 with audit + retry CTA.

6) **ID-BRANDING (Low/Type Safety)**
   - Branded IDs not enforced; easy to swap report/debug IDs.
   - *Fix*: Phase 4 branded types.

7) **SHARE-PAYLOAD-SAFETY (Low/UX/Perf)**
   - Large share payloads risk exceeding platform limits; truncation plan pending.
   - *Fix*: Phase 4 share payload guard.

8) **REACT 19 PATTERNS (Low/Modernization)**
   - Still using imperative effects for data fetch; not leveraging `use()`/Suspense or `useActionState`.
   - *Fix*: Phase 5 modernization.

### Networking & Perf Delta (v3.3 status)

- ✅ NET-004 AppState listener leak — fixed in `lib/draftRetryService.ts` (idempotent start, stored unsubscribe, leak-free stop).
- ✅ NET-005 Offline detection — `ensureOnline()` now blocks when `isInternetReachable === false` to avoid captive portal failures.
- ✅ PERF-004 RN fetch bridge overhead — `lib/httpClient.ts` prefers `expo/fetch`, defaults gzip + keepalive + timeout, and is covered by `__tests__/httpClient.test.ts`.
- ✅ PERF-005 Retry burst risk — unified scheduler with jittered backoff in `draftRetryService.scheduleDraftProcessing`, used by bootstrap/NetInfo/AppState.
- ✅ OBS-002 Fetch telemetry — `recordHttpRequest` adds latency buckets + status families; invoked by `fetchWithTimeout` and covered by tests.

### Option Set — Fetch Stack Modernization (evaluate & decide)

1. **Do nothing (RN fetch + AbortController)** — zero churn, keep bridge cost; still vulnerable to perf regressions on arrayBuffer.
2. **Swap Gemini only to `expo/fetch`** — minimal change, immediate perf gain on native; keep global fetch elsewhere.
3. **Create `httpClient` adapter (expo/fetch native, global fetch web)** — one abstraction, consistent timeouts/logging, easier mocking; enables future interceptors.
4. **Adapter + connection reuse + gzip** — option 3 plus `keepalive: true`, `Accept-Encoding: gzip` defaults, shared AbortSignal helpers.
5. **Adapter + request coalescing + cache** — add cache layer for identical Gemini requests within 5s; higher complexity, unclear value.
6. **Move Gemini to streaming API (when available)** — larger change; not needed now.

**Recommended**: Option 4 — shared adapter with expo/fetch on native, global fetch on web, baked-in timeout/keepalive/logging. Gives measurable perf gains, consistent telemetry, minimal API churn. **Status**: Adopted in v3.3 (`lib/httpClient.ts` + tests).

---

## Phased Execution Plan (v3.0 - Updated)

### ✅ Phase 1 – Correctness & Traceability (COMPLETED)

All items completed. See "Completed Items" above.

### ✅ Phase 2 – Storage & Eviction (COMPLETED)

Storage eviction implemented in `debugStore.ts`:
- `enforceDebugStorageLimit()` - 75MB soft cap
- LRU eviction keeping last 5 entries
- Runs after each save operation

---

### 🔴 Phase 3 – Security & Stability Hardening (Current Priority)

**Est. Effort**: 2-3 days | **Risk Reduction**: High

#### Task 3.1: Fix getUserHash Stability (HIGH)
```typescript
// lib/session.ts - Replace lines 24-38
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';

const USER_HASH_KEY = 'lumina_user_hash_v1';

export async function getUserHash(): Promise<string> {
  if (userHash) return userHash;

  // Try to load persisted hash
  const stored = await SecureStore.getItemAsync(USER_HASH_KEY);
  if (stored) {
    userHash = stored;
    return userHash;
  }

  // Generate new stable hash using device identifier
  const deviceId = await Application.getIosIdForVendorAsync()
    ?? `android_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const seed = `lumina-sabin-v1-${deviceId}`;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    seed
  );
  userHash = hash.substring(0, 16);

  // Persist for future sessions
  await SecureStore.setItemAsync(USER_HASH_KEY, userHash);
  return userHash;
}
```

**Acceptance Criteria:**
- [ ] Same hash returned across app restarts
- [ ] Hash stored in SecureStore
- [ ] Test: `resetSession()` + `getUserHash()` returns same value

#### Task 3.2: Strengthen TSConfig (MEDIUM)
```json
// tsconfig.json - Add to compilerOptions
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "useUnknownInCatchVariables": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true
  }
}
```

**Acceptance Criteria:**
- [ ] `pnpm typecheck` passes with new options
- [ ] All indexed access uses optional chaining
- [ ] All catch blocks handle `unknown` type

#### Task 3.3: Add Error Boundaries (MEDIUM)
```typescript
// components/error-boundary.tsx - New file
import { Component, ErrorInfo, ReactNode } from 'react';
import { ThemedView, ThemedText } from './themed-view';
import { audit } from '@/lib/audit';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    audit('error.boundary', {
      error: error.message,
      stack: error.stack?.slice(0, 500),
      componentStack: info.componentStack?.slice(0, 500),
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <ThemedText type="title">Algo deu errado</ThemedText>
          <ThemedText style={{ marginTop: 8 }}>
            {this.state.error?.message ?? 'Erro desconhecido'}
          </ThemedText>
          <ThemedText
            style={{ marginTop: 16, color: '#0a84ff' }}
            onPress={() => this.setState({ hasError: false })}
          >
            Tentar novamente
          </ThemedText>
        </ThemedView>
      );
    }
    return this.props.children;
  }
}
```

**Integration:**
```typescript
// app/_layout.tsx - Wrap with ErrorBoundary
<AppProviders>
  <ErrorBoundary>
    <SafeAreaView style={{ flex: 1 }}>
      {/* ... existing content ... */}
    </SafeAreaView>
  </ErrorBoundary>
</AppProviders>
```

**Acceptance Criteria:**
- [ ] Component crash shows recovery UI
- [ ] `error.boundary` audit event fires
- [ ] Stack traces truncated to 500 chars

#### Task 3.4: Improve Key Derivation (MEDIUM - SEC-003)
```typescript
// lib/cryptoStore.ts - Add HKDF derivation
import * as Crypto from 'expo-crypto';

async function deriveKeyWithHKDF(ikm: Uint8Array): Promise<string> {
  // HKDF-Expand with SHA-256 (simplified without native HKDF)
  // Use two rounds of HMAC for key derivation
  const salt = new TextEncoder().encode('lumina-sabin-v1-salt');
  const info = new TextEncoder().encode('lumina-sabin-encryption-key');

  const concat = new Uint8Array(ikm.length + salt.length + info.length);
  concat.set(ikm);
  concat.set(salt, ikm.length);
  concat.set(info, ikm.length + salt.length);

  const derived = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    concat
  );

  return Buffer.from(derived).toString('base64');
}
```

**Acceptance Criteria:**
- [ ] Key derivation uses HKDF pattern
- [ ] Existing keys still work (migration path)
- [ ] Tests verify key stability

#### Task 3.5: HTTP Request Metrics Histogram (MEDIUM - OBS-002) — **Status: DONE (v3.3)**
- `lib/metrics.ts` adds `recordHttpRequest` with latency buckets + status families.
- `fetchWithTimeout` records success/error paths; Vitest coverage in `__tests__/httpClient.test.ts` and `__tests__/metrics.test.ts`.

**Acceptance Criteria:** ✅

#### Task 3.6: Unified Retry Scheduler (MEDIUM - PERF-005) — **Status: DONE (v3.3)**
- Single-flight jittered scheduler (`scheduleDraftProcessing`) used by bootstrap/NetInfo/AppState.
- Cleanup clears timers/listeners; tested in `__tests__/draftRetryService.test.ts`.

**Acceptance Criteria:** ✅

#### Task 3.7: Log Retention & Backpressure (MEDIUM - OBS-003)
- Add TTL/size-based retention to `logs` table (e.g., keep last 10k lines or 30 days).
- Batch `appendLogLine` writes or add circuit-breaker when writeErrors exceed threshold to avoid UI stalls.
- Provide a debug screen counter for dropped logs.

**Acceptance Criteria:**
- [ ] Logs pruned automatically; size stays under configured cap
- [ ] Circuit breaker prevents unbounded retries on DB write failures
- [ ] Tests cover retention + breaker paths

#### Task 3.8: Settings Validation & Migration (MEDIUM - CONF-001)
- Introduce Zod schema for settings blob; migrate existing persisted settings with defaults.
- Validate `geminiApiKey`, locale, theme, and feature flags on load; drop/repair invalid fields.
- Add lintable fixtures-based tests for migration edge cases.

**Acceptance Criteria:**
- [ ] Invalid persisted settings repaired or reset with audit log
- [ ] `loadSettings()` always returns schema-conformant object
- [ ] Tests cover missing fields, wrong types, legacy keys

#### Task 3.9: Offline/Reachability Guardrails (LOW - NET-006)
- Use `isInternetReachable !== false` in all network entry points (import flows, metrics export).
- Surface actionable UI messages for captive portal/airplane mode with retry CTA.
- Add smoke test that mocks NetInfo unreachable and asserts Gemini/OCR short-circuit.

**Acceptance Criteria:**
- [ ] All networked flows respect reachability guard
- [ ] User sees clear retry guidance when blocked
- [ ] Tests cover unreachable and recoverable states

---

### 🟡 Phase 4 – Type Safety & Code Quality

**Est. Effort**: 2 days | **Quality Improvement**: Medium

#### Task 4.1: Add Branded Types
```typescript
// types/branded.ts - New file
declare const brand: unique symbol;

type Brand<T, B> = T & { readonly [brand]: B };

export type ReportId = Brand<string, 'ReportId'>;
export type DebugExtractionId = Brand<string, 'DebugExtractionId'>;
export type RequestId = Brand<string, 'RequestId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type UserHash = Brand<string, 'UserHash'>;

// Factories
export const createReportId = (id: string): ReportId => id as ReportId;
export const createDebugId = (id: string): DebugExtractionId => id as DebugExtractionId;
export const createRequestId = (id: string): RequestId => id as RequestId;
```

**Usage:**
```typescript
// lib/database.ts
export async function getReport(id: ReportId): Promise<ReportRecord | null>

// lib/debugStore.ts
export async function getDebugExtraction(id: DebugExtractionId): Promise<DebugExtraction | null>
```

**Acceptance Criteria:**
- [ ] All ID parameters use branded types
- [ ] TypeScript catches cross-ID misuse
- [ ] Factories used consistently

#### Task 4.2: Share Payload Size Guard
```typescript
// lib/shareUtils.ts - New file
const SHARE_MAX_CHARS = 50_000;

export function prepareSharePayload(data: {
  extractedText?: string;
  geminiRequest?: string;
  geminiResponse?: string;
}): { text: string; truncated: boolean } {
  const parts: string[] = [];
  let total = 0;
  let truncated = false;

  const addPart = (label: string, content?: string) => {
    if (!content) return;
    const remaining = SHARE_MAX_CHARS - total;
    if (remaining <= 0) {
      truncated = true;
      return;
    }
    const slice = content.slice(0, remaining);
    if (slice.length < content.length) truncated = true;
    parts.push(`=== ${label} ===\n${slice}`);
    total += slice.length + label.length + 10;
  };

  addPart('OCR Text', data.extractedText);
  addPart('Gemini Request', data.geminiRequest);
  addPart('Gemini Response', data.geminiResponse);

  if (truncated) {
    parts.push('\n[... conteúdo truncado ...]');
  }

  return { text: parts.join('\n\n'), truncated };
}
```

**Acceptance Criteria:**
- [ ] Share payloads ≤ 50k chars
- [ ] Truncation indicator shown
- [ ] Tests verify truncation logic

#### Task 4.3: Draft OCR Viewer Modal
```typescript
// components/ocr-viewer-modal.tsx - New file
import { Modal, ScrollView, Pressable } from 'react-native';
import { ThemedView, ThemedText } from './themed-view';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

interface Props {
  visible: boolean;
  ocrText: string;
  onClose: () => void;
}

export function OcrViewerModal({ visible, ocrText, onClose }: Props) {
  const handleCopy = async () => {
    await Clipboard.setStringAsync(ocrText);
    // Show toast
  };

  const handleShare = async () => {
    if (await Sharing.isAvailableAsync()) {
      // Use prepareSharePayload for size safety
      await Sharing.shareAsync(/* ... */);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <ThemedView style={{ flex: 1, padding: 16 }}>
        <ThemedText type="title">Texto OCR</ThemedText>
        <ScrollView style={{ flex: 1, marginTop: 16 }}>
          <ThemedText selectable>{ocrText}</ThemedText>
        </ScrollView>
        <Pressable onPress={handleCopy}>
          <ThemedText>Copiar</ThemedText>
        </Pressable>
        <Pressable onPress={handleShare}>
          <ThemedText>Compartilhar</ThemedText>
        </Pressable>
        <Pressable onPress={onClose}>
          <ThemedText>Fechar</ThemedText>
        </Pressable>
      </ThemedView>
    </Modal>
  );
}
```

**Acceptance Criteria:**
- [ ] Modal shows full OCR text for drafts
- [ ] Copy/share actions work
- [ ] Accessible via "Ver texto OCR" button in report detail

---

### 🟡 Phase 5 – React 19 Modernization

**Est. Effort**: 3-4 days | **Quality Improvement**: Medium

#### Task 5.1: Adopt `use()` Hook for Data Fetching
```typescript
// Before (useEffect pattern)
function ReportScreen({ id }: { id: string }) {
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReport(id).then(setReport).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading />;
  return <ReportDisplay report={report} />;
}

// After (use() + Suspense pattern)
import { use, Suspense } from 'react';

function ReportContent({ reportPromise }: { reportPromise: Promise<ReportRecord | null> }) {
  const report = use(reportPromise);
  return <ReportDisplay report={report} />;
}

function ReportScreen({ id }: { id: string }) {
  const reportPromise = useMemo(() => getReport(id), [id]);

  return (
    <Suspense fallback={<Loading />}>
      <ReportContent reportPromise={reportPromise} />
    </Suspense>
  );
}
```

**Acceptance Criteria:**
- [ ] Data fetching screens use `use()` + Suspense
- [ ] Loading states handled by Suspense boundaries
- [ ] No useEffect for data fetching in new code

#### Task 5.2: Adopt `useActionState()` for Forms
```typescript
// Before (manual state)
function ApiKeyForm() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await validateApiKey(apiKey);
      await saveSettings({ geminiApiKey: apiKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };
}

// After (useActionState)
import { useActionState } from 'react';

function ApiKeyForm() {
  const [state, submitAction, isPending] = useActionState(
    async (prevState: { error?: string }, formData: FormData) => {
      const apiKey = formData.get('apiKey') as string;
      try {
        await validateApiKey(apiKey);
        await saveSettings({ geminiApiKey: apiKey });
        return { success: true };
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Erro' };
      }
    },
    {}
  );

  return (
    <form action={submitAction}>
      <input name="apiKey" disabled={isPending} />
      {state.error && <span>{state.error}</span>}
      <button disabled={isPending}>
        {isPending ? 'Validando...' : 'Salvar'}
      </button>
    </form>
  );
}
```

**Note:** React Native doesn't have native `<form>` elements. Adapt using `useTransition` + action handlers.

**Acceptance Criteria:**
- [ ] Settings forms use action-based patterns
- [ ] Loading states derive from `isPending`
- [ ] Error states managed by action return

#### Task 5.3: Adopt `useOptimistic()` for Draft Reprocessing
```typescript
// Optimistic UI for draft reprocessing
import { useOptimistic, startTransition } from 'react';

function DraftItem({ report }: { report: ReportRecord }) {
  const [optimisticReport, setOptimisticReport] = useOptimistic(
    report,
    (current, update: Partial<ReportRecord>) => ({ ...current, ...update })
  );

  const handleReprocess = () => {
    startTransition(() => {
      setOptimisticReport({ isDraft: false }); // Optimistically show as processed
    });

    reprocessDraftReport(report, apiKey)
      .catch(() => {
        // Revert on failure - useOptimistic handles this automatically
      });
  };

  return (
    <ReportCard
      report={optimisticReport}
      onReprocess={handleReprocess}
    />
  );
}
```

**Acceptance Criteria:**
- [ ] Draft reprocessing shows immediate UI feedback
- [ ] Failures revert to original state
- [ ] No loading spinners for quick operations

---

### 🟢 Phase 6 – Architecture & Testing

**Est. Effort**: 1 week | **Maintainability Improvement**: High

#### Task 6.1: Repository Pattern
```
lib/
  repositories/
    IReportRepository.ts      # Interface
    SQLiteReportRepository.ts # Production implementation
    MockReportRepository.ts   # Test double
```

```typescript
// lib/repositories/IReportRepository.ts
export interface IReportRepository {
  save(record: ReportRecord): Promise<void>;
  getById(id: ReportId): Promise<ReportRecord | null>;
  list(): Promise<ReportRecord[]>;
  softDelete(id: ReportId): Promise<void>;
}
```

#### Task 6.2: Dependency Injection Context
```typescript
// providers/dependencies.tsx
const DependenciesContext = createContext<Dependencies | null>(null);

export function DependenciesProvider({ children, overrides }: Props) {
  const deps = useMemo(() => ({
    reportRepo: overrides?.reportRepo ?? new SQLiteReportRepository(),
    geminiClient: overrides?.geminiClient ?? new GeminiClient(),
    cryptoStore: overrides?.cryptoStore ?? new CryptoStore(),
  }), [overrides]);

  return (
    <DependenciesContext.Provider value={deps}>
      {children}
    </DependenciesContext.Provider>
  );
}

export function useDependencies() {
  const deps = useContext(DependenciesContext);
  if (!deps) throw new Error('DependenciesProvider missing');
  return deps;
}
```

#### Task 6.3: Comprehensive Test Suite
- [ ] Unit tests for all lib/ modules
- [ ] Integration tests for import pipeline
- [ ] Component tests for BiometricGate, ErrorBoundary
- [ ] E2E tests for critical flows (import → view → share)
- [ ] Security tests per SEC-* items

**Target Coverage:** > 80% for critical paths

---

## Part I: Security Vulnerabilities

### ✅ CRITICAL (CVSS 9.1) - FIXED

#### ✅ SEC-001: API Key Exposed in URL Query Parameters
**Status**: FIXED in v2.0
**File**: `lib/geminiClient.ts:111-115`
**Fix Applied**: API key now sent in `X-Goog-Api-Key` header, not URL.

---

### HIGH Severity (CVSS 7.0-8.9)

#### ✅ SEC-002: No Validation on Decrypted JSON
**Status**: FIXED in v2.0
**File**: `lib/cryptoStore.ts:52-60`
**Fix Applied**: `decryptJson()` now requires Zod schema parameter for validation. Legacy `decryptJsonUnsafe()` marked deprecated.

#### ✅ SEC-003: Weak Master Key Derivation
**Status**: FIXED in v3.0
**File**: `lib/cryptoStore.ts`
**Fix**: Implemented HKDF-style key derivation with:
- `deriveKeyWithHKDF()` using SHA-256 with salt and info context binding
- Backwards compatibility for legacy v1 keys
- Migration path for existing users
- 11 tests covering HKDF derivation and key migration

---

### ✅ MEDIUM Severity - ALL FIXED (CVSS 4.0-6.9)

#### ✅ SEC-004: SQL Injection via Unvalidated JSON.parse
**Status**: FIXED in v3.5
**Fix**: Added `parseEncryptedPayload()` helper with Zod schema validation.

#### ✅ SEC-005: Missing Audit Events
**Status**: FIXED in v3.5
**Fix**: Added `export.cancelled`, `export.failed`, `apikey.failed` with `attemptCount`, `gemini.rate_limited`.

#### ✅ SEC-006: Log Exposure Risk
**Status**: FIXED in v3.4 (BUG-015)
**Fix**: Added PII field redaction and pattern-based redaction for CPF, email, phone.

#### ✅ SEC-007: No Rate Limiting
**Status**: FIXED in v3.5
**Fix**: Implemented Token Bucket rate limiter (`lib/rateLimiter.ts`) with 15 tests. Integrated into Gemini client.

#### SEC-008: Prompt Injection Vulnerability
**File**: `lib/geminiClient.ts:116`
**Risk**: User-supplied text passed directly to LLM without sanitization.

#### SEC-009: No Dependency Scanning
**Risk**: No SBOM validation or vulnerability scanning in CI pipeline.

---

### LOW Severity (CVSS 0.1-3.9)

#### SEC-010: Biometric Timeout Too Long
**File**: `components/biometric-gate.tsx:12`
**Current**: 30 seconds. Consider 15 seconds for sensitive health data.

#### SEC-011: No Certificate Pinning
**Risk**: MITM attacks possible without SSL pinning for Gemini API.

#### SEC-012: Missing CSP Headers
**Risk**: Web view components lack Content-Security-Policy.

#### SEC-013: Hardcoded Model ID
**File**: `lib/config.ts`
**Risk**: Model version should be configurable for updates without app release.

---

## Part II: Code Quality Issues (Fresh Eyes Review v3.4 - UPDATED)

### Status Summary (v3.4)

| Priority | Total | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 5 | 5 | 0 ✅ |
| HIGH | 5 | 5 | 0 ✅ |
| MEDIUM | 4 | 4 | 0 ✅ |

### ✅ ALL CRITICAL & HIGH Bugs - FIXED

| ID | File:Line | Issue | Status |
|----|-----------|-------|--------|
| ✅ BUG-001 | `lib/session.ts` | getUserHash instability - persists across restarts | FIXED - SecureStore + device ID |
| ✅ BUG-002 | `lib/database.ts` | Race condition in schema migration | FIXED - race-safe ALTER TABLE with recheck |
| ✅ BUG-003 | `lib/geminiClient.ts` | Unhandled AbortError on timeout | FIXED - GeminiTimeoutError thrown |
| ✅ BUG-004 | `components/biometric-gate.tsx` | Missing `authenticate` in useEffect deps | FIXED - useCallback with stable deps |
| ✅ BUG-005 | `app/import.tsx` | Unhandled promise rejection in runPipeline | FIXED - comprehensive try/catch with error types |
| ✅ BUG-006 | `lib/metrics.ts` | Memory leak - activeMetrics never cleaned | FIXED - cleanupStaleMetrics + cancelMetric |
| ✅ BUG-007 | `components/biometric-gate.tsx` | Stale `biometricEnabled` state | FIXED - uses ref pattern |
| ✅ BUG-008 | `lib/cryptoStore.ts` | No Zod validation on decrypt | FIXED - schema parameter required |
| ✅ BUG-009 | `lib/geminiClient.ts` | Type coercion with `as any` | FIXED - no `as any` in production code |
| ✅ BUG-010 | `app/(tabs)/settings.tsx` | Data loss risk - no confirm before wipe | FIXED - double-confirm dialog |
| ✅ BUG-011 | `lib/observability.ts` | Silent error swallowing | FIXED - log health tracking with getLogHealth() |
| ✅ BUG-012 | `lib/settingsStore.ts` | No schema validation on load | FIXED - Zod appSettingsSchema |
| ✅ BUG-014 | `modules/extraction/textExtractor.ts` | Wrong error code | FIXED - NATIVE_MODULE_MISSING |
| ✅ BUG-015 | `lib/logger.ts` | Potential PII leak | FIXED - PII field/pattern redaction |

### 🟢 Status Summary

| Priority | Total | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 5 | 5 | 0 |
| HIGH | 5 | 5 | 0 |
| MEDIUM | 4 | 4 | 0 |

---

## Part III: Architecture Gaps

### Current State Analysis

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────┤
│  UI Layer          │  Direct imports to lib/*               │
│  Business Logic    │  Mixed with UI in components           │
│  Data Layer        │  SQLite + SecureStore (tightly coupled)│
│  External Services │  Gemini client (no abstraction)        │
└─────────────────────────────────────────────────────────────┘
Problems:
- No dependency injection → Cannot unit test without real DB
- No repository pattern → SQL scattered across codebase
- No error boundaries → Crashes propagate to app root
- No offline queue → Failed operations lost
```

### Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TARGET ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│  Presentation      │  React components (pure, testable)     │
│  Application       │  Use cases, orchestration              │
│  Domain            │  Entities, business rules              │
│  Infrastructure    │  DB, API clients, platform services    │
└─────────────────────────────────────────────────────────────┘
Improvements:
- Dependency injection via React Context
- Repository interfaces for data access
- Error boundaries at route level
- Offline queue with retry logic
- Feature flags for gradual rollout
```

---

## Part IV: React Patterns Analysis

### useEffect Anti-Patterns Found

#### BiometricGate Component (Critical)

**Issue 1**: Missing dependency
```typescript
// CURRENT (line 48-50)
useEffect(() => {
  authenticate().then(setAllowed);
}, []); // Missing authenticate dependency
```

**Issue 2**: Stale closure in AppState listener
```typescript
// CURRENT (line 53-84)
useEffect(() => {
  const subscription = AppState.addEventListener('change', async (nextAppState) => {
    if (!biometricEnabled) { // This captures stale value!
      return;
    }
    // ...
  });
  return () => subscription.remove();
}, [biometricEnabled]); // Recreates listener on every change
```

**Fix**:
```typescript
const authenticateRef = useRef(authenticate);
authenticateRef.current = authenticate;

const biometricEnabledRef = useRef(biometricEnabled);
biometricEnabledRef.current = biometricEnabled;

useEffect(() => {
  const subscription = AppState.addEventListener('change', async (nextAppState) => {
    if (!biometricEnabledRef.current) return;
    // Use authenticateRef.current() instead
  });
  return () => subscription.remove();
}, []); // Stable - no recreations
```

### Missing React 19 Patterns

| Pattern | Current | Should Use |
|---------|---------|------------|
| Data fetching | useEffect + useState | `use()` with Suspense |
| Form actions | Manual state | `useActionState()` |
| Optimistic UI | None | `useOptimistic()` |
| Transitions | None | `useTransition()` |

---

## Part V: Multi-Phase Implementation Plan

### Phase 1: Critical Security Fixes (Day 1)

**Priority**: BLOCKER - Must complete before any other work

#### Task 1.1: Move API Key to Header
```typescript
// lib/geminiClient.ts - Replace line 84-89
const res = await fetch(GEMINI_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
  },
  body: JSON.stringify(body),
  signal: controller.signal,
});
```

#### Task 1.2: Fix getUserHash Stability
```typescript
// lib/session.ts - Replace lines 24-36
import * as Application from 'expo-application';
import * as Device from 'expo-device';

export async function getUserHash(): Promise<string> {
  if (userHash) return userHash;

  // Use stable device identifiers
  const deviceId = await Application.getIosIdForVendorAsync()
    ?? Application.androidId
    ?? Device.modelId
    ?? 'unknown-device';

  const seed = `lumina-sabin-v1-${deviceId}`;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    seed
  );
  userHash = hash.substring(0, 16);
  return userHash;
}
```

#### Task 1.3: Add Zod Validation to decryptJson
```typescript
// lib/cryptoStore.ts - Replace lines 47-54
import { z } from 'zod';

export async function decryptJson<T>(
  blob: EncryptedBlob,
  schema: z.ZodType<T>
): Promise<T> {
  if (blob.version !== 1) {
    throw new Error(`Unsupported blob version: ${blob.version}`);
  }
  const key = await getOrCreateMasterKey();
  const plaintext = await AesGcmCrypto.decrypt(
    blob.ciphertext, key, blob.nonce, blob.tag, false
  );
  const parsed = JSON.parse(plaintext);
  return schema.parse(parsed);
}
```

#### Task 1.4: Fix Database Race Condition
```typescript
// lib/database.ts - Replace lines 26-31
// Backfill deleted_at with race-safe approach
const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(reports);');
const hasDeletedAt = columns.some((c) => c.name === 'deleted_at');
if (!hasDeletedAt) {
  try {
    await db.execAsync('ALTER TABLE reports ADD COLUMN deleted_at TEXT;');
  } catch (error) {
    // Column may have been added by concurrent call - verify
    const recheck = await db.getAllAsync<{ name: string }>('PRAGMA table_info(reports);');
    const nowHasDeletedAt = recheck.some((c) => c.name === 'deleted_at');
    if (!nowHasDeletedAt) {
      throw error; // Real error, re-throw
    }
    // Column exists now, continue
  }
}
```

**Acceptance Criteria**:
- [ ] API key not visible in any logs or network traces
- [ ] getUserHash returns same value across app restarts
- [ ] decryptJson throws ZodError for invalid payloads
- [ ] Concurrent ensureSchema calls don't crash

---

### Phase 2: React Pattern Fixes (Day 2)

#### Task 2.1: Fix BiometricGate useEffect
```typescript
// components/biometric-gate.tsx - Complete rewrite
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const BACKGROUND_TIMEOUT_MS = 30_000;

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const backgroundTimeRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const biometricEnabledRef = useRef(biometricEnabled);
  const isMountedRef = useRef(true);

  // Keep ref in sync
  useEffect(() => {
    biometricEnabledRef.current = biometricEnabled;
  }, [biometricEnabled]);

  const authenticate = useCallback(async (): Promise<boolean> => {
    const settings = await loadSettings();
    if (!isMountedRef.current) return false;

    setBiometricEnabled(Boolean(settings.biometricLock));

    if (!settings.biometricLock) return true;

    const available = await LocalAuthentication.hasHardwareAsync();
    if (!available) return true;

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return true;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquear Lumina Sabin',
      cancelLabel: 'Cancelar',
    });

    audit(result.success ? 'biometric.unlock' : 'biometric.failed', {
      success: result.success,
      error: result.error,
    });

    return result.success;
  }, []);

  // Initial auth
  useEffect(() => {
    isMountedRef.current = true;
    authenticate().then((result) => {
      if (isMountedRef.current) setAllowed(result);
    });
    return () => {
      isMountedRef.current = false;
    };
  }, [authenticate]);

  // AppState listener - stable, uses refs
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (previousState === 'active' && nextAppState.match(/inactive|background/)) {
        backgroundTimeRef.current = Date.now();
        return;
      }

      if (previousState.match(/inactive|background/) && nextAppState === 'active') {
        if (!biometricEnabledRef.current) return;

        const elapsed = backgroundTimeRef.current
          ? Date.now() - backgroundTimeRef.current
          : 0;
        backgroundTimeRef.current = null;

        if (elapsed >= BACKGROUND_TIMEOUT_MS && isMountedRef.current) {
          setAllowed(null);
          const result = await authenticate();
          if (isMountedRef.current) setAllowed(result);
        }
      }
    });

    return () => subscription.remove();
  }, [authenticate]);

  // ... rest of component
}
```

#### Task 2.2: Add Error Boundaries
```typescript
// components/error-boundary.tsx - New file
import { Component, ErrorInfo, ReactNode } from 'react';
import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';
import { audit } from '@/lib/audit';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    audit('error.boundary', {
      error: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <ThemedText type="title">Algo deu errado</ThemedText>
          <ThemedText style={{ marginTop: 8, textAlign: 'center' }}>
            {this.state.error?.message ?? 'Erro desconhecido'}
          </ThemedText>
          <ThemedText
            style={{ marginTop: 16, color: '#0a84ff' }}
            onPress={() => this.setState({ hasError: false })}
          >
            Tentar novamente
          </ThemedText>
        </ThemedView>
      );
    }
    return this.props.children;
  }
}
```

**Acceptance Criteria**:
- [ ] BiometricGate passes ESLint exhaustive-deps
- [ ] No stale closure warnings
- [ ] Error boundaries catch and report component crashes
- [ ] All useEffect hooks have proper cleanup

---

### Phase 3: Error Handling Improvements (Day 3)

#### Task 3.1: Handle AbortError in Gemini Client
```typescript
// lib/geminiClient.ts - Update postGemini function
async function postGemini(apiKey: string, body: unknown): Promise<GeminiResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new GeminiError(`Gemini error ${res.status}: ${text}`, res.status);
    }

    return (await res.json()) as GeminiResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      audit('gemini.timeout', { timeoutMs: GEMINI_TIMEOUT_MS });
      throw new GeminiTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export class GeminiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'GeminiError';
  }
}

export class GeminiTimeoutError extends Error {
  constructor() {
    super('Gemini request timed out');
    this.name = 'GeminiTimeoutError';
  }
}
```

#### Task 3.2: Fix Import Pipeline Error Handling
```typescript
// app/import.tsx - Update runPipeline
const runPipeline = async (
  rawText: string,
  source: 'pdf' | 'image' | 'text',
  meta?: Record<string, unknown>
) => {
  const key = await getApiKeyOrWarn();
  if (!key) return;

  const online = await ensureOnline();
  if (!online) return;

  try {
    logEvent('gemini.request', 'info', { source, ...meta });
    const { id } = await processAndSaveReport({ apiKey: key, rawText, labSource: 'SABIN' });
    audit('gemini.success', { kind: 'parse', source, ...meta });
    router.push({ pathname: '/report/[id]', params: { id } });
  } catch (error) {
    audit('gemini.failure', {
      source,
      error: error instanceof Error ? error.message : String(error),
      ...meta
    });

    if (error instanceof GeminiTimeoutError) {
      Alert.alert('Timeout', 'A análise demorou demais. Tente novamente.');
    } else if (error instanceof OfflineError) {
      Alert.alert('Sem conexão', error.message);
    } else if (error instanceof z.ZodError) {
      Alert.alert('Erro de análise', 'O formato da resposta é inválido. Tente novamente.');
    } else {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro desconhecido');
    }
  }
};
```

#### Task 3.3: Fix Memory Leak in Metrics
```typescript
// lib/metrics.ts - Add cleanup on error
export function endMetric(id: string, success: boolean = true): number | null {
  const metric = activeMetrics.get(id);
  if (!metric) return null;

  // Always clean up, regardless of success/failure
  activeMetrics.delete(id);

  const duration = Date.now() - metric.startTime;

  void appendLogLine(JSON.stringify({
    type: 'metric',
    name: metric.name,
    duration,
    success,
    metadata: metric.metadata,
    sessionId: getSessionId(),
    timestamp: new Date().toISOString(),
  }));

  return duration;
}

// Add cleanup for abandoned metrics (call periodically)
export function cleanupStaleMetrics(maxAgeMs: number = 300_000): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, metric] of activeMetrics.entries()) {
    if (now - metric.startTime > maxAgeMs) {
      activeMetrics.delete(id);
      cleaned++;
      void appendLogLine(JSON.stringify({
        type: 'metric.abandoned',
        name: metric.name,
        age: now - metric.startTime,
        sessionId: getSessionId(),
      }));
    }
  }

  return cleaned;
}
```

**Acceptance Criteria**:
- [ ] Timeout errors show user-friendly message
- [ ] All API errors logged with context
- [ ] No memory leaks from abandoned metrics
- [ ] Import flow handles all error types gracefully

---

### Phase 4: Test Coverage (Day 4-5)

#### Task 4.1: Integration Tests for Security Fixes
```typescript
// __tests__/security.integration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Security Integration', () => {
  describe('API Key Security', () => {
    it('should send API key in header, not URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }),
      });
      global.fetch = mockFetch;

      await analyzeWithGemini('test-key', 'test text');

      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).not.toContain('key=');
      expect(options.headers['X-Goog-Api-Key']).toBe('test-key');
    });
  });

  describe('Crypto Validation', () => {
    it('should throw ZodError for invalid decrypted data', async () => {
      const invalidBlob = await encryptJson({ invalid: 'structure' });

      await expect(
        decryptJson(invalidBlob, sabinAnalysisResponseSchema)
      ).rejects.toThrow(z.ZodError);
    });
  });

  describe('Session Stability', () => {
    it('should return same userHash across calls', async () => {
      const hash1 = await getUserHash();
      resetSession();
      const hash2 = await getUserHash();

      // After fix, these should be equal (stable device ID)
      expect(hash1).toBe(hash2);
    });
  });
});
```

#### Task 4.2: Component Tests for BiometricGate
```typescript
// __tests__/biometric-gate.test.tsx
import { render, act, waitFor } from '@testing-library/react-native';
import { BiometricGate } from '@/components/biometric-gate';
import { AppState } from 'react-native';

describe('BiometricGate', () => {
  it('should not have stale biometricEnabled state', async () => {
    const { getByText } = render(
      <BiometricGate>
        <Text>Protected Content</Text>
      </BiometricGate>
    );

    // Simulate settings change
    await act(async () => {
      await saveSettings({ biometricLock: true });
    });

    // Simulate background/foreground cycle
    await act(async () => {
      AppState.currentState = 'background';
      // Wait for timeout
      await new Promise(r => setTimeout(r, 35000));
      AppState.currentState = 'active';
    });

    // Should trigger re-auth
    await waitFor(() => {
      expect(mockAuthenticate).toHaveBeenCalledTimes(2);
    });
  });
});
```

**Acceptance Criteria**:
- [ ] All security fixes have integration tests
- [ ] BiometricGate has comprehensive test coverage
- [ ] Error boundary behavior tested
- [ ] Test coverage > 80% for critical paths

---

### Phase 5: Architecture Improvements (Week 2)

#### Task 5.1: Repository Pattern
Create abstraction layer for data access:
```
lib/
  repositories/
    IReportRepository.ts  # Interface
    SQLiteReportRepository.ts  # Implementation
    MockReportRepository.ts  # For tests
```

#### Task 5.2: Dependency Injection
Create context-based DI:
```typescript
// providers/dependencies.tsx
const DependenciesContext = createContext<Dependencies | null>(null);

export function DependenciesProvider({ children, overrides }: Props) {
  const deps = useMemo(() => ({
    reportRepo: overrides?.reportRepo ?? new SQLiteReportRepository(),
    geminiClient: overrides?.geminiClient ?? new GeminiClient(),
    cryptoStore: overrides?.cryptoStore ?? new CryptoStore(),
  }), [overrides]);

  return (
    <DependenciesContext.Provider value={deps}>
      {children}
    </DependenciesContext.Provider>
  );
}
```

#### Task 5.3: Offline Queue
Implement retry queue for failed operations:
```typescript
// lib/offlineQueue.ts
interface QueuedOperation {
  id: string;
  type: 'analyze' | 'export';
  payload: unknown;
  attempts: number;
  createdAt: string;
}

export class OfflineQueue {
  async enqueue(op: Omit<QueuedOperation, 'id' | 'attempts' | 'createdAt'>): Promise<string>;
  async process(): Promise<void>;
  async clear(): Promise<void>;
}
```

**Acceptance Criteria**:
- [ ] All data access goes through repositories
- [ ] Tests can inject mock dependencies
- [ ] Failed operations queued for retry
- [ ] Offline queue persists across app restarts

---

### Phase 6: React 19 Modernization (Week 3)

#### Task 6.1: Adopt use() Hook
Replace useEffect data fetching with Suspense:
```typescript
// Before
function ReportScreen({ id }: { id: string }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReport(id).then(setReport).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading />;
  return <ReportDisplay report={report} />;
}

// After
function ReportScreen({ id }: { id: string }) {
  const report = use(getReport(id));
  return <ReportDisplay report={report} />;
}

// Wrapped with Suspense
<Suspense fallback={<Loading />}>
  <ReportScreen id={id} />
</Suspense>
```

#### Task 6.2: Adopt useActionState
Replace manual form state:
```typescript
// Before
function SettingsForm() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await validateApiKey(apiKey);
      await saveSettings({ geminiApiKey: apiKey });
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };
}

// After
function SettingsForm() {
  const [state, submitAction, isPending] = useActionState(
    async (prevState, formData) => {
      const apiKey = formData.get('apiKey');
      await validateApiKey(apiKey);
      await saveSettings({ geminiApiKey: apiKey });
      return { success: true };
    },
    { success: false }
  );
}
```

**Acceptance Criteria**:
- [ ] Data fetching uses use() + Suspense
- [ ] Forms use useActionState
- [ ] No useEffect for data fetching
- [ ] Optimistic UI with useOptimistic where applicable

---

## Part VI: Verification Checklist

### Pre-Release Gate

- [ ] All CRITICAL and HIGH vulnerabilities fixed
- [ ] ESLint exhaustive-deps passes
- [ ] Test coverage > 80%
- [ ] No `as any` type assertions in critical paths
- [ ] All audit events fire correctly
- [ ] API key never appears in logs
- [ ] Biometric gate handles all edge cases
- [ ] Error boundaries catch component crashes
- [ ] Offline mode works correctly

### Carmack Review Criteria

| Criterion | Current | Target | Status |
|-----------|---------|--------|--------|
| Security posture | 3/10 | 8/10 | Pending |
| Type safety | 5/10 | 9/10 | Pending |
| Error handling | 4/10 | 8/10 | Pending |
| Test coverage | 6/10 | 8/10 | Pending |
| Code clarity | 6/10 | 9/10 | Pending |
| Performance | 7/10 | 8/10 | Pending |

---

## Appendix A: File Change Summary

| Phase | Files Modified | Files Created |
|-------|----------------|---------------|
| 1 | geminiClient.ts, session.ts, cryptoStore.ts, database.ts | - |
| 2 | biometric-gate.tsx | error-boundary.tsx |
| 3 | geminiClient.ts, import.tsx, metrics.ts | - |
| 4 | - | security.integration.test.ts, biometric-gate.test.tsx |
| 5 | - | repositories/*, offlineQueue.ts, dependencies.tsx |
| 6 | Multiple screens | - |

---

---

## Appendix B: Guidelines Compliance Matrix

| Guideline | Section | Compliance Status |
|-----------|---------|------------------|
| SECURITY-GUIDELINES.md | API Key Security | ✅ Fixed (SEC-001) |
| SECURITY-GUIDELINES.md | Key Derivation | 🟡 Partial (SEC-003 open) |
| SECURITY-GUIDELINES.md | Certificate Pinning | 🔴 Not implemented |
| AUDIT-GUIDELINES.md | Audit Events | ✅ Implemented |
| AUDIT-GUIDELINES.md | 7-day Retention | ✅ Implemented |
| AUDIT-GUIDELINES.md | Soft Deletes | ✅ Implemented |
| LOG-GUIDELINES.md | Structured Logging | ✅ Implemented |
| LOG-GUIDELINES.md | PII Redaction | 🟡 Partial |
| TYPESCRIPT-GUIDELINES.md | Strict TSConfig | 🟡 Partial (core strictness enabled; some options deferred) |
| TYPESCRIPT-GUIDELINES.md | Branded Types | ✅ Implemented (`types/branded.ts`) |
| REACT-GUIDELINES.md | Error Boundaries | ✅ Implemented (RootLayout boundary + audited errors) |
| REACT-GUIDELINES.md | React 19 Hooks | 🔴 Not adopted |
| MOBILE-GUIDELINES.md | New Architecture | ✅ Enabled |
| MOBILE-GUIDELINES.md | React Compiler | ✅ Enabled |
| MOBILE-GUIDELINES.md | Typed Routes | ✅ Enabled |

---

## Appendix C: Research Sources

React Native / Expo SDK 54:
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54)
- [React Native New Architecture](https://docs.expo.dev/guides/new-architecture/)
- [React Native 0.82 Announcement](https://reactnative.dev/blog/2025/10/08/react-native-0.82)

React 19:
- [React v19 Official Blog](https://react.dev/blog/2024/12/05/react-19)
- [useActionState Documentation](https://200oksolutions.com/blog/exploring-react-19-new-hooks/)
- [React 19 Hooks Guide](https://www.freecodecamp.org/news/react-19-new-hooks-explained-with-examples/)

---

**Document Owner**: Engineering Team
**Version**: 3.6
**Last Updated**: 2025-12-12
**Next Review**: After resolving P0 items (PRIV-001/AUDIT-001/AND-001)
**Carmack Review Target**: Prior to any external distribution (TestFlight / Play internal track)

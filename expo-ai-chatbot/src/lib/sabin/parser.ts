import type { Flag, LabResult, SabinAnalysisResponse } from "@/lib/sabin/types";
import {
  formatDateDdMmYyyyToIso,
  normalizeWhitespace,
  parsePtNumber,
} from "@/lib/sabin/textUtils";

type MarkerSpec = {
  id: string;
  examName: string;
  // A marker is extracted by searching for its label, then finding RESULTADO nearby.
  label: RegExp;
};

const DEFAULT_MARKERS: MarkerSpec[] = [
  { id: "GLICOSE", examName: "Glicose", label: /GLICOSE(?!\s+P[OÓ]S)/i },
  { id: "CREATININA", examName: "Creatinina", label: /CREATININA/i },
  {
    id: "COLESTEROL_TOTAL",
    examName: "Colesterol total",
    label: /COLESTEROL\s+TOTAL/i,
  },
  { id: "TRIGLICERIDEOS", examName: "Triglicerídeos", label: /TRIGLICER/i },
  { id: "HDL", examName: "Colesterol HDL", label: /COLESTEROL\s+HDL/i },
  { id: "LDL", examName: "Colesterol LDL", label: /COLESTEROL\s+LDL/i },
  {
    id: "HBA1C",
    examName: "Hemoglobina glicada (HbA1c)",
    label: /HEMOGLOBINA\s+GLICADA/i,
  },
];

function toMarkerIdFallback(examName: string): string {
  const normalized = examName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  if (!normalized) return "EXAME";
  return normalized.slice(0, 64);
}

function inferMarkerIdFromExamName(examName: string): string {
  const upper = examName.toUpperCase();

  if (/\bGLICOSE\b/.test(upper)) return "GLICOSE";
  if (/\bCREATININA\b/.test(upper)) return "CREATININA";
  if (/\bTRIGLICER/.test(upper)) return "TRIGLICERIDEOS";
  if (/\bCOLESTEROL\s+HDL\b/.test(upper)) return "HDL";
  if (/\bCOLESTEROL\s+LDL\b/.test(upper)) return "LDL";
  if (/\bCOLESTEROL\s+TOTAL\b/.test(upper)) return "COLESTEROL_TOTAL";
  if (/\bHEMOGLOBINA\s+GLICADA\b/.test(upper) || /\bHBA1C\b/.test(upper))
    return "HBA1C";

  return toMarkerIdFallback(examName);
}

function extractPatientName(text: string): string | undefined {
  const match =
    text.match(/Nome\s*:\s*([^\n]+?)(?:\s+RG\b|$)/i) ??
    text.match(/Paciente\s*:\s*([^\n]+?)(?:\s+RG\b|$)/i);
  const value = match?.[1]?.trim();
  return value ? value.replace(/\s+/g, " ") : undefined;
}

function extractCollectedAndReleasedAt(text: string): {
  collectedAt?: string;
  releasedAt?: string;
  examDate?: string;
} {
  // Coleta : 14/03/2023 - 07:32 Liberação : 14/03/2023 - 11:45
  const coletaMatch = text.match(
    /Coleta\s*:\s*(\d{2}\/\d{2}\/\d{4})(?:\s*-\s*(\d{2}:\d{2}(?::\d{2})?))?/i,
  );
  const liberacaoMatch = text.match(
    /Libera[çc][ãa]o\s*:\s*(\d{2}\/\d{2}\/\d{4})(?:\s*-\s*(\d{2}:\d{2}(?::\d{2})?))?/i,
  );

  const examDate = coletaMatch?.[1] ? formatDateDdMmYyyyToIso(coletaMatch[1]) : null;

  const collectedAt =
    coletaMatch?.[1] && coletaMatch?.[2]
      ? `${formatDateDdMmYyyyToIso(coletaMatch[1])}T${coletaMatch[2]}`
      : coletaMatch?.[1]
        ? formatDateDdMmYyyyToIso(coletaMatch[1]) ?? undefined
        : undefined;

  const releasedAt =
    liberacaoMatch?.[1] && liberacaoMatch?.[2]
      ? `${formatDateDdMmYyyyToIso(liberacaoMatch[1])}T${liberacaoMatch[2]}`
      : liberacaoMatch?.[1]
        ? formatDateDdMmYyyyToIso(liberacaoMatch[1]) ?? undefined
        : undefined;

  return {
    collectedAt,
    releasedAt,
    examDate: examDate ?? undefined,
  };
}

function computeFlagForNumeric(
  value: number,
  referenceRange: { min?: number; max?: number } | null,
): Flag {
  if (!referenceRange) return "unknown";
  if (typeof referenceRange.min === "number" && value < referenceRange.min)
    return "low";
  if (typeof referenceRange.max === "number" && value > referenceRange.max)
    return "high";
  if (
    typeof referenceRange.min === "number" ||
    typeof referenceRange.max === "number"
  )
    return "normal";
  return "unknown";
}

function parseReferenceRange(block: string): {
  raw?: string;
  min?: number;
  max?: number;
} | null {
  // Common pattern: "70 a 99 mg/dL"
  const between = block.match(/([0-9.,]+)\s*a\s*([0-9.,]+)/i);
  if (between) {
    const min = parsePtNumber(between[1]);
    const max = parsePtNumber(between[2]);
    if (min != null || max != null) {
      return {
        raw: `${between[1]} a ${between[2]}`.trim(),
        min: min ?? undefined,
        max: max ?? undefined,
      };
    }
  }

  // Upper bound: "até 200" or "< 200"
  const upper =
    block.match(/até\s*([0-9.,]+)/i) ?? block.match(/<\s*([0-9.,]+)/i);
  if (upper) {
    const max = parsePtNumber(upper[1]);
    if (max != null) {
      return { raw: upper[0].trim(), max };
    }
  }

  // Lower bound: "> 40"
  const lower = block.match(/>\s*([0-9.,]+)/i);
  if (lower) {
    const min = parsePtNumber(lower[1]);
    if (min != null) {
      return { raw: lower[0].trim(), min };
    }
  }

  return null;
}

function extractUnitNear(block: string): string | undefined {
  const match =
    block.match(/\b(mg\/dL|g\/dL|mmol\/L|mEq\/L|%|UI\/L|U\/L|ng\/mL)\b/i) ??
    block.match(/\b(milh(?:[õo]es)?\/mm[³3]|\/mm[³3])\b/i);
  return match?.[1];
}

function guessExamNameFromBeforeContext(before: string): string {
  let candidate = before.trim();

  // Prefer the last "chunk" separated by blank lines if present.
  const chunks = candidate.split(/\n{2,}/);
  candidate = chunks[chunks.length - 1] ?? candidate;

  // Prefer the last line if newlines exist.
  const lines = candidate.split(/\n/).map((l) => l.trim()).filter(Boolean);
  candidate = lines.length ? lines[lines.length - 1] : candidate;

  // If PDFs flatten layout, try to cut at common field labels.
  const cutAt = [
    /Material\s*:/i,
    /M[ée]todo\s*:/i,
    /Unidade(?:s)?\s*:/i,
    /Valores?\s+de\s+refer[êe]ncia\s*:/i,
    /Refer[êe]ncia\s*:/i,
  ];
  for (const re of cutAt) {
    const idx = candidate.search(re);
    if (idx >= 0) candidate = candidate.slice(0, idx);
  }

  candidate = normalizeWhitespace(candidate).replace(/\n/g, " ").trim();

  if (candidate.length > 160) {
    candidate = candidate.slice(candidate.length - 160).trim();
  }

  return candidate || "Exame";
}

function extractGenericResults(text: string): LabResult[] {
  const results: LabResult[] = [];
  const seen = new Set<string>();

  const re = /RESULTADO\s*:\s*/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text))) {
    const resultIndex = match.index;
    if (typeof resultIndex !== "number") continue;

    const start = Math.max(0, resultIndex - 260);
    const before = text.slice(start, resultIndex);
    const after = text.slice(resultIndex, Math.min(text.length, resultIndex + 900));

    const resultMatch = after.match(
      /RESULTADO\s*:\s*([\s\S]*?)(?:\b(?:INTERPRETA[ÇC][ÃA]O|Material|M[ée]todo|Unidade(?:s)?|Valores?\s+de\s+refer[êe]ncia|Refer[êe]ncia|Coleta|Libera[çc][ãa]o|Observa[çc][ãa]o)\b|$)/i,
    );
    const raw = normalizeWhitespace((resultMatch?.[1] ?? "").replace(/\n/g, " "))
      .trim()
      .slice(0, 140);
    if (!raw) continue;

    const examName = guessExamNameFromBeforeContext(before);
    const id = inferMarkerIdFromExamName(examName);
    if (seen.has(id)) continue;

    const { collectedAt, releasedAt } = extractCollectedAndReleasedAt(after);
    const unit = extractUnitNear(after);
    const range = parseReferenceRange(after);

    const numeric = /^[0-9]/.test(raw) ? parsePtNumber(raw.split(/\s+/)[0]) : null;

    if (numeric != null) {
      const flag = computeFlagForNumeric(
        numeric,
        range ? { min: range.min, max: range.max } : null,
      );
      results.push({
        id,
        examName,
        resultValue: numeric,
        unit,
        referenceRange: range?.raw,
        flag,
        collectedAt,
        releasedAt,
        confidence: 1,
      });
      seen.add(id);
      continue;
    }

    const upper = raw.toUpperCase();
    const flag: Flag =
      upper.includes("NÃO REAGENTE") || upper.includes("NAO REAGENTE") || upper.includes("NÃO DETECTADO") || upper.includes("NAO DETECTADO")
        ? "non_reactive"
        : upper.includes("REAGENTE") || upper.includes("DETECTADO")
          ? "reactive"
          : upper.includes("INDETERMINADO")
            ? "indeterminate"
            : "unknown";

    results.push({
      id,
      examName,
      resultText: raw,
      unit,
      referenceRange: range?.raw,
      flag,
      collectedAt,
      releasedAt,
      confidence: 1,
    });
    seen.add(id);
  }

  return results;
}

function formatLabResultValueForSummary(result: LabResult): string {
  if (typeof result.resultValue === "number") {
    return `${result.resultValue}${result.unit ? ` ${result.unit}` : ""}`;
  }
  return result.resultText ?? "—";
}

function buildMainFindingsPtBr(results: LabResult[]): string {
  const flagged = results.filter(
    (r) =>
      r.flag === "high" ||
      r.flag === "low" ||
      r.flag === "reactive" ||
      r.flag === "indeterminate",
  );

  const disclaimer =
    "Essas informações não substituem uma avaliação médica. Converse com seu médico.";

  if (results.length === 0) {
    return `Laudo importado. Nenhum marcador foi extraído automaticamente. ${disclaimer}`;
  }

  if (flagged.length === 0) {
    return `Marcadores extraídos sem sinais fora da faixa. ${disclaimer}`;
  }

  const top = flagged.slice(0, 3).map((r) => {
    const name = r.examName || r.id;
    return `${name}: ${formatLabResultValueForSummary(r)} (${r.flag})`;
  });

  const more = flagged.length > top.length ? ` +${flagged.length - top.length}` : "";
  return `Sinalizados: ${top.join(" · ")}${more}. ${disclaimer}`;
}

function extractResultFromMarker(text: string, spec: MarkerSpec): LabResult | null {
  const labelMatch = spec.label.exec(text);
  if (!labelMatch || typeof labelMatch.index !== "number") return null;

  const start = Math.max(0, labelMatch.index - 50);
  const end = Math.min(text.length, labelMatch.index + 900);
  const block = text.slice(start, end);

  const resultMatch = block.match(
    /RESULTADO\s*:\s*([0-9.,]+|N[ÃA]O\s+REAGENTE|N[ÃA]O\s+DETECTADO|DETECTADO|REAGENTE|INDETERMINADO)/i,
  );
  if (!resultMatch) return null;

  const raw = resultMatch[1].trim();
  const numeric = parsePtNumber(raw);

  const range = parseReferenceRange(block);
  const unit = extractUnitNear(block);

  const { collectedAt, releasedAt } = extractCollectedAndReleasedAt(block);

  if (numeric != null) {
    const flag = computeFlagForNumeric(
      numeric,
      range ? { min: range.min, max: range.max } : null,
    );
    return {
      id: spec.id,
      examName: spec.examName,
      resultValue: numeric,
      unit,
      referenceRange: range?.raw,
      flag,
      collectedAt,
      releasedAt,
      confidence: 1,
    };
  }

  const upper = raw.toUpperCase();
  const flag: Flag =
    upper.includes("NÃO REAGENTE") || upper.includes("NÃO DETECTADO")
      ? "non_reactive"
      : upper.includes("REAGENTE") || upper.includes("DETECTADO")
        ? "reactive"
        : upper.includes("INDETERMINADO")
          ? "indeterminate"
          : "unknown";

  return {
    id: spec.id,
    examName: spec.examName,
    resultText: raw,
    unit,
    referenceRange: range?.raw,
    flag,
    collectedAt,
    releasedAt,
    confidence: 1,
  };
}

export function parseSabinReportText(rawText: string): SabinAnalysisResponse {
  const text = normalizeWhitespace(rawText);

  const patientName = extractPatientName(text);
  const { examDate } = extractCollectedAndReleasedAt(text);

  const byId = new Map<string, LabResult>();

  for (const spec of DEFAULT_MARKERS) {
    const result = extractResultFromMarker(text, spec);
    if (result) byId.set(result.id, result);
  }

  for (const result of extractGenericResults(text)) {
    if (!byId.has(result.id)) byId.set(result.id, result);
  }

  const results = Array.from(byId.values());

  const abnormalCount = results.filter((r) =>
    r.flag === "high" ||
    r.flag === "low" ||
    r.flag === "reactive" ||
    r.flag === "indeterminate",
  ).length;
  const normalCount = results.filter((r) => r.flag === "normal").length;

  const mainFindings = buildMainFindingsPtBr(results);

  return {
    summary: {
      mainFindings,
      abnormalCount,
      normalCount,
      examDate,
      patientName,
    },
    results,
  };
}

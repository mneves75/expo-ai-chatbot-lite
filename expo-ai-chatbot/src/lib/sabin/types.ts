export type Flag =
  | "low"
  | "normal"
  | "high"
  | "reactive"
  | "non_reactive"
  | "indeterminate"
  | "unknown";

export type LabResult = {
  id: string; // internal identifier (e.g. "GLICOSE")
  examName: string; // name as seen in report
  resultValue?: number;
  resultText?: string;
  unit?: string;
  referenceRange?: string;
  flag: Flag;
  collectedAt?: string;
  releasedAt?: string;
  confidence: number; // 0..1
};

export type SabinAnalysisSummary = {
  mainFindings: string;
  abnormalCount: number;
  normalCount: number;
  examDate?: string;
  patientName?: string;
};

export type SabinAnalysisResponse = {
  summary: SabinAnalysisSummary;
  results: LabResult[];
};

export type ImportMethod = "pdf_text" | "pdf_ocr" | "image_ocr";

export type ReportPayload = {
  v: 1;
  source: {
    lab: "sabin";
    fileName?: string;
    importedAt: string; // ISO
    method?: ImportMethod;
  };
  rawText: string;
  analysis: SabinAnalysisResponse;
};

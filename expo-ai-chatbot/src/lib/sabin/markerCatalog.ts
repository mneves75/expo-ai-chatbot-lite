export const MARKER_CATALOG: Record<string, { label: string }> = {
  GLICOSE: { label: "Glicose" },
  HBA1C: { label: "HbA1c" },
  LDL: { label: "LDL" },
  HDL: { label: "HDL" },
  COLESTEROL_TOTAL: { label: "Colesterol total" },
  TRIGLICERIDEOS: { label: "Triglicerídeos" },
  CREATININA: { label: "Creatinina" },
};

export function markerLabel(markerId: string): string {
  return MARKER_CATALOG[markerId]?.label ?? markerId;
}


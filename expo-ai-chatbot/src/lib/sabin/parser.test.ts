import { parseSabinReportText } from "@/lib/sabin/parser";

test("parses basic numeric markers and flags", () => {
  const text = `
    Sabin
    Nome: Fulano de Tal RG: 123
    Coleta: 01/02/2024 - 07:30 Liberação: 01/02/2024 - 10:30

    GLICOSE
    RESULTADO: 110 mg/dL
    Valores de referência: 70 a 99 mg/dL
  `;

  const parsed = parseSabinReportText(text);

  expect(parsed.summary.examDate).toBe("2024-02-01");
  expect(parsed.results.some((r) => r.id === "GLICOSE")).toBe(true);

  const glicose = parsed.results.find((r) => r.id === "GLICOSE");
  expect(glicose?.resultValue).toBe(110);
  expect(glicose?.flag).toBe("high");
  expect(parsed.summary.abnormalCount).toBeGreaterThanOrEqual(1);
  expect(/não substituem/i.test(parsed.summary.mainFindings)).toBe(true);
});

test("parses qualitative results like PCR (não detectado)", () => {
  const text = `
    TESTE MOLECULAR PARA DETECÇÃO DO CORONAVÍRUS SARS-CoV-2
    Material: Swab nasofaríngeo
    RESULTADO: NÃO DETECTADO (Ausência de RNA específico de SARS-CoV-2)
    Interpretação do resultado: ...
  `;

  const parsed = parseSabinReportText(text);

  expect(parsed.results.length).toBeGreaterThan(0);
  expect(parsed.results.some((r) => r.flag === "non_reactive")).toBe(true);
});

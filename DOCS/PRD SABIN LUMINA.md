> Implementation note (this repository): the Expo app is **fully on-device** and does **not** call Gemini or any cloud API.  
> This PRD describes an earlier design that included Gemini with user-provided keys; those sections are not implemented here by intent.

# PRD SABIN LUMINA
1. Visão e objetivos (novo MVP “all in app”)

1.1 Visão

Um cofre de saúde local que:
	•	Lê laudos Sabin (PDF ou imagem) inteiramente no dispositivo:
	•	iOS: Vision + Foundation Models / Apple Intelligence para OCR / extração de texto.  ￼
	•	Android: ML Kit Text Recognition on-device para OCR.  ￼
	•	Usa Gemini 2.5 Flash via API como motor de parsing e normalização dos exames a partir de texto.  ￼
	•	Armazena todos os resultados criptografados no próprio app (estilo password manager).
	•	Mostra os resultados de forma clara, com resumo em português simples.

Nada de backend seu; só chamadas diretas para:
	•	Apple Foundation Models (on-device, sem rede) em iOS.  ￼
	•	Gemini API na nuvem (com chave do usuário).  ￼

1.2 Objetivo do MVP

Entregar um app Expo (iOS/Android) que:
	1.	Importa um laudo Sabin (PDF ou imagem).
	2.	Extrai texto no dispositivo (sem enviar imagem/PDF para terceiros).
	3.	Chama Gemini 2.5 Flash com esse texto para:
	•	Extrair marcadores (LDL, HDL, HbA1c etc) em JSON.
	•	Gerar resumo textual amigável em PT‑BR.
	4.	Salva tudo apenas localmente, criptografado.
	5.	Mostra dashboards simples de últimos resultados e flags.

⸻

2. Princípios de design (primeiros princípios)
	1.	Limite de confiança externa claro
	•	Tudo que for possível: on-device (OCR, parsing básico, armazenamento, visualização).
	•	Só o que exige “inteligência pesada” (entender laudo e organizar marcadores) vai para a nuvem (Gemini).
	2.	Sem servidor próprio = sem segredo compartilhado
	•	Você não consegue esconder uma API key hardcoded num app distribuído.
	•	Logo, o único segredo que vive no app é do próprio usuário (API key deles para Gemini).
	3.	Privacidade > conveniência
	•	Sem conta, sem sync, sem S3.
	•	Perder o aparelho = perder os dados.
	•	E é isso mesmo; faz parte do modelo “password manager de saúde”.
	4.	Modelo de dados “lab‑agnostic” desde o dia 0
	•	Mesmo sendo Sabin‑only, o schema já nasce preparado para outros labs.
	5.	LLM como parser, não como juiz clínico
	•	LLM só organiza e classifica resultados com base em faixas do próprio laudo.
	•	Sem recomendações de tratamento; resumo é descritivo, não prescritivo.

⸻

3. Arquitetura de alto nível (sem backend próprio)

3.1 Dentro do app (camadas)

Camada 1 – Captura & extração de texto
	•	iOS:
	•	PDF:
	•	Usar PDFKit / APIs de PDF nativas para extrair texto diretamente quando houver camada de texto.
	•	Para PDFs escaneados (imagem), usar Vision Text Recognition para OCR.  ￼
	•	Imagens (screenshots, fotos de laudos):
	•	Vision para OCR e layout básico (blocos / linhas).
	•	Android:
	•	PDFs:
	•	Interpretar PDFs com lib nativa (via módulo RN/Expo) e extrair texto.
	•	Se página for imagem → pipeline de OCR com ML Kit Text Recognition v2.  ￼
	•	Imagens:
	•	ML Kit (on-device) para OCR.

Camada 2 – Normalização de texto antes da IA
	•	Normaliza:
	•	Codificação (UTF‑8).
	•	Quebras de linha.
	•	Remove lixo óbvio (marcações visuais irrelevantes).
	•	Mantém:
	•	Nomes e blocos de exames.
	•	Faixas de referência e unidades.

Camada 3 – Cliente de LLM (Gemini 2.5 Flash)
	•	Módulo JS/TS que:
	•	Recebe rawText de um laudo Sabin.
	•	Monta prompt + JSON Schema.
	•	Chama Gemini 2.5 Flash via HTTPS.
	•	Retorna SabinAnalysisResponse (ou erro validado).
	•	Autenticação:
	•	Usuário informa sua própria API key Gemini nas configurações.
	•	App guarda essa key criptografada localmente (junto com os laudos).
	•	Sem backend seu intermediando.

Camada 4 – Criptografia & storage local
	•	Banco local (SQLite) com:
	•	Tabela de laudos.
	•	Tabela de índice de marcadores (sem PHI em claro).
	•	Payloads clínicos armazenados como blobs EncryptedBlob (AES‑GCM) usando chave mestra no Keychain/Keystore.

Camada 5 – UI/UX
	•	Telas:
	•	Onboarding/Consentimento.
	•	Home / Dashboard.
	•	Importar laudo.
	•	Detalhe de laudo.
	•	Configurações (incluindo API key Gemini, exportar, apagar tudo).

⸻

4. Fluxos do usuário

4.1 Onboarding
	1.	Splash com statement de privacidade:
	•	“Seus dados ficam somente neste aparelho, criptografados.”
	•	“Para analisar laudos, é necessário enviar o texto do laudo (não a imagem) para a API da Gemini usando sua própria chave de API.”
	2.	Perguntas:
	•	Aceitar uso de IA + termos.
	•	Tela opcional para colar chave da Gemini:
	•	Campo “Gemini API key”.
	•	Botão “Pular por enquanto” (app funciona até o ponto de extração de texto, mas sem parsing/insights).

4.2 Importar laudo (PDF)
	1.	Usuário na Home toca “Importar laudo Sabin (PDF)”.
	2.	DocumentPicker abre e usuário escolhe PDF.
	3.	App detecta:
	•	iOS: tenta extrair texto via PDF; se não houver texto, renderiza página como imagem e passa Vision OCR.
	•	Android: idem com lib PDF + ML Kit.
	4.	Ao final, app exibe preview do texto cru (opcional para debug) e pergunta:
	•	“Este texto parece corresponder ao seu laudo Sabin?”
	5.	Se o usuário confirmar:
	•	Verifica se há chave da Gemini configurada:
	•	Se não: avisa “Para interpretar este laudo automaticamente, configure sua chave Gemini nas Configurações.”
	•	Se sim: chama LLM.

4.3 Importar laudo (imagem/foto)
	1.	Fluxo parecido:
	•	Botão “Escanear laudo (foto/print)”.
	•	Usa câmera ou galeria.
	2.	Pipeline:
	•	iOS: Vision OCR → texto.
	•	Android: ML Kit OCR → texto.
	3.	Continua igual ao fluxo de PDF.

4.4 Chamada Gemini 2.5 Flash
	1.	App prepara rawText + prompt + JSON Schema.
	2.	Faz HTTPS POST para Gemini API (endpoint oficial) usando API key do usuário.  ￼
	3.	Recebe JSON, valida localmente:
	•	Schema.
	•	Tipos.
	•	Campos obrigatórios.
	4.	Se válido:
	•	Salva laudo + marcadores criptografados.
	•	Navega para tela de Detalhe do laudo.
	5.	Se inválido:
	•	Faz 1 retry com prompt de correção.
	•	Ainda inválido → mostra erro “Não consegui interpretar este laudo automaticamente. Você ainda pode salvar o texto cru.” (opcional para v0).

4.5 Visualização / dashboard
	•	Home:
	•	Lista de laudos (data, número de marcadores, quantos fora da faixa).
	•	Card do último laudo com:
	•	Resumo em PT‑BR.
	•	2–3 marcadores chave em destaque.
	•	Detalhe:
	•	Cabeçalho com “Sabin”, data, nome paciente.
	•	Card resumo.
	•	Lista de marcadores com flags.

4.6 Gerenciamento
	•	Configurações:
	•	Campo para API key Gemini (mostrar apenas ****, com botão de colar/refazer).
	•	Botão de teste “Testar conexão com Gemini”.
	•	Botão “Exportar dados” (JSON).
	•	Botão “Apagar todos os dados deste aparelho”.

⸻

5. Extração de texto (iOS + Android)

5.1 iOS

Stack provável:
	•	PDF:
	•	Primeiro, usar API de PDF para extrair texto diretamente, quando houver camada textual.
	•	Caso contrário, para cada página:
	•	Renderizar como imagem.
	•	Passar por Vision Text Recognition (VNRecognizeTextRequest).  ￼
	•	Imagem/foto:
	•	Vision Text Recognition.
	•	Possível uso de detecção de documentos para recortar bordas antes (como no WWDC doc processing).  ￼
	•	Foundation Models:
	•	Você pode opcionalmente usar Foundation Models on-device para:
	•	Limpar/normalizar texto (correção de OCR, remover ruído).
	•	Fazer pré‑summaries locais (por exemplo, “resumo rápido do laudo” mesmo offline).  ￼
	•	Integração via módulo nativo Swift → RN bridge.

5.2 Android

Stack provável:
	•	PDF:
	•	Uso de lib nativa para PDF (por exemplo, baseada em Pdfium ou similar) via módulo native module RN.
	•	Se página tiver texto → extrair diretamente.
	•	Se não, renderizar página em bitmap e passar por ML Kit Text Recognition v2.  ￼
	•	Imagem/foto:
	•	ML Kit Text Recognition:
	•	On-device, sem necessidade de backend.  ￼

5.3 Normalização cruzada

Após OCR em qualquer plataforma:
	•	Remover múltiplos espaços.
	•	Preservar estrutura importante:
	•	Nome dos exames nas linhas de cabeçalho.
	•	Blocos “RESULTADO”, “Valor de referência”, “Unidade”, “Coleta”, “Liberação”.

⸻

6. Design de prompt para Gemini 2.5 Flash + JSON Schema

6.1 Esquema alvo (conceitual)

Mesma ideia de antes, mas agora a validação acontece no próprio app:
	•	SabinAnalysisSummary
	•	LabResult
	•	SabinAnalysisResponse

type Flag =
  | 'low'
  | 'normal'
  | 'high'
  | 'reactive'
  | 'non_reactive'
  | 'indeterminate'
  | 'unknown';

interface LabResult {
  id: string;               // identificador interno: "LDL", "HBA1C", etc.
  examName: string;         // nome no laudo
  markerType?: string;      // enum amigável ("LDL","HDL","GLICOSE_JEJUM"…)
  resultValue?: number;     
  resultText?: string;      
  unit?: string;
  referenceRange?: string;
  flag: Flag;
  collectedAt?: string;     
  releasedAt?: string;      
  confidence: number;       // 0..1
}

interface SabinAnalysisSummary {
  mainFindings: string;
  abnormalCount: number;
  normalCount: number;
  examDate?: string;
  patientName?: string;
}

interface SabinAnalysisResponse {
  summary: SabinAnalysisSummary;
  results: LabResult[];
}

Você converte isso em JSON Schema para usar com o suporte de JSON Schema da Gemini API.  ￼

6.2 Prompt (conceito)

System role (em inglês aumenta chance de seguir instrução, mas o conteúdo será PT‑BR):
	•	Você é um modelo especializado em laudos laboratoriais brasileiros do laboratório Sabin.
	•	Receberá apenas o texto do laudo (sem layout visual).
	•	Sua tarefa:
	•	Identificar todos os exames com seus resultados, unidades e faixas de referência.
	•	Classificar cada exame em uma das flags (low, normal, high, reactive, non_reactive, indeterminate, unknown).
	•	Gerar um resumo em português simples, voltado ao público leigo.
	•	Regras:
	•	Não invente exames, valores ou datas.
	•	Se não tiver certeza de um valor numérico, deixe resultValue vazio e use resultText com o texto literal.
	•	A flag deve:
	•	Usar reactive/non_reactive quando houver “REAGENTE / NÃO REAGENTE”.
	•	Usar low/high/normal com base em faixas numéricas do próprio laudo.
	•	Usar unknown se não for possível decidir.
	•	confidence deve refletir sua certeza:
	•	1.0 para leituras claras.
	•	<0.85 quando houver ambiguidade (print truncado, OCR suspeito, etc).
	•	O resumo (mainFindings) deve:
	•	Destacar marcadores fora da faixa.
	•	Comentar brevemente os principais grupos de exames (lipídios, glicemia etc).
	•	Terminar com algo como: “Essas informações não substituem uma avaliação médica. Converse com seu médico.”

User role:
	•	Fornece texto cru do laudo (após OCR/extração) com instrução:
	•	“Aplique o schema JSON especificado e responda apenas com JSON válido.”

JSON Schema:
	•	Como documentado na Gemini API, você envia o schema na chamada para garantir que o modelo retorne um objeto compatível.  ￼

6.3 Validação no app

No app, você:
	1.	Usa zod ou similar para validar o JSON retornado.
	2.	Checa:
	•	results.length > 0.
	•	examName não vazio.
	•	flag ∈ conjunto permitido.
	•	confidence entre 0 e 1.
	3.	Se falhar:
	•	Gera uma segunda chamada à Gemini com o JSON problemático e mensagem:
	•	“Este JSON não segue o schema. Corrija os campos conforme o schema a seguir, sem adicionar texto fora do JSON.”
	•	Valida de novo.
	4.	Se continuar inválido:
	•	Marca erro de parsing.
	•	UX: oferece apenas salvar texto ou descartar.

⸻

7. Criptografia e storage no Expo

7.1 Princípios
	•	Nenhum dado de saúde em claro no armazenamento persistente.
	•	Chave mestra 256 bits por instalação, guardada em Keychain/Keystore.
	•	Todos os payloads clínicos são JSON → bytes → AES-GCM → EncryptedBlob → guardado no SQLite.

7.2 Chave mestra
	1.	Ao abrir o app pela primeira vez:
	•	Tenta ler MASTER_KEY do SecureStore.
	•	Se não existir:
	•	Gera 32 bytes pseudoaleatórios (via módulo de random de qualidade criptográfica).
	•	Salva codificado (base64) em SecureStore.
	2.	Mantém MASTER_KEY em memória enquanto o app está aberto.
	3.	Ao “Apagar todos os dados”:
	•	Apaga registros das tabelas.
	•	Remove MASTER_KEY do SecureStore.
	•	Opcionalmente, limpa caches temporários.

7.3 Estrutura do EncryptedBlob

Conceito:

interface EncryptedBlob {
  version: 1;
  nonce: string;       // base64
  ciphertext: string;  // base64 (dados + tag)
}

	•	nonce: 12 bytes aleatórios (96 bits) para AES‑GCM.
	•	ciphertext: bytes do JSON criptografado + tag de autenticação.

7.4 API interna da camada Crypto

Módulo: core/cryptoStore.ts (conceito):
	•	getOrCreateMasterKey(): Promise<Uint8Array>
	•	encryptJson<T>(payload: T): Promise<EncryptedBlob>
	•	decryptJson<T>(blob: EncryptedBlob): Promise<T>
	•	wipeMasterKeyFromMemory(): void

Todos os módulos de domínio (laudos, marcadores, configs) consomem apenas encryptJson/decryptJson, nunca mexem em cipher diretamente.

7.5 Integração com SQLite

Tabelas mínimas:

reports:
	•	id TEXT PK
	•	created_at INTEGER/TEXT
	•	exam_date TEXT
	•	lab_source TEXT (ex.: “SABIN”)
	•	encrypted_payload TEXT (JSON de EncryptedBlob)

markers_index (não obrigatório no v0, mas útil depois):
	•	id TEXT PK
	•	report_id TEXT FK
	•	marker_type TEXT (LDL, HDL, HBA1C…)
	•	flag TEXT
	•	exam_date TEXT

Somente encrypted_payload é considerado PHI; índice é opcional e pode ser visto como metadado menos sensível.

⸻

8. Integração com Gemini 2.5 Flash no app (sem backend)

8.1 Trade-offs críticos
	•	Sem backend implica:
	•	Seu app não pode usar uma key compartilhada e “secreta”.
	•	A fatia honesta é: o usuário entra com a própria API key.
	•	Experiência:
	•	Mais fricção, sim.
	•	Mas como MVP para power users / devs, aceitável.
	•	Se você quiser mainstream depois, você cria um BFF e migra.

8.2 Configuração da chave pelo usuário
	•	Configurações:
	•	Campo texto para API key.
	•	Botão “Validar chave”:
	•	Faz uma chamada mínima à Gemini (ex.: “ping”) com schema simples.
	•	Se OK: mostra check verde, data da última validação.
	•	Se falhar: mostra mensagem clara (chave inválida, falta de permissão, etc).
	•	Armazenamento:
	•	API key também é PHI sensível? Não, mas é segredo de cobrança / conta do usuário.
	•	Deve ser criptografada junto com o resto (chave mestra + AES-GCM).

8.3 Cliente Gemini
	•	Módulo core/geminiClient.ts:
	•	Recebe:
	•	API key desencriptada.
	•	rawText do laudo.
	•	Monta:
	•	URL correta (https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent ou equivalente).  ￼
	•	Headers com API key.
	•	Body com prompt + esquema JSON.
	•	Configurações de performance:
	•	temperature baixa (0.1–0.2) para minimizar variação.
	•	Sem streaming inicialmente (mais simples para validar JSON).
	•	Limitar texto de input se necessário, mas laudos Sabin não vão chegar perto de 1M tokens.

⸻

9. Requisitos não‑funcionais específicos
	•	Privacidade:
	•	App nunca envia imagens ou PDFs para a nuvem; só texto do laudo.
	•	Texto do laudo é enviado apenas para a Gemini, com chave do usuário.
	•	Nenhuma telemetria contendo valores clínicos.
	•	Segurança:
	•	HTTPS obrigatório.
	•	MASTER_KEY guardada em Keychain/Keystore.
	•	PHI somente em blobs AES-GCM.
	•	Não logar dados clínicos em logs locais (nem em console dev em builds release).
	•	Performance:
	•	OCR de laudo de 1–3 páginas:
	•	< 5 s em aparelhos medianos.
	•	Chamadas Gemini:
	•	95% abaixo de ~15 s de round‑trip.
	•	Confiabilidade:
	•	Erros de OCR:
	•	UI clara com opção de tentar novamente (foto melhor, outro arquivo).
	•	Erros de Gemini:
	•	Mensagem específica: chave inválida, limite de cota, timeout, etc.
	•	Experiência offline:
	•	OCR e visualização funcionam offline.
	•	Parsing Gemini e resumo exigem conexão; app deve indicar isso explicitamente.

⸻

10. Roadmap técnico

Fase 0 – Parser Gemini isolado (sem app)
	•	Script Node/TS:
	•	Lê texto de laudos Sabin (já extraídos manualmente).
	•	Chama Gemini 2.5 Flash com prompt + JSON Schema.
	•	Salva JSON em arquivos e mede acurácia vs gabarito.

Meta: prova que o prompt + schema funcionam com >85% de acerto em laudos reais.

Fase 1 – Extração de texto nativa
	•	iOS:
	•	Módulo nativo Swift com:
	•	extractTextFromPdf(path: string): string.
	•	extractTextFromImage(path: string): string.
	•	Usa PDF + Vision.
	•	Android:
	•	Módulo nativo Kotlin/Java com:
	•	Mesmas assinaturas.
	•	Usa PDF lib + ML Kit.
	•	Expo:
	•	Dev client com esses módulos ligados.

Fase 2 – Skeleton Expo + Crypto
	•	App RN/Expo:
	•	Home com botão “Importar”.
	•	Chamadas para módulos nativos de extração.
	•	Implementar cryptoStore com geração de chave + encryptJson/decryptJson.
	•	Salvar laudos fictícios criptografados, ler e exibir.

Fase 3 – Integração Gemini
	•	Tela de Configurações:
	•	Campo API key.
	•	Teste de conexão.
	•	Fluxo de importação:
	•	Após extrair texto, chamar Gemini e mostrar JSON bruto (modo dev).
	•	Validar JSON com Zod.
	•	Salvar laudo real e exibir em UI mínima.

Fase 4 – UI/UX polida (Torch‑inspired)
	•	Refinar:
	•	Home / Dashboard com cards calmos, hierarquia visual forte.
	•	Tela de detalhe com resumo e lista de marcadores.
	•	Estados de loading e erro apresentados de forma clara e discreta.

Fase 5 – Beta com usuários reais (Sabin‑only)
	•	Coletar:
	•	Laudos onde OCR falha vs laudos onde parsing falha.
	•	Feedback sobre resumo e clareza da UI.
	•	Ajustar:
	•	Prompt.
	•	Heurísticas de normalização.
	•	Mensagens de erro.

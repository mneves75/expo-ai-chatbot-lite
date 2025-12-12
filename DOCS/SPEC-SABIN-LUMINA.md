> Implementation note (this repository): this codebase is **offline-only** (“no API / no cloud / no server”).  
> Sections below that reference Gemini/LLM parsing are kept as product context, but the shipped Expo app uses deterministic on-device parsing + encrypted local storage.

1. Backlog MVP – Histórias e critérios de aceite

Épico E1 – Chave mestra e criptografia local

US1 – Gerar e armazenar chave mestra de criptografia
Como app
Quero gerar uma chave mestra única por instalação
Para cifrar todos os dados clínicos localmente

Critérios de aceite
	•	Given que o app é aberto pela primeira vez
When nenhuma chave mestra é encontrada no SecureStore
Then o app gera uma chave aleatória de 256 bits
And grava essa chave no SecureStore
And mantém a chave apenas em memória durante a sessão
	•	Given que o app é reaberto em execuções futuras
When a chave existe no SecureStore
Then a chave é lida e carregada em memória sem gerar uma nova
	•	Given que o usuário escolhe “Apagar todos os dados deste aparelho”
When confirma a ação destrutiva
Then todas as tabelas de dados são limpas
And a chave mestra é removida do SecureStore
And blobs remanescentes, se houver, se tornam irrecuperáveis

⸻

US2 – Cifrar e decifrar payloads JSON
Como dev
Quero uma API encryptJson/decryptJson
Para evitar que qualquer módulo mexa direto com detalhes criptográficos

Critérios de aceite
	•	Given um objeto JSON arbitrário (ex.: um laudo com marcadores)
When encryptJson(payload) é chamado
Then a função retorna um objeto EncryptedBlob contendo:
	•	version
	•	nonce base64
	•	ciphertext base64 (dados + tag de autenticação)
	•	Given um EncryptedBlob válido
When decryptJson<Report>(blob) é chamado com a chave correta
Then a função retorna exatamente o mesmo JSON original
And qualquer modificação em um byte do ciphertext ou nonce dispara erro de autenticação
	•	Given um EncryptedBlob com version desconhecida
When decryptJson é chamado
Then é retornado erro de versão não suportada

⸻

US3 – Persistir laudos cifrados no SQLite
Como app
Quero armazenar laudos e marcadores exclusivamente como blobs cifrados
Para não deixar PHI em claro no disco

Critérios de aceite
	•	Given que o app salva um novo laudo
When a operação de persistência é concluída
Then a tabela reports contém:
	•	id
	•	metadados em claro mínimos (ex.: lab_source, exam_date)
	•	encrypted_payload com JSON de EncryptedBlob
	•	Given que um laudo é recuperado para exibição
When decryptJson é chamado sobre o encrypted_payload
Then o laudo reconstruído contém:
	•	resumo
	•	lista de marcadores
exatamente como retornado pelo LLM
	•	Given que a base de dados é inspecionada externamente (por exemplo via adb/sqlite3)
Then nenhum valor numérico de exame ou nome de paciente aparece em texto claro

⸻

Épico E2 – Extração de texto no dispositivo

US4 – Extrair texto de PDF em iOS
Como usuário iOS
Quero importar um PDF Sabin e ter o texto extraído no aparelho
Para não precisar mandar a imagem inteira para a nuvem

Critérios de aceite
	•	Given um PDF Sabin com camada de texto
When o usuário seleciona o arquivo no fluxo de importação
Then o módulo nativo retorna texto completo contendo:
	•	nomes dos exames
	•	seções “RESULTADO”, “Valor de referência”, “Coleta”, “Liberação” (quando presentes)
	•	Given um PDF Sabin que é apenas imagem (scan)
When o usuário seleciona o arquivo
Then o módulo nativo:
	•	detecta ausência de camada de texto
	•	renderiza cada página em imagem
	•	executa OCR via Vision
	•	retorna texto com pelo menos 85% das linhas relevantes legíveis (medido em testes internos com gabarito)
	•	Given um PDF corrompido ou com formato não suportado
When a extração é tentada
Then o módulo retorna erro categorizado (ex.: UNSUPPORTED_PDF_FORMAT)
And o app mostra mensagem clara ao usuário

⸻

US5 – Extrair texto de PDF em Android
Como usuário Android
Quero importar um PDF Sabin e extrair o texto no próprio dispositivo
Para manter o mesmo modelo de privacidade do iOS

Critérios de aceite
	•	Given um PDF Sabin com texto
When o arquivo é importado
Then o módulo Android retorna texto com seções equivalentes às do iOS
	•	Given um PDF apenas com imagens
When a extração é executada
Then o módulo:
	•	renderiza páginas em bitmaps
	•	usa ML Kit Text Recognition on-device
	•	retorna texto comparável ao iOS em qualidade para os mesmos laudos
	•	Given erros de memória ou timeouts em PDFs grandes
When isso ocorre
Then o módulo retorna erro específico (ex.: OCR_TIMEOUT)
And o app oferece ao usuário tentar outro arquivo ou recortar o PDF

⸻

US6 – Extrair texto de imagem/foto (iOS/Android)
Como usuário
Quero tirar foto/usar screenshot de laudo Sabin e extrair o texto localmente
Para não depender só de PDF

Critérios de aceite
	•	Given uma foto nítida de laudo Sabin
When o usuário usa o fluxo “Escanear laudo (foto/print)”
Then o texto extraído contém os blocos de exames de forma legível para o LLM
	•	Given uma foto de baixa qualidade (embaçada, corte parcial)
When o OCR falha em extrair texto suficiente
Then o módulo retorna erro de baixa confiança
And o app pede ao usuário para tirar nova foto em melhores condições

⸻

Épico E3 – Integração com Gemini 2.5 Flash

US7 – Configurar e validar API key da Gemini
Como usuário avançado
Quero informar minha própria API key da Gemini no app
Para permitir que o app analise laudos usando esse serviço de IA

Critérios de aceite
	•	Given o usuário abre Configurações
When insere uma API key e toca “Testar conexão”
Then o app faz uma chamada mínima à API da Gemini
And se a key for válida:
	•	mostra status “Chave válida” com data/hora
	•	persiste a chave cifrada localmente
	•	Given o usuário insere uma chave inválida
When toca “Testar conexão”
Then o app mostra mensagem de erro clara (“Chave inválida ou sem permissão”)
And não marca a chave como válida
	•	Given o usuário remove/limpa a chave
When salva as configurações
Then futuras tentativas de análise de laudos disparam aviso pedindo nova chave

⸻

US8 – Enviar texto de laudo para Gemini e receber JSON estruturado
Como app
Quero enviar o texto de um laudo Sabin para Gemini 2.5 Flash
Para receber marcadores estruturados e um resumo em JSON

Critérios de aceite
	•	Given texto extraído de laudo Sabin e API key válida
When o app chama a Gemini com prompt + JSON Schema
Then a resposta bruta é um JSON compatível com SabinAnalysisResponse na maioria dos casos de teste (>85% dos laudos de validação)
	•	Given o JSON retornado viola o schema (campos ausentes ou tipos errados)
When zod/validação é executada
Then o app identifica a violação
And dispara no máximo 1 retry com prompt de correção
	•	Given o JSON continua inválido após retry
When a operação termina
Then o app mostra mensagem de erro amigável (“Não consegui interpretar este laudo automaticamente”)
And não salva laudo parcial sem o usuário decidir explicitamente

⸻

US9 – Aplicar validação de confiança
Como app
Quero calcular confiança por marcador e por laudo
Para avisar o usuário quando a interpretação estiver potencialmente incorreta

Critérios de aceite
	•	Given um SabinAnalysisResponse com confidence por marcador
When qualquer marcador tiver confidence < 0.85
Then o laudo é marcado como “precisa de revisão”
And a tela de detalhe mostra aviso (“Recomenda-se conferir com o PDF original”)
	•	Given todos os marcadores têm confidence >= 0.85
When o laudo é exibido
Then nenhum aviso extra aparece
And os valores são tratados como interpretação “confiável”, ainda com disclaimers clínicos

⸻

Épico E4 – UI/UX essencial (Torch‑like, mas enxuto)

US10 – Tela Home com último laudo e CTA de importação
Como usuário
Quero abrir o app e ver rapidamente meu último laudo e um botão de importar
Para não me perder em menus

Critérios de aceite
	•	Given não existe nenhum laudo salvo
When o app abre a Home
Then é exibida:
	•	mensagem de estado vazio (“Nenhum exame importado ainda”)
	•	botão destacado “Importar laudo Sabin”
	•	Given já existem laudos salvos
When a Home é aberta
Then é exibido:
	•	card do último laudo (data, n° de marcadores, n° fora da faixa)
	•	lista simples de laudos anteriores ordenados por data
	•	CTA “Importar novo laudo Sabin”

⸻

US11 – Tela de detalhe do laudo com resumo e lista de marcadores
Como usuário
Quero ver cada laudo Sabin com um resumo claro e lista de marcadores com flags
Para entender rapidamente o que está normal ou alterado

Critérios de aceite
	•	Given um laudo salvo e descriptografado
When o usuário abre o detalhe
Then a tela exibe:
	•	cabeçalho com “Sabin”, data do exame, nome do paciente (se disponível)
	•	card de resumo textual vindo de summary.mainFindings
	•	lista de marcadores com:
	•	nome do exame
	•	valor + unidade (ou resultText)
	•	faixa de referência textual
	•	flag visual (normal/alto/baixo/reagente) usando ícone + cor
	•	Given o laudo tem abnormalCount > 0
When o detalhe é exibido
Then marcadores fora da faixa aparecem no topo ou com destaque visual adicional
	•	Given a flag for marcadores é unknown
When exibida
Then a UI mostra explicitamente “Faixa não determinada” ou similar, sem forçar interpretação

⸻

US12 – Apagar todos os dados e exportar laudos
Como usuário
Quero apagar tudo ou exportar meus dados
Para manter controle total sobre minhas informações

Critérios de aceite
	•	Given o usuário acessa “Configurações”
When toca “Exportar dados”
Then o app gera arquivo JSON com:
	•	lista de laudos (com marcadores e resumos)
	•	sem chave de criptografia
And abre o share sheet do sistema para o usuário escolher destino
	•	Given o usuário toca “Apagar todos os dados deste aparelho”
When confirma numa segunda tela com aviso claro
Then:
	•	banco local é limpo
	•	chave mestra é apagada
	•	tela Home volta ao estado vazio

⸻

Épico E5 – Qualidade e testes

US13 – Suite de testes de parser + OCR com gabarito
Como equipe de produto/engenharia
Quero uma suíte automatizada que testa OCR + Gemini em laudos Sabin redigidos
Para garantir acurácia mínima antes de liberar

Critérios de aceite
	•	Given um conjunto de N laudos Sabin com gabarito manual
When rodamos o script de teste
Then o relatório inclui:
	•	taxa de acerto por marcador
	•	taxa de acerto por laudo
	•	lista de casos onde OCR falhou vs onde LLM falhou
	•	Given a taxa de acerto global estiver <85%
When avaliação acontece
Then o MVP não é considerado pronto
And backlog de correções é alimentado com casos concretos

⸻

2. Design do módulo nativo de extração de texto

Agora o detalhe que você pediu: como desenhar isso para iOS/Android e expor em TS.

2.1 Interface pública em TypeScript (única para as duas plataformas)

Defina uma interface “plataforma neutra” que o resto do app enxergue:

export type ExtractedPage = {
  pageIndex: number;     // 0-based
  text: string;
  confidence: number;    // 0..1 (heurístico da camada nativa)
};

export type ExtractedText = {
  sourceType: 'pdf' | 'image';
  pageCount: number;
  pages: ExtractedPage[];
  rawText: string;       // concatenação de pages com separadores
};

export type ExtractionErrorCode =
  | 'UNSUPPORTED_PDF_FORMAT'
  | 'OCR_TIMEOUT'
  | 'OCR_FAILED'
  | 'FILE_NOT_FOUND'
  | 'UNKNOWN';

export class ExtractionError extends Error {
  code: ExtractionErrorCode;
}

export interface TextExtractorModule {
  extractTextFromPdf(uri: string): Promise<ExtractedText>;
  extractTextFromImage(uri: string): Promise<ExtractedText>;
}

Na prática:
	•	uri é o caminho/URI retornado pelo DocumentPicker ou pela câmera.
	•	rawText é o que vai para o LLM depois.

Camada de JS/TS:
	•	Implementa TextExtractorModule chamando NativeModules.SabinTextExtractor (nome que você quiser).
	•	Normaliza erros nativos em ExtractionError.

2.2 Requisitos funcionais do módulo nativo

Para ambas as plataformas:
	•	Suportar:
	•	PDFs com camada de texto.
	•	PDFs somente imagem (com fallback OCR).
	•	Imagens (JPG/PNG) de laudos.
	•	Sempre retornar:
	•	pageCount consistente.
	•	pages com índice correto.
	•	confidence por página (1.0 para texto puro; heurística para OCR, por ex. com base no número de caracteres reconhecidos e densidade).
	•	Mapear erros em códigos claros:
	•	FILE_NOT_FOUND: URI inválida ou arquivo inacessível.
	•	UNSUPPORTED_PDF_FORMAT: PDF corrompido ou versão impossível de parsear.
	•	OCR_TIMEOUT: prazo estourado em laudo pesado.
	•	OCR_FAILED: OCR retornou vazio ou lixo.
	•	UNKNOWN: qualquer outra exceção.

2.3 iOS – design do bridge nativo

Nome de módulo sugerido: SabinTextExtractor

Métodos expostos (Objective‑C header / Swift @objc):
	•	func extractTextFromPdf(_ uri: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock)
	•	func extractTextFromImage(_ uri: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock)

PDF flow (iOS)
	1.	Recebe uri (pode ser file://).
	2.	Abre o PDF com API nativa.
	3.	Para cada página:
	•	Tenta page.string ou equivalente para obter texto se houver camada textual.
	•	Se texto vazio:
	•	Renderiza página em UIImage.
	•	Chama Vision Text Recognition:
	•	Configura VNRecognizeTextRequest com modo “accurate”.
	•	Junta resultados numa string, preservando quebras por linha / bloco.
	4.	Monta ExtractedPage:
	•	pageIndex: índice da página.
	•	text: string.
	•	confidence:
	•	1.0 se veio de texto nativo.
	•	Heurística p/ OCR (por ex.: min(1.0, caracteresReconhecidos / 500.0)).
	5.	Retorna:

{
  "sourceType": "pdf",
  "pageCount": N,
  "pages": [...],
  "rawText": "texto_page0\n\n---PAGE_BREAK---\n\ntexto_page1..."
}

Imagem flow (iOS)
	1.	Carrega UIImage a partir do uri.
	2.	Opcional: aplicar detecção de documento (para recorte).
	3.	Rodar Vision Text Recognition.
	4.	pageCount = 1.
	5.	Montar ExtractedPage com pageIndex = 0.

2.4 Android – design do bridge nativo

Nome de módulo sugerido: SabinTextExtractor

Métodos expostos (Kotlin/Java):
	•	fun extractTextFromPdf(uri: String, promise: Promise)
	•	fun extractTextFromImage(uri: String, promise: Promise)

PDF flow (Android)
	1.	Recebe uri (provavelmente content://).
	2.	Usa ContentResolver para abrir input stream.
	3.	Usa lib PDF nativa (PdfRenderer ou similar) para:
	•	Verificar se há texto extraível (se libraria suportar).
	•	Caso não:
	•	Renderizar cada página em Bitmap.
	•	Mandar para ML Kit Text Recognition.
	4.	Para cada página:
	•	Resultado do ML Kit → concatenar textos em ordem de leitura.
	•	Calcular confidence heurístico (ML Kit não entrega uma probabilidade full, então você cria heurística baseada em densidade/caracteres).
	5.	Retorno no mesmo formato que no iOS.

Imagem flow (Android)
	1.	Abrir Bitmap a partir do uri.
	2.	Passar pelo ML Kit Text Recognition (on-device).
	3.	Construir ExtractedText com 1 página.

2.5 Tratamento de erros e tempo máximo
	•	Cada método (extractTextFromPdf/Image) deve:
	•	Ter um timeout interno razoável (ex.: 15–20 s por laudo).
	•	Em caso de estouro de tempo, cancelar OCR e retornar OCR_TIMEOUT.
	•	Exceções devem ser capturadas e convertidas em:
	•	ExtractionErrorCode + message + nativeStack (apenas para debug, não logado em produção).

2.6 Wrapper TS para unificar comportamento

Módulo modules/extraction/textExtractor.ts:
	•	Importa NativeModules.SabinTextExtractor.
	•	Implementa TextExtractorModule:

const native = NativeModules.SabinTextExtractor as RawNativeModule;

export const textExtractor: TextExtractorModule = {
  async extractTextFromPdf(uri) {
    try {
      const result = await native.extractTextFromPdf(uri);
      return normalizarResult(result);
    } catch (e) {
      throw mapNativeError(e);
    }
  },
  async extractTextFromImage(uri) {
    try {
      const result = await native.extractTextFromImage(uri);
      return normalizarResult(result);
    } catch (e) {
      throw mapNativeError(e);
    }
  }
};

	•	mapNativeError(e) converte erros para ExtractionError com code no enum definido.

2.7 Estratégia de teste para o módulo de extração
	•	Conjunto de laudos Sabin em PDF:
	•	5–10 com texto.
	•	5–10 escaneados (imagem).
	•	Conjunto de imagens/fotos:
	•	5 fotos bem tiradas.
	•	3 fotos ruins para testar erros.

Testes manuais + scripts:
	•	Rodar extração em iOS e Android e salvar o rawText.
	•	Comparar com gabarito por similaridade:
	•	“Palavras-chave obrigatórias” presentes (nomes de exames, cabeçalhos).
	•	Ajustar pipeline até atingir:
	•	~>90% de retenção de linhas relevantes nos casos “normais”.

import type { TimelineCategory } from "./types";

export type Locale = "ja" | "en";

const JA_COPY = {
  productExpansion: "Health Record Timeliner",
  pageTitle: "HeaRT — Health Record Timeliner",
  metaDescription: "HeaRT — 医療情報時系列可視化システム",
  displayLanguage: "表示言語",
  exportJson: "時系列診療データ(JSON)を書き出す",
  connectionChecking: "AIサービスを確認中",
  connectionKeyRequired: "プロバイダーキーが必要です",
  connectionReadyKey: "入力したキーで分析できます",
  connectionUnavailable: "AI解析が無効です",
  connectionOffline: "AI解析がオフラインです",
  currentDocument: "現在の文書",
  hideInput: "入力欄を閉じる",
  editInput: "入力を編集",
  newDocument: "新しい文書",
  earlier: "過去",
  later: "未来",
  noTimeline: "タイムライン未作成",
  emptyHeadline: "診療記録などの医療文書から患者の経過を抽出し、時系列に可視化します。",
  emptyBody: "時間は根拠に応じて表現します。確定できる場合は正確に、境界や位置を確定できない場合は未確定のまま示します。",
  timelineLoadingEyebrow: "解析中の時系列",
  timelineLoadingTitle: "根拠をタイムラインに配置しています",
  timelineLoadingBody: "完了したPRISMフェーズに応じて骨格を更新します。確定前の出来事や時点を推測して表示することはありません。",
  timelineLanes: "タイムラインの区分",
  findingsLegend: "病変・症状",
  therapiesLegend: "治療",
  unresolvedLegend: "未確定",
  model: "モデル",
  prismPhases: "PRISM解析フェーズ",
  persistence: "保存",
  none: "なし",
  tokens: "トークン",
  notReported: "未報告",
  inferenceAudit: "推論監査",
  warnings: "警告",
  noWarnings: "パーサーまたは時間推論の警告はありません。",
  warningDetails: "警告の詳細を表示",
  modelOutputContract: "モデル出力がPRISM仕様に適合しませんでした",
  modelOutputDetails: "停止理由を表示",
  modelOutputSafety: "不一致の出力はタイムラインに使用せず、原文範囲も確定しません。",
  patentPrefix: "関連特許",
  patentLink: "特許第7737703号",
  sourceCodePrefix: "ソースコード",
  sourceCodeLink: "GitHubで公開",
  sourceDocument: "原文",
  heroTitle: "臨床テキストを入力してください",
  loadSynthetic: "作例で試す",
  clinicalText: "診療テキスト",
  textPlaceholder: "医療テキストを貼り付けてください",
  documentCreationDate: "テキスト作成日",
  dctHelp: "任意。解決できない相対日時も未確定のまま表示します。",
  openRouterModelAria: "OpenRouterモデル",
  modelIdentifier: "OpenRouterキーで利用できるモデル識別子（未検証モデルは結果品質が異なる場合があります）",
  noHistoryLead: "HeaRTは解析履歴を保存しません。",
  noHistoryBody: "HeaRTは入力テキスト、APIキー、モデル出力を永続保存しません。解析時には、Cloudflare Workerがこれらを処理し、OpenRouterへリクエストを送信します。このWorkerには永続ストレージを接続しておらず、保存型のWorkers Logsとトレースも無効です。ただし、Cloudflareは同社の方針に基づき、リクエスト内容と通信メタデータを処理します。OpenRouterとモデル提供者のデータポリシーも適用されます。個人を特定できる情報や機密性のある診療情報は入力しないでください。",
  analysing: "PRISM仕様に基づく解析を実行中…",
  addOpenRouterKey: "OpenRouterキーを追加",
  buildTimeline: "タイムラインを作成",
  analysisUnavailable: "解析サービスを利用できません",
  clearPageMemory: "リセット",
  prismProgress: "PRISM解析の進捗",
  prismProcessing: "PRISM解析",
  extractingEntities: "医療エンティティを抽出中",
  linkingMedicalRelations: "医療関係を抽出中",
  resolvingTemporalRelations: "時間関係を抽出中",
  buildingTimeline: "時系列を構築中",
  phaseEntities: "医療エンティティ",
  phaseMedicalRelations: "医療関係",
  phaseTemporalRelations: "時間関係",
  completedPhases: "完了したPRISM解析フェーズ",
  providerKeySet: "プロバイダーキー設定済み",
  addProviderKey: "プロバイダーキーを追加",
  requestCredential: "リクエスト用認証情報",
  useOpenRouterKey: "OpenRouterキーを使用",
  memoryOnly: "メモリ内のみ",
  openRouterApiKey: "OpenRouter APIキー",
  hide: "隠す",
  show: "表示",
  providerKeyNote: "APIキーはこのタブのメモリ内だけで保持し、解析リクエスト時にCloudflare Worker経由でOpenRouterへ送信します。HeaRTはAPIキーを永続保存せず、アプリケーションログにも記録しません。CloudflareとOpenRouterの各データポリシーが適用されます。",
  manageKey: "OpenRouterでキーを作成・管理",
  clearKey: "キーを消去",
  closeWithoutKey: "キーなしで閉じる",
  useKey: "このキーを使用",
  sourceAlignment: "原文対応",
  annotatedText: "アノテーション済みテキスト",
  evidenceThread: "根拠のつながり",
  evidenceLabel: "根拠",
  selectEvent: "出来事または原文の範囲を選択してください。",
  evidenceDescription: "PRISM仕様に基づいた医療関係を表示します。",
  placement: "配置",
  sourceSpan: "原文範囲",
  supportingEntity: "補助エンティティ",
  notInSource: "原文外",
  directRelations: "直接関係",
  noDirectRelation: "直接関係は抽出されませんでした。",
  chronology: "根拠とつながる時系列",
  clinicalTimeline: "診療タイムライン",
  noTimeExpression: "時間表現を抽出できませんでした。",
  noTimeHelp: "診療上の根拠は未確定レーンに残します。",
  scrollableTimeline: "スクロール可能な診療タイムライン",
  notDiscarded: "破棄していません",
  unresolvedEvidence: "未確定の根拠",
  allPlaced: "表示中のすべての診療項目に時間的根拠があります。",
  unknown: "不明",
} as const;

type CopyKey = keyof typeof JA_COPY;

const EN_COPY: Record<CopyKey, string> = {
  productExpansion: "Health Record Timeliner",
  pageTitle: "HeaRT — Health Record Timeliner",
  metaDescription: "HeaRT — A system for visualising medical information over time",
  displayLanguage: "Display language",
  exportJson: "Export clinical timeline data (JSON)",
  connectionChecking: "Checking AI service",
  connectionKeyRequired: "Provider key required",
  connectionReadyKey: "Ready with your key",
  connectionUnavailable: "AI analysis disabled",
  connectionOffline: "AI analysis offline",
  currentDocument: "Current document",
  hideInput: "Hide input",
  editInput: "Edit input",
  newDocument: "New document",
  earlier: "Earlier",
  later: "Later",
  noTimeline: "No timeline loaded",
  emptyHeadline: "Extract a patient's clinical course from medical documents such as clinical records and visualise it chronologically.",
  emptyBody: "Time is represented as evidence: exact when supported, open or unresolved when the text does not justify a precise bound.",
  timelineLoadingEyebrow: "Chronology in progress",
  timelineLoadingTitle: "Placing evidence on the timeline",
  timelineLoadingBody: "The scaffold advances only with completed PRISM phases. It does not invent events or dates while the result is pending.",
  timelineLanes: "Timeline lanes",
  findingsLegend: "Findings",
  therapiesLegend: "Therapies",
  unresolvedLegend: "Unresolved",
  model: "Model",
  prismPhases: "PRISM analysis phases",
  persistence: "Persistence",
  none: "None",
  tokens: "Tokens",
  notReported: "not reported",
  inferenceAudit: "Inference audit",
  warnings: "Warnings",
  noWarnings: "No parser or temporal-inference warnings.",
  warningDetails: "Show warning details",
  modelOutputContract: "Model output did not meet the PRISM contract",
  modelOutputDetails: "Show why processing stopped",
  modelOutputSafety: "Non-conforming output is not used to build the timeline or assign source spans.",
  patentPrefix: "Related patent",
  patentLink: "Japanese Patent No. 7737703",
  sourceCodePrefix: "Source code",
  sourceCodeLink: "View on GitHub",
  sourceDocument: "Source document",
  heroTitle: "Enter clinical text",
  loadSynthetic: "Try an example",
  clinicalText: "Clinical text",
  textPlaceholder: "Paste medical text here",
  documentCreationDate: "Text creation date",
  dctHelp: "Optional; unresolved relative dates remain visible.",
  openRouterModelAria: "OpenRouter model",
  modelIdentifier: "Any model identifier available to your OpenRouter key; unvalidated models may produce different results",
  noHistoryLead: "HeaRT does not retain analysis history.",
  noHistoryBody: "HeaRT does not persist input text, API keys, or model output. During analysis, a Cloudflare Worker processes this data and sends the request to OpenRouter. This Worker has no persistent storage bindings, and stored Workers Logs and traces are disabled. Cloudflare still processes request content and traffic metadata under its policies; OpenRouter's and the model provider's data policies also apply. Do not enter identifiable or confidential clinical information.",
  analysing: "Running analysis according to the PRISM specification…",
  addOpenRouterKey: "Add OpenRouter key",
  buildTimeline: "Build timeline",
  analysisUnavailable: "Analysis service unavailable",
  clearPageMemory: "Reset",
  prismProgress: "PRISM analysis progress",
  prismProcessing: "PRISM analysis",
  extractingEntities: "Extracting clinical entities",
  linkingMedicalRelations: "Linking medical relations",
  resolvingTemporalRelations: "Resolving temporal relations",
  buildingTimeline: "Building timeline",
  phaseEntities: "Clinical entities",
  phaseMedicalRelations: "Medical relations",
  phaseTemporalRelations: "Temporal relations",
  completedPhases: "Completed PRISM analysis phases",
  providerKeySet: "Provider key set",
  addProviderKey: "Add provider key",
  requestCredential: "Request credential",
  useOpenRouterKey: "Use your OpenRouter key",
  memoryOnly: "Memory only",
  openRouterApiKey: "OpenRouter API key",
  hide: "Hide",
  show: "Show",
  providerKeyNote: "Your API key is held only in this tab's memory and sent to OpenRouter through the Cloudflare Worker with analysis requests. HeaRT does not persist the key or include it in application logs. Cloudflare's and OpenRouter's data policies apply.",
  manageKey: "Create or manage a key on OpenRouter",
  clearKey: "Clear key",
  closeWithoutKey: "Close without key",
  useKey: "Use this key",
  sourceAlignment: "Source alignment",
  annotatedText: "Annotated text",
  evidenceThread: "Evidence thread",
  evidenceLabel: "Evidence",
  selectEvent: "Select an event or source span.",
  evidenceDescription: "Shows medical relations derived according to the PRISM specification.",
  placement: "Placement",
  sourceSpan: "Source span",
  supportingEntity: "supporting entity",
  notInSource: "not in source",
  directRelations: "Direct relations",
  noDirectRelation: "No direct relation was extracted.",
  chronology: "Evidence-linked chronology",
  clinicalTimeline: "Clinical timeline",
  noTimeExpression: "No time expression was extracted.",
  noTimeHelp: "Clinical evidence remains available in the unresolved lane.",
  scrollableTimeline: "Scrollable clinical timeline",
  notDiscarded: "Not discarded",
  unresolvedEvidence: "Unresolved evidence",
  allPlaced: "All visible clinical items have temporal evidence.",
  unknown: "Unknown",
};

const COPY: Record<Locale, Record<CopyKey, string>> = { ja: JA_COPY, en: EN_COPY };

export function text(locale: Locale, key: CopyKey): string {
  return COPY[locale][key];
}

export function formatNumber(locale: Locale, value: number): string {
  return value.toLocaleString(locale === "ja" ? "ja-JP" : "en-GB");
}

export function characterCount(locale: Locale, count: number): string {
  return locale === "ja"
    ? `${formatNumber(locale, count)}文字・このページのメモリ内のみで保持`
    : `${formatNumber(locale, count)} characters · held in this page only`;
}

export function documentSummary(locale: Locale, characters: number, entities: number): string {
  return locale === "ja"
    ? `${formatNumber(locale, characters)}文字・${formatNumber(locale, entities)}エンティティ`
    : `${formatNumber(locale, characters)} characters · ${formatNumber(locale, entities)} entities`;
}

export function entityCount(locale: Locale, count: number): string {
  return locale === "ja" ? `${formatNumber(locale, count)}エンティティ` : `${formatNumber(locale, count)} entities`;
}

export function phaseCount(locale: Locale, completed: number): string {
  return locale === "ja" ? `${completed} / 3フェーズ` : `${completed} / 3 phases`;
}

export function timelineCount(locale: Locale, count: number, kind: "anchors" | "items"): string {
  if (locale === "ja") return `${formatNumber(locale, count)}${kind === "anchors" ? "時間アンカー" : "配置済み項目"}`;
  return `${formatNumber(locale, count)} ${kind === "anchors" ? "time anchors" : "placed items"}`;
}

const CATEGORY_LABELS: Record<Locale, Record<TimelineCategory, string>> = {
  ja: {
    finding: "病変・症状",
    test: "検査・問診",
    medicine: "薬品",
    treatment: "治療",
    context: "クリニカルコンテクスト",
    pending: "保留",
  },
  en: {
    finding: "Findings",
    test: "Tests",
    medicine: "Medicines",
    treatment: "Treatments",
    context: "Clinical context",
    pending: "Pending",
  },
};

export function categoryLabel(locale: Locale, category: TimelineCategory): string {
  return CATEGORY_LABELS[locale][category];
}

const PLACEMENT_LABELS: Record<Locale, Record<string, string>> = {
  ja: {
    point: "時点",
    interval: "期間",
    open: "片側未確定",
    ambiguous: "曖昧",
    conflict: "矛盾",
    unplaced: "未配置",
  },
  en: {},
};

export function placementLabel(locale: Locale, status: string): string {
  return PLACEMENT_LABELS[locale][status] ?? status;
}

const PRECISION_LABELS: Record<string, string> = {
  day: "日",
  month: "月",
  year: "年",
  time: "時刻",
  duration: "期間",
  set: "反復",
  age: "年齢",
  med: "医療時点",
  misc: "その他",
  unknown: "不明",
};

export function precisionLabel(locale: Locale, precision: string): string {
  return locale === "ja" ? (PRECISION_LABELS[precision] ?? precision) : precision;
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  certainty: "確実性",
  state: "実施状態",
  type: "種別",
  correction: "訂正",
};

const ATTRIBUTE_VALUES: Record<string, string> = {
  positive: "あり",
  suspicious: "疑い",
  negative: "なし",
  general: "一般",
  scheduled: "予定",
  executed: "実施済み",
  negated: "中止",
  other: "その他",
  DATE: "日付",
  TIME: "時刻",
  DURATION: "期間",
  SET: "反復",
  AGE: "年齢",
  MED: "医療時点",
  MISC: "その他",
};

export function attributeLabel(locale: Locale, name: string): string {
  return locale === "ja" ? (ATTRIBUTE_LABELS[name] ?? name) : name;
}

export function attributeValue(locale: Locale, value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => attributeValue(locale, item)).join(", ");
  const rendered = String(value);
  return locale === "ja" ? (ATTRIBUTE_VALUES[rendered] ?? rendered) : rendered;
}

const WARNING_MESSAGES_JA: Record<string, string> = {
  "source-text-mismatch": "モデルが原文を変更したため、エンティティ範囲を安全に対応づけられません。",
  "source-whitespace-mismatch": "モデルがアノテーション時に原文の空白を変更しました。",
  "unknown-entity-type": "モデルが未対応のエンティティ種別を返しました。",
  "unparseable-relation": "モデルが生成した関係を解析できませんでした。",
  "unknown-relation-endpoint": "モデルが生成した関係が未知のエンティティを参照しています。",
  "invalid-temporal-target": "時間関係の参照先が時間表現ではありません。",
  "wrong-phase-relation": "関係が誤った抽出フェーズで返されました。",
  "annotation-warning": "PRISMパーサーがアノテーション警告を返しました。",
  "corrected-entity-attribute": "無効なエンティティ属性をPRISMの代替値に置き換えました。",
  "possible-embedded-medication-value": "薬品エンティティに、別の値として抽出されていない用量が含まれる可能性があります。",
  "missing-required-attribute": "抽出したエンティティに必須のPRISM属性がありません。",
  "temporal-cycle": "時間制約に循環があります。該当する時間アンカーには代替順序を使用します。",
  "anchor-value-conflict": "同一と推定した時間表現が異なる値に正規化されました。",
  "multiple-point-anchors": "エンティティに複数の時点候補があります。",
  "multiple-interval-bounds": "エンティティに複数の期間境界候補があります。",
  "reversed-interval": "期間の開始が終了より後になっています。",
  "dangling-relation": "関係の端点がエンティティグラフに存在しません。",
  "unplaced-evidence": "抽出した診療上の根拠の一部に、裏づけられた時間的位置がありません。",
};

export function warningMessage(locale: Locale, code: string, original: string): string {
  if (locale === "en") return original;
  return WARNING_MESSAGES_JA[code] ?? `警告の詳細はコード「${code}」を参照してください。`;
}

const ERROR_MESSAGES_JA: Record<string, string> = {
  "network-error": "分析サービスに接続できませんでした。",
  "missing-body": "JSONリクエスト本文が必要です。",
  "request-too-large": "リクエスト本文が許可されたサイズを超えています。",
  "invalid-api-key": "設定画面に有効なOpenRouter APIキーを入力してください。",
  "missing-api-key": "分析前に設定画面でOpenRouter APIキーを追加してください。",
  "method-not-allowed": "タイムライン分析にはPOSTを使用してください。",
  "unsupported-media-type": "application/json形式のリクエスト本文を使用してください。",
  "live-llm-disabled": "このWorkerではライブモデル分析が無効です。",
  "invalid-json": "リクエスト本文が有効なJSONではありません。",
  "invalid-request": "リクエスト本文はJSONオブジェクトである必要があります。",
  "unexpected-field": "リクエストに未対応の項目が含まれています。",
  "empty-text": "分析する診療テキストを入力してください。",
  "input-too-large": "入力テキストが許可された文字数を超えています。",
  "invalid-dct": "文書作成日はYYYY-MM-DD形式で指定してください。",
  "invalid-model": "モデルには200文字以内の識別子を指定してください。",
  "provider-authentication-failed": "OpenRouterがAPIキーを拒否しました。",
  "provider-credit-required": "OpenRouterアカウントのクレジットが不足しています。",
  "provider-rate-limited": "OpenRouterがリクエストを制限しました。時間をおいて再試行してください。",
  "source-text-mismatch": "モデルが原文を変更したため、安全に分析を続行できません。",
  "empty-model-output": "モデルから出力が返されませんでした。",
  "model-request-failed": "モデルへのリクエストに失敗しました。",
  "missing-source-span": "抽出したエンティティに原文範囲がありません。",
  "source-span-mismatch": "抽出したエンティティと原文範囲が一致しません。",
  "unknown-entity-type": "モデルが未対応のエンティティ種別を返しました。",
  "unparseable-relation": "モデルが生成した関係を解析できませんでした。",
  "invalid-model-response": "モデルプロバイダーから無効な応答が返されました。",
  "model-response-too-large": "モデルプロバイダーの応答が許可されたサイズを超えています。",
  "invalid-configuration": "Workerの設定が無効です。",
  "analysis-failed": "タイムラインを生成する前に分析が失敗しました。",
  "missing-progress-stream": "分析サービスから進捗ストリームが返されませんでした。",
  "incomplete-progress-stream": "タイムラインを生成する前に分析が終了しました。",
};

export function errorMessage(locale: Locale, code: string, original: string): string {
  if (locale === "en") return original;
  return ERROR_MESSAGES_JA[code] ?? `分析に失敗しました（${code}）。`;
}

const MODEL_OUTPUT_ERROR_CODES = new Set([
  "empty-model-output",
  "source-text-mismatch",
  "missing-source-span",
  "source-span-mismatch",
  "unknown-entity-type",
  "unparseable-relation",
]);

const MODEL_OUTPUT_RULES_JA: Record<string, string> = {
  "empty-model-output": "各解析フェーズで、仕様に沿った空でない応答が必要です。",
  "source-text-mismatch": "アノテーション記号を除いた出力は、原文の内部空白・句読点・文字順を含めて一字一句一致する必要があります。",
  "missing-source-span": "原文内の各エンティティには、コードポイント単位の開始位置と終了位置が必要です。",
  "source-span-mismatch": "各エンティティの文字列は、指定された原文範囲の文字列と完全に一致する必要があります。",
  "unknown-entity-type": "すべてのエンティティ種別は、対応するPRISMラベルである必要があります。",
  "unparseable-relation": "各関係は、対応する解析フェーズの関係形式と既知のエンティティIDを使用する必要があります。",
};

const MODEL_OUTPUT_RULES_EN: Record<string, string> = {
  "empty-model-output": "Every analysis phase requires a non-empty response in the specified format.",
  "source-text-mismatch": "After annotation markup is removed, internal whitespace, punctuation, characters, and order must match the source exactly.",
  "missing-source-span": "Every source entity requires code-point start and end offsets in the original text.",
  "source-span-mismatch": "Each entity string must exactly equal the original text at its reported source span.",
  "unknown-entity-type": "Every entity type must be a supported PRISM label.",
  "unparseable-relation": "Every relation must use the format for its analysis phase and reference known entity identifiers.",
};

export function isModelOutputError(code: string): boolean {
  return MODEL_OUTPUT_ERROR_CODES.has(code);
}

export function modelOutputRule(locale: Locale, code: string): string {
  const rules = locale === "ja" ? MODEL_OUTPUT_RULES_JA : MODEL_OUTPUT_RULES_EN;
  return rules[code] ?? COPY[locale].modelOutputContract;
}

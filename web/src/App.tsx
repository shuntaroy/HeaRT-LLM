import { useEffect, useState } from "react";

import { analyseTimeline, ApiError } from "./api";
import type { AnalysisProgress } from "./api";
import { AnalysisForm, SYNTHETIC_EXAMPLE } from "./components/AnalysisForm";
import { EvidencePanel } from "./components/EvidencePanel";
import { ProviderKeyButton, ProviderSettings } from "./components/ProviderSettings";
import { SourceDocument } from "./components/SourceDocument";
import { TimelineSkeleton } from "./components/TimelineSkeleton";
import { TimelineView } from "./components/TimelineView";
import {
  documentSummary,
  errorMessage,
  formatNumber,
  isModelOutputError,
  modelOutputRule,
  text as uiText,
  warningMessage,
  type Locale,
} from "./i18n";
import type { TimelineDocument } from "./types";

type ApiState = "checking" | "connected" | "unavailable" | "offline";

export function App() {
  const [locale, setLocale] = useState<Locale>("ja");
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [text, setText] = useState("");
  const [dct, setDct] = useState("");
  const [model, setModel] = useState("openai/gpt-5.6-sol");
  const [apiKey, setApiKey] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineDocument | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [inputExpanded, setInputExpanded] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("API unavailable");
        const health = (await response.json().catch(() => null)) as
          | { analysis_available?: boolean }
          | null;
        setApiState(health?.analysis_available === false ? "unavailable" : "connected");
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setApiState("offline");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = uiText(locale, "pageTitle");
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute("content", uiText(locale, "metaDescription"));
  }, [locale]);

  async function analyse() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setProgress(null);
    setError(null);
    try {
      const result = await analyseTimeline({ text, dct, model, apiKey }, setProgress);
      setTimeline(result);
      setSelectedEntityId(result.items[0]?.entity_id ?? null);
      setInputExpanded(false);
    } catch (reason: unknown) {
      if (reason instanceof ApiError) {
        setError({ code: reason.code, message: reason.message });
      } else {
        setError({
          code: "network-error",
          message: "The analysis service could not be reached.",
        });
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function loadSynthetic() {
    setText(SYNTHETIC_EXAMPLE);
    setDct("2024-01-20");
    setTimeline(null);
    setSelectedEntityId(null);
    setError(null);
    setProgress(null);
    setInputExpanded(false);
  }

  function clearDocument() {
    setText("");
    setDct("");
    setTimeline(null);
    setSelectedEntityId(null);
    setError(null);
    setProgress(null);
    setInputExpanded(false);
  }

  function clearPageMemory() {
    clearDocument();
    setApiKey("");
    setSettingsOpen(false);
  }

  function invalidateTimeline() {
    if (!timeline) return;
    setTimeline(null);
    setSelectedEntityId(null);
    setError(null);
    setInputExpanded(false);
  }

  function changeText(value: string) {
    setText(value);
    invalidateTimeline();
  }

  function changeDct(value: string) {
    setDct(value);
    invalidateTimeline();
  }

  function changeModel(value: string) {
    setModel(value);
    invalidateTimeline();
  }

  function exportJson() {
    if (!timeline) return;
    const blob = new Blob([JSON.stringify(timeline, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${timeline.source.id}.timeline.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <header className="masthead">
        <div className="identity">
          <img
            className="heritage-mark"
            src="/heart-mark.png"
            alt=""
            aria-hidden="true"
            width="55"
            height="48"
          />
          <div>
            <p className="product-name">HeaRT</p>
            <p className="product-expansion">{uiText(locale, "productExpansion")}</p>
          </div>
        </div>
        <div className="masthead-actions">
          {timeline && (
            <button type="button" className="export-action" onClick={exportJson}>
              {uiText(locale, "exportJson")}
            </button>
          )}
          <ProviderKeyButton
            locale={locale}
            configured={Boolean(apiKey.trim())}
            open={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          />
          <nav className="language-switcher" aria-label={uiText(locale, "displayLanguage")}>
            <button type="button" lang="ja" aria-pressed={locale === "ja"} onClick={() => setLocale("ja")}>
              日本語
            </button>
            <button type="button" lang="en" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>
              English
            </button>
          </nav>
          <p className={`connection connection--${apiState}`} aria-live="polite">
            <span aria-hidden="true" />
            {apiState === "checking" && uiText(locale, "connectionChecking")}
            {apiState === "connected" && !apiKey.trim() && uiText(locale, "connectionKeyRequired")}
            {apiState === "connected" && Boolean(apiKey.trim()) && uiText(locale, "connectionReadyKey")}
            {apiState === "unavailable" && uiText(locale, "connectionUnavailable")}
            {apiState === "offline" && uiText(locale, "connectionOffline")}
          </p>
        </div>
      </header>

      {settingsOpen && (
        <ProviderSettings
          locale={locale}
          apiKey={apiKey}
          required={apiState === "connected"}
          busy={busy}
          onApiKeyChange={setApiKey}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <div className={`workspace ${timeline ? "has-timeline" : ""}`}>
        <aside className="input-column">
          {timeline && (
            <div className="document-strip">
              <div>
                <span>{uiText(locale, "currentDocument")}</span>
                <strong>
                  {documentSummary(locale, timeline.source.text.length, timeline.entities.length)}
                </strong>
              </div>
              <div className="document-actions">
                <button
                  type="button"
                  aria-expanded={inputExpanded}
                  onClick={() => setInputExpanded((expanded) => !expanded)}
                >
                  {inputExpanded ? uiText(locale, "hideInput") : uiText(locale, "editInput")}
                </button>
                <button type="button" onClick={clearDocument}>{uiText(locale, "newDocument")}</button>
              </div>
            </div>
          )}
          {(!timeline || inputExpanded) && (
            <AnalysisForm
              locale={locale}
              text={text}
              dct={dct}
              model={model}
              busy={busy}
              analysisAvailable={apiState === "connected"}
              credentialReady={Boolean(apiKey.trim())}
              progress={progress}
              onTextChange={changeText}
              onDctChange={changeDct}
              onModelChange={changeModel}
              onSubmit={analyse}
              onLoadSynthetic={loadSynthetic}
              onClear={clearPageMemory}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
          {error && (
            <div className="error-banner" role="alert">
              <code>{error.code}</code>
              <p>{errorMessage(locale, error.code, error.message)}</p>
              {isModelOutputError(error.code) && (
                <details className="model-output-disclosure">
                  <summary>
                    <span aria-hidden="true" />
                    {uiText(locale, "modelOutputDetails")}
                  </summary>
                  <strong>{uiText(locale, "modelOutputContract")}</strong>
                  <p>{modelOutputRule(locale, error.code)}</p>
                  <small>{uiText(locale, "modelOutputSafety")}</small>
                </details>
              )}
            </div>
          )}
          {timeline && (
            <SourceDocument
              locale={locale}
              text={timeline.source.text}
              entities={timeline.entities}
              selectedEntityId={selectedEntityId}
              onSelectEntity={setSelectedEntityId}
            />
          )}
        </aside>

        <section className="result-column">
          {!timeline ? (
            busy ? (
              <TimelineSkeleton locale={locale} progress={progress} />
            ) : (
              <div className="empty-stage">
                <div className="ruler" aria-hidden="true">
                  <span>{uiText(locale, "earlier")}</span><i /><i /><i /><span>{uiText(locale, "later")}</span>
                </div>
                <div className="empty-copy">
                  <div className="evidence-thread" aria-hidden="true">
                    <b /><span data-label={uiText(locale, "evidenceLabel")} /><b />
                  </div>
                  <p className="eyebrow">{uiText(locale, "noTimeline")}</p>
                  <h2>{uiText(locale, "emptyHeadline")}</h2>
                  <p>{uiText(locale, "emptyBody")}</p>
                </div>
                <div className="lane-legend" aria-label={uiText(locale, "timelineLanes")}>
                  <span><i className="finding" />{uiText(locale, "findingsLegend")}</span>
                  <span><i className="therapy" />{uiText(locale, "therapiesLegend")}</span>
                  <span><i className="uncertain" />{uiText(locale, "unresolvedLegend")}</span>
                </div>
              </div>
            )
          ) : (
            <>
              <div className="run-strip">
                <div>
                  <span>{uiText(locale, "model")}</span>
                  <strong>{timeline.run.model}</strong>
                </div>
                <div>
                  <span>{uiText(locale, "prismPhases")}</span>
                  <strong>{timeline.run.phase_calls}</strong>
                </div>
                <div>
                  <span>{uiText(locale, "persistence")}</span>
                  <strong>{uiText(locale, "none")}</strong>
                </div>
                <div>
                  <span>{uiText(locale, "tokens")}</span>
                  <strong>
                    {typeof timeline.run.usage?.total_tokens === "number"
                      ? formatNumber(locale, timeline.run.usage.total_tokens)
                      : uiText(locale, "notReported")}
                  </strong>
                </div>
              </div>
              <TimelineView
                locale={locale}
                timeline={timeline}
                selectedEntityId={selectedEntityId}
                onSelectEntity={setSelectedEntityId}
              />
              <div className="result-footer">
                <EvidencePanel locale={locale} timeline={timeline} entityId={selectedEntityId} />
                <section className="warnings-panel" aria-labelledby="warnings-title">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">{uiText(locale, "inferenceAudit")}</p>
                      <h2 id="warnings-title">{uiText(locale, "warnings")}</h2>
                    </div>
                    <span className="count-label">{timeline.warnings.length}</span>
                  </div>
                  {timeline.warnings.length > 0 ? (
                    <ul>
                      {timeline.warnings.map((warning, index) => (
                        <li className={`warning--${warning.severity}`} key={`${warning.code}-${index}`}>
                          <details>
                            <summary>
                              <span aria-hidden="true" />
                              <code>{warning.code}</code>
                              <small>{uiText(locale, "warningDetails")}</small>
                            </summary>
                            <p>{warningMessage(locale, warning.code, warning.message)}</p>
                          </details>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{uiText(locale, "noWarnings")}</p>
                  )}
                </section>
              </div>
            </>
          )}
        </section>
      </div>
      <footer className="site-footer">
        <div>
          <span>{uiText(locale, "patentPrefix")}</span>
          <a
            href="https://jglobal.jst.go.jp/detail?JGLOBAL_ID=202503019605238486"
            target="_blank"
            rel="noreferrer"
          >
            {uiText(locale, "patentLink")} <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div>
          <span>{uiText(locale, "sourceCodePrefix")}</span>
          <a
            href="https://github.com/shuntaroy/HeaRT-LLM"
            target="_blank"
            rel="noreferrer"
          >
            {uiText(locale, "sourceCodeLink")} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </footer>
    </main>
  );
}

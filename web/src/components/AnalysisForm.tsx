import type { FormEvent } from "react";

import type { AnalysisProgress } from "../api";
import { characterCount, phaseCount, text as uiText, type Locale } from "../i18n";

export const SYNTHETIC_EXAMPLE =
  "2024年1月10日に外来を受診した。胸部CTで右肺に小結節を認めた。" +
  "プレドニゾロン10mgを同日から開始し、2024年1月20日に終了した。";

interface AnalysisFormProps {
  locale: Locale;
  text: string;
  dct: string;
  model: string;
  busy: boolean;
  analysisAvailable: boolean;
  credentialReady: boolean;
  progress: AnalysisProgress | null;
  onTextChange: (value: string) => void;
  onDctChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onSubmit: () => void;
  onLoadSynthetic: () => void;
  onClear: () => void;
  onOpenSettings: () => void;
}

export function AnalysisForm({
  locale,
  text,
  dct,
  model,
  busy,
  analysisAvailable,
  credentialReady,
  progress,
  onTextChange,
  onDctChange,
  onModelChange,
  onSubmit,
  onLoadSynthetic,
  onClear,
  onOpenSettings,
}: AnalysisFormProps) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  const needsKey = analysisAvailable && !credentialReady;

  return (
    <form className="analysis-form" onSubmit={submit}>
      <div className="form-heading">
        <div>
          <p className="pane-label">{uiText(locale, "sourceDocument")}</p>
          <h1>{uiText(locale, "heroTitle")}</h1>
        </div>
        <button
          className="text-action"
          type="button"
          onClick={onLoadSynthetic}
          disabled={busy}
        >
          {uiText(locale, "loadSynthetic")}
        </button>
      </div>

      <label className="field field--text">
        <span>{uiText(locale, "clinicalText")}</span>
        <textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={uiText(locale, "textPlaceholder")}
          rows={10}
          spellCheck={false}
          required
          disabled={busy}
        />
        <small>{characterCount(locale, text.length)}</small>
      </label>

      <div className="form-row">
        <label className="field">
          <span>{uiText(locale, "documentCreationDate")}</span>
          <input
            type="date"
            value={dct}
            onChange={(event) => onDctChange(event.target.value)}
            disabled={busy}
          />
          <small>{uiText(locale, "dctHelp")}</small>
        </label>
        <label className="field">
          <span>{uiText(locale, "model")}</span>
          <input
            type="text"
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            aria-label={uiText(locale, "openRouterModelAria")}
            disabled={busy}
          />
          <small>{uiText(locale, "modelIdentifier")}</small>
        </label>
      </div>

      <div className="privacy-callout">
        <span className="privacy-symbol" aria-hidden="true">∅</span>
        <p>
          <strong>{uiText(locale, "noHistoryLead")}</strong>{" "}
          {uiText(locale, "noHistoryBody")}
        </p>
      </div>

      {busy && <PrismProgress locale={locale} progress={progress} />}

      <div className="form-actions">
        <button
          className="primary-action"
          type={needsKey ? "button" : "submit"}
          onClick={needsKey ? onOpenSettings : undefined}
          disabled={busy || (!needsKey && (!analysisAvailable || !text.trim()))}
        >
          {busy
            ? uiText(locale, "analysing")
            : needsKey
              ? uiText(locale, "addOpenRouterKey")
            : analysisAvailable
              ? uiText(locale, "buildTimeline")
              : uiText(locale, "analysisUnavailable")}
        </button>
        <button className="secondary-action" type="button" onClick={onClear} disabled={busy}>
          {uiText(locale, "clearPageMemory")}
        </button>
      </div>
    </form>
  );
}

const phases = [
  { id: "entity", label: "phaseEntities" },
  { id: "medical_relation", label: "phaseMedicalRelations" },
  { id: "time_relation", label: "phaseTemporalRelations" },
] as const;

function PrismProgress({ locale, progress }: { locale: Locale; progress: AnalysisProgress | null }) {
  const completed = progress?.completed ?? 0;
  const currentLabels = [
    uiText(locale, "extractingEntities"),
    uiText(locale, "linkingMedicalRelations"),
    uiText(locale, "resolvingTemporalRelations"),
    uiText(locale, "buildingTimeline"),
  ];

  return (
    <section className="prism-progress" aria-live="polite" aria-label={uiText(locale, "prismProgress")}>
      <div className="progress-heading">
        <div>
          <span>{uiText(locale, "prismProcessing")}</span>
          <strong>{currentLabels[completed]}</strong>
        </div>
        <b>{phaseCount(locale, completed)}</b>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={uiText(locale, "completedPhases")}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={completed}
      >
        <i style={{ width: `${(completed / 3) * 100}%` }} />
      </div>
      <ol>
        {phases.map((phase, index) => {
          const step = index + 1;
          const state = step <= completed ? "complete" : step === completed + 1 ? "active" : "waiting";
          return (
            <li className={`phase--${state}`} key={phase.id}>
              <span aria-hidden="true">{step <= completed ? "✓" : step}</span>
              {uiText(locale, phase.label)}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

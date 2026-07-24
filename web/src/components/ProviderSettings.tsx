import { useState, type FormEvent } from "react";

import { text as uiText, type Locale } from "../i18n";

interface ProviderKeyButtonProps {
  locale: Locale;
  configured: boolean;
  open: boolean;
  onClick: () => void;
}

export function ProviderKeyButton({ locale, configured, open, onClick }: ProviderKeyButtonProps) {
  return (
    <button
      type="button"
      className={`key-action ${configured ? "is-configured" : ""}`}
      aria-expanded={open}
      aria-controls="provider-settings"
      onClick={onClick}
    >
      <span aria-hidden="true" />
      {configured ? uiText(locale, "providerKeySet") : uiText(locale, "addProviderKey")}
    </button>
  );
}

interface ProviderSettingsProps {
  locale: Locale;
  apiKey: string;
  required: boolean;
  busy: boolean;
  onApiKeyChange: (value: string) => void;
  onClose: () => void;
}

export function ProviderSettings({
  locale,
  apiKey,
  required,
  busy,
  onApiKeyChange,
  onClose,
}: ProviderSettingsProps) {
  const [revealed, setRevealed] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    onClose();
  }

  return (
    <section id="provider-settings" className="provider-settings" aria-labelledby="provider-settings-title">
      <form onSubmit={submit}>
        <div className="provider-settings__heading">
          <div>
            <p className="pane-label">{uiText(locale, "requestCredential")}</p>
            <h2 id="provider-settings-title">{uiText(locale, "useOpenRouterKey")}</h2>
          </div>
          <span className="memory-badge">{uiText(locale, "memoryOnly")}</span>
        </div>

        <div className="provider-key-field">
          <label htmlFor="openrouter-api-key">{uiText(locale, "openRouterApiKey")}</label>
          <div className="provider-key-entry">
            <input
              id="openrouter-api-key"
              type={revealed ? "text" : "password"}
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              placeholder="sk-or-v1-…"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              aria-describedby="provider-key-note"
            />
            <button type="button" onClick={() => setRevealed((value) => !value)} disabled={busy || !apiKey}>
              {revealed ? uiText(locale, "hide") : uiText(locale, "show")}
            </button>
          </div>
        </div>

        <p id="provider-key-note" className="provider-key-note">
          {uiText(locale, "providerKeyNote")}
        </p>

        <div className="provider-settings__footer">
          <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">
            {uiText(locale, "manageKey")} <span aria-hidden="true">↗</span>
          </a>
          <div>
            {apiKey && (
              <button type="button" className="clear-key-action" onClick={() => onApiKeyChange("")} disabled={busy}>
                {uiText(locale, "clearKey")}
              </button>
            )}
            <button type="submit" className="settings-done-action" disabled={busy}>
              {required && !apiKey.trim() ? uiText(locale, "closeWithoutKey") : uiText(locale, "useKey")}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

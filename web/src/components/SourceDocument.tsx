import type { ClinicalEntity } from "../types";
import { entityCount, text as uiText, type Locale } from "../i18n";

interface SourceDocumentProps {
  locale: Locale;
  text: string;
  entities: ClinicalEntity[];
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
}

interface Segment {
  text: string;
  entity: ClinicalEntity | null;
}

function segmentsFor(text: string, entities: ClinicalEntity[]): Segment[] {
  const codepoints = Array.from(text);
  const positioned = entities
    .filter((entity) => entity.span !== null && !entity.is_dct)
    .sort((left, right) => {
      const startDifference = left.span!.start - right.span!.start;
      if (startDifference !== 0) return startDifference;
      return right.span!.end - right.span!.start - (left.span!.end - left.span!.start);
    });

  const segments: Segment[] = [];
  let cursor = 0;
  for (const entity of positioned) {
    const span = entity.span!;
    if (span.start < cursor || span.end > codepoints.length) continue;
    if (span.start > cursor) {
      segments.push({ text: codepoints.slice(cursor, span.start).join(""), entity: null });
    }
    segments.push({ text: codepoints.slice(span.start, span.end).join(""), entity });
    cursor = span.end;
  }
  if (cursor < codepoints.length) {
    segments.push({ text: codepoints.slice(cursor).join(""), entity: null });
  }
  return segments;
}

export function SourceDocument({
  locale,
  text,
  entities,
  selectedEntityId,
  onSelectEntity,
}: SourceDocumentProps) {
  return (
    <section className="source-document" aria-labelledby="source-preview-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{uiText(locale, "sourceAlignment")}</p>
          <h2 id="source-preview-title">{uiText(locale, "annotatedText")}</h2>
        </div>
        <span className="count-label">
          {entityCount(locale, entities.filter((entity) => !entity.is_dct).length)}
        </span>
      </div>
      <p className="annotated-text" lang="ja">
        {segmentsFor(text, entities).map((segment, index) =>
          segment.entity ? (
            <button
              className={`source-entity source-entity--${segment.entity.label} ${
                selectedEntityId === segment.entity.id ? "is-selected" : ""
              }`}
              type="button"
              key={`${segment.entity.id}-${index}`}
              onClick={() => onSelectEntity(segment.entity!.id)}
              aria-pressed={selectedEntityId === segment.entity.id}
              title={`${segment.entity.label} · ${segment.entity.id}`}
            >
              {segment.text}
            </button>
          ) : (
            <span key={`text-${index}`}>{segment.text}</span>
          ),
        )}
      </p>
    </section>
  );
}

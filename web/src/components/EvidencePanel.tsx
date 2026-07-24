import type { TimelineDocument } from "../types";
import {
  attributeLabel,
  attributeValue,
  placementLabel,
  text as uiText,
  type Locale,
} from "../i18n";

interface EvidencePanelProps {
  locale: Locale;
  timeline: TimelineDocument;
  entityId: string | null;
}

export function EvidencePanel({ locale, timeline, entityId }: EvidencePanelProps) {
  const entity = timeline.entities.find((candidate) => candidate.id === entityId);
  const item = timeline.items.find((candidate) => candidate.entity_id === entityId);
  const relations = timeline.relations.filter(
    (relation) => relation.source_id === entityId || relation.target_id === entityId,
  );
  const entityById = new Map(timeline.entities.map((candidate) => [candidate.id, candidate]));

  return (
    <aside className="evidence-panel" aria-live="polite">
      <div className="evidence-thread" aria-hidden="true">
        <b />
        <span data-label={uiText(locale, "evidenceLabel")} />
        <b />
      </div>
      {!entity ? (
        <div>
          <p className="eyebrow">{uiText(locale, "evidenceThread")}</p>
          <h2>{uiText(locale, "selectEvent")}</h2>
          <p>{uiText(locale, "evidenceDescription")}</p>
        </div>
      ) : (
        <div>
          <p className="eyebrow">{entity.id} · {entity.label}</p>
          <h2 lang="ja">{entity.text}</h2>
          <dl className="evidence-facts">
            <div>
              <dt>{uiText(locale, "placement")}</dt>
              <dd>{item ? placementLabel(locale, item.placement.status) : uiText(locale, "supportingEntity")}</dd>
            </div>
            <div>
              <dt>{uiText(locale, "sourceSpan")}</dt>
              <dd>{entity.span ? `${entity.span.start}–${entity.span.end}` : uiText(locale, "notInSource")}</dd>
            </div>
            {Object.entries(entity.attributes).map(([name, value]) => (
              <div key={name}>
                <dt>{attributeLabel(locale, name)}</dt>
                <dd>{attributeValue(locale, value)}</dd>
              </div>
            ))}
          </dl>
          <div className="relation-list">
            <h3>{uiText(locale, "directRelations")}</h3>
            {relations.length > 0 ? (
              <ul>
                {relations.map((relation) => {
                  const outgoing = relation.source_id === entity.id;
                  const otherId = outgoing ? relation.target_id : relation.source_id;
                  return (
                    <li key={relation.id}>
                      <code>{relation.type}</code>
                      <span>{outgoing ? "→" : "←"}</span>
                      <span lang="ja">{entityById.get(otherId)?.text ?? otherId}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>{uiText(locale, "noDirectRelation")}</p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

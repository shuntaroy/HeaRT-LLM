import type {
  TemporalAnchor,
  TimelineCategory,
  TimelineDocument,
  TimelineItem,
} from "../types";
import {
  categoryLabel,
  placementLabel,
  precisionLabel,
  text as uiText,
  timelineCount,
  type Locale,
} from "../i18n";

const CATEGORY_ORDER: TimelineCategory[] = [
  "finding",
  "test",
  "medicine",
  "treatment",
  "context",
  "pending",
];

function anchorLabel(anchor: TemporalAnchor, locale: Locale): string {
  return anchor.value ?? anchor.texts[0] ?? uiText(locale, "unknown");
}

function gridPlacement(item: TimelineItem, anchors: TemporalAnchor[]) {
  const index = new Map(anchors.map((anchor, anchorIndex) => [anchor.id, anchorIndex]));
  const placement = item.placement;
  let start = 0;
  let end = Math.max(0, anchors.length - 1);

  if (placement.status === "point" && placement.point_anchor_ids[0]) {
    start = index.get(placement.point_anchor_ids[0]) ?? 0;
    end = start;
  } else if (placement.start || placement.end) {
    start = placement.start ? (index.get(placement.start.anchor_id) ?? 0) : 0;
    end = placement.end
      ? (index.get(placement.end.anchor_id) ?? anchors.length - 1)
      : anchors.length - 1;
  } else if (placement.alternative_anchor_ids.length > 0) {
    const positions = placement.alternative_anchor_ids
      .map((anchorId) => index.get(anchorId))
      .filter((value): value is number => value !== undefined);
    if (positions.length > 0) {
      start = Math.min(...positions);
      end = Math.max(...positions);
    }
  }
  return { start, end };
}

interface TimelineViewProps {
  locale: Locale;
  timeline: TimelineDocument;
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
}

export function TimelineView({
  locale,
  timeline,
  selectedEntityId,
  onSelectEntity,
}: TimelineViewProps) {
  const placed = timeline.items.filter((item) => item.placement.status !== "unplaced");
  const unplaced = timeline.items.filter((item) => item.placement.status === "unplaced");
  const anchors = timeline.anchors;

  return (
    <section className="timeline-view" aria-labelledby="timeline-title">
      <div className="section-heading timeline-heading">
        <div>
          <p className="eyebrow">{uiText(locale, "chronology")}</p>
          <h2 id="timeline-title">{uiText(locale, "clinicalTimeline")}</h2>
        </div>
        <div className="timeline-summary">
          <span>{timelineCount(locale, anchors.length, "anchors")}</span>
          <span>{timelineCount(locale, placed.length, "items")}</span>
        </div>
      </div>

      {anchors.length === 0 ? (
        <div className="timeline-empty">
          <p>{uiText(locale, "noTimeExpression")}</p>
          <span>{uiText(locale, "noTimeHelp")}</span>
        </div>
      ) : (
        <div className="timeline-scroll" tabIndex={0} aria-label={uiText(locale, "scrollableTimeline")}>
          <div className="anchor-ruler" style={{ gridTemplateColumns: `repeat(${anchors.length}, minmax(130px, 1fr))` }}>
            {anchors.map((anchor) => (
              <div className={`anchor ${anchor.resolution === "unresolved" ? "is-unresolved" : ""}`} key={anchor.id}>
                <span>{anchorLabel(anchor, locale)}</span>
                <small>{anchor.is_dct ? "DCT" : precisionLabel(locale, anchor.precision)}</small>
                <i aria-hidden="true" />
              </div>
            ))}
          </div>

          <div className="timeline-lanes">
            {CATEGORY_ORDER.map((category) => {
              const categoryItems = placed.filter((item) => item.category === category);
              if (categoryItems.length === 0) return null;
              return (
                <section className={`timeline-lane timeline-lane--${category}`} key={category}>
                  <h3>{categoryLabel(locale, category)}</h3>
                  {categoryItems.map((item) => {
                    const position = gridPlacement(item, anchors);
                    return (
                      <div className="timeline-row" key={item.id}>
                        <div
                          className="timeline-track"
                          style={{ gridTemplateColumns: `repeat(${anchors.length}, minmax(130px, 1fr))` }}
                        >
                          <button
                            className={`timeline-event timeline-event--${item.placement.status} ${
                              selectedEntityId === item.entity_id ? "is-selected" : ""
                            }`}
                            style={{ gridColumn: `${position.start + 1} / ${position.end + 2}` }}
                            type="button"
                            onClick={() => onSelectEntity(item.entity_id)}
                            aria-pressed={selectedEntityId === item.entity_id}
                          >
                            <span>{item.text}</span>
                            <small>{placementLabel(locale, item.placement.status)}</small>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </div>
      )}

      <section className="unplaced-lane" aria-labelledby="unplaced-title">
        <div>
          <p className="eyebrow">{uiText(locale, "notDiscarded")}</p>
          <h3 id="unplaced-title">{uiText(locale, "unresolvedEvidence")}</h3>
        </div>
        {unplaced.length > 0 ? (
          <div className="unplaced-items">
            {unplaced.map((item) => (
              <button
                type="button"
                key={item.id}
                className={selectedEntityId === item.entity_id ? "is-selected" : ""}
                onClick={() => onSelectEntity(item.entity_id)}
              >
                {item.text}
              </button>
            ))}
          </div>
        ) : (
          <p className="all-placed">{uiText(locale, "allPlaced")}</p>
        )}
      </section>
    </section>
  );
}

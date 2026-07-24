import type { CSSProperties } from "react";

import type { AnalysisProgress } from "../api";
import { phaseCount, text as uiText, type Locale } from "../i18n";

interface TimelineSkeletonProps {
  locale: Locale;
  progress: AnalysisProgress | null;
}

export function TimelineSkeleton({ locale, progress }: TimelineSkeletonProps) {
  const completed = progress?.completed ?? 0;
  const currentLabels = [
    uiText(locale, "extractingEntities"),
    uiText(locale, "linkingMedicalRelations"),
    uiText(locale, "resolvingTemporalRelations"),
    uiText(locale, "buildingTimeline"),
  ];

  return (
    <section
      className="timeline-skeleton"
      role="status"
      aria-label={uiText(locale, "timelineLoadingTitle")}
      aria-live="polite"
    >
      <div className="timeline-skeleton__heading">
        <div>
          <p className="eyebrow">{uiText(locale, "timelineLoadingEyebrow")}</p>
          <h2>{uiText(locale, "timelineLoadingTitle")}</h2>
        </div>
        <span>{phaseCount(locale, completed)}</span>
      </div>
      <p className="timeline-skeleton__status">{currentLabels[completed]}</p>
      <p className="timeline-skeleton__body">{uiText(locale, "timelineLoadingBody")}</p>

      <div className="timeline-skeleton__canvas" aria-hidden="true">
        <div className="timeline-skeleton__ruler">
          <i />
          <i />
          <i />
          <i />
        </div>
        {[0, 1, 2].map((lane) => (
          <div className="timeline-skeleton__lane" key={lane}>
            <span />
            <div>
              <i style={{ width: `${[44, 68, 35][lane]}%` }} />
              <b style={{ left: `${[19, 54, 72][lane]}%` }} />
            </div>
          </div>
        ))}
        <span
          className="timeline-skeleton__scan"
          style={{ "--completed-phases": completed } as CSSProperties}
        />
      </div>
    </section>
  );
}

export const ENTITY_LABELS = [
  "d",
  "a",
  "f",
  "c",
  "TIMEX3",
  "t-test",
  "t-key",
  "t-val",
  "m-key",
  "m-val",
  "r",
  "cc",
  "p",
] as const;

export type EntityLabel = (typeof ENTITY_LABELS)[number];

export const RELATION_TYPES = [
  "changeSbj",
  "changeRef",
  "featureSbj",
  "subRegion",
  "keyValue",
  "timeOn",
  "timeBefore",
  "timeAfter",
  "timeBegin",
  "timeEnd",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export interface SourceSpan {
  start: number;
  end: number;
}

export interface ClinicalEntity {
  id: string;
  label: EntityLabel;
  text: string;
  span: SourceSpan | null;
  attributes: Record<string, string | string[]>;
  is_dct: boolean;
}

export interface ClinicalRelation {
  id: string;
  type: RelationType;
  source_id: string;
  target_id: string;
}

export type TemporalPrecision =
  | "day"
  | "month"
  | "year"
  | "month-day"
  | "time"
  | "duration"
  | "set"
  | "age"
  | "medical"
  | "misc"
  | "unknown";

export type ResolutionMethod = "stated" | "dct-inferred" | "unresolved";

export interface TemporalAnchor {
  id: string;
  entity_ids: string[];
  texts: string[];
  value: string | null;
  precision: TemporalPrecision;
  resolution: ResolutionMethod;
  is_dct: boolean;
}

export interface TemporalBound {
  anchor_id: string;
  inclusive: boolean;
  relation_type: RelationType;
}

export type PlacementStatus =
  | "point"
  | "interval"
  | "open"
  | "ambiguous"
  | "conflict"
  | "unplaced";

export interface TimelinePlacement {
  status: PlacementStatus;
  start: TemporalBound | null;
  end: TemporalBound | null;
  point_anchor_ids: string[];
  alternative_anchor_ids: string[];
  evidence_relation_ids: string[];
}

export type TimelineCategory =
  | "finding"
  | "test"
  | "medicine"
  | "treatment"
  | "context"
  | "pending";

export interface TimelineItem {
  id: string;
  entity_id: string;
  text: string;
  label: EntityLabel;
  category: TimelineCategory;
  attributes: Record<string, string | string[]>;
  span: SourceSpan | null;
  placement: TimelinePlacement;
  anatomy_ids: string[];
  modifier_ids: string[];
  value_ids: string[];
}

export interface TimelineWarning {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  entity_ids: string[];
  relation_ids: string[];
}

export interface ModelUsage {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
}

export interface RunMetadata {
  annotator: string;
  annotator_version: string;
  model: string;
  phase_calls: number;
  generated_at: string;
  persistence: "none";
  usage: ModelUsage | null;
}

export interface TimelineDocument {
  schema_version: "1.0";
  source: {
    id: string;
    text: string;
    dct: string | null;
    language: "ja";
    sha256: string;
  };
  entities: ClinicalEntity[];
  relations: ClinicalRelation[];
  anchors: TemporalAnchor[];
  items: TimelineItem[];
  warnings: TimelineWarning[];
  run: RunMetadata;
}

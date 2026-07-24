import { ENTITY_LABELS, RELATION_TYPES, type EntityLabel, type RelationType } from "../../shared/timeline";

export const ENTITY_LABEL_SET = new Set<string>(ENTITY_LABELS);
export const RELATION_TYPE_SET = new Set<string>(RELATION_TYPES);

export const TEMPORAL_RELATION_SET = new Set<RelationType>([
  "timeOn",
  "timeBefore",
  "timeAfter",
  "timeBegin",
  "timeEnd",
]);

export const MEDICAL_RELATION_SET = new Set<RelationType>([
  "changeSbj",
  "changeRef",
  "featureSbj",
  "subRegion",
  "keyValue",
]);

export const REQUIRED_ATTRIBUTES: Partial<Record<EntityLabel, string[]>> = {
  d: ["certainty"],
  TIMEX3: ["type"],
  "t-test": ["state"],
  "m-key": ["state"],
  r: ["state"],
  cc: ["state"],
};

export function isEntityLabel(value: string): value is EntityLabel {
  return ENTITY_LABEL_SET.has(value);
}

export function isRelationType(value: string): value is RelationType {
  return RELATION_TYPE_SET.has(value);
}

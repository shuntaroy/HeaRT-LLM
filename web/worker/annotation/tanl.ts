import type { SourceSpan } from "../../shared/timeline";
import { isEntityLabel, isRelationType, MEDICAL_RELATION_SET, TEMPORAL_RELATION_SET } from "./schema";

export interface PrismEntity {
  text: string;
  label: string;
  span: SourceSpan | null;
  attributes: Record<string, string>;
}

export interface PrismRelation {
  type: string;
  fromEid: string;
  toEid: string;
}

const CERTAINTY_ABBREV: Record<string, string> = {
  positive: "+",
  negative: "-",
  suspicious: "?",
  general: "*",
};
const STATE_ABBREV: Record<string, string> = {
  executed: "+",
  negated: "-",
  scheduled: "予",
  other: "他",
};
const TIMEX_ABBREV: Record<string, string> = {
  DATE: "DATE",
  TIME: "TIME",
  DURATION: "DUR",
  SET: "SET",
  AGE: "AGE",
  MED: "MED",
  MISC: "MISC",
};
const ABBREV_TO_CERTAINTY = new Map(Object.entries(CERTAINTY_ABBREV).map(([key, value]) => [value, key]));
const ABBREV_TO_STATE = new Map(Object.entries(STATE_ABBREV).map(([key, value]) => [value, key]));
const ABBREV_TO_TIMEX: Record<string, string> = {
  DATE: "DATE",
  TIME: "TIME",
  DUR: "DURATION",
  DURATION: "DURATION",
  SET: "SET",
  AGE: "AGE",
  MED: "MED",
  MISC: "MISC",
};

function codepointLength(value: string): number {
  return Array.from(value).length;
}

export function codepointSlice(value: string, start: number, end?: number): string {
  return Array.from(value).slice(start, end).join("");
}

function parseTypeAbbrev(typeString: string): [string, Record<string, string>] {
  const match = /^([a-zA-Z0-9_-]+)(?:\(([^)]*)\))?$/.exec(typeString.trim());
  if (!match) return [typeString.trim(), {}];
  const label = match[1];
  const abbreviation = match[2] ?? "";
  if (!isEntityLabel(label)) return [label, {}];
  if (label === "TIMEX3" && abbreviation) {
    return [label, { type: ABBREV_TO_TIMEX[abbreviation] ?? abbreviation }];
  }
  if (label === "d" && abbreviation) {
    const value = ABBREV_TO_CERTAINTY.get(abbreviation);
    return [label, value ? { certainty: value } : {}];
  }
  if (abbreviation) {
    const value = ABBREV_TO_STATE.get(abbreviation);
    return [label, value ? { state: value } : {}];
  }
  return [label, {}];
}

export function parseTanlEntities(output: string, source: string): [PrismEntity[], string[]] {
  const warnings: string[] = [];
  const entities: PrismEntity[] = [];
  const strippedParts: string[] = [];
  let strippedPosition = 0;
  let lastEnd = 0;
  const pattern = /\[([^|\]]+?)\s*\|\s*([^\]]+?)\]/gu;
  for (const match of output.matchAll(pattern)) {
    const matchIndex = match.index;
    const before = output.slice(lastEnd, matchIndex);
    strippedParts.push(before);
    strippedPosition += codepointLength(before);
    const entityText = match[1];
    const [label, attributes] = parseTypeAbbrev(match[2]);
    const start = strippedPosition;
    const end = start + codepointLength(entityText);
    if (!isEntityLabel(label)) warnings.push(`Unknown entity type: ${label} (text='${entityText}')`);
    else if (!entityText.trim()) warnings.push(`Empty entity text for type ${label}`);
    else entities.push({ text: entityText, label, span: { start, end }, attributes });
    strippedParts.push(entityText);
    strippedPosition = end;
    lastEnd = matchIndex + match[0].length;
  }
  strippedParts.push(output.slice(lastEnd));
  const stripped = strippedParts.join("");
  if (stripped !== source) {
    const strippedWords = stripped.trim().split(/\s+/u).join("\u0000");
    const sourceWords = source.trim().split(/\s+/u).join("\u0000");
    if (strippedWords === sourceWords) warnings.push("Minor whitespace differences between stripped output and original");
    else warnings.push(`Text mismatch: stripped=${codepointLength(stripped)} chars, original=${codepointLength(source)} chars (diff=${Math.abs(codepointLength(stripped) - codepointLength(source))})`);
  }
  return [entities, warnings];
}

function abbreviatedAttribute(entity: PrismEntity): string {
  if (entity.label === "TIMEX3") return TIMEX_ABBREV[entity.attributes.type ?? ""] ?? entity.attributes.type ?? "";
  if (entity.attributes.certainty) return CERTAINTY_ABBREV[entity.attributes.certainty] ?? entity.attributes.certainty;
  if (entity.attributes.state) return STATE_ABBREV[entity.attributes.state] ?? entity.attributes.state;
  return "";
}

function entityTag(entity: PrismEntity, eid: string, sourceText?: string): string {
  const abbreviation = abbreviatedAttribute(entity);
  const typeString = abbreviation ? `${entity.label}(${abbreviation})` : entity.label;
  return `[${sourceText ?? entity.text} | ${typeString} | ${eid}]`;
}

export function documentToTanl(text: string, entities: PrismEntity[]): string {
  const positioned: Array<{ start: number; end: number; index: number }> = [];
  const unpositioned: number[] = [];
  entities.forEach((entity, index) => {
    if (entity.span) positioned.push({ ...entity.span, index });
    else unpositioned.push(index);
  });
  positioned.sort((left, right) => left.start - right.start || right.end - right.start - (left.end - left.start));
  const filtered: typeof positioned = [];
  for (const position of positioned) {
    const nested = filtered.some(
      (existing) =>
        position.start >= existing.start &&
        position.end <= existing.end &&
        (position.start !== existing.start || position.end !== existing.end),
    );
    if (nested) unpositioned.push(position.index);
    else filtered.push(position);
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const position of filtered) {
    if (position.start > cursor) parts.push(codepointSlice(text, cursor, position.start));
    const entity = entities[position.index];
    parts.push(entityTag(entity, `e${position.index + 1}`, codepointSlice(text, position.start, position.end)));
    cursor = position.end;
  }
  if (cursor < codepointLength(text)) parts.push(codepointSlice(text, cursor));
  if (unpositioned.length > 0) {
    parts.push("\n\n（位置未確定エンティティ）\n");
    for (const index of unpositioned) parts.push(`${entityTag(entities[index], `e${index + 1}`)}\n`);
  }
  return parts.join("");
}

export function parseRelations(
  text: string,
  validEids: Set<string>,
  phase: "medical_relation" | "time_relation",
  entityLabels: Map<string, string>,
): [PrismRelation[], string[]] {
  const allowed = phase === "time_relation" ? TEMPORAL_RELATION_SET : MEDICAL_RELATION_SET;
  const relations: PrismRelation[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.trim().split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line === "(なし)") continue;
    const match = /^([A-Za-z]+)\s*:\s*(e\d+)\s*->\s*(e\d+)\s*$/u.exec(line);
    if (!match || !isRelationType(match[1])) {
      warnings.push(`Unparseable line: ${line}`);
      continue;
    }
    const [, type, fromEid, toEid] = match;
    if (!allowed.has(type)) {
      warnings.push(`Wrong phase relation type: ${line}`);
      continue;
    }
    if (!validEids.has(fromEid)) {
      warnings.push(`Unknown from_eid: ${fromEid} in ${line}`);
      continue;
    }
    if (!validEids.has(toEid)) {
      warnings.push(`Unknown to_eid: ${toEid} in ${line}`);
      continue;
    }
    if (phase === "time_relation" && entityLabels.get(toEid) !== "TIMEX3") {
      warnings.push(`to_eid ${toEid} is not TIMEX3: ${line}`);
      continue;
    }
    const key = `${type}\u0000${fromEid}\u0000${toEid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    relations.push({ type, fromEid, toEid });
  }
  return [relations, warnings];
}

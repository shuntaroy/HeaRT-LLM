import type {
  ClinicalEntity,
  ClinicalRelation,
  EntityLabel,
  RunMetadata,
  TemporalAnchor,
  TimelineCategory,
  TimelineDocument,
  TimelinePlacement,
  TimelineWarning,
} from "../../shared/timeline";
import { normaliseTimex, type NormalisedTimex } from "./normalise";

const PRIMARY_LABELS = new Set<EntityLabel>(["d", "t-test", "t-key", "m-key", "r", "cc", "p"]);
const CATEGORY_BY_LABEL: Partial<Record<EntityLabel, TimelineCategory>> = {
  d: "finding",
  "t-test": "test",
  "t-key": "test",
  "m-key": "medicine",
  r: "treatment",
  cc: "context",
  p: "pending",
};
const TEMPORAL_RELATIONS = new Set(["timeOn", "timeBefore", "timeAfter", "timeBegin", "timeEnd"]);

class DisjointSet {
  private readonly parent: Map<string, string>;

  constructor(values: string[]) {
    this.parent = new Map(values.map((value) => [value, value]));
  }

  find(value: string): string {
    const parent = this.parent.get(value);
    if (parent === undefined) throw new Error("Unknown disjoint-set value");
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parent.set(rightRoot, leftRoot);
  }
}

function compareAnchor(
  left: string,
  right: string,
  normalised: Map<string, NormalisedTimex>,
  entityOrder: Map<string, number>,
  anchorMembers: Map<string, string[]>,
): number {
  const key = (anchorId: string): [number, string, number] => {
    const members = anchorMembers.get(anchorId) ?? [];
    const known = members
      .map((member) => normalised.get(member)?.sortDate ?? null)
      .filter((value): value is string => value !== null)
      .sort();
    return [known.length > 0 ? 0 : 1, known[0] ?? "9999-12-31", Math.min(...members.map((member) => entityOrder.get(member) ?? Number.MAX_SAFE_INTEGER))];
  };
  const leftKey = key(left);
  const rightKey = key(right);
  return leftKey[0] - rightKey[0] || leftKey[1].localeCompare(rightKey[1]) || leftKey[2] - rightKey[2];
}

function append<K>(map: Map<K, string[]>, key: K, value: string): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function warning(
  code: string,
  severity: TimelineWarning["severity"],
  message: string,
  entityIds: string[] = [],
  relationIds: string[] = [],
): TimelineWarning {
  return { code, severity, message, entity_ids: entityIds, relation_ids: relationIds };
}

function buildAnchors(
  entities: ClinicalEntity[],
  relations: ClinicalRelation[],
  dct: string | null,
  warnings: TimelineWarning[],
): [TemporalAnchor[], Map<string, string>] {
  const timexEntities = entities.filter((entity) => entity.label === "TIMEX3");
  if (timexEntities.length === 0) return [[], new Map()];

  const timexById = new Map(timexEntities.map((entity) => [entity.id, entity]));
  const entityOrder = new Map(entities.map((entity, index) => [entity.id, index]));
  const normalised = new Map(
    timexEntities.map((entity) => [
      entity.id,
      normaliseTimex(
        entity.text,
        typeof entity.attributes.type === "string" ? entity.attributes.type : "",
        dct,
        entity.is_dct,
      ),
    ]),
  );

  const groups = new DisjointSet([...timexById.keys()]);
  for (const relation of relations) {
    if (relation.type === "timeOn" && timexById.has(relation.source_id) && timexById.has(relation.target_id)) {
      groups.union(relation.source_id, relation.target_id);
    }
  }

  const byValue = new Map<string, string>();
  for (const entity of timexEntities) {
    const value = normalised.get(entity.id)!;
    if (value.value === null) continue;
    const key = `${value.value}\u0000${value.precision}`;
    const previous = byValue.get(key);
    if (previous !== undefined) groups.union(previous, entity.id);
    else byValue.set(key, entity.id);
  }

  const rootMembers = new Map<string, string[]>();
  for (const entity of timexEntities) append(rootMembers, groups.find(entity.id), entity.id);
  const orderedRoots = [...rootMembers.keys()].sort(
    (left, right) => (entityOrder.get(left) ?? 0) - (entityOrder.get(right) ?? 0),
  );
  const temporaryIdByRoot = new Map(orderedRoots.map((root, index) => [root, `anchor-${String(index + 1).padStart(3, "0")}`]));
  let entityToAnchor = new Map<string, string>();
  const anchorMembers = new Map<string, string[]>();
  for (const [root, members] of rootMembers) {
    const anchorId = temporaryIdByRoot.get(root)!;
    anchorMembers.set(anchorId, members);
    for (const member of members) entityToAnchor.set(member, anchorId);
  }

  const edges = new Map([...anchorMembers.keys()].map((anchorId) => [anchorId, new Set<string>()]));
  for (const relation of relations) {
    if (!timexById.has(relation.source_id) || !timexById.has(relation.target_id)) continue;
    const sourceAnchor = entityToAnchor.get(relation.source_id)!;
    const targetAnchor = entityToAnchor.get(relation.target_id)!;
    if (sourceAnchor === targetAnchor) continue;
    if (relation.type === "timeBefore") edges.get(sourceAnchor)!.add(targetAnchor);
    else if (relation.type === "timeAfter") edges.get(targetAnchor)!.add(sourceAnchor);
  }

  const knownAnchors = [...anchorMembers.keys()]
    .filter((anchorId) => anchorMembers.get(anchorId)!.some((member) => normalised.get(member)!.sortDate !== null))
    .sort((left, right) => compareAnchor(left, right, normalised, entityOrder, anchorMembers));
  for (let index = 0; index < knownAnchors.length; index += 1) {
    const earlier = knownAnchors[index];
    const earlierDate = anchorMembers.get(earlier)!
      .map((member) => normalised.get(member)!.sortDate)
      .filter((value): value is string => value !== null)
      .sort()[0];
    for (const later of knownAnchors.slice(index + 1)) {
      const laterDate = anchorMembers.get(later)!
        .map((member) => normalised.get(member)!.sortDate)
        .filter((value): value is string => value !== null)
        .sort()[0];
      if (earlierDate < laterDate) edges.get(earlier)!.add(later);
    }
  }

  const indegree = new Map([...anchorMembers.keys()].map((anchorId) => [anchorId, 0]));
  for (const targets of edges.values()) {
    for (const target of targets) indegree.set(target, indegree.get(target)! + 1);
  }
  const available = [...indegree].filter(([, degree]) => degree === 0).map(([anchorId]) => anchorId);
  const orderedIds: string[] = [];
  while (available.length > 0) {
    available.sort((left, right) => compareAnchor(left, right, normalised, entityOrder, anchorMembers));
    const current = available.shift()!;
    orderedIds.push(current);
    for (const target of [...edges.get(current)!].sort()) {
      const degree = indegree.get(target)! - 1;
      indegree.set(target, degree);
      if (degree === 0) available.push(target);
    }
  }

  const cyclicIds = [...anchorMembers.keys()].filter((anchorId) => !orderedIds.includes(anchorId));
  if (cyclicIds.length > 0) {
    cyclicIds.sort((left, right) => compareAnchor(left, right, normalised, entityOrder, anchorMembers));
    orderedIds.push(...cyclicIds);
    warnings.push(
      warning(
        "temporal-cycle",
        "error",
        "Temporal constraints contain a cycle; affected anchors use fallback order.",
        cyclicIds.flatMap((anchorId) => anchorMembers.get(anchorId)!),
      ),
    );
  }

  const canonicalId = new Map(orderedIds.map((oldId, index) => [oldId, `time-${String(index + 1).padStart(3, "0")}`]));
  entityToAnchor = new Map([...entityToAnchor].map(([entityId, anchorId]) => [entityId, canonicalId.get(anchorId)!]));

  const anchors = orderedIds.map((oldId): TemporalAnchor => {
    const members = anchorMembers.get(oldId)!;
    const memberValues = members.map((member) => normalised.get(member)!);
    const statedValues = new Set(memberValues.flatMap((value) => (value.value === null ? [] : [value.value])));
    if (statedValues.size > 1) {
      warnings.push(warning("anchor-value-conflict", "error", "Equivalent time expressions normalised to different values.", members));
    }
    const representative = [...memberValues].sort((left, right) => {
      if ((left.value === null) !== (right.value === null)) return left.value === null ? 1 : -1;
      return (left.sortDate ?? "9999-12-31").localeCompare(right.sortDate ?? "9999-12-31");
    })[0];
    return {
      id: canonicalId.get(oldId)!,
      entity_ids: members,
      texts: members.map((member) => timexById.get(member)!.text),
      value: representative.value,
      precision: representative.precision,
      resolution: representative.resolution,
      is_dct: members.some((member) => timexById.get(member)!.is_dct),
    };
  });
  return [anchors, entityToAnchor];
}

function uniqueAnchorIds(relations: ClinicalRelation[], entityToAnchor: Map<string, string>): string[] {
  return [...new Set(relations.flatMap((relation) => {
    const anchor = entityToAnchor.get(relation.target_id);
    return anchor === undefined ? [] : [anchor];
  }))];
}

function emptyPlacement(status: TimelinePlacement["status"]): TimelinePlacement {
  return { status, start: null, end: null, point_anchor_ids: [], alternative_anchor_ids: [], evidence_relation_ids: [] };
}

function placementForEntity(
  entity: ClinicalEntity,
  relations: ClinicalRelation[],
  entityToAnchor: Map<string, string>,
  anchorIndex: Map<string, number>,
  warnings: TimelineWarning[],
): TimelinePlacement {
  const temporal = relations.filter((relation) => TEMPORAL_RELATIONS.has(relation.type));
  const usable = temporal.filter((relation) => entityToAnchor.has(relation.target_id));
  const evidenceIds = usable.map((relation) => relation.id);
  const onRelations = usable.filter((relation) => relation.type === "timeOn");
  const startRelations = usable.filter((relation) => relation.type === "timeBegin" || relation.type === "timeAfter");
  const endRelations = usable.filter((relation) => relation.type === "timeEnd" || relation.type === "timeBefore");
  const onIds = uniqueAnchorIds(onRelations, entityToAnchor);
  const startIds = uniqueAnchorIds(startRelations, entityToAnchor);
  const endIds = uniqueAnchorIds(endRelations, entityToAnchor);

  if (usable.length === 0) return emptyPlacement("unplaced");
  if (startIds.length === 0 && endIds.length === 0) {
    if (onIds.length === 1) {
      return { ...emptyPlacement("point"), point_anchor_ids: onIds, evidence_relation_ids: evidenceIds };
    }
    warnings.push(warning("multiple-point-anchors", "warning", "An entity has more than one possible point placement.", [entity.id], evidenceIds));
    return { ...emptyPlacement("ambiguous"), point_anchor_ids: onIds, alternative_anchor_ids: onIds, evidence_relation_ids: evidenceIds };
  }
  if (startIds.length > 1 || endIds.length > 1) {
    const alternatives = [...new Set([...startIds, ...endIds, ...onIds])];
    warnings.push(warning("multiple-interval-bounds", "warning", "An entity has multiple candidate interval bounds.", [entity.id], evidenceIds));
    return { ...emptyPlacement("ambiguous"), alternative_anchor_ids: alternatives, evidence_relation_ids: evidenceIds };
  }

  const startRelation = startRelations[0];
  const endRelation = endRelations[0];
  const start = startRelation
    ? { anchor_id: startIds[0], inclusive: startRelation.type === "timeBegin", relation_type: startRelation.type }
    : null;
  const end = endRelation
    ? { anchor_id: endIds[0], inclusive: endRelation.type === "timeEnd", relation_type: endRelation.type }
    : null;
  if (start && end && anchorIndex.get(start.anchor_id)! > anchorIndex.get(end.anchor_id)!) {
    warnings.push(warning("reversed-interval", "error", "An interval begins after it ends.", [entity.id], evidenceIds));
    return {
      ...emptyPlacement("conflict"),
      start,
      end,
      alternative_anchor_ids: [...new Set([...startIds, ...endIds, ...onIds])],
      evidence_relation_ids: evidenceIds,
    };
  }
  return {
    ...emptyPlacement(start && end ? "interval" : "open"),
    start,
    end,
    alternative_anchor_ids: onIds,
    evidence_relation_ids: evidenceIds,
  };
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildTimeline(input: {
  documentId: string;
  text: string;
  dct: string | null;
  entities: ClinicalEntity[];
  relations: ClinicalRelation[];
  run: RunMetadata;
  initialWarnings?: TimelineWarning[];
  sourceDigest?: string;
}): Promise<TimelineDocument> {
  const warnings = [...(input.initialWarnings ?? [])];
  const entityById = new Map(input.entities.map((entity) => [entity.id, entity]));
  const validRelations: ClinicalRelation[] = [];
  for (const relation of input.relations) {
    if (!entityById.has(relation.source_id) || !entityById.has(relation.target_id)) {
      warnings.push(warning("dangling-relation", "error", "A relation endpoint does not exist in the entity graph.", [], [relation.id]));
      continue;
    }
    if (TEMPORAL_RELATIONS.has(relation.type) && entityById.get(relation.target_id)!.label !== "TIMEX3") {
      warnings.push(warning("invalid-temporal-target", "error", "A temporal relation does not target a time expression.", [relation.target_id], [relation.id]));
      continue;
    }
    validRelations.push(relation);
  }

  const [anchors, entityToAnchor] = buildAnchors(input.entities, validRelations, input.dct, warnings);
  const anchorIndex = new Map(anchors.map((anchor, index) => [anchor.id, index]));
  const relationsFrom = new Map<string, ClinicalRelation[]>();
  for (const relation of validRelations) {
    const values = relationsFrom.get(relation.source_id) ?? [];
    values.push(relation);
    relationsFrom.set(relation.source_id, values);
  }

  const anatomyByTarget = new Map<string, string[]>();
  const modifiersByTarget = new Map<string, string[]>();
  const valuesBySource = new Map<string, string[]>();
  for (const relation of validRelations) {
    const source = entityById.get(relation.source_id)!;
    if (relation.type === "subRegion" && source.label === "a") append(anatomyByTarget, relation.target_id, relation.source_id);
    else if (relation.type === "featureSbj" || relation.type === "changeSbj") append(modifiersByTarget, relation.target_id, relation.source_id);
    else if (relation.type === "keyValue") append(valuesBySource, relation.source_id, relation.target_id);
  }

  const items = input.entities.filter((entity) => PRIMARY_LABELS.has(entity.label)).map((entity, index) => ({
    id: `item-${String(index + 1).padStart(3, "0")}`,
    entity_id: entity.id,
    text: entity.text,
    label: entity.label,
    category: CATEGORY_BY_LABEL[entity.label]!,
    attributes: entity.attributes,
    span: entity.span,
    placement: placementForEntity(entity, relationsFrom.get(entity.id) ?? [], entityToAnchor, anchorIndex, warnings),
    anatomy_ids: anatomyByTarget.get(entity.id) ?? [],
    modifier_ids: modifiersByTarget.get(entity.id) ?? [],
    value_ids: valuesBySource.get(entity.id) ?? [],
  }));
  const unplacedIds = items.filter((item) => item.placement.status === "unplaced").map((item) => item.entity_id);
  if (unplacedIds.length > 0) {
    warnings.push(warning("unplaced-evidence", "info", "Some extracted clinical evidence has no supported temporal placement.", unplacedIds));
  }

  return {
    schema_version: "1.0",
    source: {
      id: input.documentId,
      text: input.text,
      dct: input.dct,
      language: "ja",
      sha256: input.sourceDigest ?? (await sha256Hex(input.text)),
    },
    entities: input.entities,
    relations: validRelations,
    anchors,
    items,
    warnings,
    run: input.run,
  };
}

import { describe, expect, it } from "vitest";

import type { ClinicalEntity, ClinicalRelation, EntityLabel, RelationType, RunMetadata } from "../../shared/timeline";
import { buildTimeline } from "./engine";

function entity(
  index: number,
  label: EntityLabel,
  text: string,
  options: { start?: number; attributes?: Record<string, string>; isDct?: boolean } = {},
): ClinicalEntity {
  return {
    id: `ent-${String(index).padStart(3, "0")}`,
    label,
    text,
    span: options.start === undefined ? null : { start: options.start, end: options.start + Array.from(text).length },
    attributes: options.attributes ?? {},
    is_dct: options.isDct ?? false,
  };
}

function relation(index: number, type: RelationType, source: number, target: number): ClinicalRelation {
  return {
    id: `rel-${String(index).padStart(3, "0")}`,
    type,
    source_id: `ent-${String(source).padStart(3, "0")}`,
    target_id: `ent-${String(target).padStart(3, "0")}`,
  };
}

const run: RunMetadata = {
  annotator: "synthetic-fixture",
  annotator_version: "0",
  model: "none",
  phase_calls: 0,
  generated_at: "2026-07-22T00:00:00Z",
  persistence: "none",
  usage: null,
};

describe("buildTimeline", () => {
  it("builds intervals and preserves composition links", async () => {
    const timeline = await buildTimeline({
      documentId: "synthetic",
      text: "2024年1月1日に右肺の結節を認め、薬剤10mgを開始。2024年1月10日に終了。",
      dct: "2024-01-10",
      entities: [
        entity(1, "TIMEX3", "2024年1月1日", { start: 0, attributes: { type: "DATE" } }),
        entity(2, "TIMEX3", "2024年1月10日", { start: 32, attributes: { type: "DATE" } }),
        entity(3, "d", "結節", { start: 14, attributes: { certainty: "positive" } }),
        entity(4, "a", "右肺", { start: 11 }),
        entity(5, "f", "小さい"),
        entity(6, "m-key", "薬剤", { start: 20, attributes: { state: "executed" } }),
        entity(7, "m-val", "10mg", { start: 22 }),
      ],
      relations: [
        relation(1, "timeOn", 3, 1),
        relation(2, "subRegion", 4, 3),
        relation(3, "featureSbj", 5, 3),
        relation(4, "timeBegin", 6, 1),
        relation(5, "timeEnd", 6, 2),
        relation(6, "keyValue", 6, 7),
      ],
      run,
    });

    const disease = timeline.items.find((item) => item.entity_id === "ent-003")!;
    const medicine = timeline.items.find((item) => item.entity_id === "ent-006")!;
    expect(disease).toMatchObject({ category: "finding", anatomy_ids: ["ent-004"], modifier_ids: ["ent-005"] });
    expect(disease.placement.status).toBe("point");
    expect(medicine).toMatchObject({ value_ids: ["ent-007"] });
    expect(medicine.placement.status).toBe("interval");
    expect(timeline.anchors.map((anchor) => anchor.value)).toEqual(["2024-01-01", "2024-01-10"]);
  });

  it("preserves open, conflicting, and unplaced evidence", async () => {
    const open = await buildTimeline({
      documentId: "open",
      text: "synthetic",
      dct: null,
      entities: [entity(1, "TIMEX3", "2024年1月1日", { attributes: { type: "DATE" } }), entity(2, "r", "治療", { attributes: { state: "executed" } })],
      relations: [relation(1, "timeBegin", 2, 1)],
      run,
    });
    expect(open.items[0].placement).toMatchObject({ status: "open", end: null });

    const conflict = await buildTimeline({
      documentId: "conflict",
      text: "synthetic",
      dct: null,
      entities: [
        entity(1, "TIMEX3", "2024年1月1日", { attributes: { type: "DATE" } }),
        entity(2, "TIMEX3", "2024年1月10日", { attributes: { type: "DATE" } }),
        entity(3, "m-key", "薬剤", { attributes: { state: "executed" } }),
      ],
      relations: [relation(1, "timeBegin", 3, 2), relation(2, "timeEnd", 3, 1)],
      run,
    });
    expect(conflict.items[0].placement.status).toBe("conflict");
    expect(conflict.warnings.map((item) => item.code)).toContain("reversed-interval");

    const unplaced = await buildTimeline({
      documentId: "unplaced",
      text: "咳あり。",
      dct: null,
      entities: [entity(1, "d", "咳", { start: 0, attributes: { certainty: "positive" } })],
      relations: [],
      run,
    });
    expect(unplaced.items[0].placement.status).toBe("unplaced");
    expect(unplaced.warnings.map((item) => item.code)).toContain("unplaced-evidence");
  });
});

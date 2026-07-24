import { describe, expect, it } from "vitest";

import type { ClinicalEntity, ClinicalRelation, RunMetadata, TimelineDocument } from "../../shared/timeline";
import { buildTimeline } from "./engine";

const run: RunMetadata = {
  annotator: "synthetic-fixture",
  annotator_version: "0",
  model: "none",
  phase_calls: 0,
  generated_at: "2026-07-22T00:00:00Z",
  persistence: "none",
  usage: null,
};

const entities: ClinicalEntity[] = [
  { id: "ent-001", label: "TIMEX3", text: "2024年1月1日", span: { start: 0, end: 9 }, attributes: { type: "DATE" }, is_dct: false },
  { id: "ent-002", label: "TIMEX3", text: "2024年1月10日", span: { start: 32, end: 42 }, attributes: { type: "DATE" }, is_dct: false },
  { id: "ent-003", label: "d", text: "結節", span: { start: 14, end: 16 }, attributes: { certainty: "positive" }, is_dct: false },
  { id: "ent-004", label: "a", text: "右肺", span: { start: 11, end: 13 }, attributes: {}, is_dct: false },
  { id: "ent-005", label: "f", text: "小さい", span: null, attributes: {}, is_dct: false },
  { id: "ent-006", label: "m-key", text: "薬剤", span: { start: 20, end: 22 }, attributes: { state: "executed" }, is_dct: false },
  { id: "ent-007", label: "m-val", text: "10mg", span: { start: 22, end: 26 }, attributes: {}, is_dct: false },
];
const relations: ClinicalRelation[] = [
  { id: "rel-001", type: "timeOn", source_id: "ent-003", target_id: "ent-001" },
  { id: "rel-002", type: "subRegion", source_id: "ent-004", target_id: "ent-003" },
  { id: "rel-003", type: "featureSbj", source_id: "ent-005", target_id: "ent-003" },
  { id: "rel-004", type: "timeBegin", source_id: "ent-006", target_id: "ent-001" },
  { id: "rel-005", type: "timeEnd", source_id: "ent-006", target_id: "ent-002" },
  { id: "rel-006", type: "keyValue", source_id: "ent-006", target_id: "ent-007" },
];

interface FixtureInput {
  document_id: string;
  text: string;
  dct: string | null;
  entities: ClinicalEntity[];
  relations: ClinicalRelation[];
  run: RunMetadata;
}

async function buildFixtureTimeline(input: FixtureInput): Promise<TimelineDocument> {
  return buildTimeline({
    documentId: input.document_id,
    text: input.text,
    dct: input.dct,
    entities: input.entities,
    relations: input.relations,
    run: input.run,
  });
}

describe("frozen timeline reference fixtures", () => {
  it("preserves the verified interval contract", async () => {
    const input: FixtureInput = {
      document_id: "synthetic",
      text: "2024年1月1日に右肺の結節を認め、薬剤10mgを開始。2024年1月10日に終了。",
      dct: "2024-01-10",
      entities,
      relations,
      run,
    };

    expect(await buildFixtureTimeline(input)).toMatchSnapshot();
  });

  it("matches open, conflicting, unplaced, partial, relative, and cyclic evidence", async () => {
    const cases: FixtureInput[] = [
      {
        document_id: "open",
        text: "synthetic",
        dct: null,
        entities: [
          { id: "ent-001", label: "TIMEX3", text: "2024年1月1日", span: null, attributes: { type: "DATE" }, is_dct: false },
          { id: "ent-002", label: "r", text: "治療", span: null, attributes: { state: "executed" }, is_dct: false },
        ],
        relations: [{ id: "rel-001", type: "timeBegin", source_id: "ent-002", target_id: "ent-001" }],
        run,
      },
      {
        document_id: "conflict",
        text: "synthetic",
        dct: null,
        entities: [
          { id: "ent-001", label: "TIMEX3", text: "2024年1月1日", span: null, attributes: { type: "DATE" }, is_dct: false },
          { id: "ent-002", label: "TIMEX3", text: "2024年1月10日", span: null, attributes: { type: "DATE" }, is_dct: false },
          { id: "ent-003", label: "m-key", text: "薬剤", span: null, attributes: { state: "executed" }, is_dct: false },
        ],
        relations: [
          { id: "rel-001", type: "timeBegin", source_id: "ent-003", target_id: "ent-002" },
          { id: "rel-002", type: "timeEnd", source_id: "ent-003", target_id: "ent-001" },
        ],
        run,
      },
      {
        document_id: "unplaced",
        text: "咳あり。",
        dct: null,
        entities: [
          { id: "ent-001", label: "d", text: "咳", span: { start: 0, end: 1 }, attributes: { certainty: "positive" }, is_dct: false },
        ],
        relations: [],
        run,
      },
      {
        document_id: "partial-relative-cycle",
        text: "synthetic",
        dct: "2024-02-01",
        entities: [
          { id: "ent-001", label: "TIMEX3", text: "2024年1月", span: null, attributes: { type: "DATE" }, is_dct: false },
          { id: "ent-002", label: "TIMEX3", text: "1月10日", span: null, attributes: { type: "DATE" }, is_dct: false },
          { id: "ent-003", label: "TIMEX3", text: "3日前", span: null, attributes: { type: "DATE" }, is_dct: false },
          { id: "ent-004", label: "d", text: "所見", span: null, attributes: { certainty: "positive" }, is_dct: false },
        ],
        relations: [
          { id: "rel-001", type: "timeBefore", source_id: "ent-001", target_id: "ent-002" },
          { id: "rel-002", type: "timeBefore", source_id: "ent-002", target_id: "ent-001" },
          { id: "rel-003", type: "timeOn", source_id: "ent-004", target_id: "ent-003" },
        ],
        run,
      },
    ];

    for (const input of cases) {
      expect(await buildFixtureTimeline(input), input.document_id).toMatchSnapshot();
    }
  });
});

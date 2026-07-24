import { describe, expect, it } from "vitest";

import { normaliseTimex } from "./normalise";

describe("normaliseTimex", () => {
  it("normalises full and partial Japanese dates", () => {
    expect(normaliseTimex("2024年1月10日", "DATE", null)).toMatchObject({
      value: "2024-01-10",
      precision: "day",
    });
    expect(normaliseTimex("2024年1月", "DATE", null)).toMatchObject({
      value: "2024-01",
      precision: "month",
    });
    expect(normaliseTimex("2024年", "DATE", null)).toMatchObject({
      value: "2024",
      precision: "year",
    });
  });

  it("resolves relative dates only from an explicit DCT", () => {
    expect(normaliseTimex("3日前", "DATE", "2024-01-10")).toMatchObject({
      value: "2024-01-07",
      resolution: "dct-inferred",
    });
    expect(normaliseTimex("3日前", "DATE", null)).toMatchObject({
      value: null,
      resolution: "unresolved",
    });
  });

  it("does not assign an unstated year to month-day expressions", () => {
    expect(normaliseTimex("1月10日", "DATE", "2024-02-01")).toMatchObject({
      value: "--01-10",
      precision: "month-day",
      sortDate: null,
    });
  });

  it("preserves the verified month and leap-year clamping behaviour", () => {
    expect(normaliseTimex("1か月後", "DATE", "2024-01-31").value).toBe("2024-02-29");
    expect(normaliseTimex("1年後", "DATE", "2024-02-29").value).toBe("2025-02-28");
  });
});

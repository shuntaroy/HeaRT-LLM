import type { ResolutionMethod, TemporalPrecision } from "../../shared/timeline";

export interface NormalisedTimex {
  value: string | null;
  precision: TemporalPrecision;
  resolution: ResolutionMethod;
  sortDate: string | null;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function safeDate(year: number, month: number, day: number): DateParts | null {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(year, month - 1, day);
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function parseIsoDate(value: string | null): DateParts | null {
  if (value === null) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match
    ? safeDate(Number(match[1]), Number(match[2]), Number(match[3]))
    : null;
}

function daysInMonth(year: number, month: number): number {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(year, month, 0);
  return value.getUTCDate();
}

function isoDate(value: DateParts): string {
  return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function shiftDays(value: DateParts, days: number): DateParts {
  const shifted = new Date(0);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCFullYear(value.year, value.month - 1, value.day + days);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function shiftMonths(value: DateParts, months: number): DateParts {
  const absoluteMonth = value.year * 12 + value.month - 1 + months;
  const year = Math.floor(absoluteMonth / 12);
  const month = ((absoluteMonth % 12) + 12) % 12 + 1;
  return {
    year,
    month,
    day: Math.min(value.day, daysInMonth(year, month)),
  };
}

function shiftYears(value: DateParts, years: number): DateParts {
  const year = value.year + years;
  return {
    year,
    month: value.month,
    day: Math.min(value.day, daysInMonth(year, value.month)),
  };
}

function resolved(value: DateParts, resolution: ResolutionMethod): NormalisedTimex {
  const iso = isoDate(value);
  return { value: iso, precision: "day", resolution, sortDate: iso };
}

export function normaliseTimex(
  text: string,
  timexType: string | null,
  dct: string | null,
  isDct = false,
): NormalisedTimex {
  const compact = text
    .replace(/[０-９]/g, (digit) => String("０１２３４５６７８９".indexOf(digit)))
    .replace(/\s+/gu, "");
  const parsedDct = parseIsoDate(dct);

  if (isDct && parsedDct !== null) return resolved(parsedDct, "stated");

  const fullDatePatterns = [
    /(?<!\d)(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/u,
    /(?<!\d)(\d{4})年(\d{1,2})月(\d{1,2})日/u,
  ];
  for (const pattern of fullDatePatterns) {
    const match = pattern.exec(compact);
    if (match) {
      const value = safeDate(Number(match[1]), Number(match[2]), Number(match[3]));
      if (value !== null) return resolved(value, "stated");
    }
  }

  const monthMatch = /(?<!\d)(\d{4})年(\d{1,2})月(?!\d)/u.exec(compact);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (month >= 1 && month <= 12) {
      const value = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
      return { value, precision: "month", resolution: "stated", sortDate: `${value}-01` };
    }
  }

  const yearMatch = /(?<!\d)(\d{4})年(?!\d)/u.exec(compact);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    if (year >= 1 && year <= 9999) {
      const value = String(year).padStart(4, "0");
      return { value, precision: "year", resolution: "stated", sortDate: `${value}-01-01` };
    }
  }

  const monthDayMatch = /(?<!\d)(\d{1,2})月(\d{1,2})日/u.exec(compact);
  if (monthDayMatch) {
    const month = Number(monthDayMatch[1]);
    const day = Number(monthDayMatch[2]);
    if (safeDate(2000, month, day) !== null) {
      return {
        value: `--${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        precision: "month-day",
        resolution: "stated",
        sortDate: null,
      };
    }
  }

  const relativeDays = new Map<string, number>([
    ["一昨日", -2],
    ["昨日", -1],
    ["前日", -1],
    ["本日", 0],
    ["今日", 0],
    ["現在", 0],
    ["明日", 1],
    ["翌日", 1],
    ["明後日", 2],
  ]);
  if (parsedDct !== null) {
    for (const [expression, offset] of relativeDays) {
      if (compact.includes(expression)) return resolved(shiftDays(parsedDct, offset), "dct-inferred");
    }
  }

  const relativeMatch = /(\d+)(日|週間|週|か月|ヶ月|箇月|月|年)(前|後)/u.exec(compact);
  if (relativeMatch && parsedDct !== null) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    const direction = relativeMatch[3] === "前" ? -1 : 1;
    let value: DateParts;
    if (unit === "日") value = shiftDays(parsedDct, direction * amount);
    else if (unit === "週間" || unit === "週") value = shiftDays(parsedDct, direction * amount * 7);
    else if (["か月", "ヶ月", "箇月", "月"].includes(unit)) value = shiftMonths(parsedDct, direction * amount);
    else value = shiftYears(parsedDct, direction * amount);
    return resolved(value, "dct-inferred");
  }

  const precisionByType: Record<string, TemporalPrecision> = {
    TIME: "time",
    DURATION: "duration",
    SET: "set",
    AGE: "age",
    MED: "medical",
    MISC: "misc",
  };
  return {
    value: null,
    precision: precisionByType[timexType ?? ""] ?? "unknown",
    resolution: "unresolved",
    sortDate: null,
  };
}

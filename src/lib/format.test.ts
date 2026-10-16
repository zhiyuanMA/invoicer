import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatMoney,
  formatPercentFromBps,
  formatQuantity,
  todayInAuckland,
} from "./format";

describe("formatDate", () => {
  it("formats ISO dates as DD/MM/YYYY", () => {
    expect(formatDate("2026-10-16")).toBe("16/10/2026");
    expect(formatDate("2026-01-05")).toBe("05/01/2026");
  });
});

describe("todayInAuckland", () => {
  it("uses the Auckland calendar day, not UTC", () => {
    // 2026-06-30 23:00 UTC is already 1 July 11:00 in NZ (UTC+12 in winter)
    expect(todayInAuckland(new Date("2026-06-30T23:00:00Z"))).toBe("2026-07-01");
    // 2026-12-31 12:00 UTC is 1 January 01:00 in NZ (UTC+13 in summer)
    expect(todayInAuckland(new Date("2026-12-31T12:00:00Z"))).toBe("2027-01-01");
  });
});

describe("formatMoney", () => {
  it("formats NZD with two decimals and thousands separators", () => {
    expect(formatMoney(123456, "NZD")).toContain("1,234.56");
    expect(formatMoney(5, "NZD")).toContain("0.05");
  });

  it("falls back for an invalid currency code", () => {
    expect(formatMoney(1050, "ZZZZ")).toBe("ZZZZ 10.50");
  });
});

describe("formatQuantity and formatPercentFromBps", () => {
  it("drops trailing zeros", () => {
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(1.5)).toBe("1.5");
    expect(formatQuantity(0.125)).toBe("0.125");
    expect(formatPercentFromBps(1500)).toBe("15");
    expect(formatPercentFromBps(750)).toBe("7.5");
  });
});

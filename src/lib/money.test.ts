import { describe, expect, it } from "vitest";
import { computeTotals, lineAmountCents, roundDiv } from "./money";

describe("roundDiv", () => {
  it("rounds half away from zero", () => {
    expect(roundDiv(5, 10)).toBe(1);
    expect(roundDiv(4, 10)).toBe(0);
    expect(roundDiv(-5, 10)).toBe(-1);
    expect(roundDiv(-4, 10)).toBe(0);
    expect(roundDiv(15, 10)).toBe(2);
  });

  it("rejects a non-positive denominator", () => {
    expect(() => roundDiv(1, 0)).toThrow(RangeError);
  });
});

describe("lineAmountCents", () => {
  it("multiplies quantity by unit price", () => {
    expect(lineAmountCents({ quantity: 3, unitPriceCents: 1050 })).toBe(3150);
  });

  it("supports fractional quantities", () => {
    expect(lineAmountCents({ quantity: 1.5, unitPriceCents: 1999 })).toBe(2999); // 2998.5 -> 2999
    expect(lineAmountCents({ quantity: 0.1, unitPriceCents: 300 })).toBe(30);
  });

  it("applies a percentage discount", () => {
    expect(lineAmountCents({ quantity: 2, unitPriceCents: 5000, discountPercent: 10 })).toBe(9000);
    expect(lineAmountCents({ quantity: 1, unitPriceCents: 999, discountPercent: 12.5 })).toBe(874);
  });

  it("returns null when quantity or unit price is missing", () => {
    expect(lineAmountCents({ unitPriceCents: 1000 })).toBeNull();
    expect(lineAmountCents({ quantity: 2 })).toBeNull();
    expect(lineAmountCents({ quantity: null, unitPriceCents: null })).toBeNull();
    expect(lineAmountCents({})).toBeNull();
  });

  it("treats zero as a set value", () => {
    expect(lineAmountCents({ quantity: 0, unitPriceCents: 1000 })).toBe(0);
    expect(lineAmountCents({ quantity: 2, unitPriceCents: 0 })).toBe(0);
  });

  it("supports negative unit prices (credits)", () => {
    expect(lineAmountCents({ quantity: 1, unitPriceCents: -2500 })).toBe(-2500);
  });
});

describe("computeTotals", () => {
  it("adds 15% GST on GST-exclusive prices", () => {
    const t = computeTotals([{ quantity: 2, unitPriceCents: 10000 }]);
    expect(t).toMatchObject({
      subtotalCents: 20000,
      gstCents: 3000,
      totalCents: 23000,
      hasTotals: true,
    });
  });

  it("extracts GST from GST-inclusive prices", () => {
    const t = computeTotals([{ quantity: 1, unitPriceCents: 11500 }], { pricesIncludeGst: true });
    expect(t).toMatchObject({ subtotalCents: 10000, gstCents: 1500, totalCents: 11500 });
  });

  it("keeps total equal to the entered amount for inclusive prices", () => {
    const t = computeTotals([{ quantity: 1, unitPriceCents: 9999 }], { pricesIncludeGst: true });
    expect(t.totalCents).toBe(9999);
    expect(t.subtotalCents + t.gstCents).toBe(9999);
  });

  it("calculates GST on the sum, not per line", () => {
    // 3 x 0.33 + GST: per-line rounding would give 3 x 0.05 = 0.15, sum-based gives 0.15 on 0.99 = 0.1485 -> 0.15
    const lines = Array.from({ length: 3 }, () => ({ quantity: 1, unitPriceCents: 33 }));
    expect(computeTotals(lines).gstCents).toBe(15);
    const many = Array.from({ length: 10 }, () => ({ quantity: 1, unitPriceCents: 3 }));
    // per-line GST rounds 0.45 -> 0 each; summed it is 30 * 0.15 = 4.5 -> 5
    expect(computeTotals(many).gstCents).toBe(5);
  });

  it("excludes lines that are not GST applicable from GST", () => {
    const t = computeTotals([
      { quantity: 1, unitPriceCents: 10000 },
      { quantity: 1, unitPriceCents: 5000, gstApplicable: false },
    ]);
    expect(t).toMatchObject({ subtotalCents: 15000, gstCents: 1500, totalCents: 16500 });
  });

  it("handles non-GST lines on GST-inclusive invoices", () => {
    const t = computeTotals(
      [
        { quantity: 1, unitPriceCents: 11500 },
        { quantity: 1, unitPriceCents: 5000, gstApplicable: false },
      ],
      { pricesIncludeGst: true },
    );
    expect(t).toMatchObject({ subtotalCents: 15000, gstCents: 1500, totalCents: 16500 });
  });

  it("skips incomplete lines but still returns them", () => {
    const t = computeTotals([
      { quantity: 1, unitPriceCents: 10000 },
      { quantity: 5 },
      { unitPriceCents: 9999 },
    ]);
    expect(t.lines.map((l) => l.amountCents)).toEqual([10000, null, null]);
    expect(t).toMatchObject({ subtotalCents: 10000, gstCents: 1500, totalCents: 11500 });
  });

  it("reports no totals when nothing can be calculated", () => {
    expect(computeTotals([])).toMatchObject({ hasTotals: false, totalCents: 0 });
    expect(computeTotals([{ quantity: 1 }, {}])).toMatchObject({ hasTotals: false, totalCents: 0 });
  });

  it("respects a custom GST rate, including 0", () => {
    expect(
      computeTotals([{ quantity: 1, unitPriceCents: 10000 }], { gstRateBps: 0 }),
    ).toMatchObject({
      gstCents: 0,
      totalCents: 10000,
    });
    expect(
      computeTotals([{ quantity: 1, unitPriceCents: 10000 }], { gstRateBps: 1000 }).gstCents,
    ).toBe(1000);
  });

  it("avoids floating point drift", () => {
    // 0.1 + 0.2 style cases stay exact in integer cents
    const t = computeTotals([
      { quantity: 1, unitPriceCents: 10 },
      { quantity: 1, unitPriceCents: 20 },
    ]);
    expect(t.subtotalCents).toBe(30);
  });
});

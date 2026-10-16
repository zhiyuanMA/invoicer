/**
 * Money and GST calculation.
 *
 * All amounts are integer cents; rates are basis points (1500 = 15%).
 * Rounding is half away from zero.
 *
 * Rules:
 * - A line only participates in calculation when both quantity and unit price are set.
 *   Other lines are still returned (so they can be rendered) with `amountCents: null`.
 * - GST is calculated once on the sum of GST-applicable lines, not per line,
 *   so rounding does not drift with the number of lines.
 */

export const DEFAULT_GST_RATE_BPS = 1500;

export type LineInput = {
  quantity?: number | null;
  unitPriceCents?: number | null;
  /** 0-100, up to 2 decimals */
  discountPercent?: number | null;
  /** Defaults to true */
  gstApplicable?: boolean;
};

export type LineResult = {
  /** Amount after discount, as entered (GST-inclusive or exclusive depending on the invoice). */
  amountCents: number | null;
};

export type InvoiceTotals = {
  lines: LineResult[];
  /** True when at least one line participates in the calculation. */
  hasTotals: boolean;
  /** Total excluding GST. */
  subtotalCents: number;
  gstCents: number;
  /** Total including GST. */
  totalCents: number;
};

export type TotalsOptions = {
  gstRateBps?: number;
  pricesIncludeGst?: boolean;
};

/** Integer division rounded half away from zero. */
export function roundDiv(numerator: number, denominator: number): number {
  if (denominator <= 0) throw new RangeError("denominator must be positive");
  const abs = Math.abs(numerator);
  const q = Math.floor(abs / denominator);
  const r = abs - q * denominator;
  const rounded = r * 2 >= denominator ? q + 1 : q;
  return numerator < 0 && rounded !== 0 ? -rounded : rounded;
}

function isSet(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** quantity (up to 3 decimals) x unit price, minus discount (up to 2 decimals). */
export function lineAmountCents(line: LineInput): number | null {
  if (!isSet(line.quantity) || !isSet(line.unitPriceCents)) return null;
  const quantityMilli = Math.round(line.quantity * 1000);
  const gross = roundDiv(quantityMilli * Math.round(line.unitPriceCents), 1000);
  const discountBps = isSet(line.discountPercent) ? Math.round(line.discountPercent * 100) : 0;
  return roundDiv(gross * (10000 - discountBps), 10000);
}

export function computeTotals(
  lines: LineInput[],
  { gstRateBps = DEFAULT_GST_RATE_BPS, pricesIncludeGst = false }: TotalsOptions = {},
): InvoiceTotals {
  const results: LineResult[] = [];
  let taxable = 0;
  let nonTaxable = 0;
  let hasTotals = false;

  for (const line of lines) {
    const amountCents = lineAmountCents(line);
    results.push({ amountCents });
    if (amountCents === null) continue;
    hasTotals = true;
    if (line.gstApplicable ?? true) taxable += amountCents;
    else nonTaxable += amountCents;
  }

  if (!hasTotals) {
    return { lines: results, hasTotals, subtotalCents: 0, gstCents: 0, totalCents: 0 };
  }

  let gstCents: number;
  let subtotalCents: number;
  if (pricesIncludeGst) {
    gstCents = roundDiv(taxable * gstRateBps, 10000 + gstRateBps);
    subtotalCents = taxable - gstCents + nonTaxable;
  } else {
    gstCents = roundDiv(taxable * gstRateBps, 10000);
    subtotalCents = taxable + nonTaxable;
  }

  return {
    lines: results,
    hasTotals,
    subtotalCents,
    gstCents,
    totalCents: subtotalCents + gstCents,
  };
}

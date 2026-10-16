import type { CSSProperties } from "react";
import { FONT_STACKS, type FontId } from "@/lib/design";
import { formatMoney, formatPercentFromBps, formatQuantity } from "@/lib/format";
import { computeTotals } from "@/lib/money";
import type { Invoice } from "@/lib/schemas/invoice";

export type LineView = {
  description?: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  /** Empty when the line does not count towards the totals. */
  amount: string;
};

export type InvoiceView = {
  title: string;
  lines: LineView[];
  hasDiscount: boolean;
  /** Null when no line counts towards the totals. */
  totals: { subtotal: string; gst: string; gstLabel: string; total: string } | null;
};

/**
 * What every template shows, worked out once: which lines appear, and every amount as text.
 * Templates only decide how it looks.
 */
export function buildView(invoice: Invoice): InvoiceView {
  const money = (cents: number) => formatMoney(cents, invoice.currency);
  const totals = computeTotals(invoice.lines, {
    gstRateBps: invoice.gstRateBps,
    pricesIncludeGst: invoice.pricesIncludeGst,
  });

  const lines: LineView[] = [];
  invoice.lines.forEach((line, index) => {
    // Lines with nothing filled in are skipped; partly filled ones are shown without an amount.
    if (
      line.description === undefined &&
      line.quantity === undefined &&
      line.unitPriceCents === undefined
    ) {
      return;
    }
    const amount = totals.lines[index]?.amountCents ?? null;
    lines.push({
      description: line.description,
      quantity: line.quantity !== undefined ? formatQuantity(line.quantity) : "",
      unitPrice: line.unitPriceCents !== undefined ? money(line.unitPriceCents) : "",
      discount: line.discountPercent ? `${line.discountPercent}%` : "",
      amount: amount !== null ? money(amount) : "",
    });
  });

  return {
    title: invoice.title ?? "Invoice",
    lines,
    hasDiscount: lines.some((line) => line.discount !== ""),
    totals: totals.hasTotals
      ? {
          subtotal: money(totals.subtotalCents),
          gst: money(totals.gstCents),
          gstLabel: `GST (${formatPercentFromBps(invoice.gstRateBps)}%)`,
          total: money(totals.totalCents),
        }
      : null,
  };
}

/**
 * The root element's style: the accent colour (as a CSS variable the template's CSS uses) and the
 * font. Each falls back to the template's own default. The accent is validated as a plain hex
 * colour by the invoice schema.
 */
export function themeStyle(
  invoice: Invoice,
  defaults: { accent: string; font: FontId },
): CSSProperties {
  return {
    ["--accent" as string]: invoice.accentColor ?? defaults.accent,
    fontFamily: FONT_STACKS[invoice.font ?? defaults.font],
  };
}

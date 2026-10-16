import { describe, expect, it } from "vitest";
import { invoiceSchema } from "./invoice";

const minimal = { seller: { name: "Acme Ltd" }, buyer: { name: "Jane" } };

describe("invoiceSchema", () => {
  it("accepts an invoice with only seller and buyer names", () => {
    const result = invoiceSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("NZD");
      expect(result.data.gstRateBps).toBe(1500);
      expect(result.data.pricesIncludeGst).toBe(false);
      expect(result.data.lines).toEqual([]);
      expect(result.data.number).toBeUndefined();
    }
  });

  it("requires seller and buyer names", () => {
    expect(invoiceSchema.safeParse({ seller: { name: "" }, buyer: { name: "Jane" } }).success).toBe(
      false,
    );
    expect(
      invoiceSchema.safeParse({ seller: { name: "Acme" }, buyer: { name: "  " } }).success,
    ).toBe(false);
    expect(invoiceSchema.safeParse({ seller: { name: "Acme" } }).success).toBe(false);
  });

  it("treats empty strings as not provided", () => {
    const result = invoiceSchema.parse({
      ...minimal,
      number: "",
      issueDate: "",
      currency: "",
      notes: "   ",
      lines: [{ description: "", quantity: "", unitPriceCents: "" }],
    });
    expect(result.number).toBeUndefined();
    expect(result.issueDate).toBeUndefined();
    expect(result.currency).toBe("NZD");
    expect(result.notes).toBeUndefined();
    expect(result.lines[0]).toEqual({ gstApplicable: true });
  });

  it("keeps the invoice number as a free-form string", () => {
    expect(invoiceSchema.parse({ ...minimal, number: " INV-2026/001-A " }).number).toBe(
      "INV-2026/001-A",
    );
  });

  it("validates dates", () => {
    expect(invoiceSchema.safeParse({ ...minimal, issueDate: "2026-02-30" }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...minimal, issueDate: "16/10/2026" }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...minimal, issueDate: "2026-10-16" }).success).toBe(true);
  });

  it("normalises the currency code", () => {
    expect(invoiceSchema.parse({ ...minimal, currency: "aud" }).currency).toBe("AUD");
    expect(invoiceSchema.safeParse({ ...minimal, currency: "NZ" }).success).toBe(false);
  });

  it("allows partially filled line items", () => {
    const result = invoiceSchema.parse({
      ...minimal,
      lines: [{ quantity: 2 }, { unitPriceCents: 500 }, {}],
    });
    expect(result.lines).toHaveLength(3);
  });

  it("rejects out-of-range discounts and fractional cents", () => {
    expect(invoiceSchema.safeParse({ ...minimal, lines: [{ discountPercent: 101 }] }).success).toBe(
      false,
    );
    expect(invoiceSchema.safeParse({ ...minimal, lines: [{ unitPriceCents: 10.5 }] }).success).toBe(
      false,
    );
  });
});

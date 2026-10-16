import { describe, expect, it } from "vitest";
import { invoiceSchema } from "./schemas/invoice";
import {
  defaultFormValues,
  dollarsToCents,
  parseNumber,
  toInvoiceInput,
  toPreviewInput,
} from "./invoice-form";

describe("dollarsToCents", () => {
  it("converts dollars typed by the user to integer cents", () => {
    expect(dollarsToCents("12.50")).toBe(1250);
    expect(dollarsToCents("12")).toBe(1200);
    expect(dollarsToCents("1.15")).toBe(115); // 1.15 * 100 is 114.99999... in floating point
    expect(dollarsToCents("0.07")).toBe(7);
    expect(dollarsToCents("-5")).toBe(-500);
    expect(dollarsToCents(" 3.00 ")).toBe(300);
  });

  it("treats empty input as not provided", () => {
    expect(dollarsToCents("")).toBeUndefined();
    expect(dollarsToCents("   ")).toBeUndefined();
  });

  it("returns NaN for invalid input so validation reports it", () => {
    expect(dollarsToCents("abc")).toBeNaN();
    expect(dollarsToCents("1.234")).toBeNaN();
    expect(dollarsToCents("1,000")).toBeNaN();
  });
});

describe("parseNumber", () => {
  it("parses numbers and keeps empty as undefined", () => {
    expect(parseNumber("2.5")).toBe(2.5);
    expect(parseNumber("")).toBeUndefined();
    expect(parseNumber("x")).toBeNaN();
  });
});

describe("toInvoiceInput", () => {
  it("rejects an empty form because the names are required", () => {
    expect(invoiceSchema.safeParse(toInvoiceInput(defaultFormValues())).success).toBe(false);
  });

  it("produces a valid invoice from a minimal form", () => {
    const values = defaultFormValues();
    values.seller.name = "Acme";
    values.buyer.name = "Jane";
    const result = invoiceSchema.safeParse(toInvoiceInput(values));
    expect(result.success).toBe(true);
  });

  it("maps a filled line item", () => {
    const values = defaultFormValues();
    values.seller.name = "Acme";
    values.buyer.name = "Jane";
    values.lines = [
      {
        description: "Work",
        quantity: "2",
        unitPrice: "10.50",
        discountPercent: "10",
        gstApplicable: true,
      },
    ];
    const result = invoiceSchema.parse(toInvoiceInput(values));
    expect(result.lines[0]).toMatchObject({
      quantity: 2,
      unitPriceCents: 1050,
      discountPercent: 10,
    });
  });

  it("reports a bad number instead of silently ignoring it", () => {
    const values = defaultFormValues();
    values.seller.name = "Acme";
    values.buyer.name = "Jane";
    values.lines[0].quantity = "two";
    expect(invoiceSchema.safeParse(toInvoiceInput(values)).success).toBe(false);
  });
});

describe("toPreviewInput", () => {
  it("is valid even before the names are typed", () => {
    expect(invoiceSchema.safeParse(toPreviewInput(defaultFormValues())).success).toBe(true);
  });

  it("uses the real names once typed", () => {
    const values = defaultFormValues();
    values.seller.name = "Acme";
    const parsed = invoiceSchema.parse(toPreviewInput(values));
    expect(parsed.seller.name).toBe("Acme");
  });

  it("ignores half-typed numbers and currency codes", () => {
    const values = defaultFormValues();
    values.currency = "N";
    values.lines[0].quantity = "2.";
    values.lines[0].unitPrice = "abc";
    const parsed = invoiceSchema.safeParse(toPreviewInput(values));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.currency).toBe("NZD");
      expect(parsed.data.lines[0].unitPriceCents).toBeUndefined();
    }
  });
});

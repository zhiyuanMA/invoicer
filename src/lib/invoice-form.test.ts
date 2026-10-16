import { describe, expect, it } from "vitest";
import { invoiceSchema } from "./schemas/invoice";
import {
  centsToDollars,
  defaultFormValues,
  invoiceToFormValues,
  newInvoiceFormValues,
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

describe("centsToDollars", () => {
  it("formats integer cents as dollars with two decimals", () => {
    expect(centsToDollars(1250)).toBe("12.50");
    expect(centsToDollars(100)).toBe("1.00");
    expect(centsToDollars(7)).toBe("0.07");
    expect(centsToDollars(0)).toBe("0.00");
    expect(centsToDollars(-500)).toBe("-5.00");
    expect(centsToDollars(-5)).toBe("-0.05");
  });

  it("is the inverse of dollarsToCents", () => {
    for (const cents of [0, 1, 99, 100, 1234, -1234, 100_000_000]) {
      expect(dollarsToCents(centsToDollars(cents))).toBe(cents);
    }
  });
});

describe("invoiceToFormValues", () => {
  it("round-trips a fully filled invoice", () => {
    const invoice = invoiceSchema.parse({
      template: "modern",
      accentColor: "#d97706",
      font: "serif",
      title: "Tax Invoice",
      number: "INV-1",
      issueDate: "2026-10-01",
      dueDate: "2026-10-20",
      currency: "AUD",
      pricesIncludeGst: true,
      seller: {
        name: "Acme",
        address: "1 St",
        email: "a@b.co",
        phone: "1",
        nzbn: "9",
        gstNumber: "8",
      },
      buyer: { name: "Jane", address: "2 St", email: "j@b.co", nzbn: "7" },
      paymentDetails: "Bank",
      notes: "Hi",
      lines: [
        {
          description: "Work",
          quantity: 2.5,
          unitPriceCents: 1999,
          discountPercent: 12.5,
          gstApplicable: false,
        },
        { description: "Partial", quantity: 1 },
        {},
      ],
    });
    expect(invoiceSchema.parse(toInvoiceInput(invoiceToFormValues(invoice)))).toEqual(invoice);
  });

  it("round-trips a minimal invoice", () => {
    const invoice = invoiceSchema.parse({ seller: { name: "A" }, buyer: { name: "B" } });
    expect(invoiceSchema.parse(toInvoiceInput(invoiceToFormValues(invoice)))).toEqual(invoice);
  });
});

describe("newInvoiceFormValues", () => {
  it("prefills the seller and payment details, and leaves the rest empty", () => {
    const values = newInvoiceFormValues({ name: "Acme", gstNumber: "123", paymentDetails: "Bank" });
    expect(values.seller).toMatchObject({ name: "Acme", gstNumber: "123", address: "" });
    expect(values.paymentDetails).toBe("Bank");
    expect(values.buyer.name).toBe("");
    expect(values.lines).toHaveLength(1);
  });

  it("keeps the design choices", () => {
    const values = defaultFormValues();
    values.seller.name = "A";
    values.buyer.name = "B";
    values.template = "minimal";
    values.accentColor = "#2563EB";
    values.font = "mono";
    expect(invoiceSchema.parse(toInvoiceInput(values))).toMatchObject({
      template: "minimal",
      accentColor: "#2563eb",
      font: "mono",
    });
  });

  it("falls back to the default look for a half-typed accent colour in the preview", () => {
    const values = defaultFormValues();
    values.accentColor = "#25";
    const parsed = invoiceSchema.safeParse(toPreviewInput(values));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.accentColor).toBeUndefined();
  });
});

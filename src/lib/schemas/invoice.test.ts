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

  it("limits the number of line items", () => {
    const lines = Array.from({ length: 201 }, () => ({}));
    expect(invoiceSchema.safeParse({ ...minimal, lines }).success).toBe(false);
  });

  it("accepts decimal quantities and discounts despite floating point", () => {
    const lines = [
      { quantity: 1.1, discountPercent: 0.07 },
      { quantity: 0.3, discountPercent: 12.5 },
      { quantity: 2.675, discountPercent: 33.33 },
    ];
    expect(invoiceSchema.safeParse({ ...minimal, lines }).success).toBe(true);
  });

  it("limits quantity and unit price so calculations stay exact", () => {
    expect(invoiceSchema.safeParse({ ...minimal, lines: [{ quantity: 100001 }] }).success).toBe(
      false,
    );
    expect(
      invoiceSchema.safeParse({ ...minimal, lines: [{ unitPriceCents: 100_000_001 }] }).success,
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({
        ...minimal,
        lines: [{ quantity: 100000, unitPriceCents: 100_000_000 }],
      }).success,
    ).toBe(true);
  });
});

describe("invoice design fields", () => {
  const base = { seller: { name: "A" }, buyer: { name: "B" } };

  it("defaults to the classic template, with no accent colour or font chosen", () => {
    const parsed = invoiceSchema.parse(base);
    expect(parsed.template).toBe("classic");
    expect(parsed.font).toBeUndefined();
    expect(parsed.accentColor).toBeUndefined();
  });

  it("accepts known templates and fonts, and lower-cases the colour", () => {
    const parsed = invoiceSchema.parse({
      ...base,
      template: "modern",
      font: "serif",
      accentColor: "#2563EB",
    });
    expect(parsed).toMatchObject({ template: "modern", font: "serif", accentColor: "#2563eb" });
  });

  it("treats empty design fields as not provided", () => {
    const parsed = invoiceSchema.parse({ ...base, template: "", font: "", accentColor: "" });
    expect(parsed.template).toBe("classic");
    expect(parsed.font).toBeUndefined();
    expect(parsed.accentColor).toBeUndefined();
  });

  it("rejects unknown templates and fonts", () => {
    expect(invoiceSchema.safeParse({ ...base, template: "fancy" }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...base, font: "comic" }).success).toBe(false);
  });

  it("rejects anything but a plain hex colour, so nothing can be injected into CSS", () => {
    for (const bad of [
      "red",
      "#fff",
      "#12345",
      "#1234567",
      "2563eb",
      "#gggggg",
      "#2563eb;background:url(https://evil.example)",
      "#2563eb}</style><script>alert(1)</script>",
      "url(x)",
      "rgb(0,0,0)",
    ]) {
      expect(invoiceSchema.safeParse({ ...base, accentColor: bad }).success, bad).toBe(false);
    }
  });
});

import { describe, expect, it } from "vitest";
import { invoiceSchema } from "./schemas/invoice";
import { pdfFileName, renderInvoiceHtml } from "./pdf";

const parse = (input: unknown) => invoiceSchema.parse(input);
const base = { seller: { name: "Acme Ltd" }, buyer: { name: "Jane" } };

describe("renderInvoiceHtml", () => {
  it("escapes user input", () => {
    const html = renderInvoiceHtml(
      parse({
        seller: { name: '<script>alert("x")</script>' },
        buyer: { name: "<img src=x onerror=alert(1)>" },
        notes: "</div><iframe src=file:///etc/passwd>",
        lines: [{ description: "<b>bold</b>", quantity: 1, unitPriceCents: 100 }],
      }),
    );
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders the buyer NZBN only when provided", () => {
    const withNzbn = renderInvoiceHtml(
      parse({ seller: { name: "Acme" }, buyer: { name: "Jane", nzbn: "9429000000001" } }),
    );
    expect(withNzbn).toContain("NZBN 9429000000001");
    expect(renderInvoiceHtml(parse(base))).not.toContain("NZBN");
  });

  it("omits fields that were not provided", () => {
    const html = renderInvoiceHtml(parse(base));
    expect(html).not.toContain("Number");
    expect(html).not.toContain("Due");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("Subtotal");
    expect(html).not.toContain("Payment details");
  });

  it("renders totals, dates and the title", () => {
    const html = renderInvoiceHtml(
      parse({
        ...base,
        title: "Tax Invoice",
        number: "INV-001",
        issueDate: "2026-10-16",
        lines: [{ description: "Work", quantity: 2, unitPriceCents: 10000 }],
      }),
    );
    expect(html).toContain("Tax Invoice");
    expect(html).toContain("INV-001");
    expect(html).toContain("16/10/2026");
    expect(html).toContain("$200.00");
    expect(html).toContain("$30.00"); // 15% GST
    expect(html).toContain("$230.00");
  });

  it("shows incomplete lines without an amount and excludes them from totals", () => {
    const html = renderInvoiceHtml(
      parse({
        ...base,
        lines: [
          { description: "Counted", quantity: 1, unitPriceCents: 10000 },
          { description: "No price", quantity: 5 },
        ],
      }),
    );
    expect(html).toContain("No price");
    expect(html).toContain("$115.00");
  });
});

describe("pdfFileName", () => {
  it("builds a safe file name from the invoice number", () => {
    expect(pdfFileName(parse({ ...base, number: "INV-2026/001" }))).toBe(
      "invoice-INV-2026-001.pdf",
    );
    expect(pdfFileName(parse({ ...base, number: '../"; evil' }))).toBe("invoice-..-evil.pdf");
    expect(pdfFileName(parse(base))).toBe("invoice.pdf");
  });
});

describe("renderInvoiceHtml with templates", () => {
  it("renders the template chosen in the invoice", () => {
    expect(renderInvoiceHtml(parse({ ...base, template: "modern" }))).toContain("inv-modern");
    expect(renderInvoiceHtml(parse({ ...base, template: "minimal" }))).toContain("inv-minimal");
    expect(renderInvoiceHtml(parse(base))).toContain("inv-classic");
  });
});

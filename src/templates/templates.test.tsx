import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FONT_STACKS, TEMPLATE_IDS } from "@/lib/design";
import { invoiceSchema } from "@/lib/schemas/invoice";
import { templates } from "./index";

const parse = (input: unknown) => invoiceSchema.parse(input);
const base = { seller: { name: "Acme Ltd" }, buyer: { name: "Jane" } };
const render = (id: (typeof TEMPLATE_IDS)[number], input: unknown) => {
  const { Component } = templates[id];
  return renderToStaticMarkup(<Component invoice={parse(input)} />);
};

const full = {
  ...base,
  title: "Tax Invoice",
  number: "INV-001",
  issueDate: "2026-10-16",
  dueDate: "2026-11-20",
  seller: { name: "Acme Ltd", gstNumber: "123-456-789", nzbn: "9429000000000" },
  buyer: { name: "Jane", nzbn: "9429000000001" },
  paymentDetails: "Bank 12-3456",
  notes: "Thanks",
  lines: [
    { description: "Design", quantity: 2, unitPriceCents: 10000, discountPercent: 10 },
    { description: "No price", quantity: 1 },
  ],
};

describe("every template", () => {
  it("is registered for every template id", () => {
    expect(Object.keys(templates).sort()).toEqual([...TEMPLATE_IDS].sort());
  });

  for (const id of TEMPLATE_IDS) {
    describe(id, () => {
      it("shows the invoice details, dates, parties and totals", () => {
        const html = render(id, full);
        for (const text of [
          "Tax Invoice",
          "INV-001",
          "16/10/2026",
          "20/11/2026",
          "Acme Ltd",
          "123-456-789",
          "9429000000000",
          "9429000000001",
          "Design",
          "No price",
          "$180.00", // 2 x $100 less 10%
          "$27.00", // 15% GST
          "$207.00",
          "Bank 12-3456",
          "Thanks",
          "10%",
        ]) {
          expect(html, text).toContain(text);
        }
      });

      it("omits what was not provided", () => {
        const html = render(id, base);
        for (const text of ["Number", "Due", "<table", "Subtotal", "Payment details", "Notes"]) {
          expect(html, text).not.toContain(text);
        }
        expect(html).toContain("Invoice"); // default title
      });

      it("escapes user input", () => {
        const html = render(id, {
          seller: { name: "<script>alert(1)</script>" },
          buyer: { name: "<img src=x onerror=alert(1)>" },
          notes: "</div><iframe src=file:///etc/passwd>",
          lines: [{ description: "<b>bold</b>", quantity: 1, unitPriceCents: 100 }],
        });
        expect(html).not.toContain("<script>alert");
        expect(html).not.toContain("<img src=x");
        expect(html).not.toContain("<iframe");
        expect(html).not.toContain("<b>bold</b>");
      });

      it("uses the chosen accent colour and font", () => {
        const html = render(id, { ...base, accentColor: "#dc2626", font: "serif" });
        expect(html).toContain("--accent:#dc2626");
        expect(html).toContain("Georgia");
      });

      it("uses its own accent colour when none is chosen", () => {
        const html = render(id, base);
        expect(html).toContain(`--accent:${templates[id].defaultAccent}`);
        expect(html).toContain(FONT_STACKS[templates[id].defaultFont].split(",")[0]);
      });
    });
  }
});

describe("templates differ", () => {
  it("each has its own root class, so styles never leak between them", () => {
    const roots = TEMPLATE_IDS.map((id) => render(id, base).match(/class="(inv-[a-z]+)"/)?.[1]);
    expect(new Set(roots).size).toBe(TEMPLATE_IDS.length);
  });
});

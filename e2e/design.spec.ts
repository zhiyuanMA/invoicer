import { createInvoice, expect, field, fontSelect, preview, test } from "./helpers";

const TEMPLATES = ["classic", "modern", "minimal", "bold", "sky"] as const;

test.describe("choosing a design", () => {
  test("offers every template and shows each one in the preview", async ({ page }) => {
    await page.goto("/invoices/new");
    await expect(field(page, "seller.name")).toBeVisible();
    await expect(page.locator('input[name="template"]')).toHaveCount(TEMPLATES.length);
    for (const id of TEMPLATES) {
      await page.locator(`label:visible:has(input[value="${id}"])`).click();
      await expect(preview(page)).toHaveClass(new RegExp(`inv-${id}`));
    }
  });

  test("applies an accent colour, and each template falls back to its own", async ({ page }) => {
    await page.goto("/invoices/new");
    await expect(field(page, "seller.name")).toBeVisible();
    await page.getByLabel("Use #dc2626").click();
    await expect(preview(page)).toHaveAttribute("style", /--accent: #dc2626/);
    await page.getByRole("button", { name: "Use the template's colour" }).click();
    await expect(preview(page)).toHaveAttribute("style", /--accent: #1f2937/); // classic
    await page.locator('label:visible:has(input[value="modern"])').click();
    await expect(preview(page)).toHaveAttribute("style", /--accent: #2563eb/);
  });

  test("uses the template's own font unless one is chosen", async ({ page }) => {
    await page.goto("/invoices/new");
    await expect(field(page, "seller.name")).toBeVisible();
    await page.locator('label:visible:has(input[value="sky"])').click();
    await expect(preview(page)).toHaveAttribute("style", /Georgia/);
    await expect(fontSelect(page).locator("option").first()).toHaveText("Template default (Serif)");

    await fontSelect(page).selectOption("mono");
    await expect(preview(page)).toHaveAttribute("style", /Courier/);
    await fontSelect(page).selectOption("");
    await expect(preview(page)).toHaveAttribute("style", /Georgia/);

    await page.locator('label:visible:has(input[value="bold"])').click();
    await expect(fontSelect(page).locator("option").first()).toHaveText(
      "Template default (Sans-serif)",
    );
  });

  test("keeps the design after saving and reloading", async ({ page }) => {
    await createInvoice(page, {
      buyer: "Jane",
      number: "D-1",
      template: "bold",
      accent: "#059669",
    });
    await fontSelect(page).selectOption("serif");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.locator('input[value="bold"]')).toBeChecked();
    await expect(fontSelect(page)).toHaveValue("serif");
    await expect(preview(page)).toHaveClass(/inv-bold/);
    await expect(preview(page)).toHaveAttribute("style", /#059669/);
    await expect(preview(page)).toHaveAttribute("style", /Georgia/);
  });

  for (const id of TEMPLATES) {
    test(`renders a PDF with the ${id} template`, async ({ page }) => {
      const url = await createInvoice(page, { buyer: "Jane", number: `T-${id}`, template: id });
      const response = await page.request.get(`/api/invoices/${url.split("/").pop()}/pdf`);
      expect(response.status()).toBe(200);
      expect((await response.body()).subarray(0, 4).toString()).toBe("%PDF");
    });
  }
});

import { readFileSync } from "node:fs";
import { createInvoice, expect, field, preview, test } from "./helpers";

test.describe("creating and saving an invoice", () => {
  test("shows a live preview with placeholders, and will not save without the names", async ({
    page,
  }) => {
    await page.goto("/invoices/new");
    await expect(field(page, "seller.name")).toBeVisible();
    await expect(preview(page)).toContainText("Your company");
    await expect(preview(page)).toContainText("Client name");

    await field(page, "seller.name").fill("Acme Ltd");
    await expect(preview(page)).toContainText("Acme Ltd");

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Fix the highlighted fields first")).toBeVisible();
    await expect(page.getByText("Required")).toBeVisible();
    expect(page.url()).toMatch(/\/invoices\/new$/);
  });

  test("defaults the issue date to today", async ({ page }) => {
    await page.goto("/invoices/new");
    await expect(field(page, "issueDate")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("calculates GST in the preview and treats incomplete lines as not counting", async ({
    page,
  }) => {
    await page.goto("/invoices/new");
    await expect(field(page, "seller.name")).toBeVisible();
    await field(page, "lines.0.description").fill("Consulting");
    await field(page, "lines.0.quantity").fill("2");
    await field(page, "lines.0.unitPrice").fill("100");
    await expect(preview(page)).toContainText("$200.00");
    await expect(preview(page)).toContainText("$30.00");
    await expect(preview(page)).toContainText("$230.00");

    await page.getByRole("button", { name: "Add line" }).click();
    await field(page, "lines.1.description").fill("No price yet");
    await field(page, "lines.1.quantity").fill("5");
    await expect(preview(page)).toContainText("No price yet");
    await expect(preview(page)).toContainText("$230.00"); // unchanged

    await field(page, "lines.0.quantity").fill("two");
    await expect(page.getByText("Must be a number")).toBeVisible();
  });

  test("keeps an invoice after a reload, and saves edits", async ({ page }) => {
    await createInvoice(page, {
      buyer: "Jane Smith",
      number: "INV-1",
      quantity: "2",
      unitPrice: "100",
    });
    await page.reload();
    await expect(field(page, "buyer.name")).toHaveValue("Jane Smith");
    await expect(field(page, "lines.0.unitPrice")).toHaveValue("100.00");
    await expect(page.getByRole("heading", { name: "Edit invoice" })).toBeVisible();

    await field(page, "number").fill("INV-2");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(field(page, "number")).toHaveValue("INV-2");
  });

  test("shows the saved invoice in the list with its total", async ({ page }) => {
    await createInvoice(page, {
      buyer: "Jane Smith",
      number: "INV-1",
      quantity: "2",
      unitPrice: "100",
    });
    await page.goto("/");
    const row = page.getByRole("row", { name: /INV-1/ });
    await expect(row).toContainText("Jane Smith");
    await expect(row).toContainText("$230.00");
  });

  test("shows a not-found page for an invoice that does not exist", async ({ page }) => {
    await page.goto("/invoices/00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("This page could not be found")).toBeVisible();
  });
});

test.describe("downloading a PDF", () => {
  test("downloads a PDF of an unsaved invoice, named after its number", async ({ page }) => {
    await page.goto("/invoices/new");
    await expect(field(page, "seller.name")).toBeVisible();
    await field(page, "seller.name").fill("Acme Ltd");
    await field(page, "buyer.name").fill("Jane");
    await field(page, "number").fill("INV-7");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download PDF" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("invoice-INV-7.pdf");
    expect(
      readFileSync(await download.path())
        .subarray(0, 4)
        .toString(),
    ).toBe("%PDF");
  });

  test("serves the PDF of a saved invoice from the list", async ({ page }) => {
    const url = await createInvoice(page, { buyer: "Jane", number: "INV-9" });
    const id = url.split("/").pop();
    const response = await page.request.get(`/api/invoices/${id}/pdf`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toContain("invoice-INV-9.pdf");
    expect((await response.body()).subarray(0, 4).toString()).toBe("%PDF");
  });
});

test.describe("duplicating and deleting", () => {
  test("duplicates an invoice as a new draft without its number", async ({ page }) => {
    await createInvoice(page, { buyer: "Jane", number: "INV-1", template: "modern" });
    await page.goto("/");
    await page
      .getByRole("row", { name: /INV-1/ })
      .getByRole("button", { name: "Duplicate" })
      .click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/);
    await expect(field(page, "number")).toHaveValue("");
    await expect(field(page, "buyer.name")).toHaveValue("Jane");
    await expect(preview(page)).toHaveClass(/inv-modern/);
    await expect(page.locator('select[aria-label="Status"]:visible')).toHaveValue("draft");
  });

  test("deletes an invoice after confirmation", async ({ page }) => {
    await createInvoice(page, { buyer: "Jane", number: "INV-1" });
    await page.goto("/");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("row", { name: /INV-1/ }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("No invoices yet")).toBeVisible();
  });

  test("keeps an invoice when the confirmation is cancelled", async ({ page }) => {
    await createInvoice(page, { buyer: "Jane", number: "INV-1" });
    await page.goto("/");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("row", { name: /INV-1/ }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("row", { name: /INV-1/ })).toBeVisible();
  });
});

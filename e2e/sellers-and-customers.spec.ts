import { createInvoice, expect, field, preview, test } from "./helpers";

async function addSeller(
  page: import("@playwright/test").Page,
  seller: { label?: string; name: string; gst?: string; payment?: string },
) {
  await page.goto("/sellers/new");
  await expect(field(page, "name")).toBeVisible();
  if (seller.label) await field(page, "label").fill(seller.label);
  await field(page, "name").fill(seller.name);
  if (seller.gst) await field(page, "gstNumber").fill(seller.gst);
  if (seller.payment) await field(page, "paymentDetails").fill(seller.payment);
  await page.getByRole("button", { name: "Save seller" }).click();
  await page.waitForURL(/\/sellers$/);
}

test.describe("sellers", () => {
  test("starts empty, and a new invoice has an empty seller", async ({ page }) => {
    await page.goto("/sellers");
    await expect(page.getByText("No sellers yet")).toBeVisible();
    await page.goto("/invoices/new");
    await expect(field(page, "seller.name")).toHaveValue("");
    await expect(page.getByLabel("Saved seller")).toContainText("No saved sellers yet");
  });

  test("requires a name", async ({ page }) => {
    await page.goto("/sellers/new");
    await page.getByRole("button", { name: "Save seller" }).click();
    await expect(page.getByText("Required")).toBeVisible();
    expect(page.url()).toMatch(/\/sellers\/new$/);
  });

  test("the first seller is the default, and a label falls back to the name", async ({ page }) => {
    await addSeller(page, { label: "Acme - Consulting", name: "Acme Ltd" });
    await addSeller(page, { name: "Beta Ltd" });
    const rows = page.getByRole("listitem");
    await expect(rows.first()).toContainText("Acme - Consulting");
    await expect(rows.first()).toContainText("Default");
    await expect(rows.nth(1)).toContainText("Beta Ltd");
    await expect(rows.nth(1)).not.toContainText("Default");
  });

  test("prefills a new invoice from the default seller, and the picker switches seller", async ({
    page,
  }) => {
    await addSeller(page, { name: "Acme Ltd", gst: "111-111-111", payment: "Bank ACME" });
    await addSeller(page, { name: "Beta Ltd", gst: "222-222-222", payment: "Bank BETA" });

    await page.goto("/invoices/new");
    await expect(field(page, "seller.name")).toHaveValue("Acme Ltd");
    await expect(field(page, "seller.gstNumber")).toHaveValue("111-111-111");
    await expect(field(page, "paymentDetails")).toHaveValue("Bank ACME");

    await page.getByLabel("Saved seller").selectOption({ label: "Beta Ltd" });
    await expect(field(page, "seller.name")).toHaveValue("Beta Ltd");
    await expect(field(page, "seller.gstNumber")).toHaveValue("222-222-222");
    await expect(field(page, "paymentDetails")).toHaveValue("Bank BETA");
    await expect(preview(page)).toContainText("Beta Ltd");
  });

  test("keeps exactly one default when it is changed", async ({ page }) => {
    await addSeller(page, { name: "Acme Ltd" });
    await addSeller(page, { name: "Beta Ltd" });
    await page
      .getByRole("listitem")
      .filter({ hasText: "Beta Ltd" })
      .getByRole("button", { name: "Make default" })
      .click();
    await expect(page.getByRole("listitem").first()).toContainText("Beta Ltd");
    await expect(page.getByText("Default", { exact: true })).toHaveCount(1);

    await page.goto("/invoices/new");
    await expect(field(page, "seller.name")).toHaveValue("Beta Ltd");
  });

  test("leaves no default when the default seller is deleted", async ({ page }) => {
    await addSeller(page, { name: "Acme Ltd" });
    await addSeller(page, { name: "Beta Ltd" });
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("listitem")
      .filter({ hasText: "Acme Ltd" })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByText("Default", { exact: true })).toHaveCount(0);

    await page.goto("/invoices/new");
    await expect(field(page, "seller.name")).toHaveValue("");
  });

  test("editing or deleting a seller never changes a saved invoice", async ({ page }) => {
    await addSeller(page, { name: "Acme Ltd", gst: "111-111-111" });
    await page.goto("/invoices/new");
    await expect(field(page, "seller.name")).toHaveValue("Acme Ltd");
    await field(page, "buyer.name").fill("Jane");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/);
    const invoiceUrl = page.url();

    await page.goto("/sellers");
    await page.getByRole("link", { name: "Edit" }).click();
    await field(page, "name").fill("Renamed Ltd");
    await page.getByRole("button", { name: "Save seller" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    await page.goto("/sellers");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("No sellers yet")).toBeVisible();

    await page.goto(invoiceUrl);
    await expect(field(page, "seller.name")).toHaveValue("Acme Ltd");
    await expect(field(page, "seller.gstNumber")).toHaveValue("111-111-111");
  });

  test("shows a not-found page for a seller that does not exist", async ({ page }) => {
    await page.goto("/sellers/00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("This page could not be found")).toBeVisible();
  });
});

test.describe("customers", () => {
  test("adds a customer from the customers page", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.getByText("No saved customers yet")).toBeVisible();
    await page.getByRole("link", { name: "Add customer" }).click();
    await page.waitForURL(/\/customers\/new$/);

    await page.getByRole("button", { name: "Save customer" }).click();
    await expect(page.getByText("Required")).toBeVisible();
    expect(page.url()).toMatch(/\/customers\/new$/);

    await field(page, "name").fill("Jane Smith");
    await field(page, "address").fill("2 Lambton Quay");
    await field(page, "email").fill("jane@example.com");
    await field(page, "nzbn").fill("9429000000001");
    await page.getByRole("button", { name: "Save customer" }).click();
    await page.waitForURL(/\/customers$/);
    const item = page.getByRole("listitem").filter({ hasText: "Jane Smith" });
    await expect(item).toContainText("2 Lambton Quay");
    await expect(item).toContainText("jane@example.com");
    await expect(item).toContainText("NZBN 9429000000001");

    // and it can be chosen on a new invoice
    await page.goto("/invoices/new");
    await page.getByLabel("Saved customer").selectOption({ label: "Jane Smith" });
    await expect(field(page, "buyer.name")).toHaveValue("Jane Smith");
    await expect(field(page, "buyer.email")).toHaveValue("jane@example.com");
  });

  test("saves the buyer as a customer, picks them on a new invoice, and deletes them", async ({
    page,
  }) => {
    await page.goto("/invoices/new");
    await expect(field(page, "buyer.name")).toBeVisible();
    await page.getByRole("button", { name: "Save as customer" }).click();
    await expect(page.getByText("Enter the buyer name first")).toBeVisible();

    await field(page, "buyer.name").fill("Jane Smith");
    await field(page, "buyer.nzbn").fill("9429000000001");
    await page.getByRole("button", { name: "Save as customer" }).click();
    await expect(page.getByText("Customer saved")).toBeVisible();

    await page.goto("/invoices/new");
    await page.getByLabel("Saved customer").selectOption({ label: "Jane Smith" });
    await expect(field(page, "buyer.name")).toHaveValue("Jane Smith");
    await expect(field(page, "buyer.nzbn")).toHaveValue("9429000000001");

    await page.goto("/customers");
    await expect(page.getByText("NZBN 9429000000001")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("No saved customers yet")).toBeVisible();
  });

  test("deleting a customer does not change an invoice that used them", async ({ page }) => {
    await page.goto("/invoices/new");
    await expect(field(page, "buyer.name")).toBeVisible();
    await field(page, "buyer.name").fill("Jane Smith");
    await page.getByRole("button", { name: "Save as customer" }).click();
    await expect(page.getByText("Customer saved")).toBeVisible();
    const url = await createInvoice(page, { buyer: "Jane Smith", number: "C-1" });

    await page.goto("/customers");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("No saved customers yet")).toBeVisible();

    await page.goto(url);
    await expect(field(page, "buyer.name")).toHaveValue("Jane Smith");
  });
});

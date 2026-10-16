import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { resetDatabase } from "./db";

/** Every test starts with an empty database. */
export const test = base.extend<{ clean: void }>({
  clean: [
    async ({}, use) => {
      await resetDatabase();
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/**
 * A form field by its name attribute. With cacheComponents, Next.js keeps the previous page
 * mounted but hidden, so only visible fields count.
 */
export function field(page: Page, name: string): Locator {
  return page.locator(`[name="${name}"]:visible`);
}

/** The invoice template currently shown in the live preview. */
export function preview(page: Page): Locator {
  return page.locator('[class^="inv-"]:visible').first();
}

export type NewInvoice = {
  seller?: string;
  buyer: string;
  number?: string;
  dueDate?: string;
  template?: string;
  accent?: string;
  quantity?: string;
  unitPrice?: string;
};

/** Creates and saves an invoice through the UI, and returns its address. */
export async function createInvoice(page: Page, invoice: NewInvoice): Promise<string> {
  await page.goto("/invoices/new");
  await expect(field(page, "seller.name")).toBeVisible();
  await field(page, "seller.name").fill(invoice.seller ?? "Acme Ltd");
  await field(page, "buyer.name").fill(invoice.buyer);
  if (invoice.number) await field(page, "number").fill(invoice.number);
  if (invoice.dueDate) await field(page, "dueDate").fill(invoice.dueDate);
  await field(page, "lines.0.description").fill("Work");
  await field(page, "lines.0.quantity").fill(invoice.quantity ?? "1");
  await field(page, "lines.0.unitPrice").fill(invoice.unitPrice ?? "100");
  if (invoice.template)
    await page.locator(`label:visible:has(input[value="${invoice.template}"])`).click();
  if (invoice.accent) await page.getByLabel(`Use ${invoice.accent}`).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/);
  await expect(field(page, "number")).toBeVisible();
  return page.url();
}

/** The font picker on the page being shown (the page left behind stays mounted but hidden). */
export function fontSelect(page: Page): Locator {
  return page.locator('select[name="font"]:visible');
}

/**
 * Changes an invoice's status and waits until the server has stored it. The change is a Server
 * Action, so reloading straight away could cancel it half way.
 */
export async function changeStatus(select: Locator, value: string): Promise<void> {
  await Promise.all([
    select
      .page()
      .waitForResponse(
        (response) =>
          response.request().method() === "POST" && "next-action" in response.request().headers(),
      ),
    select.selectOption(value),
  ]);
  await expect(select).toBeEnabled();
}

import { changeStatus, createInvoice, expect, test } from "./helpers";

// Fixed dates far in the past and future, so these tests never depend on today's date.
const PAST = "2020-01-01";
const FUTURE = "2099-01-01";

function statusSelect(page: import("@playwright/test").Page, row: RegExp) {
  return page.getByRole("row", { name: row }).locator('select[aria-label="Status"]');
}

async function listedNumbers(page: import("@playwright/test").Page): Promise<string[]> {
  const cells = page.locator("tbody tr:visible td:first-child");
  return (await cells.allInnerTexts()).map((text) => text.trim()).sort();
}

test.describe("status", () => {
  test("starts as a draft, and a sent invoice past its due date shows as overdue", async ({
    page,
  }) => {
    await createInvoice(page, { buyer: "Jane", number: "INV-1", dueDate: PAST });
    await expect(page.locator('select[aria-label="Status"]:visible')).toHaveValue("draft");

    await page.goto("/");
    const select = statusSelect(page, /INV-1/);
    await expect(select).toHaveValue("draft");
    await changeStatus(select, "sent");
    await expect(select).toHaveValue("overdue");
    await page.reload();
    await expect(statusSelect(page, /INV-1/)).toHaveValue("overdue");

    await changeStatus(statusSelect(page, /INV-1/), "paid");
    await page.reload();
    await expect(statusSelect(page, /INV-1/)).toHaveValue("paid");
  });

  test("a sent invoice that is not yet due, or has no due date, is not overdue", async ({
    page,
  }) => {
    await createInvoice(page, { buyer: "Bob", number: "INV-2", dueDate: FUTURE });
    await createInvoice(page, { buyer: "Cara", number: "INV-3" });
    await page.goto("/");
    await changeStatus(statusSelect(page, /INV-2/), "sent");
    await changeStatus(statusSelect(page, /INV-3/), "sent");
    await page.reload();
    await expect(statusSelect(page, /INV-2/)).toHaveValue("sent");
    await expect(statusSelect(page, /INV-3/)).toHaveValue("sent");
  });

  test("can be changed from the editor, and editing the invoice keeps it", async ({ page }) => {
    const url = await createInvoice(page, { buyer: "Jane", number: "INV-1" });
    await changeStatus(page.locator('select[aria-label="Status"]:visible'), "paid");
    await page.reload();
    await expect(page.locator('select[aria-label="Status"]:visible')).toHaveValue("paid");

    await page.locator('[name="notes"]:visible').fill("Edited");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.goto(url);
    await expect(page.locator('select[aria-label="Status"]:visible')).toHaveValue("paid");
  });
});

test.describe("filtering the list", () => {
  test.beforeEach(async ({ page }) => {
    await createInvoice(page, { buyer: "Jane Smith", number: "INV-1", dueDate: PAST }); // sent, overdue
    await createInvoice(page, { buyer: "Bob Brown", number: "INV-2", dueDate: FUTURE }); // sent
    await createInvoice(page, { buyer: "Cara Jones", number: "INV-3" }); // draft
    await createInvoice(page, { buyer: "Dan Lee", number: "INV-4", dueDate: PAST }); // paid
    await page.goto("/");
    await changeStatus(statusSelect(page, /INV-1/), "sent");
    await changeStatus(statusSelect(page, /INV-2/), "sent");
    await changeStatus(statusSelect(page, /INV-4/), "paid");
    await page.reload();
    await expect(statusSelect(page, /INV-4/)).toHaveValue("paid");
  });

  test("shows everything by default", async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => listedNumbers(page)).toEqual(["INV-1", "INV-2", "INV-3", "INV-4"]);
  });

  test("filters by status, and the tabs do not overlap", async ({ page }) => {
    await page.goto("/?status=overdue");
    await expect.poll(() => listedNumbers(page)).toEqual(["INV-1"]);
    await page.goto("/?status=sent");
    await expect.poll(() => listedNumbers(page)).toEqual(["INV-2"]);
    await page.goto("/?status=paid");
    await expect.poll(() => listedNumbers(page)).toEqual(["INV-4"]);
    await page.goto("/?status=draft");
    await expect.poll(() => listedNumbers(page)).toEqual(["INV-3"]);
  });

  test("searches the buyer name and the number", async ({ page }) => {
    await page.goto("/?q=jones");
    await expect.poll(() => listedNumbers(page)).toEqual(["INV-3"]);
    await page.goto("/?q=INV-2");
    await expect.poll(() => listedNumbers(page)).toEqual(["INV-2"]);
    await page.goto("/?q=nobody");
    await expect(page.getByText("No invoices match this filter.")).toBeVisible();
  });

  test("combines a tab and the search box through the address", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Sent", exact: true }).click();
    await page.waitForURL(/status=sent/);
    await page.getByPlaceholder("Search number or buyer").fill("bob");
    await page.getByRole("button", { name: "Search" }).click();
    await page.waitForURL(/q=bob/);
    expect(page.url()).toContain("status=sent");
    await expect.poll(() => listedNumbers(page)).toEqual(["INV-2"]);
    await expect(page.locator("a[aria-current='page']")).toHaveText("Sent");

    await page.getByRole("link", { name: "Clear" }).click();
    await page.waitForURL((url) => !url.search.includes("q="));
    await expect.poll(() => listedNumbers(page)).toEqual(["INV-2"]);
  });

  test("ignores an unknown status", async ({ page }) => {
    await page.goto("/?status=bogus");
    await expect.poll(() => listedNumbers(page)).toHaveLength(4);
  });
});

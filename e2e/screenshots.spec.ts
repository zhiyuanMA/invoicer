import { changeStatus, expect, field, preview, test } from "./helpers";

/**
 * Regenerates the README screenshots in docs/images with made-up demo data:
 *   npm run screenshots
 */
test.use({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });

const TEMPLATES = ["classic", "modern", "minimal", "bold", "sky"] as const;

type Demo = {
  buyer: string;
  address: string;
  number: string;
  issue: string;
  due: string;
  template: (typeof TEMPLATES)[number];
  status: "draft" | "sent" | "paid";
  lines: Array<[string, string, string]>;
};

const DEMOS: Demo[] = [
  {
    buyer: "Harbour Café Ltd",
    address: "12 Quay Street\nAuckland 1010",
    number: "INV-1042",
    issue: "2026-09-01",
    due: "2026-09-15",
    template: "modern",
    status: "sent", // past its due date, so it shows as overdue
    lines: [
      ["Brand identity design", "1", "1800"],
      ["Menu layout", "2", "240"],
      ["Signage artwork", "1", "420"],
    ],
  },
  {
    buyer: "Southern Alps Tours",
    address: "5 Lakeview Terrace\nQueenstown 9300",
    number: "INV-1043",
    issue: "2026-10-05",
    due: "2026-11-05",
    template: "classic",
    status: "sent",
    lines: [
      ["Website refresh", "1", "3200"],
      ["Photography licence", "1", "650"],
    ],
  },
  {
    buyer: "Kauri Books",
    address: "88 Cuba Street\nWellington 6011",
    number: "INV-1041",
    issue: "2026-08-12",
    due: "2026-09-12",
    template: "minimal",
    status: "paid",
    lines: [["Catalogue design", "1", "2100"]],
  },
  {
    buyer: "Pōhutukawa Pottery",
    address: "3 Karaka Road\nNelson 7010",
    number: "INV-1044",
    issue: "2026-10-14",
    due: "2026-11-14",
    template: "sky",
    status: "draft",
    lines: [
      ["Packaging concept", "1", "950"],
      ["Product labels", "4", "85"],
    ],
  },
];

test("@screenshots README screenshots", async ({ page }) => {
  // A seller, so every invoice starts with the seller details filled in
  await page.goto("/sellers/new");
  await field(page, "label").fill("Kiwi Design");
  await field(page, "name").fill("Kiwi Design Ltd");
  await field(page, "address").fill("21 Ponsonby Road\nAuckland 1011");
  await field(page, "email").fill("hello@kiwidesign.example");
  await field(page, "phone").fill("09 555 0123");
  await field(page, "nzbn").fill("9429000000000");
  await field(page, "gstNumber").fill("123-456-789");
  await field(page, "paymentDetails").fill("Kiwi Design Ltd\nBank account 12-3456-7890123-00");
  await page.getByRole("button", { name: "Save seller" }).click();
  await page.waitForURL(/\/sellers$/);

  for (const demo of DEMOS) {
    await page.goto("/invoices/new");
    await expect(field(page, "seller.name")).toHaveValue("Kiwi Design Ltd");
    await field(page, "buyer.name").fill(demo.buyer);
    await field(page, "buyer.address").fill(demo.address);
    await field(page, "number").fill(demo.number);
    await field(page, "issueDate").fill(demo.issue);
    await field(page, "dueDate").fill(demo.due);
    await field(page, "notes").fill("Thank you for your business. Payment is due within 30 days.");
    for (const [index, [description, quantity, price]] of demo.lines.entries()) {
      if (index > 0) await page.getByRole("button", { name: "Add line" }).click();
      await field(page, `lines.${index}.description`).fill(description);
      await field(page, `lines.${index}.quantity`).fill(quantity);
      await field(page, `lines.${index}.unitPrice`).fill(price);
    }
    await page.locator(`label:visible:has(input[value="${demo.template}"])`).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/);
    await expect(field(page, "number")).toBeVisible();
  }

  // The list, with a mix of statuses
  await page.goto("/");
  for (const demo of DEMOS) {
    if (demo.status === "draft") continue;
    const select = page.getByRole("row", { name: new RegExp(demo.number) }).locator("select");
    await changeStatus(select, demo.status);
  }
  await page.reload();
  await expect(page.getByRole("row", { name: /INV-1042/ }).locator("select")).toHaveValue(
    "overdue",
  );
  await page.screenshot({ path: "docs/images/invoice-list.png" });

  // The editor with its live preview
  await page.getByRole("link", { name: "INV-1042" }).click();
  await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/);
  await expect(field(page, "number")).toHaveValue("INV-1042");
  await page.mouse.move(0, 0);
  await page.screenshot({ path: "docs/images/editor.png" });

  // Each template, from the same invoice
  for (const id of TEMPLATES) {
    await page.locator(`label:visible:has(input[value="${id}"])`).click();
    await expect(preview(page)).toHaveClass(new RegExp(`inv-${id}`));
    await preview(page).screenshot({ path: `docs/images/template-${id}.png` });
  }
});

import { createInvoice, expect, field, test } from "./helpers";

const XSS = `<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>`;

test.describe("untrusted text", () => {
  test("is shown as text, never run, in the editor, the preview and the list", async ({ page }) => {
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });

    const url = await createInvoice(page, { buyer: XSS, seller: XSS, number: "X-1" });
    await page.locator('[name="notes"]:visible').fill(XSS);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    await page.goto(url);
    await expect(field(page, "buyer.name")).toHaveValue(XSS);
    await page.goto("/");
    await expect(page.getByRole("row", { name: /X-1/ })).toContainText("<img src=x");

    expect(
      await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
    ).toBeUndefined();
    expect(dialogs).toEqual([]);
  });

  test("renders into a PDF as text", async ({ page }) => {
    const url = await createInvoice(page, { buyer: XSS, number: "X-2" });
    const response = await page.request.get(`/api/invoices/${url.split("/").pop()}/pdf`);
    expect(response.status()).toBe(200);
    expect((await response.body()).subarray(0, 4).toString()).toBe("%PDF");
  });
});

test.describe("the PDF endpoint", () => {
  const valid = { seller: { name: "A" }, buyer: { name: "B" } };

  test("renders a valid invoice", async ({ request }) => {
    const response = await request.post("/api/pdf", { data: valid });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
  });

  test("rejects other methods", async ({ request }) => {
    expect((await request.get("/api/pdf")).status()).toBe(405);
    expect((await request.put("/api/pdf", { data: valid })).status()).toBe(405);
  });

  test("rejects an invoice without the required names", async ({ request }) => {
    const response = await request.post("/api/pdf", { data: { seller: { name: "" }, buyer: {} } });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("Invalid invoice");
  });

  test("rejects malformed JSON", async ({ request }) => {
    const response = await request.post("/api/pdf", {
      headers: { "content-type": "application/json" },
      data: "{not json",
    });
    expect(response.status()).toBe(400);
  });

  test("rejects a body that is too large", async ({ request }) => {
    const response = await request.post("/api/pdf", {
      data: { ...valid, notes: "x".repeat(400_000) },
    });
    expect(response.status()).toBe(413);
  });

  test("rejects an unknown template, font or colour that could inject CSS", async ({ request }) => {
    for (const bad of [
      { template: "fancy" },
      { font: "comic" },
      { accentColor: "red" },
      { accentColor: "#fff;background:url(https://evil.example)" },
      { accentColor: "#000}</style><script>1</script>" },
    ]) {
      const response = await request.post("/api/pdf", { data: { ...valid, ...bad } });
      expect(response.status(), JSON.stringify(bad)).toBe(400);
    }
  });

  test("answers 404 for a saved-invoice PDF that does not exist", async ({ request }) => {
    expect(
      (await request.get("/api/invoices/00000000-0000-4000-8000-000000000000/pdf")).status(),
    ).toBe(404);
    expect((await request.get("/api/invoices/not-a-uuid/pdf")).status()).toBe(404);
  });
});

test("the health check answers without a database round trip", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

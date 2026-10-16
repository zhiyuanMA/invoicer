import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import type { Invoice } from "@/lib/schemas/invoice";
import { templates } from "@/templates";

/** Server-side only: renders a template to a complete HTML document. User text is escaped by React. */
export function renderInvoiceHtml(invoice: Invoice) {
  const { Component: Template } = templates[invoice.template];
  const body = renderToStaticMarkup(<Template invoice={invoice} />);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${
    // The title never contains user input.
    "Invoice"
  }</title></head><body style="margin:0">${body}</body></html>`;
}

/** Renders HTML to an A4 PDF with headless Chromium. Scripts and all network access are disabled. */
export async function htmlToPdf(html: string): Promise<Buffer> {
  // Inside the Docker image Chromium cannot use its sandbox (Docker's default seccomp profile
  // blocks the user namespaces it needs), so the image sets CHROMIUM_NO_SANDBOX=1. The page is our
  // own escaped HTML with scripts and network disabled, and the container is the isolation.
  const browser = await chromium.launch({
    args: process.env.CHROMIUM_NO_SANDBOX === "1" ? ["--no-sandbox"] : [],
  });
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    // The HTML is self-contained; refuse every request so a template can never reach out
    // to the network or the local file system (SSRF / local file read).
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "load" });
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally {
    await browser.close();
  }
}

/** A safe file name such as "invoice-INV-001.pdf". */
export function pdfFileName(invoice: Invoice): string {
  const suffix = (invoice.number ?? "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return suffix ? `invoice-${suffix}.pdf` : "invoice.pdf";
}

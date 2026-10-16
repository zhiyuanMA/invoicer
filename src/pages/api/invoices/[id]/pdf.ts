import type { NextApiRequest, NextApiResponse } from "next";
import { htmlToPdf, pdfFileName, renderInvoiceHtml } from "@/lib/pdf";
import { getInvoice } from "@/server/invoice-store";

/** PDF of a saved invoice, rendered from its stored snapshot. See pdf.ts for why this is a Pages route. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : "";
  const saved = await getInvoice(id);
  if (!saved) return res.status(404).json({ error: "Invoice not found" });

  const html = renderInvoiceHtml(saved.invoice);
  const pdf = await htmlToPdf(html);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${pdfFileName(saved.invoice)}"`);
  res.setHeader("Cache-Control", "no-store");
  return res.send(pdf);
}

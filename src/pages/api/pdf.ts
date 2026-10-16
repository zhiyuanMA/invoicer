import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { htmlToPdf, pdfFileName, renderInvoiceHtml } from "@/lib/pdf";
import { invoiceSchema } from "@/lib/schemas/invoice";

/**
 * This is a Pages Router API route on purpose. App Router route handlers run in the React Server
 * Components layer, where `react-dom/server` (needed to render the template to HTML) is not
 * available. Both routers can live in the same Next.js project.
 */
export const config = { api: { bodyParser: { sizeLimit: "256kb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Never trust the client: validate again on the server.
  const result = invoiceSchema.safeParse(req.body);
  if (!result.success) {
    return res
      .status(400)
      .json({ error: "Invalid invoice", fieldErrors: z.flattenError(result.error).fieldErrors });
  }

  const invoice = result.data;
  const pdf = await htmlToPdf(renderInvoiceHtml(invoice));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${pdfFileName(invoice)}"`);
  res.setHeader("Cache-Control", "no-store");
  return res.send(pdf);
}

import { formatDate } from "@/lib/format";
import type { Invoice } from "@/lib/schemas/invoice";
import { buildView, themeStyle } from "./view";

export const SKY_DEFAULTS = { accent: "#1ad5e2", font: "serif" } as const;

/**
 * A tinted header and footer band (a light tint of the accent colour), a large italic serif title,
 * and labelled rows for the buyer. Scoped under `.inv-sky`.
 */
export const skyCss = `
@page { size: A4; margin: 0; }
.inv-sky { box-sizing: border-box; width: 210mm; min-height: 297mm; display: flex; flex-direction: column;
  background: #fffcf8; color: #1f2937; font-size: 9.5pt; line-height: 1.5; }
.inv-sky *, .inv-sky *::before, .inv-sky *::after { box-sizing: border-box; }
.inv-sky .band { background: color-mix(in srgb, var(--accent) 24%, #fff); }
.inv-sky .head { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12mm; padding: 15mm 16mm 10mm; }
.inv-sky h1 { margin: 0; font-size: 46pt; line-height: 1.05; font-weight: 400; font-style: italic;
  color: #111827; overflow-wrap: anywhere; }
.inv-sky .kv { display: flex; gap: 4mm; margin-top: 1.4mm; }
.inv-sky .kv b { flex: 0 0 24mm; }
.inv-sky .meta { margin-top: 9mm; }
.inv-sky .section { margin-top: 8mm; font-size: 12pt; font-weight: 700; text-transform: uppercase; }
.inv-sky .seller { padding-top: 14mm; }
.inv-sky .seller .name { font-size: 14pt; font-weight: 700; text-transform: uppercase; margin-bottom: 1.5mm; }
.inv-sky .pre { white-space: pre-line; }
.inv-sky .body { flex: 1; padding: 11mm 16mm 8mm; }
.inv-sky table { width: 100%; border-collapse: collapse; }
.inv-sky th { text-align: left; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  font-size: 9.5pt; padding: 0 0 3.5mm; }
.inv-sky td { padding: 3mm 0; border-bottom: 0.25mm solid #111827; vertical-align: top; }
.inv-sky tbody tr:first-child td { border-top: 0; }
.inv-sky .num { text-align: right; white-space: nowrap; padding-left: 4mm; }
.inv-sky tr { break-inside: avoid; }
.inv-sky .totals { margin: 5mm 0 0 auto; width: 70mm; }
.inv-sky .totals div { display: flex; justify-content: space-between; padding: 1.2mm 0; }
.inv-sky .totals .grand { margin-top: 1.5mm; padding-top: 2.5mm; border-top: 0.25mm solid #111827;
  font-weight: 700; font-size: 11pt; text-transform: uppercase; }
.inv-sky .block { margin-top: 10mm; max-width: 100mm; break-inside: avoid; }
.inv-sky .block .section { margin: 0 0 2mm; }
.inv-sky .footer { height: 14mm; }
`;

export function SkyTemplate({ invoice }: { invoice: Invoice }) {
  const { seller, buyer } = invoice;
  const view = buildView(invoice);

  return (
    <div className="inv-sky" style={themeStyle(invoice, SKY_DEFAULTS)}>
      <style dangerouslySetInnerHTML={{ __html: skyCss }} />

      <div className="band head">
        <div>
          <h1>{view.title}</h1>
          <div className="meta">
            {invoice.number && (
              <div className="kv">
                <b>INVOICE NO.</b>
                <span>{invoice.number}</span>
              </div>
            )}
            {invoice.issueDate && (
              <div className="kv">
                <b>DATE:</b>
                <span>{formatDate(invoice.issueDate)}</span>
              </div>
            )}
            {invoice.dueDate && (
              <div className="kv">
                <b>DUE DATE:</b>
                <span>{formatDate(invoice.dueDate)}</span>
              </div>
            )}
          </div>
          <div className="section">Bill to</div>
          <div className="kv">
            <b>Name:</b>
            <span>{buyer.name}</span>
          </div>
          {buyer.address && (
            <div className="kv">
              <b>Address:</b>
              <span className="pre">{buyer.address}</span>
            </div>
          )}
          {buyer.email && (
            <div className="kv">
              <b>Email:</b>
              <span>{buyer.email}</span>
            </div>
          )}
          {buyer.nzbn && (
            <div className="kv">
              <b>NZBN:</b>
              <span>{buyer.nzbn}</span>
            </div>
          )}
        </div>

        <div className="seller">
          <div className="name">{seller.name}</div>
          {seller.address && <div className="pre">{seller.address}</div>}
          {seller.email && <div>{seller.email}</div>}
          {seller.phone && <div>{seller.phone}</div>}
          {seller.nzbn && <div>NZBN {seller.nzbn}</div>}
          {seller.gstNumber && <div>GST No. {seller.gstNumber}</div>}
        </div>
      </div>

      <div className="body">
        {view.lines.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th className="num">Price</th>
                <th className="num">Qty</th>
                {view.hasDiscount && <th className="num">Discount</th>}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {view.lines.map((line, index) => (
                <tr key={index}>
                  <td className="pre">{line.description}</td>
                  <td className="num">{line.unitPrice}</td>
                  <td className="num">{line.quantity}</td>
                  {view.hasDiscount && <td className="num">{line.discount}</td>}
                  <td className="num">{line.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {view.totals && (
          <div className="totals">
            <div>
              <span>Sub-total</span>
              <span>{view.totals.subtotal}</span>
            </div>
            <div>
              <span>{view.totals.gstLabel}</span>
              <span>{view.totals.gst}</span>
            </div>
            <div className="grand">
              <span>Total</span>
              <span>{view.totals.total}</span>
            </div>
          </div>
        )}

        {invoice.notes && (
          <div className="block">
            <div className="section">Notes</div>
            <div className="pre">{invoice.notes}</div>
          </div>
        )}
        {invoice.paymentDetails && (
          <div className="block">
            <div className="section">Payment information</div>
            <div className="pre">{invoice.paymentDetails}</div>
          </div>
        )}
      </div>

      <div className="band footer" />
    </div>
  );
}

import { formatDate } from "@/lib/format";
import type { Invoice } from "@/lib/schemas/invoice";
import { buildView, themeStyle } from "./view";

export const CLASSIC_DEFAULTS = { accent: "#1f2937", font: "sans" } as const;

/**
 * Plain CSS shipped with the template, so the same markup renders identically in the on-screen
 * preview and in the PDF (Chromium). Everything is scoped under `.inv-classic`.
 */
export const classicCss = `
@page { size: A4; margin: 0; }
.inv-classic { box-sizing: border-box; width: 210mm; min-height: 297mm; padding: 16mm; background: #fff;
  color: #1f2937; font-size: 10pt; line-height: 1.45; }
.inv-classic *, .inv-classic *::before, .inv-classic *::after { box-sizing: border-box; }
.inv-classic h1 { margin: 0; font-size: 26pt; font-weight: 700; letter-spacing: 0.02em; color: var(--accent); }
.inv-classic .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; }
.inv-classic .meta { text-align: right; }
.inv-classic .meta div + div { margin-top: 1mm; }
.inv-classic .label { color: #6b7280; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; }
.inv-classic .parties { display: flex; gap: 12mm; margin-top: 12mm; }
.inv-classic .party { flex: 1; }
.inv-classic .party .name { font-weight: 700; font-size: 11pt; }
.inv-classic .pre { white-space: pre-line; }
.inv-classic table { width: 100%; border-collapse: collapse; margin-top: 12mm; }
.inv-classic th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em;
  color: #6b7280; border-bottom: 1.5px solid var(--accent); padding: 2mm 2mm 2mm 0; }
.inv-classic td { padding: 2.5mm 2mm 2.5mm 0; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
.inv-classic .num { text-align: right; white-space: nowrap; padding-right: 0; }
.inv-classic th.num { padding-right: 0; }
.inv-classic tr { break-inside: avoid; }
.inv-classic .totals { margin-top: 6mm; margin-left: auto; width: 75mm; }
.inv-classic .totals div { display: flex; justify-content: space-between; padding: 1.2mm 0; }
.inv-classic .totals .grand { border-top: 1.5px solid var(--accent); margin-top: 1mm; padding-top: 2.5mm;
  font-weight: 700; font-size: 12pt; }
.inv-classic .section { margin-top: 10mm; break-inside: avoid; }
`;

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <div className="label">{label}</div>
      <div className="pre">{children}</div>
    </div>
  );
}

export function ClassicTemplate({ invoice }: { invoice: Invoice }) {
  const { seller, buyer } = invoice;
  const view = buildView(invoice);

  return (
    <div className="inv-classic" style={themeStyle(invoice, CLASSIC_DEFAULTS)}>
      <style dangerouslySetInnerHTML={{ __html: classicCss }} />

      <div className="head">
        <div>
          <h1>{view.title}</h1>
        </div>
        <div className="meta">
          {invoice.number && (
            <div>
              <span className="label">Number</span> {invoice.number}
            </div>
          )}
          {invoice.issueDate && (
            <div>
              <span className="label">Date</span> {formatDate(invoice.issueDate)}
            </div>
          )}
          {invoice.dueDate && (
            <div>
              <span className="label">Due</span> {formatDate(invoice.dueDate)}
            </div>
          )}
        </div>
      </div>

      <div className="parties">
        <div className="party">
          <div className="label">From</div>
          <div className="name">{seller.name}</div>
          {seller.address && <div className="pre">{seller.address}</div>}
          {seller.email && <div>{seller.email}</div>}
          {seller.phone && <div>{seller.phone}</div>}
          {seller.nzbn && <div>NZBN {seller.nzbn}</div>}
          {seller.gstNumber && <div>GST No. {seller.gstNumber}</div>}
        </div>
        <div className="party">
          <div className="label">Bill to</div>
          <div className="name">{buyer.name}</div>
          {buyer.address && <div className="pre">{buyer.address}</div>}
          {buyer.email && <div>{buyer.email}</div>}
          {buyer.nzbn && <div>NZBN {buyer.nzbn}</div>}
        </div>
      </div>

      {view.lines.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              {view.hasDiscount && <th className="num">Discount</th>}
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {view.lines.map((line, index) => (
              <tr key={index}>
                <td className="pre">{line.description}</td>
                <td className="num">{line.quantity}</td>
                <td className="num">{line.unitPrice}</td>
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
            <span>Subtotal</span>
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

      {invoice.paymentDetails && <Block label="Payment details">{invoice.paymentDetails}</Block>}
      {invoice.notes && <Block label="Notes">{invoice.notes}</Block>}
    </div>
  );
}

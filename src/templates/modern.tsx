import { formatDate } from "@/lib/format";
import type { Invoice } from "@/lib/schemas/invoice";
import { buildView, themeStyle } from "./view";

export const MODERN_DEFAULTS = { accent: "#2563eb", font: "sans" } as const;

/** A coloured header band and a tinted table header. Scoped under `.inv-modern`. */
export const modernCss = `
@page { size: A4; margin: 0; }
.inv-modern { box-sizing: border-box; width: 210mm; min-height: 297mm; background: #fff; color: #1f2937;
  font-size: 10pt; line-height: 1.45; }
.inv-modern *, .inv-modern *::before, .inv-modern *::after { box-sizing: border-box; }
.inv-modern .band { background: var(--accent); color: #fff; padding: 14mm 16mm 10mm; display: flex;
  justify-content: space-between; align-items: flex-end; gap: 12mm; }
.inv-modern h1 { margin: 0; font-size: 28pt; font-weight: 700; letter-spacing: 0.01em; }
.inv-modern .meta { text-align: right; }
.inv-modern .meta div + div { margin-top: 1mm; }
.inv-modern .meta .label { color: rgba(255,255,255,0.75); }
.inv-modern .body { padding: 10mm 16mm 16mm; }
.inv-modern .label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
.inv-modern .parties { display: flex; gap: 12mm; }
.inv-modern .party { flex: 1; }
.inv-modern .party .label { color: var(--accent); font-weight: 700; }
.inv-modern .party .name { font-weight: 700; font-size: 11pt; margin-top: 1mm; }
.inv-modern .pre { white-space: pre-line; }
.inv-modern table { width: 100%; border-collapse: collapse; margin-top: 10mm; }
.inv-modern th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, #fff); padding: 2.5mm 3mm; }
.inv-modern td { padding: 2.5mm 3mm; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
.inv-modern .num { text-align: right; white-space: nowrap; }
.inv-modern tr { break-inside: avoid; }
.inv-modern .totals { margin-top: 6mm; margin-left: auto; width: 78mm; }
.inv-modern .totals div { display: flex; justify-content: space-between; padding: 1.2mm 3mm; }
.inv-modern .totals .grand { background: var(--accent); color: #fff; margin-top: 2mm; padding: 2.5mm 3mm;
  font-weight: 700; font-size: 12pt; border-radius: 1.5mm; }
.inv-modern .section { margin-top: 10mm; break-inside: avoid; }
.inv-modern .section .label { color: var(--accent); font-weight: 700; }
`;

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <div className="label">{label}</div>
      <div className="pre">{children}</div>
    </div>
  );
}

export function ModernTemplate({ invoice }: { invoice: Invoice }) {
  const { seller, buyer } = invoice;
  const view = buildView(invoice);

  return (
    <div className="inv-modern" style={themeStyle(invoice, MODERN_DEFAULTS)}>
      <style dangerouslySetInnerHTML={{ __html: modernCss }} />

      <div className="band">
        <h1>{view.title}</h1>
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

      <div className="body">
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
    </div>
  );
}

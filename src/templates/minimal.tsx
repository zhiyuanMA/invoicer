import { formatDate } from "@/lib/format";
import type { Invoice } from "@/lib/schemas/invoice";
import { buildView, themeStyle } from "./view";

export const MINIMAL_DEFAULTS = { accent: "#111827", font: "sans" } as const;

/** Light and spacious: hairlines, small caps, the accent used sparingly. Scoped under `.inv-minimal`. */
export const minimalCss = `
@page { size: A4; margin: 0; }
.inv-minimal { box-sizing: border-box; width: 210mm; min-height: 297mm; padding: 20mm 20mm; background: #fff;
  color: #374151; font-size: 9.5pt; line-height: 1.6; }
.inv-minimal *, .inv-minimal *::before, .inv-minimal *::after { box-sizing: border-box; }
.inv-minimal h1 { margin: 0; font-size: 12pt; font-weight: 400; letter-spacing: 0.25em; text-transform: uppercase;
  color: var(--accent); padding-bottom: 4mm; border-bottom: 0.5mm solid var(--accent); }
.inv-minimal .meta { display: flex; gap: 10mm; margin-top: 5mm; }
.inv-minimal .label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.12em; color: #9ca3af; }
.inv-minimal .parties { display: flex; gap: 12mm; margin-top: 14mm; }
.inv-minimal .party { flex: 1; }
.inv-minimal .party .name { font-weight: 600; color: #111827; }
.inv-minimal .pre { white-space: pre-line; }
.inv-minimal table { width: 100%; border-collapse: collapse; margin-top: 14mm; }
.inv-minimal th { text-align: left; font-weight: 400; font-size: 7.5pt; text-transform: uppercase;
  letter-spacing: 0.12em; color: #9ca3af; padding: 0 2mm 2mm 0; border-bottom: 0.25mm solid #d1d5db; }
.inv-minimal td { padding: 3mm 2mm 3mm 0; border-bottom: 0.25mm solid #f3f4f6; vertical-align: top; }
.inv-minimal .num { text-align: right; white-space: nowrap; padding-right: 0; }
.inv-minimal th.num { padding-right: 0; }
.inv-minimal tr { break-inside: avoid; }
.inv-minimal .totals { margin-top: 8mm; margin-left: auto; width: 70mm; }
.inv-minimal .totals div { display: flex; justify-content: space-between; padding: 1mm 0; }
.inv-minimal .totals .grand { margin-top: 2mm; padding-top: 3mm; border-top: 0.5mm solid var(--accent);
  color: var(--accent); font-weight: 600; font-size: 11pt; }
.inv-minimal .section { margin-top: 12mm; break-inside: avoid; }
`;

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <div className="label">{label}</div>
      <div className="pre">{children}</div>
    </div>
  );
}

export function MinimalTemplate({ invoice }: { invoice: Invoice }) {
  const { seller, buyer } = invoice;
  const view = buildView(invoice);

  return (
    <div className="inv-minimal" style={themeStyle(invoice, MINIMAL_DEFAULTS)}>
      <style dangerouslySetInnerHTML={{ __html: minimalCss }} />

      <h1>{view.title}</h1>
      <div className="meta">
        {invoice.number && (
          <div>
            <div className="label">Number</div>
            {invoice.number}
          </div>
        )}
        {invoice.issueDate && (
          <div>
            <div className="label">Date</div>
            {formatDate(invoice.issueDate)}
          </div>
        )}
        {invoice.dueDate && (
          <div>
            <div className="label">Due</div>
            {formatDate(invoice.dueDate)}
          </div>
        )}
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

import { formatDate } from "@/lib/format";
import type { Invoice } from "@/lib/schemas/invoice";
import { buildView, themeStyle } from "./view";

export const BOLD_DEFAULTS = { accent: "#111111", font: "sans" } as const;

/**
 * A huge uppercase title, a thin frame on a warm paper background, and ruled rows. The accent
 * colour is used for the frame, the title and every rule. Scoped under `.inv-bold`.
 */
export const boldCss = `
@page { size: A4; margin: 0; }
.inv-bold { box-sizing: border-box; width: 210mm; min-height: 297mm; padding: 6mm; background: #fffdf7;
  color: #111; font-size: 9.5pt; line-height: 1.5; }
.inv-bold *, .inv-bold *::before, .inv-bold *::after { box-sizing: border-box; }
.inv-bold .frame { border: 0.35mm solid var(--accent); min-height: calc(297mm - 12mm); padding: 14mm 15mm 12mm; }
.inv-bold .head { text-align: right; }
.inv-bold h1 { margin: 0; font-size: 50pt; line-height: 1; font-weight: 800; letter-spacing: -0.02em;
  text-transform: uppercase; color: var(--accent); overflow-wrap: anywhere; }
.inv-bold .number { margin-top: 3mm; font-size: 15pt; font-weight: 800; text-transform: uppercase; }
.inv-bold .dates { margin-top: 2.5mm; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; line-height: 1.7; }
.inv-bold .parties { display: grid; grid-template-columns: 1.2fr 1fr; gap: 10mm; margin-top: 20mm; }
.inv-bold .strong { font-weight: 800; text-transform: uppercase; }
.inv-bold .party .strong { font-size: 10pt; }
.inv-bold .pre { white-space: pre-line; }
.inv-bold table { width: 100%; border-collapse: collapse; margin-top: 14mm; }
.inv-bold th { text-align: left; font-weight: 800; text-transform: uppercase; font-size: 9pt;
  padding: 0 0 3mm; border-bottom: 0.35mm solid var(--accent); }
.inv-bold td { padding: 4mm 0; border-bottom: 0.35mm solid var(--accent); vertical-align: top; }
.inv-bold .num { text-align: right; white-space: nowrap; padding-left: 4mm; }
.inv-bold tr { break-inside: avoid; }
.inv-bold .totals { margin: 6mm 0 0 auto; width: 80mm; }
.inv-bold .totals div { display: flex; justify-content: space-between; padding: 1.3mm 0; }
.inv-bold .totals .grand { margin-top: 1mm; font-size: 12pt; font-weight: 800; text-transform: uppercase; }
.inv-bold .bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; margin-top: 12mm; }
.inv-bold .block { break-inside: avoid; }
.inv-bold .block .strong { margin-bottom: 2mm; }
`;

export function BoldTemplate({ invoice }: { invoice: Invoice }) {
  const { seller, buyer } = invoice;
  const view = buildView(invoice);

  return (
    <div className="inv-bold" style={themeStyle(invoice, BOLD_DEFAULTS)}>
      <style dangerouslySetInnerHTML={{ __html: boldCss }} />
      <div className="frame">
        <div className="head">
          <h1>{view.title}</h1>
          {invoice.number && <div className="number">Invoice No. {invoice.number}</div>}
          <div className="dates">
            {invoice.issueDate && <div>Date : {formatDate(invoice.issueDate)}</div>}
            {invoice.dueDate && <div>Due date : {formatDate(invoice.dueDate)}</div>}
          </div>
        </div>

        <div className="parties">
          <div className="party">
            <div className="strong">{seller.name}</div>
            {seller.address && <div className="pre">{seller.address}</div>}
            {seller.email && <div>{seller.email}</div>}
            {seller.phone && <div>{seller.phone}</div>}
            {seller.nzbn && <div>NZBN {seller.nzbn}</div>}
            {seller.gstNumber && <div>GST No. {seller.gstNumber}</div>}
          </div>
          <div className="party">
            <div className="strong">Bill to:</div>
            <div>{buyer.name}</div>
            {buyer.address && <div className="pre">{buyer.address}</div>}
            {buyer.email && <div>{buyer.email}</div>}
            {buyer.nzbn && <div>NZBN {buyer.nzbn}</div>}
          </div>
        </div>

        {view.lines.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Description :</th>
                <th className="num">Quantity</th>
                <th className="num">Price</th>
                {view.hasDiscount && <th className="num">Discount</th>}
                <th className="num">Total</th>
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
            <div className="strong">
              <span>Sub total :</span>
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

        {(invoice.notes || invoice.paymentDetails) && (
          <div className="bottom">
            <div>
              {invoice.notes && (
                <div className="block">
                  <div className="strong">Notes:</div>
                  <div className="pre">{invoice.notes}</div>
                </div>
              )}
            </div>
            <div>
              {invoice.paymentDetails && (
                <div className="block">
                  <div className="strong">Payment details:</div>
                  <div className="pre">{invoice.paymentDetails}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

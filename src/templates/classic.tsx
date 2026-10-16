import { formatDate, formatMoney, formatPercentFromBps, formatQuantity } from "@/lib/format";
import { computeTotals } from "@/lib/money";
import type { Invoice } from "@/lib/schemas/invoice";

/**
 * Plain CSS shipped with the template, so the same markup renders identically in the on-screen
 * preview and in the PDF (Chromium). Everything is scoped under `.inv`.
 */
export const classicCss = `
@page { size: A4; margin: 0; }
.inv { box-sizing: border-box; width: 210mm; min-height: 297mm; padding: 16mm; background: #fff;
  color: #1f2937; font-family: Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 1.45; }
.inv *, .inv *::before, .inv *::after { box-sizing: border-box; }
.inv h1 { margin: 0; font-size: 26pt; font-weight: 700; letter-spacing: 0.02em; color: #111827; }
.inv .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; }
.inv .meta { text-align: right; }
.inv .meta div + div { margin-top: 1mm; }
.inv .label { color: #6b7280; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; }
.inv .parties { display: flex; gap: 12mm; margin-top: 12mm; }
.inv .party { flex: 1; }
.inv .party .name { font-weight: 700; font-size: 11pt; }
.inv .pre { white-space: pre-line; }
.inv table { width: 100%; border-collapse: collapse; margin-top: 12mm; }
.inv th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em;
  color: #6b7280; border-bottom: 1.5px solid #111827; padding: 2mm 2mm 2mm 0; }
.inv td { padding: 2.5mm 2mm 2.5mm 0; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
.inv .num { text-align: right; white-space: nowrap; padding-right: 0; }
.inv th.num { padding-right: 0; }
.inv tr { break-inside: avoid; }
.inv .totals { margin-top: 6mm; margin-left: auto; width: 75mm; }
.inv .totals div { display: flex; justify-content: space-between; padding: 1.2mm 0; }
.inv .totals .grand { border-top: 1.5px solid #111827; margin-top: 1mm; padding-top: 2.5mm;
  font-weight: 700; font-size: 12pt; }
.inv .section { margin-top: 10mm; break-inside: avoid; }
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
  const { seller, buyer, currency } = invoice;
  const totals = computeTotals(invoice.lines, {
    gstRateBps: invoice.gstRateBps,
    pricesIncludeGst: invoice.pricesIncludeGst,
  });
  const money = (cents: number) => formatMoney(cents, currency);
  const visibleLines = invoice.lines.filter(
    (line) =>
      line.description !== undefined ||
      line.quantity !== undefined ||
      line.unitPriceCents !== undefined,
  );
  const hasDiscount = visibleLines.some((line) => line.discountPercent);

  return (
    <div className="inv">
      <style dangerouslySetInnerHTML={{ __html: classicCss }} />

      <div className="head">
        <div>
          <h1>{invoice.title ?? "Invoice"}</h1>
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

      {visibleLines.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              {hasDiscount && <th className="num">Discount</th>}
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {visibleLines.map((line, index) => {
              // `totals.lines` follows `invoice.lines`, so find this line's result by identity.
              const amount = totals.lines[invoice.lines.indexOf(line)]?.amountCents ?? null;
              return (
                <tr key={index}>
                  <td className="pre">{line.description}</td>
                  <td className="num">
                    {line.quantity !== undefined ? formatQuantity(line.quantity) : ""}
                  </td>
                  <td className="num">
                    {line.unitPriceCents !== undefined ? money(line.unitPriceCents) : ""}
                  </td>
                  {hasDiscount && (
                    <td className="num">
                      {line.discountPercent ? `${line.discountPercent}%` : ""}
                    </td>
                  )}
                  <td className="num">{amount !== null ? money(amount) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {totals.hasTotals && (
        <div className="totals">
          <div>
            <span>Subtotal</span>
            <span>{money(totals.subtotalCents)}</span>
          </div>
          <div>
            <span>GST ({formatPercentFromBps(invoice.gstRateBps)}%)</span>
            <span>{money(totals.gstCents)}</span>
          </div>
          <div className="grand">
            <span>Total</span>
            <span>{money(totals.totalCents)}</span>
          </div>
        </div>
      )}

      {invoice.paymentDetails && <Block label="Payment details">{invoice.paymentDetails}</Block>}
      {invoice.notes && <Block label="Notes">{invoice.notes}</Block>}
    </div>
  );
}

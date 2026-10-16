import Link from "next/link";
import { Suspense } from "react";
import { InvoiceRowActions } from "@/components/invoice-row-actions";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { listInvoices } from "@/server/invoice-store";

export default function InvoicesPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Invoices</h1>
        <Link
          href="/invoices/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          New invoice
        </Link>
      </div>
      {/* The list comes from the database on every request, so it streams in behind Suspense. */}
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <InvoiceList />
      </Suspense>
    </main>
  );
}

async function InvoiceList() {
  const invoices = await listInvoices();

  if (invoices.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
        No invoices yet. Create your first one with “New invoice”.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-medium">Number</th>
            <th className="px-4 py-3 font-medium">Buyer</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
            <th className="px-4 py-3 font-medium">Updated</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3">
                <Link href={`/invoices/${invoice.id}`} className="font-medium text-zinc-900">
                  {invoice.number ?? <span className="text-zinc-400">(no number)</span>}
                </Link>
              </td>
              <td className="px-4 py-3 text-zinc-700">{invoice.buyerName}</td>
              <td className="px-4 py-3 text-zinc-700">
                {invoice.issueDate ? formatDate(invoice.issueDate) : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                {invoice.totalCents === null
                  ? "—"
                  : formatMoney(invoice.totalCents, invoice.currency)}
              </td>
              <td className="px-4 py-3 text-zinc-500">{formatDateTime(invoice.updatedAt)}</td>
              <td className="px-4 py-3">
                <InvoiceRowActions id={invoice.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

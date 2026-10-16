import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { InvoiceRowActions } from "@/components/invoice-row-actions";
import { InvoiceStatusSelect } from "@/components/invoice-status-select";
import { formatDate, formatDateTime, formatMoney, todayInAuckland } from "@/lib/format";
import { STATUSES, STATUS_LABELS, effectiveStatus, type Status } from "@/lib/invoice-status";
import { listInvoices } from "@/server/invoice-store";

type SearchParams = Promise<{ status?: string; q?: string }>;

export default function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
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
        <InvoiceList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function parseStatus(value: string | undefined): Status | undefined {
  return STATUSES.find((status) => status === value);
}

function filterHref(status: Status | undefined, query: string): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (query) params.set("q", query);
  const text = params.toString();
  return text ? `/?${text}` : "/";
}

async function InvoiceList({ searchParams }: { searchParams: SearchParams }) {
  // "Today" decides what is overdue, so this list must be rendered per request. Without this, Next
  // would treat the current time as something it can prerender.
  await connection();
  const params = await searchParams;
  const status = parseStatus(params.status);
  const query = (params.q ?? "").trim();
  const today = todayInAuckland();
  const invoices = await listInvoices({ status, query, today });
  const filtered = status !== undefined || query !== "";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 text-sm" aria-label="Filter by status">
          {[undefined, ...STATUSES].map((tab) => (
            <Link
              key={tab ?? "all"}
              href={filterHref(tab, query)}
              aria-current={tab === status ? "page" : undefined}
              className={
                tab === status
                  ? "rounded-md bg-zinc-900 px-3 py-1.5 text-white"
                  : "rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-200"
              }
            >
              {tab ? STATUS_LABELS[tab] : "All"}
            </Link>
          ))}
        </nav>
        <form action="/" method="get" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search number or buyer"
            className="w-64 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Search
          </button>
          {query && (
            <Link
              href={filterHref(status, "")}
              className="px-2 py-1.5 text-sm text-zinc-500 hover:text-zinc-900"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {invoices.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
          {filtered
            ? "No invoices match this filter."
            : "No invoices yet. Create your first one with “New invoice”."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Buyer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {invoices.map((invoice) => {
                const effective = effectiveStatus(invoice.status, invoice.dueDate, today);
                return (
                  <tr key={invoice.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <Link href={`/invoices/${invoice.id}`} className="font-medium text-zinc-900">
                        {invoice.number ?? <span className="text-zinc-400">(no number)</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{invoice.buyerName}</td>
                    <td className="px-4 py-3">
                      <InvoiceStatusSelect
                        key={`${invoice.id}-${effective}`}
                        id={invoice.id}
                        effective={effective}
                      />
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {invoice.issueDate ? formatDate(invoice.issueDate) : "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

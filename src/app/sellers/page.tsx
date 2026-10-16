import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SellerRowActions } from "@/components/seller-row-actions";
import { listSellers } from "@/server/seller-store";

export default function SellersPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Sellers</h1>
        <Link
          href="/sellers/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Add seller
        </Link>
      </div>
      <p className="mb-4 text-sm text-zinc-600">
        The businesses you invoice as. The default seller prefills new invoices, and any seller can
        be chosen in the invoice editor. Invoices keep their own copy of the seller, so editing or
        deleting a seller never changes an invoice.
      </p>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <SellerList />
      </Suspense>
    </main>
  );
}

async function SellerList() {
  // Read from the database on every request, never at build time.
  await connection();
  const sellers = await listSellers();
  if (sellers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
        No sellers yet. Add one to prefill your invoices.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white shadow-sm">
      {sellers.map((seller) => (
        <li key={seller.id} className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-900">{seller.label}</span>
              {seller.isDefault && (
                <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white">
                  Default
                </span>
              )}
            </div>
            {seller.label !== seller.name && <div className="text-zinc-600">{seller.name}</div>}
            {seller.gstNumber && <div className="text-zinc-600">GST No. {seller.gstNumber}</div>}
          </div>
          <SellerRowActions id={seller.id} label={seller.label} isDefault={seller.isDefault} />
        </li>
      ))}
    </ul>
  );
}

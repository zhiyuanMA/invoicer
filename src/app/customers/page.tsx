import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { DeleteCustomerButton } from "@/components/delete-customer-button";
import { listCustomers } from "@/server/customer-store";

export default function CustomersPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Customers</h1>
        <Link
          href="/customers/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Add customer
        </Link>
      </div>
      <p className="mb-4 text-sm text-zinc-600">
        The buyers you invoice. Add one here, or save the buyer of an invoice with “Save as
        customer”, then pick them on any new invoice. Invoices keep their own copy of the buyer, so
        deleting a customer never changes an invoice.
      </p>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <CustomerList />
      </Suspense>
    </main>
  );
}

async function CustomerList() {
  // Read from the database on every request, never at build time.
  await connection();
  const customers = await listCustomers();
  if (customers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
        No saved customers yet. Add one to reuse it on your invoices.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white shadow-sm">
      {customers.map((customer) => (
        <li key={customer.id} className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="text-sm">
            <div className="font-medium text-zinc-900">{customer.name}</div>
            {customer.address && (
              <div className="whitespace-pre-line text-zinc-600">{customer.address}</div>
            )}
            {customer.email && <div className="text-zinc-600">{customer.email}</div>}
            {customer.nzbn && <div className="text-zinc-600">NZBN {customer.nzbn}</div>}
          </div>
          <DeleteCustomerButton id={customer.id} name={customer.name} />
        </li>
      ))}
    </ul>
  );
}

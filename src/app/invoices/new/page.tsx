import { connection } from "next/server";
import { Suspense } from "react";
import { InvoiceEditor } from "@/components/invoice-editor";
import { newInvoiceFormValues } from "@/lib/invoice-form";
import { listCustomers } from "@/server/customer-store";
import { listSellers } from "@/server/seller-store";

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <NewInvoice />
    </Suspense>
  );
}

async function NewInvoice() {
  // Read from the database on every request, never at build time.
  await connection();
  const [sellers, customers] = await Promise.all([listSellers(), listCustomers()]);
  // New invoices start from the default seller, if there is one.
  const defaultSeller = sellers.find((seller) => seller.isDefault) ?? {};
  return (
    <InvoiceEditor
      initialValues={newInvoiceFormValues(defaultSeller)}
      customers={customers}
      sellers={sellers}
    />
  );
}

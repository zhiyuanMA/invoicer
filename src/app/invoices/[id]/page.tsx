import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InvoiceEditor } from "@/components/invoice-editor";
import { invoiceToFormValues } from "@/lib/invoice-form";
import { listCustomers } from "@/server/customer-store";
import { getInvoice } from "@/server/invoice-store";
import { listSellers } from "@/server/seller-store";

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <EditInvoice params={params} />
    </Suspense>
  );
}

async function EditInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [saved, customers, sellers] = await Promise.all([
    getInvoice(id),
    listCustomers(),
    listSellers(),
  ]);
  if (!saved) notFound();
  return (
    <InvoiceEditor
      invoiceId={saved.id}
      initialValues={invoiceToFormValues(saved.invoice)}
      customers={customers}
      sellers={sellers}
    />
  );
}

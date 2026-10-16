import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SellerForm } from "@/components/seller-form";
import { getSeller } from "@/server/seller-store";

export default function EditSellerPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">Edit seller</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <EditSeller params={params} />
      </Suspense>
    </main>
  );
}

async function EditSeller({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = await getSeller(id);
  if (!seller) notFound();
  return (
    <SellerForm
      sellerId={seller.id}
      initialValues={{
        label: seller.label,
        name: seller.name,
        address: seller.address ?? "",
        email: seller.email ?? "",
        phone: seller.phone ?? "",
        nzbn: seller.nzbn ?? "",
        gstNumber: seller.gstNumber ?? "",
        paymentDetails: seller.paymentDetails ?? "",
      }}
    />
  );
}

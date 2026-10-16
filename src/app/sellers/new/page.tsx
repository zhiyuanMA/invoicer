import { SellerForm, emptySellerFormValues } from "@/components/seller-form";

export default function NewSellerPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">Add seller</h1>
      <SellerForm initialValues={emptySellerFormValues} />
    </main>
  );
}

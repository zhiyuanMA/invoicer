import { CustomerForm } from "@/components/customer-form";

export default function NewCustomerPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">Add customer</h1>
      <CustomerForm />
    </main>
  );
}

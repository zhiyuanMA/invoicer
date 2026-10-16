import { Suspense } from "react";
import { InvoiceEditor } from "@/components/invoice-editor";

export default function Home() {
  // The editor is interactive and generates random ids on the client, so it streams in
  // behind a Suspense boundary instead of being prerendered.
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <InvoiceEditor />
    </Suspense>
  );
}

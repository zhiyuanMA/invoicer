import type { Invoice } from "@/lib/schemas/invoice";
import { templates } from "@/templates";

/** Renders the same template component the PDF is generated from. */
export function InvoicePreview({ invoice }: { invoice: Invoice | null }) {
  const Template = invoice ? templates[invoice.template].Component : null;
  return (
    <div className="overflow-auto rounded-lg border border-zinc-200 bg-zinc-200 p-4">
      {invoice && Template ? (
        <div className="mx-auto w-fit shadow-md" style={{ zoom: 0.65 }}>
          <Template invoice={invoice} />
        </div>
      ) : (
        <p className="p-8 text-center text-sm text-zinc-600">
          Preview paused: fix the highlighted fields to see it again.
        </p>
      )}
    </div>
  );
}

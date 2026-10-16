"use client";

import { useState, useTransition } from "react";
import { deleteInvoiceAction, duplicateInvoiceAction } from "@/app/actions";

const linkClass = "text-sm text-zinc-600 hover:text-zinc-900";

export function InvoiceRowActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string } | void>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && !result.ok) setError(result.error ?? "Something went wrong");
    });
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <a href={`/api/invoices/${id}/pdf`} className={linkClass}>
        PDF
      </a>
      <button
        type="button"
        disabled={pending}
        className={linkClass}
        onClick={() => run(() => duplicateInvoiceAction(id))}
      >
        Duplicate
      </button>
      <button
        type="button"
        disabled={pending}
        className="text-sm text-zinc-500 hover:text-red-600"
        onClick={() => {
          if (window.confirm("Delete this invoice? This cannot be undone.")) {
            run(() => deleteInvoiceAction(id));
          }
        }}
      >
        Delete
      </button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { deleteCustomerAction } from "@/app/actions";

export function DeleteCustomerButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex items-center justify-end gap-3">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        disabled={pending}
        className="text-sm text-zinc-500 hover:text-red-600"
        onClick={() => {
          if (!window.confirm(`Delete customer “${name}”? Saved invoices are not affected.`))
            return;
          setError(null);
          startTransition(async () => {
            const result = await deleteCustomerAction(id);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        Delete
      </button>
    </span>
  );
}

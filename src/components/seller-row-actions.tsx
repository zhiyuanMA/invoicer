"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteSellerAction, setDefaultSellerAction } from "@/app/actions";

const linkClass = "text-sm text-zinc-600 hover:text-zinc-900";

export function SellerRowActions({
  id,
  label,
  isDefault,
}: {
  id: string;
  label: string;
  isDefault: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong");
    });
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <Link href={`/sellers/${id}`} className={linkClass}>
        Edit
      </Link>
      {!isDefault && (
        <button
          type="button"
          disabled={pending}
          className={linkClass}
          onClick={() => run(() => setDefaultSellerAction(id))}
        >
          Make default
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        className="text-sm text-zinc-500 hover:text-red-600"
        onClick={() => {
          if (window.confirm(`Delete seller “${label}”? Saved invoices are not affected.`)) {
            run(() => deleteSellerAction(id));
          }
        }}
      >
        Delete
      </button>
    </div>
  );
}

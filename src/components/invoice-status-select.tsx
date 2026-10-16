"use client";

import { useState, useTransition } from "react";
import { setInvoiceStatusAction } from "@/app/actions";
import {
  STATUS_LABELS,
  STORED_STATUSES,
  type Status,
  type StoredStatus,
} from "@/lib/invoice-status";

export const STATUS_STYLES: Record<Status, string> = {
  draft: "border-zinc-300 bg-zinc-100 text-zinc-700",
  sent: "border-blue-200 bg-blue-50 text-blue-700",
  paid: "border-green-200 bg-green-50 text-green-700",
  overdue: "border-red-200 bg-red-50 text-red-700",
};

/**
 * Shows an invoice's status and changes it. "Overdue" is not a choice: it is shown instead of
 * "Sent" when a sent invoice is past its due date, and picking another status replaces it.
 */
export function InvoiceStatusSelect({ id, effective }: { id: string; effective: Status }) {
  const [value, setValue] = useState<Status>(effective);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: StoredStatus) {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await setInvoiceStatusAction(id, next);
      if (!result.ok) {
        setValue(previous);
        setError(result.error);
      }
    });
  }

  return (
    <span className="inline-flex flex-col">
      <select
        aria-label="Status"
        value={value}
        disabled={pending}
        onChange={(event) => change(event.target.value as StoredStatus)}
        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[value]}`}
      >
        {STORED_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
        {effective === "overdue" && (
          <option value="overdue" disabled>
            {STATUS_LABELS.overdue}
          </option>
        )}
      </select>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}

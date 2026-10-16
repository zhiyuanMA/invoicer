/**
 * Invoice status. Only draft, sent and paid are stored. "Overdue" is not stored because it would
 * go stale overnight: an invoice is overdue while it is sent, unpaid, and its due date has passed.
 */

export const STORED_STATUSES = ["draft", "sent", "paid"] as const;
export type StoredStatus = (typeof STORED_STATUSES)[number];

export const STATUSES = ["draft", "sent", "paid", "overdue"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
};

/**
 * @param dueDate ISO date (YYYY-MM-DD) or undefined
 * @param today ISO date (YYYY-MM-DD) in the user's time zone
 */
export function effectiveStatus(
  status: StoredStatus,
  dueDate: string | null | undefined,
  today: string,
): Status {
  // ISO dates compare correctly as strings. An invoice is overdue the day after its due date.
  if (status === "sent" && dueDate && dueDate < today) return "overdue";
  return status;
}

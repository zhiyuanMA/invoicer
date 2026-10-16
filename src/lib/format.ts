/** Display formatting. Dates are ISO strings (YYYY-MM-DD) and are never converted through Date. */

/** 2026-10-16 -> 16/10/2026 */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Today's date in New Zealand, as YYYY-MM-DD. */
export function todayInAuckland(now: Date = new Date()): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(now);
}

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(cents / 100);
  } catch {
    // Unknown currency code: fall back to a plain number with the code.
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

/** 2 -> "2", 1.5 -> "1.5", 0.25 -> "0.25" */
export function formatQuantity(quantity: number): string {
  return String(Math.round(quantity * 1000) / 1000);
}

/** 1500 -> "15", 750 -> "7.5" */
export function formatPercentFromBps(bps: number): string {
  return String(bps / 100);
}

/** 16/10/2026, 1:30 pm in Auckland time. */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

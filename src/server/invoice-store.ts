import { todayInAuckland } from "@/lib/format";
import type { Status, StoredStatus } from "@/lib/invoice-status";
import { computeTotals } from "@/lib/money";
import { invoiceSchema, type Invoice } from "@/lib/schemas/invoice";
import type { InvoiceStatus } from "@/generated/prisma/client";
import { getPrisma } from "./db";

export type SavedInvoice = {
  id: string;
  status: StoredStatus;
  invoice: Invoice;
  createdAt: Date;
  updatedAt: Date;
};

export type InvoiceListItem = {
  id: string;
  status: StoredStatus;
  number: string | null;
  buyerName: string;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  /** Null when no line counts towards the totals. */
  totalCents: number | null;
  updatedAt: Date;
};

const toStored = (status: InvoiceStatus): StoredStatus => status.toLowerCase() as StoredStatus;
const toDb = (status: StoredStatus): InvoiceStatus => status.toUpperCase() as InvoiceStatus;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** The columns kept next to the snapshot so the list page does not need to parse every invoice. */
function summarise(invoice: Invoice) {
  const totals = computeTotals(invoice.lines, {
    gstRateBps: invoice.gstRateBps,
    pricesIncludeGst: invoice.pricesIncludeGst,
  });
  return {
    number: invoice.number ?? null,
    buyerName: invoice.buyer.name,
    issueDate: invoice.issueDate ?? null,
    dueDate: invoice.dueDate ?? null,
    currency: invoice.currency,
    totalCents: totals.hasTotals ? BigInt(totals.totalCents) : null,
    // Round-trip through JSON so `undefined` fields are dropped, as Prisma's Json type requires.
    content: JSON.parse(JSON.stringify(invoice)) as object,
  };
}

function toSaved(row: {
  id: string;
  status: InvoiceStatus;
  content: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SavedInvoice {
  const parsed = invoiceSchema.safeParse(row.content);
  if (!parsed.success) {
    throw new Error(`Stored invoice ${row.id} no longer matches the invoice schema`);
  }
  return {
    id: row.id,
    status: toStored(row.status),
    invoice: parsed.data,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** New invoices start as drafts. */
export async function createInvoice(invoice: Invoice): Promise<SavedInvoice> {
  const row = await getPrisma().invoice.create({ data: summarise(invoice) });
  return toSaved(row);
}

/** Changes the content only; the status is left as it is. Returns null when it does not exist. */
export async function updateInvoice(id: string, invoice: Invoice): Promise<SavedInvoice | null> {
  if (!isUuid(id)) return null;
  try {
    const row = await getPrisma().invoice.update({ where: { id }, data: summarise(invoice) });
    return toSaved(row);
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") return null; // record not found
    throw error;
  }
}

export async function getInvoice(id: string): Promise<SavedInvoice | null> {
  if (!isUuid(id)) return null;
  const row = await getPrisma().invoice.findUnique({ where: { id } });
  return row ? toSaved(row) : null;
}

export type InvoiceFilter = {
  /** "sent" means sent and not yet overdue, so the status tabs never overlap. */
  status?: Status;
  /** Matches the invoice number or the buyer name, ignoring case. */
  query?: string;
  /** ISO date in the user's time zone; decides what is overdue. Defaults to today in Auckland. */
  today?: string;
};

/**
 * Prisma's `contains` passes the text to SQL LIKE as it is, so `%` and `_` in a search would act
 * as wildcards. Backslash is LIKE's default escape character in PostgreSQL.
 */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

function whereFor({ status, query, today = todayInAuckland() }: InvoiceFilter) {
  const and: object[] = [];
  if (status === "draft" || status === "paid") and.push({ status: toDb(status) });
  if (status === "sent") {
    and.push({ status: "SENT", OR: [{ dueDate: null }, { dueDate: { gte: today } }] });
  }
  if (status === "overdue") and.push({ status: "SENT", dueDate: { lt: today } });
  const text = query?.trim() && escapeLike(query.trim());
  if (text) {
    and.push({
      OR: [
        { number: { contains: text, mode: "insensitive" } },
        { buyerName: { contains: text, mode: "insensitive" } },
      ],
    });
  }
  return and.length > 0 ? { AND: and } : {};
}

/** Most recently changed first. */
export async function listInvoices(filter: InvoiceFilter = {}): Promise<InvoiceListItem[]> {
  const rows = await getPrisma().invoice.findMany({
    where: whereFor(filter),
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      number: true,
      buyerName: true,
      issueDate: true,
      dueDate: true,
      currency: true,
      totalCents: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    status: toStored(row.status),
    totalCents: row.totalCents === null ? null : Number(row.totalCents),
  }));
}

/** Returns false when the invoice does not exist. */
export async function setInvoiceStatus(id: string, status: StoredStatus): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { count } = await getPrisma().invoice.updateMany({
    where: { id },
    data: { status: toDb(status) },
  });
  return count > 0;
}

/** Returns false when the invoice did not exist. */
export async function deleteInvoice(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { count } = await getPrisma().invoice.deleteMany({ where: { id } });
  return count > 0;
}

/**
 * Copies an invoice as a new draft. The number is cleared (numbers are entered by hand), the issue
 * date becomes today, and the due date is cleared.
 */
export async function duplicateInvoice(id: string): Promise<SavedInvoice | null> {
  const source = await getInvoice(id);
  if (!source) return null;
  const copy: Invoice = {
    ...source.invoice,
    number: undefined,
    issueDate: todayInAuckland(),
    dueDate: undefined,
  };
  return createInvoice(copy);
}

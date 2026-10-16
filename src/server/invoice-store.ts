import { todayInAuckland } from "@/lib/format";
import { computeTotals } from "@/lib/money";
import { invoiceSchema, type Invoice } from "@/lib/schemas/invoice";
import { DEFAULT_TEMPLATE, type TemplateId } from "@/templates";
import { getPrisma } from "./db";

export type SavedInvoice = {
  id: string;
  templateId: string;
  invoice: Invoice;
  createdAt: Date;
  updatedAt: Date;
};

export type InvoiceListItem = {
  id: string;
  number: string | null;
  buyerName: string;
  issueDate: string | null;
  currency: string;
  /** Null when no line counts towards the totals. */
  totalCents: number | null;
  updatedAt: Date;
};

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
    currency: invoice.currency,
    totalCents: totals.hasTotals ? BigInt(totals.totalCents) : null,
    // Round-trip through JSON so `undefined` fields are dropped, as Prisma's Json type requires.
    content: JSON.parse(JSON.stringify(invoice)) as object,
  };
}

function toSaved(row: {
  id: string;
  templateId: string;
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
    templateId: row.templateId,
    invoice: parsed.data,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createInvoice(
  invoice: Invoice,
  templateId: TemplateId = DEFAULT_TEMPLATE,
): Promise<SavedInvoice> {
  const row = await getPrisma().invoice.create({ data: { templateId, ...summarise(invoice) } });
  return toSaved(row);
}

/** Returns null when the invoice does not exist. */
export async function updateInvoice(
  id: string,
  invoice: Invoice,
  templateId?: TemplateId,
): Promise<SavedInvoice | null> {
  if (!isUuid(id)) return null;
  try {
    const row = await getPrisma().invoice.update({
      where: { id },
      data: { ...(templateId ? { templateId } : {}), ...summarise(invoice) },
    });
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

/** Most recently changed first. */
export async function listInvoices(): Promise<InvoiceListItem[]> {
  const rows = await getPrisma().invoice.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      number: true,
      buyerName: true,
      issueDate: true,
      currency: true,
      totalCents: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    totalCents: row.totalCents === null ? null : Number(row.totalCents),
  }));
}

/** Returns false when the invoice did not exist. */
export async function deleteInvoice(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { count } = await getPrisma().invoice.deleteMany({ where: { id } });
  return count > 0;
}

/**
 * Copies an invoice. The number is cleared (numbers are entered by hand), the issue date becomes
 * today, and the due date is cleared.
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
  return createInvoice(copy, source.templateId as TemplateId);
}

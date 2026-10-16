"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { STORED_STATUSES } from "@/lib/invoice-status";
import { invoiceSchema, partySchema } from "@/lib/schemas/invoice";
import { sellerProfileSchema } from "@/lib/schemas/seller";
import { createCustomer, deleteCustomer } from "@/server/customer-store";
import {
  createInvoice,
  deleteInvoice,
  duplicateInvoice,
  setInvoiceStatus,
  updateInvoice,
} from "@/server/invoice-store";
import { createSeller, deleteSeller, setDefaultSeller, updateSeller } from "@/server/seller-store";

/**
 * Server Actions are public HTTP endpoints, so every argument is validated here even though the
 * forms already validated it in the browser.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

function invalid(error: z.ZodError): { ok: false; error: string } {
  const first = error.issues[0];
  const where = first?.path.length ? `${first.path.join(".")}: ` : "";
  return { ok: false, error: `${where}${first?.message ?? "Invalid input"}` };
}

export async function saveInvoiceAction(
  id: string | null,
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  if (id === null) {
    const created = await createInvoice(parsed.data);
    refresh();
    return { ok: true, id: created.id };
  }
  const updated = await updateInvoice(id, parsed.data);
  if (!updated) return { ok: false, error: "This invoice no longer exists" };
  refresh();
  return { ok: true, id: updated.id };
}

export async function setInvoiceStatusAction(id: string, status: unknown): Promise<ActionResult> {
  const parsed = z.enum(STORED_STATUSES).safeParse(status);
  if (!parsed.success) return { ok: false, error: "Unknown status" };
  const done = await setInvoiceStatus(id, parsed.data);
  refresh();
  return done ? { ok: true } : { ok: false, error: "This invoice no longer exists" };
}

export async function deleteInvoiceAction(id: string): Promise<ActionResult> {
  const deleted = await deleteInvoice(id);
  refresh();
  return deleted ? { ok: true } : { ok: false, error: "This invoice no longer exists" };
}

export async function duplicateInvoiceAction(id: string): Promise<ActionResult> {
  const copy = await duplicateInvoice(id);
  if (!copy) return { ok: false, error: "This invoice no longer exists" };
  redirect(`/invoices/${copy.id}`);
}

export async function saveCustomerAction(input: unknown): Promise<ActionResult> {
  const parsed = partySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await createCustomer(parsed.data);
  refresh();
  return { ok: true };
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  const deleted = await deleteCustomer(id);
  refresh();
  return deleted ? { ok: true } : { ok: false, error: "This customer no longer exists" };
}

export async function saveSellerAction(
  id: string | null,
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = sellerProfileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const seller =
    id === null ? await createSeller(parsed.data) : await updateSeller(id, parsed.data);
  if (!seller) return { ok: false, error: "This seller no longer exists" };
  refresh();
  return { ok: true, id: seller.id };
}

export async function setDefaultSellerAction(id: string): Promise<ActionResult> {
  const done = await setDefaultSeller(id);
  refresh();
  return done ? { ok: true } : { ok: false, error: "This seller no longer exists" };
}

export async function deleteSellerAction(id: string): Promise<ActionResult> {
  const deleted = await deleteSeller(id);
  refresh();
  return deleted ? { ok: true } : { ok: false, error: "This seller no longer exists" };
}

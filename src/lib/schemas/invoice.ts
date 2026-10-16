import { z } from "zod";
import { DEFAULT_GST_RATE_BPS } from "@/lib/money";

/** Form inputs send "" for empty fields; treat those as not provided. */
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional());

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === null ? undefined : emptyToUndefined(v)), schema.optional());

const isoDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Must be a valid date (YYYY-MM-DD)");

const optionalDate = z.preprocess(emptyToUndefined, isoDate.optional());

const requiredName = z.string().trim().min(1, "Required").max(200);

export const partySchema = z.object({
  name: requiredName,
  address: optionalText,
  email: optionalText,
});

export const sellerSchema = partySchema.extend({
  phone: optionalText,
  nzbn: optionalText,
  gstNumber: optionalText,
});

export const lineItemSchema = z.object({
  description: optionalText,
  quantity: optionalNumber(z.number().finite().multipleOf(0.001)),
  unitPriceCents: optionalNumber(z.number().int()),
  discountPercent: optionalNumber(z.number().min(0).max(100).multipleOf(0.01)),
  gstApplicable: z.boolean().default(true),
});

/** Only the seller and buyer names are required; everything else is optional. */
export const invoiceSchema = z.object({
  title: optionalText,
  number: optionalText,
  issueDate: optionalDate,
  dueDate: optionalDate,
  currency: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, "Must be a 3-letter currency code")
      .transform((v) => v.toUpperCase())
      .default("NZD"),
  ),
  seller: sellerSchema,
  buyer: partySchema,
  paymentDetails: optionalText,
  notes: optionalText,
  pricesIncludeGst: z.boolean().default(false),
  gstRateBps: z.number().int().min(0).max(10000).default(DEFAULT_GST_RATE_BPS),
  lines: z.array(lineItemSchema).default([]),
});

export type InvoiceInput = z.input<typeof invoiceSchema>;
export type Invoice = z.output<typeof invoiceSchema>;

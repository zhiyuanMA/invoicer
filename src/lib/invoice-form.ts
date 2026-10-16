/**
 * The entry form works with strings (that is what inputs give us). This module converts the form
 * values into the shape the invoice schema validates.
 */

import { DEFAULT_TEMPLATE, HEX_COLOR, type FontId, type TemplateId } from "@/lib/design";
import type { Invoice } from "@/lib/schemas/invoice";

export type LineFormValues = {
  description: string;
  quantity: string;
  /** In dollars, as typed, e.g. "12.50" */
  unitPrice: string;
  /** Percent, as typed, e.g. "10" */
  discountPercent: string;
  gstApplicable: boolean;
};

export type InvoiceFormValues = {
  template: TemplateId;
  /** "" means the template's own accent colour. */
  accentColor: string;
  /** "" means the template's own font. */
  font: FontId | "";
  title: string;
  number: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  pricesIncludeGst: boolean;
  seller: {
    name: string;
    address: string;
    email: string;
    phone: string;
    nzbn: string;
    gstNumber: string;
  };
  buyer: { name: string; address: string; email: string; nzbn: string };
  paymentDetails: string;
  notes: string;
  lines: LineFormValues[];
};

export function emptyLine(): LineFormValues {
  return { description: "", quantity: "", unitPrice: "", discountPercent: "", gstApplicable: true };
}

export function defaultFormValues(): InvoiceFormValues {
  return {
    template: DEFAULT_TEMPLATE,
    accentColor: "",
    font: "",
    title: "",
    number: "",
    issueDate: "",
    dueDate: "",
    currency: "",
    pricesIncludeGst: false,
    seller: { name: "", address: "", email: "", phone: "", nzbn: "", gstNumber: "" },
    buyer: { name: "", address: "", email: "", nzbn: "" },
    paymentDetails: "",
    notes: "",
    lines: [emptyLine()],
  };
}

/** 1250 -> "12.50"; -500 -> "-5.00" */
export function centsToDollars(cents: number): string {
  const abs = Math.abs(cents);
  const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return cents < 0 ? `-${text}` : text;
}

/** Form values for editing a saved invoice (the inverse of `toInvoiceInput`). */
export function invoiceToFormValues(invoice: Invoice): InvoiceFormValues {
  const { seller, buyer } = invoice;
  return {
    template: invoice.template,
    accentColor: invoice.accentColor ?? "",
    font: invoice.font ?? "",
    title: invoice.title ?? "",
    number: invoice.number ?? "",
    issueDate: invoice.issueDate ?? "",
    dueDate: invoice.dueDate ?? "",
    currency: invoice.currency,
    pricesIncludeGst: invoice.pricesIncludeGst,
    seller: {
      name: seller.name,
      address: seller.address ?? "",
      email: seller.email ?? "",
      phone: seller.phone ?? "",
      nzbn: seller.nzbn ?? "",
      gstNumber: seller.gstNumber ?? "",
    },
    buyer: {
      name: buyer.name,
      address: buyer.address ?? "",
      email: buyer.email ?? "",
      nzbn: buyer.nzbn ?? "",
    },
    paymentDetails: invoice.paymentDetails ?? "",
    notes: invoice.notes ?? "",
    lines: invoice.lines.map((line) => ({
      description: line.description ?? "",
      quantity: line.quantity === undefined ? "" : String(line.quantity),
      unitPrice: line.unitPriceCents === undefined ? "" : centsToDollars(line.unitPriceCents),
      discountPercent: line.discountPercent === undefined ? "" : String(line.discountPercent),
      gstApplicable: line.gstApplicable,
    })),
  };
}

/** Form values for a new invoice, with the seller details and payment details prefilled. */
export function newInvoiceFormValues(seller: {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  nzbn?: string;
  gstNumber?: string;
  paymentDetails?: string;
}): InvoiceFormValues {
  const values = defaultFormValues();
  values.seller = {
    name: seller.name ?? "",
    address: seller.address ?? "",
    email: seller.email ?? "",
    phone: seller.phone ?? "",
    nzbn: seller.nzbn ?? "",
    gstNumber: seller.gstNumber ?? "",
  };
  values.paymentDetails = seller.paymentDetails ?? "";
  return values;
}

/** "" -> undefined; "2.5" -> 2.5; "abc" -> NaN (so the schema reports it). */
export function parseNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  return Number(trimmed);
}

/** "12.50" -> 1250; "" -> undefined; "abc" or "1.234" -> NaN. */
export function dollarsToCents(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) return NaN;
  return Math.round(Number(trimmed) * 100);
}

type ConvertedLine = {
  description: string;
  quantity: number | undefined;
  unitPriceCents: number | undefined;
  discountPercent: number | undefined;
  gstApplicable: boolean;
};

type ConvertedInvoice = Omit<InvoiceFormValues, "lines"> & { lines: ConvertedLine[] };

export function toInvoiceInput(values: InvoiceFormValues): ConvertedInvoice {
  return {
    ...values,
    lines: values.lines.map((line) => ({
      description: line.description,
      quantity: parseNumber(line.quantity),
      unitPriceCents: dollarsToCents(line.unitPrice),
      discountPercent: parseNumber(line.discountPercent),
      gstApplicable: line.gstApplicable,
    })),
  };
}

const finiteOrUndefined = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) ? value : undefined;

/**
 * The preview is always shown while typing: until the required names are typed it uses
 * placeholders, and half-typed numbers or currency codes are ignored instead of blocking it.
 */
export function toPreviewInput(values: InvoiceFormValues): unknown {
  const input = toInvoiceInput(values);
  return {
    ...input,
    currency: /^[A-Za-z]{3}$/.test(input.currency.trim()) ? input.currency : "",
    accentColor: HEX_COLOR.test(input.accentColor) ? input.accentColor : "",
    seller: { ...input.seller, name: input.seller.name.trim() || "Your company" },
    buyer: { ...input.buyer, name: input.buyer.name.trim() || "Client name" },
    lines: input.lines.map((line) => ({
      ...line,
      quantity: finiteOrUndefined(line.quantity),
      unitPriceCents: finiteOrUndefined(line.unitPriceCents),
      discountPercent: finiteOrUndefined(line.discountPercent),
    })),
  };
}

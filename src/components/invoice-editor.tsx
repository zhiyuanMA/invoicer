"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { saveCustomerAction, saveInvoiceAction } from "@/app/actions";
import { ACCENT_PRESETS, FONT_IDS, FONT_LABELS, TEMPLATE_IDS, type FontId } from "@/lib/design";
import type { Status } from "@/lib/invoice-status";
import { todayInAuckland } from "@/lib/format";
import {
  emptyLine,
  toInvoiceInput,
  toPreviewInput,
  type InvoiceFormValues,
} from "@/lib/invoice-form";
import { invoiceSchema, partySchema } from "@/lib/schemas/invoice";
import type { Customer } from "@/server/customer-store";
import type { Seller } from "@/server/seller-store";
import { templates } from "@/templates";
import { Field, Section, inputClass } from "./fields";
import { InvoiceStatusSelect } from "./invoice-status-select";
import { InvoicePreview } from "./invoice-preview";

/** Maps a schema issue path to the form field name that produced it. */
function fieldName(path: PropertyKey[]): string {
  return path.map((part) => (part === "unitPriceCents" ? "unitPrice" : String(part))).join(".");
}

function friendlyMessage(message: string): string {
  if (message.includes("NaN")) return "Must be a number";
  return message;
}

function touchedAt(touched: unknown, name: string): boolean {
  let node = touched;
  for (const part of name.split(".")) {
    if (node === null || typeof node !== "object") return false;
    node = (node as Record<string, unknown>)[part];
  }
  return node === true;
}

type Message = { kind: "ok" | "error"; text: string } | null;

export function InvoiceEditor({
  invoiceId,
  status,
  initialValues,
  customers,
  sellers,
}: {
  /** Set when editing a saved invoice. */
  invoiceId?: string;
  /** The saved invoice's status (including overdue), when editing. */
  status?: Status;
  initialValues: InvoiceFormValues;
  customers: Customer[];
  sellers: Seller[];
}) {
  const router = useRouter();
  const { register, control, setValue, formState } = useForm<InvoiceFormValues>({
    defaultValues: initialValues,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const values = useWatch({ control }) as InvoiceFormValues;

  const [attempted, setAttempted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  // A new invoice's issue date defaults to today in New Zealand. Done after mount to avoid a
  // server/client mismatch.
  useEffect(() => {
    if (!invoiceId) setValue("issueDate", todayInAuckland());
  }, [invoiceId, setValue]);

  const accent = values.accentColor || templates[values.template].defaultAccent;

  const strict = useMemo(() => invoiceSchema.safeParse(toInvoiceInput(values)), [values]);
  const preview = useMemo(() => invoiceSchema.safeParse(toPreviewInput(values)), [values]);

  const errors = useMemo(() => {
    const map = new Map<string, string>();
    if (!strict.success) {
      for (const issue of strict.error.issues) {
        const name = fieldName(issue.path);
        if (!map.has(name)) map.set(name, friendlyMessage(issue.message));
      }
    }
    return map;
  }, [strict]);

  /** Show an error once the user has left the field, or after a save or download attempt. */
  function errorFor(name: string): string | undefined {
    const message = errors.get(name);
    if (!message) return undefined;
    return attempted || touchedAt(formState.touchedFields, name) ? message : undefined;
  }

  const invalid = (name: string) => (errorFor(name) ? true : undefined);

  async function save() {
    setMessage(null);
    if (!strict.success) {
      setAttempted(true);
      return;
    }
    setSaving(true);
    try {
      const result = await saveInvoiceAction(invoiceId ?? null, strict.data);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
      } else if (!invoiceId) {
        // The new invoice now exists; continue editing it at its own address.
        router.replace(`/invoices/${result.id}`);
      } else {
        setMessage({ kind: "ok", text: "Saved" });
      }
    } catch {
      setMessage({ kind: "error", text: "Could not save the invoice" });
    } finally {
      setSaving(false);
    }
  }

  /** Applies a saved seller to the seller fields and the payment details. */
  function applySeller(id: string) {
    const seller = sellers.find((s) => s.id === id);
    if (!seller) return;
    const options = { shouldDirty: true, shouldTouch: true };
    setValue("seller.name", seller.name, options);
    setValue("seller.address", seller.address ?? "", options);
    setValue("seller.email", seller.email ?? "", options);
    setValue("seller.phone", seller.phone ?? "", options);
    setValue("seller.nzbn", seller.nzbn ?? "", options);
    setValue("seller.gstNumber", seller.gstNumber ?? "", options);
    setValue("paymentDetails", seller.paymentDetails ?? "", options);
  }

  /** Applies a saved customer to the buyer fields. */
  function applyCustomer(id: string) {
    const customer = customers.find((c) => c.id === id);
    if (!customer) return;
    const options = { shouldDirty: true, shouldTouch: true };
    setValue("buyer.name", customer.name, options);
    setValue("buyer.address", customer.address ?? "", options);
    setValue("buyer.email", customer.email ?? "", options);
    setValue("buyer.nzbn", customer.nzbn ?? "", options);
  }

  async function saveBuyerAsCustomer() {
    setMessage(null);
    const parsed = partySchema.safeParse(values.buyer);
    if (!parsed.success) {
      setAttempted(true);
      setMessage({ kind: "error", text: "Enter the buyer name first" });
      return;
    }
    const result = await saveCustomerAction(parsed.data);
    setMessage(
      result.ok ? { kind: "ok", text: "Customer saved" } : { kind: "error", text: result.error },
    );
  }

  async function download() {
    setMessage(null);
    if (!strict.success) {
      setAttempted(true);
      return;
    }
    setDownloading(true);
    try {
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(strict.data),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }
      const blob = await response.blob();
      const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = match?.[1] ?? "invoice.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not generate the PDF",
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex-1">
      <div className="sticky top-[53px] z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <h1 className="text-base font-semibold text-zinc-900">
            {invoiceId ? "Edit invoice" : "New invoice"}
          </h1>
          <div className="flex items-center gap-3">
            {attempted && !strict.success && (
              <span className="text-sm text-red-600">Fix the highlighted fields first</span>
            )}
            {invoiceId && status && <InvoiceStatusSelect id={invoiceId} effective={status} />}
            {message && (
              <span
                className={
                  message.kind === "ok" ? "text-sm text-green-700" : "text-sm text-red-600"
                }
              >
                {message.text}
              </span>
            )}
            <button
              type="button"
              onClick={download}
              disabled={downloading || saving}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
            >
              {downloading ? "Generating…" : "Download PDF"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || downloading}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()} noValidate>
          <Section title="Design">
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-zinc-600">Template</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {TEMPLATE_IDS.map((id) => (
                  <label
                    key={id}
                    className="cursor-pointer rounded-md border border-zinc-200 p-3 text-sm has-[:checked]:border-zinc-900 has-[:checked]:ring-1 has-[:checked]:ring-zinc-900"
                  >
                    <input type="radio" value={id} className="sr-only" {...register("template")} />
                    <span className="block font-medium text-zinc-900">{templates[id].label}</span>
                    <span className="block text-xs text-zinc-500">{templates[id].description}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <span className="mb-1 block text-xs font-medium text-zinc-600">Accent colour</span>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use ${color}`}
                    aria-pressed={accent === color}
                    onClick={() => setValue("accentColor", color, { shouldDirty: true })}
                    style={{ backgroundColor: color }}
                    className="h-7 w-7 rounded-full border border-zinc-300 aria-pressed:ring-2 aria-pressed:ring-zinc-900 aria-pressed:ring-offset-2"
                  />
                ))}
                <input
                  type="color"
                  aria-label="Custom accent colour"
                  value={accent}
                  onChange={(event) =>
                    setValue("accentColor", event.target.value, { shouldDirty: true })
                  }
                  className="h-7 w-10 cursor-pointer rounded border border-zinc-300 bg-white p-0.5"
                />
                <button
                  type="button"
                  onClick={() => setValue("accentColor", "", { shouldDirty: true })}
                  className="text-sm text-zinc-500 hover:text-zinc-900"
                >
                  Use the template&apos;s colour
                </button>
              </div>
            </div>
            <Field label="Font">
              <select className={inputClass} {...register("font")}>
                <option value="">
                  Template default ({FONT_LABELS[templates[values.template].defaultFont]})
                </option>
                {FONT_IDS.map((id: FontId) => (
                  <option key={id} value={id}>
                    {FONT_LABELS[id]}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="Invoice">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" error={errorFor("title")}>
                <input className={inputClass} placeholder="Invoice" {...register("title")} />
              </Field>
              <Field label="Number" error={errorFor("number")}>
                <input className={inputClass} placeholder="INV-001" {...register("number")} />
              </Field>
              <Field label="Issue date" error={errorFor("issueDate")}>
                <input type="date" className={inputClass} {...register("issueDate")} />
              </Field>
              <Field label="Due date" error={errorFor("dueDate")}>
                <input type="date" className={inputClass} {...register("dueDate")} />
              </Field>
              <Field label="Currency" error={errorFor("currency")}>
                <input
                  className={inputClass}
                  placeholder="NZD"
                  maxLength={3}
                  aria-invalid={invalid("currency")}
                  {...register("currency")}
                />
              </Field>
            </div>
          </Section>

          <Section title="From (seller)">
            <Field label="Saved seller">
              <select
                className={inputClass}
                defaultValue=""
                onChange={(event) => {
                  applySeller(event.target.value);
                  event.target.value = "";
                }}
              >
                <option value="">
                  {sellers.length === 0 ? "No saved sellers yet" : "Choose a seller…"}
                </option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.label}
                    {seller.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name" required error={errorFor("seller.name")}>
              <input
                className={inputClass}
                aria-invalid={invalid("seller.name")}
                {...register("seller.name")}
              />
            </Field>
            <Field label="Address">
              <textarea rows={2} className={inputClass} {...register("seller.address")} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email">
                <input className={inputClass} {...register("seller.email")} />
              </Field>
              <Field label="Phone">
                <input className={inputClass} {...register("seller.phone")} />
              </Field>
              <Field label="NZBN">
                <input className={inputClass} {...register("seller.nzbn")} />
              </Field>
              <Field label="GST number">
                <input className={inputClass} {...register("seller.gstNumber")} />
              </Field>
            </div>
          </Section>

          <Section title="Bill to (buyer)">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <Field label="Saved customer">
                  <select
                    className={inputClass}
                    defaultValue=""
                    onChange={(event) => {
                      applyCustomer(event.target.value);
                      event.target.value = "";
                    }}
                  >
                    <option value="">
                      {customers.length === 0 ? "No saved customers yet" : "Choose a customer…"}
                    </option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <button
                type="button"
                onClick={saveBuyerAsCustomer}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Save as customer
              </button>
            </div>
            <Field label="Name" required error={errorFor("buyer.name")}>
              <input
                className={inputClass}
                aria-invalid={invalid("buyer.name")}
                {...register("buyer.name")}
              />
            </Field>
            <Field label="Address">
              <textarea rows={2} className={inputClass} {...register("buyer.address")} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email">
                <input className={inputClass} {...register("buyer.email")} />
              </Field>
              <Field label="NZBN">
                <input className={inputClass} {...register("buyer.nzbn")} />
              </Field>
            </div>
          </Section>

          <Section title="Line items">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" {...register("pricesIncludeGst")} />
              Prices include GST (15%)
            </label>
            <p className="text-xs text-zinc-500">
              A line counts towards the totals only when both quantity and unit price are filled in.
            </p>
            {fields.map((item, index) => (
              <div key={item.id} className="space-y-2 rounded-md border border-zinc-200 p-3">
                <Field label="Description">
                  <input className={inputClass} {...register(`lines.${index}.description`)} />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Quantity" error={errorFor(`lines.${index}.quantity`)}>
                    <input
                      inputMode="decimal"
                      className={inputClass}
                      aria-invalid={invalid(`lines.${index}.quantity`)}
                      {...register(`lines.${index}.quantity`)}
                    />
                  </Field>
                  <Field label="Unit price ($)" error={errorFor(`lines.${index}.unitPrice`)}>
                    <input
                      inputMode="decimal"
                      className={inputClass}
                      aria-invalid={invalid(`lines.${index}.unitPrice`)}
                      {...register(`lines.${index}.unitPrice`)}
                    />
                  </Field>
                  <Field label="Discount (%)" error={errorFor(`lines.${index}.discountPercent`)}>
                    <input
                      inputMode="decimal"
                      className={inputClass}
                      aria-invalid={invalid(`lines.${index}.discountPercent`)}
                      {...register(`lines.${index}.discountPercent`)}
                    />
                  </Field>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    <input type="checkbox" {...register(`lines.${index}.gstApplicable`)} />
                    GST applies
                  </label>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-sm text-zinc-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => append(emptyLine())}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Add line
            </button>
          </Section>

          <Section title="Payment and notes">
            <Field label="Payment details">
              <textarea rows={3} className={inputClass} {...register("paymentDetails")} />
            </Field>
            <Field label="Notes">
              <textarea rows={3} className={inputClass} {...register("notes")} />
            </Field>
          </Section>
        </form>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <InvoicePreview invoice={preview.success ? preview.data : null} />
        </div>
      </main>
    </div>
  );
}

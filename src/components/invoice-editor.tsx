"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { todayInAuckland } from "@/lib/format";
import {
  defaultFormValues,
  emptyLine,
  toInvoiceInput,
  toPreviewInput,
  type InvoiceFormValues,
} from "@/lib/invoice-form";
import { invoiceSchema } from "@/lib/schemas/invoice";
import { Field, Section, inputClass } from "./fields";
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

export function InvoiceEditor() {
  const { register, control, setValue, formState } = useForm<InvoiceFormValues>({
    defaultValues: defaultFormValues(),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const values = useWatch({ control }) as InvoiceFormValues;

  const [attempted, setAttempted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // The issue date defaults to today in New Zealand. Done after mount to avoid a server/client mismatch.
  useEffect(() => {
    setValue("issueDate", todayInAuckland());
  }, [setValue]);

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

  /** Show an error once the user has left the field, or after a download attempt. */
  function errorFor(name: string): string | undefined {
    const message = errors.get(name);
    if (!message) return undefined;
    return attempted || touchedAt(formState.touchedFields, name) ? message : undefined;
  }

  const invalid = (name: string) => (errorFor(name) ? true : undefined);

  async function download() {
    setDownloadError(null);
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
      setDownloadError(error instanceof Error ? error.message : "Could not generate the PDF");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <h1 className="text-lg font-semibold text-zinc-900">Invoicer</h1>
          <div className="flex items-center gap-3">
            {attempted && !strict.success && (
              <span className="text-sm text-red-600">Fix the highlighted fields first</span>
            )}
            {downloadError && <span className="text-sm text-red-600">{downloadError}</span>}
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {downloading ? "Generating…" : "Download PDF"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <form className="space-y-4" onSubmit={(event) => event.preventDefault()} noValidate>
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

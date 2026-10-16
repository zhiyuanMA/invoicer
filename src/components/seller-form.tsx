"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { saveSellerAction } from "@/app/actions";
import { Field, Section, inputClass } from "./fields";

export type SellerFormValues = {
  label: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  nzbn: string;
  gstNumber: string;
  paymentDetails: string;
};

export const emptySellerFormValues: SellerFormValues = {
  label: "",
  name: "",
  address: "",
  email: "",
  phone: "",
  nzbn: "",
  gstNumber: "",
  paymentDetails: "",
};

export function SellerForm({
  sellerId,
  initialValues,
}: {
  /** Set when editing an existing seller. */
  sellerId?: string;
  initialValues: SellerFormValues;
}) {
  const router = useRouter();
  const { register, handleSubmit, formState } = useForm<SellerFormValues>({
    defaultValues: initialValues,
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    const result = await saveSellerAction(sellerId ?? null, values);
    if (!result.ok) {
      setMessage({ ok: false, text: result.error });
    } else if (!sellerId) {
      router.push("/sellers");
    } else {
      setMessage({ ok: true, text: "Saved" });
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Section title="Seller details">
        <Field label="Label" error={undefined}>
          <input
            className={inputClass}
            placeholder="Shown in lists. Defaults to the name"
            {...register("label")}
          />
        </Field>
        <Field label="Name" required error={formState.errors.name?.message}>
          <input
            className={inputClass}
            aria-invalid={formState.errors.name ? true : undefined}
            {...register("name", { validate: (v) => v.trim() !== "" || "Required" })}
          />
        </Field>
        <Field label="Address">
          <textarea rows={2} className={inputClass} {...register("address")} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <input className={inputClass} {...register("email")} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} {...register("phone")} />
          </Field>
          <Field label="NZBN">
            <input className={inputClass} {...register("nzbn")} />
          </Field>
          <Field label="GST number">
            <input className={inputClass} {...register("gstNumber")} />
          </Field>
        </div>
        <Field label="Payment details">
          <textarea rows={3} className={inputClass} {...register("paymentDetails")} />
        </Field>
      </Section>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {formState.isSubmitting ? "Saving…" : "Save seller"}
        </button>
        {message && (
          <span className={message.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { saveCustomerAction } from "@/app/actions";
import { Field, Section, inputClass } from "./fields";

type CustomerFormValues = {
  name: string;
  address: string;
  email: string;
  nzbn: string;
};

const emptyValues: CustomerFormValues = { name: "", address: "", email: "", nzbn: "" };

export function CustomerForm() {
  const router = useRouter();
  const { register, handleSubmit, formState } = useForm<CustomerFormValues>({
    defaultValues: emptyValues,
  });
  const [error, setError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await saveCustomerAction(values);
    if (result.ok) router.push("/customers");
    else setError(result.error);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Section title="Customer details">
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
          <Field label="NZBN">
            <input className={inputClass} {...register("nzbn")} />
          </Field>
        </div>
      </Section>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {formState.isSubmitting ? "Saving…" : "Save customer"}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}

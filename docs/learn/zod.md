# Zod: what it is, why we use it, how to use it

Zod is a TypeScript library for **describing the shape of data and checking real data against it**.
This repo uses Zod 4. The main example throughout is the invoice schema in
[src/lib/schemas/invoice.ts](../../src/lib/schemas/invoice.ts), with tests in
[invoice.test.ts](../../src/lib/schemas/invoice.test.ts).

## 1. Why we use it

### The problem: types disappear at runtime

TypeScript types are checked while you build, then erased. Nothing stops this at runtime:

```ts
type Invoice = { seller: { name: string } };

const body = await request.json(); // type: any
const invoice: Invoice = body; // compiles fine, but body could be anything
invoice.seller.name; // crashes if the client sent {}
```

Data that comes from outside your code is **untrusted**: form submissions, JSON bodies, URL
parameters, database rows written by older code, `localStorage`. TypeScript cannot check it, because
it only exists when the program runs.

### The solution: validate at the boundary

Zod lets you write a **schema** and run it against the data. If it passes, you get data that is
**both validated and correctly typed**:

```ts
const result = invoiceSchema.safeParse(untrustedInput);
if (result.success) {
  result.data; // typed as Invoice, and guaranteed to match
}
```

### One schema, three jobs

In this project the same schema is used for:

1. **Runtime validation** on the server (Server Actions and Route Handlers).
2. **Form validation** in the browser, so users see errors immediately (React Hook Form for state,
   the schema for the rules).
3. **The TypeScript type**, derived with `z.infer`, so the type and the validation can never drift
   apart.

Without Zod you would write the type, the validation function and the form rules separately and keep
them in sync by hand.

### Why Zod rather than alternatives

Zod is the most widely used validation library in the TypeScript and React ecosystem, has first-class
integration with React Hook Form, and is typically expected on TypeScript job listings. Alternatives
(Valibot, ArkType, Yup) solve the same problem.

## 2. The basics

```ts
import { z } from "zod";

const User = z.object({
  name: z.string().min(1),
  age: z.number().int().optional(),
});
```

### Parsing

| Method                   | On success                | On failure                  |
| ------------------------ | ------------------------- | --------------------------- |
| `schema.parse(data)`     | returns data              | **throws** a `ZodError`     |
| `schema.safeParse(data)` | `{ success: true, data }` | `{ success: false, error }` |

Prefer **`safeParse`** at boundaries: invalid input is expected, not exceptional, and you want to
turn it into a friendly error instead of a crash.

```ts
const result = User.safeParse({ name: "", age: 1.5 });
if (!result.success) {
  z.flattenError(result.error);
  // {
  //   formErrors: [],
  //   fieldErrors: {
  //     name: ["Too small: expected string to have >=1 characters"],
  //     age:  ["Invalid input: expected int, received number"]
  //   }
  // }
}
```

`z.flattenError` gives errors grouped per field, which is what a form needs. `z.prettifyError`
produces a readable multi-line string for logs. The raw list is `result.error.issues`.

### Getting the TypeScript type

```ts
type User = z.infer<typeof User>; // { name: string; age?: number | undefined }
```

When a schema transforms data or fills defaults, the input and output differ, so there are two
types:

```ts
type InvoiceInput = z.input<typeof invoiceSchema>; // what you may pass in (many fields optional)
type Invoice = z.output<typeof invoiceSchema>; // what you get out (defaults applied)
```

In this repo `Invoice.currency` is always a string (defaults to `"NZD"`), while
`InvoiceInput.currency` may be missing. `z.infer` is the same as `z.output`.

### Common building blocks

```ts
z.string()              z.number()            z.boolean()
z.string().min(1).max(200)
z.number().int().min(0).max(100)
z.enum(["draft", "sent", "paid"])
z.array(z.string())
z.object({ ... })
z.string().optional()   // may be undefined
z.string().nullable()   // may be null
z.string().default("NZD") // replaces undefined with a value
z.email()               // top-level format helpers in Zod 4 (also z.url(), z.uuid(), ...)
```

## 3. Behaviours worth knowing (all verified on this version)

- **Unknown keys are removed.** `z.object({ name: z.string() }).parse({ name: "a", extra: 1 })`
  returns `{ name: "a" }`. This is a useful safety property: extra fields sent by a client never
  reach your database.
- **`.default()` only applies to `undefined`**, not to an empty string:
  `z.string().default("NZD").parse(undefined)` gives `"NZD"`, but `parse("")` returns `""`.
- **`z.coerce.number()` turns `""` into `0`**, which is wrong for an optional field where "empty"
  must mean "not provided". This is the reason this project does not use `coerce` for numbers.
- **`.optional()` accepts `undefined`, not `null` or `""`.** HTML forms send empty strings, so they
  need converting first (next section).

## 4. How this project handles empty form fields

Almost every invoice field is optional, but a form sends `""` for an untouched input. The schema
converts `""` to `undefined` **before** validating, with `z.preprocess`:

```ts
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional());
```

`z.preprocess(fn, schema)` runs `fn` on the raw input first and then validates the result with
`schema`. So `""`, `"   "` and a missing field all end up as `undefined`, and the preview can
simply skip fields that are `undefined`.

The same idea handles numbers, where an empty input must not become `0`:

```ts
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === null ? undefined : emptyToUndefined(v)), schema.optional());
```

Note the effect on the rules: quantity and unit price are optional, and a line only counts towards
the totals when both are set ([src/lib/money.ts](../../src/lib/money.ts)). That rule depends on
"empty" staying distinct from `0`.

### Required vs optional in the invoice

```ts
export const invoiceSchema = z.object({
  title: optionalText, // optional
  number: optionalText, // optional, free-form string
  currency: currencySchema, // defaults to "NZD" when empty
  seller: sellerSchema, // seller.name is required
  buyer: partySchema, // buyer.name is required
  lines: z.array(lineItemSchema).default([]),
});
```

Required means "no `.optional()`". For a string, `z.string().trim().min(1, "Required")` rejects
both missing and blank values.

### Reusing and extending schemas

```ts
export const sellerSchema = partySchema.extend({
  phone: optionalText,
  nzbn: optionalText,
  gstNumber: optionalText,
});
```

`.extend()` builds a new object schema from an existing one, so seller reuses all the buyer fields.
Other useful helpers: `.pick()`, `.omit()`, `.partial()`.

### Custom checks with `refine`

```ts
const isoDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Must be a valid date (YYYY-MM-DD)");
```

`refine` adds a rule that the built-in checks cannot express, here "this is a real calendar date"
(it rejects `2026-02-30`). Return `true` when valid, `false` when not; the second argument is the
error message.

### Transforming output

```ts
z.string()
  .regex(/^[A-Za-z]{3}$/, "Must be a 3-letter currency code")
  .transform((v) => v.toUpperCase());
```

`.transform()` changes the value after validation. This is why `"aud"` is stored as `"AUD"`.

## 5. Using a schema in each layer

### Server Action (never skip this)

```ts
"use server";

export async function saveInvoice(input: unknown) {
  const result = invoiceSchema.safeParse(input);
  if (!result.success) {
    return { ok: false as const, errors: z.flattenError(result.error).fieldErrors };
  }
  // result.data is a validated, typed Invoice here
}
```

The parameter is typed `unknown` on purpose: it forces you to validate before using it.

### React Hook Form and live validation

The invoice form keeps every field as a string (that is what inputs give you) and converts the
values with `toInvoiceInput` in [src/lib/invoice-form.ts](../../src/lib/invoice-form.ts), for
example `"12.50"` dollars into `1250` cents. The result goes through `invoiceSchema.safeParse` on
every change in [invoice-editor.tsx](../../src/components/invoice-editor.tsx):

```ts
const strict = invoiceSchema.safeParse(toInvoiceInput(values));
// strict.error.issues -> messages shown next to the matching fields
// strict.data         -> what gets sent to /api/pdf
```

The schema's issue `path` (for example `["lines", 0, "quantity"]`) is joined into a field name
(`lines.0.quantity`) so each message appears under the right input. This works without
`@hookform/resolvers`, which is the usual way to plug a Zod schema into React Hook Form
(`useForm({ resolver: zodResolver(schema) })`). We validate manually because the form's string
values and the schema's number values differ and because errors are shown only after a field is
touched or a download is attempted.

### Database

Zod validates data going **into** Prisma. It does not replace the database schema; the two are
described separately and should be kept consistent.

## 6. Testing a schema

Schemas are plain functions, so they are easy to test. See
[invoice.test.ts](../../src/lib/schemas/invoice.test.ts):

```ts
it("accepts an invoice with only seller and buyer names", () => {
  const result = invoiceSchema.safeParse({ seller: { name: "Acme" }, buyer: { name: "Jane" } });
  expect(result.success).toBe(true);
});

it("requires seller and buyer names", () => {
  expect(invoiceSchema.safeParse({ seller: { name: "" }, buyer: { name: "Jane" } }).success).toBe(
    false,
  );
});
```

Test the boundaries: empty strings, missing fields, wrong types, and the defaults.

## 7. Common mistakes

- **Using `parse` and forgetting the `try/catch`**: use `safeParse` at boundaries.
- **Trusting the client's validation**: the browser can be bypassed; always validate on the server.
- **Declaring a type by hand next to the schema**: derive it with `z.infer`/`z.input`/`z.output`.
- **Using `z.coerce.number()` on optional inputs**: `""` becomes `0`. Use `preprocess` as above.
- **Expecting `.default()` to handle `""`**: it only replaces `undefined`.
- **Casting instead of parsing** (`data as Invoice`): this silences TypeScript without checking
  anything.

## 8. Further reading

- Zod documentation: https://zod.dev
- React Hook Form with resolvers: https://react-hook-form.com/get-started#SchemaValidation

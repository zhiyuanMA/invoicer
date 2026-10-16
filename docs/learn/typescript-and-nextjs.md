# TypeScript and Next.js: how this project is set up

A practical guide for someone new to TypeScript and Next.js. It explains what each piece is, how
this repository is configured, and how to start working in it. Examples point at real files in the
repo where possible.

Versions used here: Node.js 22, TypeScript 5, Next.js 16 (App Router), React 19.

> Next.js 16 differs from older tutorials you may find online. When in doubt, read the docs bundled
> with the installed version: `node_modules/next/dist/docs/` (see also [AGENTS.md](../../AGENTS.md)).

## 1. Getting started

```bash
npm install          # install dependencies from package-lock.json
npm run dev          # dev server at http://localhost:3000, with hot reload
```

Everyday commands (all defined in [package.json](../../package.json)):

| Command                | What it does                                                         |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run dev`          | Start the dev server                                                 |
| `npm run build`        | Production build (also type-checks and lints the code Next compiles) |
| `npm start`            | Run the production build                                             |
| `npm test`             | Run unit tests once (Vitest)                                         |
| `npm run test:watch`   | Re-run tests as files change                                         |
| `npm run lint`         | ESLint                                                               |
| `npm run typecheck`    | `next typegen && tsc --noEmit`, see [section 4](#4-type-checking)    |
| `npm run format`       | Format everything with Prettier                                      |
| `npm run format:check` | Check formatting without changing files (used in CI)                 |

The same checks run in CI on every push: [.github/workflows/ci.yml](../../.github/workflows/ci.yml).

### How the project was created

```bash
npx create-next-app@latest --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

- `--ts`: TypeScript project.
- `--app`: use the App Router (the `app/` directory), the current recommended router.
- `--src-dir`: put code in `src/` instead of the repo root.
- `--import-alias "@/*"`: lets you write `import { x } from "@/lib/money"` instead of
  `"../../lib/money"`.
- `--tailwind`: Tailwind CSS for styling.

Then we added `zod` (validation), `vitest` (tests), `prettier` and `eslint-config-prettier`
(formatting), plus a CI workflow.

## 2. TypeScript in five minutes

TypeScript is JavaScript plus a type system. The types are checked at build time and then erased:
**at runtime there is only JavaScript.** That last point is why we also use Zod (see
[zod.md](./zod.md)).

### Basic types

```ts
const name: string = "Acme";
const quantity: number = 2;
const paid: boolean = false;
const tags: string[] = ["a", "b"];
```

Most of the time you do not write the type; TypeScript infers it: `const quantity = 2` is already a
`number`.

### Object types and optional fields

```ts
type LineInput = {
  quantity?: number | null; // optional, and may be null
  unitPriceCents?: number | null;
  gstApplicable?: boolean;
};
```

`?` means the property may be missing (its type becomes `number | undefined`). `|` is a **union**:
the value is one of several types. This exact type is in [src/lib/money.ts](../../src/lib/money.ts).

`type` and `interface` both describe object shapes. This project uses `type` everywhere; pick one
and stay consistent.

### Narrowing

TypeScript tracks what you have checked:

```ts
function isSet(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

if (isSet(line.quantity)) {
  line.quantity; // here it is a number, not null/undefined
}
```

`value is number` is a **type guard**: a function that tells the compiler what a check proved.

### `unknown` vs `any`

`any` turns type checking off. `unknown` means "could be anything, check before use". Prefer
`unknown` for data from outside (user input, `JSON.parse`, network). Validating such data with Zod
turns `unknown` into a real type. Avoid `any`; ESLint is configured to complain about it.

### Generics (just enough to read them)

Types that take a type argument, written `Name<Type>`:

```ts
const lines: Array<LineInput> = []; // same as LineInput[]
const done: Promise<string> = fetchSomething(); // an async result
```

You will mostly read generics from libraries, not write them.

### `import type`

```ts
import type { NextConfig } from "next";
```

`import type` is erased completely at build time. Use it for things that exist only as types.

### Deriving types instead of repeating them

```ts
type Invoice = z.output<typeof invoiceSchema>;
```

`typeof invoiceSchema` takes the type of a value. The idea is to have **one source of truth** (the
Zod schema) and derive the type from it, so the two can never drift apart.

## 3. `tsconfig.json` explained

[tsconfig.json](../../tsconfig.json) tells TypeScript how to check the project.

| Option                            | Why it matters here                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `"strict": true`                  | Turns on all strict checks. The most important option; never turn it off.                |
| `"noEmit": true`                  | `tsc` only checks types and writes no files. Next.js does the actual compiling.          |
| `"moduleResolution": "bundler"`   | Imports resolve the way bundlers (Next/Turbopack, Vite) resolve them.                    |
| `"isolatedModules": true`         | Every file must be compilable on its own; required by the tools that compile TS quickly. |
| `"jsx": "react-jsx"`              | Enables JSX without importing React in every file.                                       |
| `"paths": { "@/*": ["./src/*"] }` | Defines the `@/` import alias. Vitest has the same alias in `vitest.config.mts`.         |
| `"plugins": [{ "name": "next" }]` | Editor plugin that understands Next.js files.                                            |
| `"skipLibCheck": true`            | Skips type-checking inside `node_modules` type files; faster, fewer false alarms.        |
| `"include"`                       | Which files to check. `.next/types/**` holds types Next generates.                       |

`next-env.d.ts` is generated by Next and git-ignored; do not edit it.

## 4. Type checking

There are two separate things that look at your types:

1. **Your editor** (VS Code) shows red squiggles as you type.
2. **`npm run typecheck`** runs the same check from the command line, so CI can fail on type errors.

The script is `next typegen && tsc --noEmit`, not just `tsc --noEmit`. Next.js generates some global
types (such as `LayoutProps` used in [src/app/layout.tsx](../../src/app/layout.tsx)) into `.next/`.
Without `next typegen` first, a fresh checkout fails with `Cannot find name 'LayoutProps'` until a
build has run.

## 5. Next.js App Router basics

### Routing is folders and special files

Everything under `src/app/` is the route tree. A folder is a URL segment; special file names give it
behaviour:

| File                                        | Purpose                                                   |
| ------------------------------------------- | --------------------------------------------------------- |
| `page.tsx`                                  | The UI for that URL. Without it the folder is not a page. |
| `layout.tsx`                                | UI shared by the page and everything below it             |
| `route.ts`                                  | An HTTP endpoint (Route Handler), for example a PDF route |
| `loading.tsx`, `error.tsx`, `not-found.tsx` | Loading, error and 404 UI for the segment                 |

```
src/app/page.tsx                         ->  /
src/app/invoices/page.tsx                ->  /invoices
src/app/invoices/[id]/page.tsx           ->  /invoices/123      ([id] is a dynamic segment)
src/app/api/invoices/[id]/pdf/route.ts   ->  /api/invoices/123/pdf
```

Folders starting with `_` (for example `_components`) are not routes, and you can colocate code
next to a page. Files outside `app/` (like `src/lib`, `src/components`) are plain modules.

[src/app/layout.tsx](../../src/app/layout.tsx) is the root layout: it renders `<html>` and `<body>`
and wraps every page.

### Dynamic params are a Promise

In this version of Next.js, the `params` and `searchParams` passed to a page are **Promises**:

```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <h1>Invoice {id}</h1>;
}
```

Old tutorials show `params.id` directly; that no longer works.

### Server Components and Client Components

Components in `app/` are **Server Components** by default: they run on the server, can read the
database or files directly, and send only HTML to the browser. They cannot use `useState`,
`useEffect` or event handlers like `onClick`.

Add `"use client"` at the top of a file to make it a **Client Component**, which runs in the browser
and can be interactive:

```tsx
"use client";

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

Rule of thumb: keep components on the server and add `"use client"` only for the small parts that
need state or events. A Server Component can render a Client Component, not the other way round
(except by passing it as `children`). For this app, the invoice form and live preview must be client
components; the invoice list page can be a server component.

### Server Actions (mutating data)

A **Server Function** is an async function marked `"use server"`. A client component can call it as
if it were local, and it runs on the server, which is how forms save data without writing an API
route:

```ts
// src/app/invoices/actions.ts
"use server";

import { invoiceSchema } from "@/lib/schemas/invoice";

export async function saveInvoice(input: unknown) {
  const result = invoiceSchema.safeParse(input); // never trust the client
  if (!result.success) return { ok: false as const, errors: result.error.issues };
  // ...save with Prisma...
  return { ok: true as const };
}
// The real ones are in src/app/actions.ts
```

Server Functions are public HTTP endpoints in disguise: **always validate their input on the
server**, even if the form already validated it in the browser.

### Why the PDF endpoint is in `src/pages/`

The PDF needs the template rendered to an HTML string with `react-dom/server`. Next.js does not
allow that import in App Router code, including Route Handlers, because they run in the Server
Components layer. The Pages Router has no such restriction, and both routers can live in one
project, so [src/pages/api/pdf.ts](../../src/pages/api/pdf.ts) is a Pages Router API route:
`export default function handler(req, res)`. If you see the error "You're importing a component
that imports react-dom/server", this is why.

### Route Handlers

`route.ts` files export functions named after HTTP methods and return a standard `Response`. A typical
example (this project's PDF endpoint is not one of these, see above):

```ts
// src/app/api/invoices/[id]/route.ts
export async function GET(request: Request, ctx: RouteContext<"/api/invoices/[id]">) {
  const { id } = await ctx.params;
  return Response.json({ id });
}
```

### Caching: `cacheComponents` is on

[next.config.ts](../../next.config.ts) sets `cacheComponents: true`, the default for new apps. What
that means in practice:

- Pages are prerendered into a static shell where possible.
- Reading **request-time data** (a database query, cookies, headers) that is not cached should sit
  inside a `<Suspense>` boundary, so the shell is sent immediately and that part streams in.
- To cache a result, mark an async function or component with the `"use cache"` directive and give
  it a lifetime with `cacheLife(...)`.
- For an invoice app, most data changes often, so database reads use `<Suspense>` rather than
  `"use cache"`: see [src/app/page.tsx](../../src/app/page.tsx), where `InvoiceList` awaits the
  database inside a Suspense boundary. The dev overlay tells you when a route
  blocks and suggests the fix.
- `GET` Route Handlers follow the same model: they run at request time by default.

Read `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` before building the
pages that read from the database (M3).

### Suspense and client-only randomness

With `cacheComponents` on, a client component that generates random values while prerendering
(React Hook Form's `useFieldArray` creates ids with `crypto.randomUUID()`) makes Next.js complain.
The fix used in [src/app/page.tsx](../../src/app/page.tsx) is to wrap the component in
`<Suspense>`, so it renders on the client instead of being prerendered.

### Styling

Tailwind utility classes go directly in `className`, for example
`className="flex items-center gap-4 text-zinc-600"`. Global CSS and Tailwind setup live in
[src/app/globals.css](../../src/app/globals.css). Dark mode variants use the `dark:` prefix.

## 6. Where code goes in this repo

```
src/app/          routes, layouts, Server Actions, Route Handlers
src/components/   UI: invoice-editor (form), invoice-preview
src/templates/    invoice templates, plain React components
src/lib/          pure logic: money.ts, schemas/, pdf.tsx
src/server/       database access (Prisma stores); see prisma-and-database.md
src/pages/api/    the PDF endpoint (Pages Router, see below)
```

Guideline: keep business logic (money, validation) in `src/lib` as plain TypeScript with no
React or Next imports. It is easy to unit test and reusable from both server and client.

Tests live next to the code: `money.ts` and `money.test.ts` in the same folder. Vitest picks up
`src/**/*.test.ts` (see `vitest.config.mts`).

## 7. A good first change

1. Run `npm run dev` and open `http://localhost:3000`.
2. Edit [src/app/page.tsx](../../src/app/page.tsx) and watch the browser update.
3. Add a function to `src/lib/money.ts`, write a test for it in `money.test.ts`, run `npm test`.
4. Before committing: `npm run format && npm run lint && npm run typecheck && npm test`.

## 8. Common stumbles

- **"Cannot find name 'LayoutProps'"**: run `npm run typecheck` (it runs `next typegen` first) or
  start `npm run dev` once.
- **Hooks error or `onClick` ignored in a Server Component**: add `"use client"` to that file.
- **`params.id` is undefined / a Promise warning**: `await params` first.
- **Red squiggle you do not understand**: hover for the message; read it from the bottom, the last
  line is usually the actual mismatch.
- **Formatting fails in CI**: run `npm run format` and commit the result.
- **Avoid `as` casts to silence errors** (`value as Invoice`). A cast tells the compiler to stop
  checking. Validate with Zod instead.

## 9. Further reading

- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/intro.html
- The bundled Next.js docs: `node_modules/next/dist/docs/01-app/01-getting-started/`
- React docs (components, state, hooks): https://react.dev/learn

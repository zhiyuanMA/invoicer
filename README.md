# invoicer

An invoice generator: pick a template, enter invoice details, preview live, and download a PDF.
Built with Next.js and TypeScript, aimed at New Zealand use (NZD, 15% GST).

> Status: M2 done (one template, entry form, live preview, PDF download). Invoices are not saved yet.

## Development

Requires Node.js 22+.

```bash
npm install
npx playwright install chromium   # one-off: the browser used to render PDFs
npm run dev           # start the dev server on http://localhost:3000
npm test              # unit tests (Vitest)
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm run format        # Prettier
```

## Design notes

- Only the seller name and buyer name are required; every other field is optional.
- Invoice numbers are free-form strings entered manually (no auto-generation, no uniqueness check).
- Amounts are stored as integer cents; GST rates as basis points (1500 = 15%).
- A line item needs both quantity and unit price to count towards totals; incomplete lines are still
  shown on the invoice, without an amount.
- GST is calculated once on the sum of GST-applicable lines, not per line.
- The live preview and the PDF come from the same template component (`src/templates`). The PDF is
  rendered on the server with headless Chromium, with scripts and all network access disabled.
- There is no authentication. Run it locally only; do not expose it to the public internet.

## Roadmap

- M3: PostgreSQL + Prisma, docker compose, invoice CRUD with content snapshots
- M4: more templates, themes, invoice status
- M5: production Dockerfile, E2E tests

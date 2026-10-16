# invoicer

An invoice generator: pick a template, enter invoice details, preview live, and download a PDF.
Built with Next.js and TypeScript, aimed at New Zealand use (NZD, 15% GST).

> Status: early development (M1: project setup, money/GST calculation, validation schema).

## Development

Requires Node.js 22+.

```bash
npm install
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
- There is no authentication. Run it locally only; do not expose it to the public internet.

## Roadmap

- M2: one template, entry form, live preview, PDF download
- M3: PostgreSQL + Prisma, docker compose, invoice CRUD with content snapshots
- M4: more templates, themes, invoice status
- M5: production Dockerfile, E2E tests

# invoicer

An invoice generator: pick a template, enter invoice details, preview live, and download a PDF.
Built with Next.js and TypeScript, aimed at New Zealand use (NZD, 15% GST).

> Status: M3 done (saved invoices with content snapshots, customers, multiple sellers, PostgreSQL).

## Development

Requires Node.js 22+ and Docker (for PostgreSQL).

```bash
npm install                       # also generates the Prisma client
cp .env.example .env              # database connection strings
npm run db:up                     # start PostgreSQL in Docker (localhost:5433)
npm run db:migrate                # create the tables
npx playwright install chromium   # one-off: the browser used to render PDFs
npm run dev                       # http://localhost:3000
```

Other commands:

```bash
npm test                  # unit tests (Vitest, no database needed)
npm run test:integration  # database tests against the invoicer_test database
npm run lint              # ESLint
npm run typecheck         # TypeScript
npm run format            # Prettier
npm run db:studio         # browse the database
npm run db:down           # stop PostgreSQL (data is kept in a Docker volume)
```

## Design notes

- Only the seller name and buyer name are required; every other field is optional.
- Invoice numbers are free-form strings entered manually (no auto-generation, no uniqueness check).
- Amounts are stored as integer cents; GST rates as basis points (1500 = 15%).
- A line item needs both quantity and unit price to count towards totals; incomplete lines are still
  shown on the invoice, without an amount.
- GST is calculated once on the sum of GST-applicable lines, not per line.
- Saving an invoice stores a full snapshot of it (seller, buyer, lines, tax settings) in PostgreSQL.
  Editing or deleting a seller or customer never alters a saved invoice.
- The live preview and the PDF come from the same template component (`src/templates`). The PDF is
  rendered on the server with headless Chromium, with scripts and all network access disabled.
- There is no authentication. Run it locally only; do not expose it to the public internet.

## Roadmap

- M4: more templates, themes, invoice status
- M5: production Dockerfile, E2E tests

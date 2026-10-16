# Requirements

An invoice generator in the spirit of Invoice Home: choose a template, enter details, preview live,
and download a PDF. It runs locally in Docker for a single user, and is aimed at New Zealand use.

## 1. Scope

### In scope (MVP)

- **Templates**: around three templates, with a selectable theme colour and font.
- **Data entry**:
  - Required: seller name and buyer name.
  - Optional: everything else, including seller address, contact details, NZBN and GST number; buyer
    address, email and NZBN; invoice title, number, issue date, due date, currency, payment details and
    notes; and line items.
- **Live preview**: edits appear on the template immediately. Empty fields are not rendered, and
  leave no blank placeholder.
- **PDF download**: rendered on the server on demand. PDF files are not stored.
- **Invoice management**: save drafts, list, edit, duplicate, and track status (draft, sent, paid,
  overdue).
- **Content snapshot**: saving an invoice stores its full content (seller, buyer, line items, tax
  settings, template and theme) in the database. Later changes to seller settings or templates do
  not affect saved invoices. PDFs are re-rendered from the snapshot each time.
- **Reuse**: seller details are a single global setting; customers can be saved and reused.

### Out of scope

Logo upload, authentication and multiple users, cloud deployment, third-party integrations (Xero,
Peppol), online payment, email sending, multiple languages, recurring invoices, PDF file storage,
automatic invoice numbering, and IRD tax invoice compliance checks.

## 2. Optional fields and line items

- **Invoice number**: entered manually as a free-form string such as `INV-2026-001`. It is never
  generated automatically and has no uniqueness constraint. The database primary key is a UUID and
  is unrelated to the invoice number. If left empty, the number is not shown.
- **Issue date**: defaults to today (Pacific/Auckland) and can be cleared.
- **Currency**: defaults to NZD.
- **Title**: optional free text, shown as "Invoice" by default. The user may type "Tax Invoice".
- **Line items**:
  - A line counts towards the totals only when both quantity and unit price are set.
  - Any other line is still shown on the PDF with its description, but without an amount, and is
    excluded from the subtotal, GST and total.
  - When no line counts, the totals block is not rendered.

## 3. New Zealand specifics

- Default currency NZD; GST rate 15%.
- Prices may be entered GST-inclusive or GST-exclusive.
- Dates are shown as DD/MM/YYYY, using the Pacific/Auckland time zone.
- There are no IRD tax invoice checks, warnings or restrictions. The application does not verify
  which fields are present and does not switch the title automatically.

## 4. Money rules

- Amounts are integer cents; GST rates are basis points (1500 = 15%).
- Rounding is half away from zero.
- GST is calculated once on the sum of GST-applicable lines, not per line, so rounding does not
  drift with the number of lines.
- Each line may be marked as not GST-applicable and may carry a percentage discount.

## 5. Non-functional requirements

- **Correctness**: money and GST calculations, and every combination of missing optional fields and
  incomplete line items, are covered by unit tests.
- **Security**:
  - There is no authentication, so the app binds to `localhost` only and the README warns against
    exposing it publicly.
  - The server re-validates all input with Zod.
  - User text in templates must be escaped to prevent XSS and HTML injection. This matters more
    because PDFs are rendered from HTML in a browser.
  - PDF rendering must not load external URLs (SSRF protection).
- **Maintainability**: templates are decoupled from business logic; adding a template means adding
  one component and registering it.
- **Runnability**: `docker compose up` starts the app, including database migrations.

## 6. Milestones

1. **M1** (done): project skeleton, lint, formatting, tests, CI; money and GST calculation with tests; Zod
   schema (only the two names are required).
2. **M2** (done): one template, entry form, live preview, PDF download. No database yet; already
   demonstrable.
3. **M3**: Prisma and PostgreSQL, docker compose, invoice CRUD with content snapshots, customers,
   seller settings.
4. **M4**: multiple templates, theme settings, invoice status, list filtering.
5. **M5**: production Dockerfile with Chromium, Playwright E2E tests, README and screenshots.

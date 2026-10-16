# Prisma, PostgreSQL and Docker: how data is stored here

For someone new to databases in a TypeScript project. It explains what each piece does and how this
repository uses it. Versions: PostgreSQL 17, Prisma 7.

## 1. The pieces

| Piece                                      | Job                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| **PostgreSQL**                             | The database server. Stores tables of rows. Runs in Docker, not installed on the Mac. |
| **Docker Compose** (`docker-compose.yml`)  | Starts PostgreSQL with one command and keeps its data in a volume.                    |
| **Prisma schema** (`prisma/schema.prisma`) | Describes the tables in a readable language. The single source of truth.              |
| **Prisma Migrate**                         | Turns schema changes into SQL files (`prisma/migrations/`) and applies them.          |
| **Prisma Client**                          | A generated, fully typed TypeScript API for querying: `prisma.invoice.findMany()`.    |
| **Driver adapter** (`@prisma/adapter-pg`)  | Lets Prisma 7 talk to PostgreSQL through the standard `pg` driver.                    |

## 2. Everyday commands

```bash
npm run db:up        # start PostgreSQL (waits until it is healthy)
npm run db:migrate   # apply schema changes; creates a migration if the schema changed
npm run db:studio    # a browser UI to look at the data
npm run db:down      # stop it; data stays in the Docker volume
```

First time on a new machine: `npm install`, `cp .env.example .env`, `npm run db:up`,
`npm run db:migrate`.

Why port **5433**? Another project on this machine already uses 5432, so
[docker-compose.yml](../../docker-compose.yml) publishes ours on `127.0.0.1:5433`. The connection
string in `.env` matches that.

## 3. The schema

[prisma/schema.prisma](../../prisma/schema.prisma) has three models, each of which becomes a table:

- **Invoice** (`invoices`): one row per saved invoice.
- **Customer** (`customers`): buyers saved for reuse.
- **Seller** (`sellers`): the businesses you invoice as. Several can exist; one can be the default.

A model looks like this:

```prisma
model Customer {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  address   String?          // "?" means optional (nullable)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("customers")         // the actual table name
}
```

### Changing the schema

1. Edit `schema.prisma`.
2. Run `npm run db:migrate` and give the change a name. Prisma writes a SQL file in
   `prisma/migrations/` and applies it.
3. Commit the migration file together with the schema change. Never edit an applied migration;
   add a new one instead.

The generated client (`src/generated/prisma`) is git-ignored. `npm install` regenerates it
(the `postinstall` script runs `prisma generate`), and you can run `npx prisma generate` yourself
after editing the schema.

## 4. Snapshots: the key design idea

An invoice must not change after the fact. If you rename a seller, or delete a
customer, an invoice you sent last month must still show the old details.

So `invoices.content` is a **JSON snapshot of the whole invoice**: seller, buyer, line items, tax
settings. Nothing in `invoices` points at `customers` or `sellers` (no foreign keys), so
there is no way for those tables to change it. Copying a customer into the buyer fields of an
invoice is just copying text.

A few values are also copied into ordinary columns (`number`, `buyerName`, `issueDate`,
`currency`, `totalCents`) so the list page can show them without parsing every JSON blob. They are
written together with the snapshot in one place,
[summarise() in invoice-store.ts](../../src/server/invoice-store.ts), so they cannot disagree.

When an invoice is read back, the JSON is validated again with the Zod schema
(`invoiceSchema.safeParse`). The database is another boundary where data is not guaranteed to match
your types, for example after the schema changed.

### Several sellers and the default

Sellers work like customers (saved, then picked in the editor), plus one extra rule: at most one
seller is the **default**, and the default prefills new invoices. Prisma cannot declare "at most one
row has `isDefault = true`" (that needs a partial unique index, which Prisma Migrate does not
manage), so the rule is kept in code:
[setDefaultSeller](../../src/server/seller-store.ts) clears the flag on the others and sets it on
the chosen one inside a single transaction, and the integration tests check that there is never
more than one default. This is safe for a single-user app; a multi-user app would want the database
to enforce it.

## 5. Money in the database

Amounts are integer **cents**, never floating point (`0.1 + 0.2` is not `0.3` in JavaScript).
`totalCents` is a `BigInt` column because a total can exceed what a 32-bit `Int` holds. Prisma
returns it as a JavaScript `bigint`; the store converts it to a `number`, which is safe because the
schema limits quantities and prices so totals stay below 2e15.

## 6. Where the database code lives

```
src/server/db.ts                     one PrismaClient per process, created lazily
src/server/invoice-store.ts          create, read, update, list, delete, duplicate invoices
src/server/customer-store.ts         customers
src/server/seller-store.ts           sellers, including the default
src/app/actions.ts                   Server Actions: validate input, call a store, refresh the page
```

Rules followed here:

- Only code in `src/server/` and the Pages API routes touches Prisma. Components never import it.
- Stores take validated data and return plain objects. They do not know about HTTP or React.
- Server Actions validate every argument again, because they are public endpoints.
- The client is created lazily so importing the module never needs a database (for example during
  `next build`), and it is cached on `globalThis` so dev hot reloads do not open a new connection
  pool each time.

## 7. Reading data in pages

Pages read the database in async Server Components:

```tsx
export default function InvoicesPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <InvoiceList />
    </Suspense>
  );
}

async function InvoiceList() {
  const invoices = await listInvoices(); // runs on the server, per request
  // ...
}
```

With `cacheComponents` enabled, database reads are not cached and happen at request time. The
`<Suspense>` boundary lets Next.js send the page shell immediately and stream the list in. After a
mutation, the Server Action calls `refresh()` so the current page re-reads the data.

## 8. Tests

Two kinds of test, because they have different costs:

- `npm test`: fast unit tests, no database. This is what runs most often.
- `npm run test:integration`: [stores.integration.test.ts](../../src/server/stores.integration.test.ts)
  runs the stores against a real PostgreSQL database, `invoicer_test`. It applies the migrations
  first, and **refuses to run unless the database name ends in `_test`**, because the tests delete
  every row. CI starts a PostgreSQL service for it.

Mocking a database tells you little; running against a real one catches mistakes such as wrong
column types, `BigInt` handling and invalid UUIDs.

## 9. Common problems

- **"DATABASE_URL is not set"**: copy `.env.example` to `.env`.
- **"Can't reach database server"**: run `npm run db:up`; check Docker is running.
- **"Something went wrong" page**: usually the database is down; see the message above.
- **Schema and database out of sync**: run `npm run db:migrate`.
- **Start over with an empty database**: `docker compose down -v` deletes the volume (all data),
  then `npm run db:up && npm run db:migrate`.
- **Prisma client types missing**: run `npx prisma generate`.

## 10. Further reading

- Prisma documentation: https://www.prisma.io/docs
- PostgreSQL tutorial: https://www.postgresql.org/docs/current/tutorial.html

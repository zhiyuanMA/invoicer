# Tech stack

The stack follows what is common in New Zealand job listings for TypeScript and Node.js roles:
React, Next.js, PostgreSQL, Docker and CI. The application is a single Next.js project that runs
locally in Docker; there is no cloud deployment or authentication.

| Layer              | Choice                                                                       | Notes                                                                     |
| ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Language           | TypeScript (strict)                                                          |                                                                           |
| Framework          | Next.js (App Router), full stack                                             | Server Actions and Route Handlers; no separate backend                    |
| UI                 | React, Tailwind CSS, shadcn/ui                                               |                                                                           |
| Forms & validation | React Hook Form, Zod                                                         | One Zod schema shared by client and server (`src/lib/schemas`)            |
| Database           | PostgreSQL, Prisma                                                           | Runs through docker compose                                               |
| PDF                | HTML template (React component) rendered to PDF with Playwright and Chromium | Preview and PDF share one template; rendered on demand in a Route Handler |
| Tests              | Vitest, Playwright E2E                                                       |                                                                           |
| Tooling            | npm, ESLint, Prettier, GitHub Actions (lint, typecheck, test, build)         | CI only; no deployment                                                    |
| Containers         | Dockerfile (Next.js standalone output plus Chromium), docker compose         | `docker compose up` starts the web app and PostgreSQL                     |

## Decisions

- **Next.js only.** A separate NestJS API was considered and dropped for now; Server Actions and
  Route Handlers are enough. The API can be split out later if needed.
- **npm instead of pnpm.** It is a single project and pnpm is not installed on the development
  machine.
- **HTML to PDF with Playwright.** `@react-pdf/renderer` is lighter, but supports only a subset of
  layout and cannot share CSS with the on-screen preview. Playwright gives full CSS, which matters
  for building several templates, at the cost of shipping Chromium in the container.
- **Content snapshots in PostgreSQL.** Saved invoices store their full content, so later changes to
  templates or seller settings never alter past invoices. PDF files themselves are not stored.
- **No logo upload.** This removes file storage and upload handling entirely.
- **No authentication.** The app is single-user and local; it binds to `localhost` only.

## Layout

```
src/app/            pages, Server Actions, PDF route
src/components/     form, preview and other UI
src/templates/      invoice templates (React components)
src/lib/            Zod schemas, money and GST calculation, Prisma client
prisma/             schema and migrations
Dockerfile, docker-compose.yml
```

## Known notes

- `npm audit` reports high-severity findings in the `eslint-config-next` dev dependency chain
  (`braces`). They do not reach the runtime. The suggested fix downgrades `eslint-config-next` to
  v14, which does not match Next.js 16, so it is deferred until upstream updates.

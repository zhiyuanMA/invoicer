# Docker and testing: how the app is packaged and checked

For someone new to Docker and browser testing. It explains what is in this repository, why, and how
to work with it.

## 1. Docker in one page

- An **image** is a packaged filesystem: an operating system, the programs, and your app, frozen.
- A **container** is a running copy of an image.
- A **Dockerfile** is the recipe for an image. Each instruction (`RUN`, `COPY`, ...) makes a
  **layer**, and Docker reuses a layer when nothing it depends on changed. That is why the order of
  instructions matters.
- **Docker Compose** (`docker-compose.yml`) describes several containers that work together, and
  starts them with one command.

```bash
docker compose up --build    # build the images, start everything
docker compose ps            # what is running, and is it healthy
docker compose logs web      # the app's output
docker compose down          # stop; add -v to delete the data volume as well
```

## 2. The Dockerfile, stage by stage

[Dockerfile](../../Dockerfile) is a **multi-stage build**: several `FROM` lines, each starting a new
stage. Only the last stage becomes the running image, so build tools never ship.

| Stage     | What it does                                                                         |
| --------- | ------------------------------------------------------------------------------------ |
| `deps`    | Copies `package.json` and the Prisma files, runs `npm ci`. Cached until they change. |
| `builder` | Copies the source and runs `next build`.                                             |
| `migrate` | Installs only the Prisma CLI and dotenv, runs `prisma migrate deploy`, then exits.   |
| `runner`  | The app: Node, Chromium, and the small `standalone` output of the build.             |

Things worth understanding:

- **`COPY package*.json` before `COPY . .`.** Dependencies change rarely and source changes
  constantly. Copying the dependency files first lets Docker reuse the slow `npm ci` layer on most
  builds.
- **`output: "standalone"`** in `next.config.ts` makes Next.js emit a self-contained server in
  `.next/standalone` with only the files it needs, instead of the whole `node_modules`.
- **Chromium is installed before the app code.** It is by far the largest layer, and
  it only changes when Playwright is upgraded.
- **A separate, small `migrate` stage.** It needs two packages, not the whole app, so it installs
  just those (at the versions in `package-lock.json`). Clean up in the same `RUN` that creates the
  mess: npm's download cache added 300 MB to the image until `rm -rf /root/.npm` was added to that
  same instruction. A later `RUN rm` would not help, because the files would still exist in the
  earlier layer.
- **Chromium is in the production image on purpose.** The tests use a different browser, installed
  on your machine. The one in the image renders every PDF the app serves, so without it
  "Download PDF" would fail.
- **`USER node`.** The server does not need root, so it does not run as root.
- **`.dockerignore`** keeps `node_modules`, `.git`, `.env` and the docs out of the build context, so
  builds are faster and secrets are not copied into the image.

## 3. Compose: starting things in order

[docker-compose.yml](../../docker-compose.yml) has three services:

1. **`db`**: PostgreSQL. Its `healthcheck` runs `pg_isready`, so "started" and "ready" are
   different things.
2. **`migrate`**: runs once and exits. It waits for `db` to be **healthy**.
3. **`web`**: waits for `db` to be healthy and `migrate` to have **completed successfully**, so the
   app never starts against a database without tables.

Two details: inside Compose the app reaches the database at `db:5432` (the service name is the
host name), while from your Mac the same database is `localhost:5433`. And the app's port is written
`127.0.0.1:1333:3000`: `host:container`, so the app listens on 3000 inside its container and you
reach it at port 1333 on your machine (3000 stays free for other things). The `127.0.0.1` part
publishes it to this machine only, which matters because the app has no login.

## 4. Why the build failed twice

The first image build is where problems that "work on my machine" show up.

1. **Google Fonts.** `next/font/google` downloads Geist during the build. Inside the build there was
   no connection to Google. The app never really used Geist (the page font was Arial), so it was
   removed and the app uses system fonts. Lesson: a build that needs the internet is fragile.
2. **A build that quietly used the database.** The build failed with "DATABASE_URL is not set". Next.js
   had been running the customers page's database query while prerendering at build time. On a
   machine with a `.env` and a running database that worked silently, which is worse: builds depended
   on the database. The fix is `await connection()` at the top of each component that reads the
   database, which tells Next.js to render it per request.

## 5. The three kinds of test

| Kind        | Command                    | What runs                                    | Speed  |
| ----------- | -------------------------- | -------------------------------------------- | ------ |
| Unit        | `npm test`                 | Pure functions and components, no database   | ~1 s   |
| Integration | `npm run test:integration` | The database stores, against real PostgreSQL | ~2 s   |
| End-to-end  | `npm run test:e2e`         | A real browser using the production build    | ~1.5 m |

Prefer the cheapest test that can catch the bug. Money maths is unit-tested; "deleting a seller does
not change a saved invoice" needs a database, so it is an integration test; "the Save button takes
you to the edit page and the data is still there after a reload" needs a browser.

## 6. How the end-to-end tests work

Tests live in [e2e/](../../e2e) and use [Playwright Test](https://playwright.dev/docs/intro).
[playwright.config.ts](../../playwright.config.ts) builds and starts the app on port 3100 against the
`invoicer_test` database, waits for `/api/health`, and runs the specs one at a time (they share one
database).

- **A clean database per test.** [helpers.ts](../../e2e/helpers.ts) defines a `test` that empties the
  tables before each test, so tests do not depend on each other's data or order.
- **A separate build folder.** `NEXT_DIST_DIR=.next-e2e` keeps the test build away from `.next`, so
  you can run the tests while `npm run dev` is running.
- **Locators.** Prefer roles and labels (`getByRole("button", { name: "Save" })`), the way a user
  finds things. Form fields are found by their `name` attribute.
- **Waiting.** Playwright retries assertions until they pass (`await expect(...).toBeVisible()`), so
  there are almost no fixed sleeps. Never reload straight after something that saves in the
  background: the status select waits for the Server Action's response first (`changeStatus`).
- **Hidden old pages.** With `cacheComponents`, Next.js keeps the previous page mounted but hidden.
  A locator can then match two elements and fail with a "strict mode violation". Use `:visible`
  (see `field()` and `fontSelect()` in helpers).
- **Fixed dates.** Tests that depend on "overdue" use dates far in the past and future, never
  today's date, so they cannot start failing next month.
- **Safety.** The test database name must end in `_test`, or the tests refuse to run: they delete
  every row.

When a test fails, Playwright saves a trace in `test-results/`. Open it with
`npx playwright show-trace <path>` to step through what the browser did.

## 7. README screenshots

`npm run screenshots` runs [e2e/screenshots.spec.ts](../../e2e/screenshots.spec.ts), which creates
made-up demo data through the real UI and saves the images in `docs/images`. It is excluded from the
normal test run (it is tagged `@screenshots`), so the images only change when you ask.

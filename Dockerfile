# syntax=docker/dockerfile:1

# Stages: deps -> builder -> runner (the app), and a separate small migrate stage (applies the
# database migrations).
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Dependencies. The Prisma files come first because `npm ci` runs `prisma generate` (postinstall).
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM deps AS builder
COPY . .
RUN npm run build

# One-off job: apply the migrations, then exit. It needs only the Prisma CLI and dotenv (which
# prisma.config.ts imports), so it installs just those, at the versions pinned in package-lock.json,
# instead of reusing the full dependency tree.
FROM base AS migrate
COPY package-lock.json ./
RUN PRISMA="$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
    && DOTENV="$(node -p "require('./package-lock.json').packages['node_modules/dotenv'].version")" \
    && npm install --no-save --no-package-lock --omit=dev --no-audit --no-fund "prisma@$PRISMA" "dotenv@$DOTENV" \
    && rm -rf /root/.npm /root/.cache
COPY prisma ./prisma
COPY prisma.config.ts ./
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    CHROMIUM_NO_SANDBOX=1

# Chromium (renders the PDFs) plus the system libraries and fonts it needs. Installed from the
# same Playwright version the app was built with, and before the app code so this large layer is
# cached when only the code changes.
COPY --from=builder /app/node_modules/playwright ./node_modules/playwright
COPY --from=builder /app/node_modules/playwright-core ./node_modules/playwright-core
RUN node node_modules/playwright/cli.js install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* \
    && chmod -R a+rX /ms-playwright

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# The standalone server does not need root.
USER node
EXPOSE 3000
CMD ["node", "server.js"]

# ---------------------------------------------------------------------------
# OpenStore API — Medusa v2 Backend Container
# Multi-stage build for optimized production image
# ---------------------------------------------------------------------------

FROM node:20-alpine AS base

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencies stage
# ---------------------------------------------------------------------------
FROM base AS deps

# Copy workspace root files for monorepo dependency resolution
COPY package.json bun.lockb* ./
COPY packages/cli/package.json ./packages/cli/
COPY packages/core/package.json ./packages/core/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

# Install dependencies using bun (matching the project's package manager)
RUN npm install -g bun && \
    bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# Builder stage
# ---------------------------------------------------------------------------
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps

# Copy source code
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY tsconfig.json ./

# Build the core plugin first (required by API)
WORKDIR /app/packages/core
RUN bun run build

# Build the API app
WORKDIR /app/apps/api
ENV NODE_ENV=production
RUN bun run build || npx tsc

# ---------------------------------------------------------------------------
# Runner stage — minimal production image
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9000

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 medusa

# Copy built application
COPY --from=builder --chown=medusa:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=medusa:nodejs /app/apps/api/medusa-config.ts ./
COPY --from=builder --chown=medusa:nodejs /app/apps/api/package.json ./
COPY --from=builder --chown=medusa:nodejs /app/node_modules ./node_modules

# Copy core plugin build output
COPY --from=builder --chown=medusa:nodejs /app/packages/core/.medusa ./packages/core/.medusa
COPY --from=builder --chown=medusa:nodejs /app/packages/core/package.json ./packages/core/

USER medusa

EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------------------
# OpenStore Admin Dashboard — Vite/React Static Site
# Served via Nginx for optimal static asset delivery
# ---------------------------------------------------------------------------

FROM node:20-alpine AS builder

WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy workspace files for monorepo resolution
COPY package.json bun.lockb* ./
COPY packages/admin/package.json ./packages/admin/
COPY packages/dashboard-shared/package.json ./packages/dashboard-shared/
COPY packages/dashboard-sdk/package.json ./packages/dashboard-sdk/
COPY packages/client/package.json ./packages/client/
COPY packages/types/package.json ./packages/types/
COPY apps/admin-test/package.json ./apps/admin-test/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/ ./packages/
COPY apps/admin-test/ ./apps/admin-test/
COPY tsconfig.json ./

# Build packages in dependency order
WORKDIR /app/packages/types
RUN bun run build

WORKDIR /app/packages/dashboard-sdk
RUN bun run build

WORKDIR /app/packages/dashboard-shared
RUN bun run build

WORKDIR /app/packages/client
RUN bun run build

WORKDIR /app/packages/admin
RUN bun run build

# Build admin app
WORKDIR /app/apps/admin-test
RUN bun run build

# ---------------------------------------------------------------------------
# Production stage — Nginx static server
# ---------------------------------------------------------------------------
FROM nginx:alpine

# Copy built static files
COPY --from=builder /app/apps/admin-test/dist /usr/share/nginx/html

# Copy custom nginx config for SPA routing
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /assets/ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    gzip on; \
    gzip_types text/plain text/css application/javascript application/json; \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

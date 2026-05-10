# Mercur

**Open-source AI-native marketplace framework built on MedusaJS v2.**

Mercur provides reusable building blocks for multi-vendor marketplaces: seller management, commissions, payouts, order splitting, vendor portals, and admin dashboards. Code is copied into your project for full ownership — no black-box dependencies.

## Architecture

- **Foundation**: MedusaJS v2 (headless commerce)
- **Language**: TypeScript (strict)
- **Monorepo**: Turborepo with bun
- **Pattern**: Block-based — modules, workflows, API routes, and UI extensions installed via CLI

## Project Structure

```
mercur/
├── apps/
│   ├── admin-test/         # Admin dashboard demo app (Vite, port 7002)
│   ├── api/                # Medusa v2 backend (Node, port 9000)
│   ├── docs/               # Documentation site (Mintlify)
│   ├── storefront/         # B2C Next.js storefront (port varies)
│   └── vendor/             # Vendor portal demo app (Vite, port 7001)
├── packages/
│   ├── admin/              # @mercurjs/admin — admin dashboard UI library
│   ├── cli/                # @mercurjs/cli — scaffolding, blocks, codegen
│   ├── client/             # @mercurjs/client — typed API client (Proxy-based)
│   ├── core/               # @mercurjs/core — core Medusa plugin
│   ├── dashboard-sdk/      # Vite plugin for building dashboard apps
│   ├── dashboard-shared/   # Shared UI primitives for admin + vendor
│   ├── providers/          # Provider modules (e.g. payout-stripe-connect)
│   ├── registry/           # Official block registry (private, not published)
│   ├── types/              # @mercurjs/types — shared TypeScript definitions
│   └── vendor/             # @mercurjs/vendor — vendor portal UI library
├── templates/
│   ├── basic/              # Starter marketplace project template
│   ├── plugin/             # Starter template for Medusa/Mercur plugins
│   └── registry/           # Starter template for custom block registries
├── integration-tests/      # Cross-package HTTP integration test suite
└── .claude/skills/         # AI agent skills (conventions, review checklists)
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | MedusaJS v2 (`@medusajs/framework` 2.13.4), Node.js ≥20, Express |
| Frontend | React 18, React Router Dom 6, Vite 5 |
| UI | `@medusajs/ui` 4.1.1, Radix UI (gaps only), Tailwind CSS |
| Forms | `react-hook-form` + `zod` + local `Form` compound wrappers |
| Data Fetching | TanStack Query 5.64.2, TanStack Table 8.20.5 |
| i18n | `react-i18next` with `Trans` component |
| API Client | Recursive Proxy pattern (`client.admin.sellers.query()`) |
| Build (packages) | `tsup` (ESM + DTS) |
| Build (backend) | `tsc` → `.medusa/server` |
| Monorepo | Turborepo 2.7.4, bun 1.3.8 |
| Lint | ESLint 9 (flat config) + `typescript-eslint` |
| Format | Prettier 3 (defaults, no custom config) |
| Tests | Jest + `@swc/jest` |
| Docs | Mintlify |

## Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` (root) | Workspace definition, root scripts, bun workspaces |
| `turbo.json` | Turborepo pipeline (build, lint, check-types, dev, test) |
| `tsconfig.json` (root) | Base TS config: ES2021, Node16, strict, path aliases `~/*` and `@/*` → `apps/api/src/*` |
| `eslint.config.mts` | Flat ESLint config: `@eslint/js`, `typescript-eslint`, 2-space indent, semicolons |
| `blocks.json` (root) | Block path aliases: `api` → `apps/api/src`, `admin` → `apps/admin-test/src`, `vendor` → `apps/vendor/src` |
| `registry.json` (root) | Schema for registry item definitions |
| `medusa-config.ts` (apps/api) | Backend runtime config wrapped with `withMercur()` |
| `medusa-config.ts` (integration-tests) | Test backend config with `@mercurjs/core` plugin |

## Build and Dev Commands

All commands are run from the repository root using bun.

```bash
# Install dependencies
bun install --frozen-lockfile

# Start all dev servers (admin-test: 7002, api: 9000, vendor: 7001)
bun run dev

# Build all packages and apps
bun run build

# Type-check all packages
bun run check-types

# Lint all packages
bun run lint

# Format code
bun run format              # prettier --write "**/*.{ts,tsx,md}"

# Integration tests (HTTP)
bun run test:integration:http
```

### Package-Specific Dev Commands

```bash
# Core plugin
cd packages/core
bun run dev                 # medusa plugin:develop
bun run build               # codegen + tsc → .medusa/server

# Admin / Vendor / Dashboard-Shared / Client / CLI
cd packages/<name>
bun run dev                 # tsup --watch
bun run build               # tsup

# Types
cd packages/types
bun run dev                 # tsc --watch
bun run build               # tsc

# API app
cd apps/api
bun run dev                 # mercurjs develop
bun run start               # mercurjs start
bun run seed                # medusa exec ./src/scripts/seed.ts
bun run test:unit           # Jest unit tests
bun run test:integration:http    # Jest HTTP integration tests
bun run test:integration:modules # Jest module integration tests
```

## Testing Strategy

| Layer | Location | Runner | Pattern / Env |
|-------|----------|--------|---------------|
| Unit tests | `apps/api` | Jest + SWC | `TEST_TYPE=unit`, `**/__tests__/**/*.unit.spec.[jt]s` |
| Integration (modules) | `apps/api` | Jest + SWC | `TEST_TYPE=integration:modules`, `**/src/modules/*/__tests__/**/*.[jt]s` |
| Integration (HTTP) | `apps/api` | Jest + SWC | `TEST_TYPE=integration:http`, `**/integration-tests/http/*.spec.[jt]s` |
| Integration (HTTP, cross-package) | `integration-tests/` | Jest + SWC | `TEST_TYPE=integration:http`, `**/http/**/*.spec.[jt]s` |
| Integration (Meilisearch) | `integration-tests/` | Jest + SWC | `MEILISEARCH_HOST` + `MEILISEARCH_API_KEY` env vars, `--testPathPattern=meilisearch` |

Turborepo caching is **disabled** for integration tests and dev tasks (`"cache": false`).

## Code Style Guidelines

- **Language**: TypeScript (strict mode enabled)
- **Indent**: 2 spaces
- **Semicolons**: required
- **Quotes**: use project defaults (Prettier defaults)
- **Module system**: Node16 / ESNext depending on package
- **Path aliases**: each package defines its own (`@/*`, `@components/*`, `@hooks/*`, etc.)

### ESLint Rules (enforced)

- `consistent-return`: error
- `indent`: warn, 2 spaces
- `no-else-return`: warn
- `semi`: warn, always
- `space-unary-ops`: error

### TypeScript Configuration

- Root: `target: ES2021`, `module: Node16`, `moduleResolution: Node16`, `strict: true`
- UI packages: `target: ES2020`, `module: ESNext`, `moduleResolution: bundler`, `jsx: react-jsx`
- Common UI flags: `isolatedModules: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `allowImportingTsExtensions: true`

## UI/UX Conventions

These conventions are enforced by the `.claude/skills/` review skills and must be followed when modifying dashboard UI.

### Compound Components

- **List pages**: `Object.assign(Root, { Table, Header, HeaderTitle, HeaderActions, DataTable })`
- **Detail pages**: use `TwoColumnPage` with `MainGeneralSection` and `SidebarInfoSection`
- **Forms**: always use `Form.Field` + `Form.Item` + `Form.Label` + `Form.Control` + `Form.ErrorMessage` — never raw `Controller` or `<Label>`
- **Keyboard submit**: use `<KeyboundForm>` for Ctrl/Cmd+Enter submit
- **Tabs**: use `TabbedForm` wizard tabs with `defineTabMeta<SchemaType>()`

### Hard Rules

- **No hardcoded strings** — everything user-visible must use `t("...")` from `react-i18next`
- **No raw `<form>`** — use `<KeyboundForm>`
- **No `window.confirm`** — use `usePrompt()` from `@medusajs/ui`
- **No custom dropdowns/empty states** — use `ActionMenu`, `NoRecords`, `NoResults`, `StatusBadge`
- **No `*` for required fields** — omit `optional` prop; use `<Form.Label optional>` for optional fields
- **No manual error rendering** — always `<Form.ErrorMessage />`
- **Heading levels**: h1 = page title only; h2 = sections, tabs, drawer headers
- **Layout tokens**: tab outer `p-16`, inner `max-w-[720px]` + `gap-y-8`
- **`data-testid`** required on root elements, form fields, and buttons (kebab-case)

### UI Primitive Decision Tree

1. Local wrapper first (`Form`, `ActionMenu`, route modals)
2. `@medusajs/ui` second (buttons, inputs, drawers, tables, tabs)
3. Compose from the above
4. Radix UI only for genuine gaps

## Block System

Mercur uses a block-based architecture where reusable pieces of functionality are installed into your project:

- **Modules** — data models and business logic (sellers, commissions, offers, reviews)
- **Links** — relationships between modules (e.g., linking sellers to products)
- **Workflows** — multi-step business processes (order splitting, payout calculation)
- **API Routes** — HTTP endpoints for admin, vendor, and storefront APIs
- **Admin Extensions** — UI components for the admin dashboard
- **Vendor Extensions** — UI components for the vendor portal

Install blocks with `bunx @mercurjs/cli add`:

```bash
bunx @mercurjs/cli@latest add seller commission payout
```

### Key CLI Commands

```bash
# Create a new marketplace project
bunx @mercurjs/cli@latest create my-marketplace

# Add blocks from registry
bunx @mercurjs/cli@latest add <block-name>

# Generate TypeScript types from API routes
bunx @mercurjs/cli@latest codegen

# Search available blocks
bunx @mercurjs/cli@latest search -q "commission"

# View block details
bunx @mercurjs/cli@latest view <block-name>
```

## Release Process

All packages are published under the `@mercurjs` scope on npm.

- **Stable** releases use the `latest` npm tag
- **Canary** releases use the `canary` npm tag

### Published Packages

- `@mercurjs/cli`
- `@mercurjs/client`
- `@mercurjs/types`
- `@mercurjs/dashboard-sdk`
- `@mercurjs/dashboard-shared`
- `@mercurjs/core`
- `@mercurjs/vendor`
- `@mercurjs/payout-stripe-connect`

`@mercurjs/registry` is private and not published.

### How to Release

1. Bump the version in every package's `package.json`
2. Commit and tag: `git tag v2.X.Y && git push origin main --tags`
3. GitHub Action (`.github/workflows/release.yml`) triggers automatically:
   - Generates a GitHub Release with changelog via `changelogithub`
   - Builds all packages with `bun run build`
   - Publishes every non-private package to npm with provenance

### CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `release.yml` | Push tag `v*` | Build, publish to npm, generate changelog |
| `claude-code-review.yml` | PR events | AI code review on pull requests |
| `issue-triage.yml` | Issue opened / comment | AI issue triage with Discord webhook |

## Environment Variables

The `apps/api/medusa-config.ts` requires the following environment variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `STORE_CORS` | Storefront CORS origin |
| `ADMIN_CORS` | Admin dashboard CORS origin |
| `VENDOR_CORS` | Vendor portal CORS origin |
| `AUTH_CORS` | Auth endpoints CORS origin |
| `JWT_SECRET` | JWT signing secret (default: "supersecret") |
| `COOKIE_SECRET` | Cookie signing secret (default: "supersecret") |
| `MEILISEARCH_HOST` | Meilisearch server URL (optional) |
| `MEILISEARCH_API_KEY` | Meilisearch API key (optional) |
| `TYPESENSE_HOST` | Typesense server host (optional) |
| `TYPESENSE_PORT` | Typesense server port (optional) |
| `TYPESENSE_PROTOCOL` | Typesense protocol (optional) |
| `TYPESENSE_API_KEY` | Typesense API key (optional) |

## Security Considerations

- JWT and cookie secrets default to `"supersecret"` in development — **must be changed in production**
- CORS origins must be explicitly configured per environment
- The `seller_registration` feature flag controls whether sellers can self-register
- RBAC module is enabled in integration tests; review role assignments before production use
- Provider packages (e.g., Stripe Connect) handle sensitive payment credentials — store keys in environment variables only

## Development Notes for AI Agents

- **Skills**: The `.claude/skills/` directory contains review checklists and conventions. Read relevant `SKILL.md` files before modifying admin/vendor UI, forms, or tabs.
- **Proxy client**: `@mercurjs/client` uses a recursive Proxy — TypeScript inference depends on the generated types from `codegen`.
- **Core build**: `packages/core` outputs to `.medusa/server` and is consumed by Medusa's framework. Do not import from `src/` directly.
- **Registry blocks**: When modifying `packages/registry`, remember blocks are copied into consumer projects via the CLI — avoid importing from internal `@components/`, `@hooks/`, or `@lib/` aliases inside registry workflows or API routes.
- **Storefront**: `apps/storefront` is a dirty git submodule with its own `.git` directory and uses **yarn** instead of bun.
- **Path aliases**: `~/*` and `@/*` in backend code map to `apps/api/src/*`. UI packages use package-local aliases.
- **Testing**: Always use `TEST_TYPE=...` env var when running Jest in `apps/api` or `integration-tests/`.
- **Docs**: Public docs are at https://docs.mercurjs.com; the `llms.txt` endpoint provides a machine-readable project summary.

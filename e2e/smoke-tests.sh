#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# OpenStore E2E Smoke Tests — A-to-Z Health Check
#
# Verifies critical user journeys via HTTP. Run this after the full stack
# (Postgres, Redis, Meilisearch, API, Storefront) is booted.
#
# Usage: ./e2e/smoke-tests.sh
# Exit code: 0 = all passed, 1 = any failed
# ---------------------------------------------------------------------------

set -euo pipefail

API_URL="${API_URL:-http://localhost:9000}"
STOREFRONT_URL="${STOREFRONT_URL:-http://localhost:3000}"
VENDOR_URL="${VENDOR_URL:-http://localhost:7001}"
ADMIN_URL="${ADMIN_URL:-http://localhost:7002}"

PASS=0
FAIL=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

assert_ok() {
  local url="$1"
  local desc="$2"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")

  if [ "$status" -ge 200 ] && [ "$status" -lt 400 ]; then
    echo -e "${GREEN}✓${NC} $desc ($status)"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} $desc ($status)"
    ((FAIL++))
  fi
}

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  OpenStore E2E Smoke Tests"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── API Health ───────────────────────────────────────────────────────────
echo -e "${YELLOW}API Health${NC}"
assert_ok "$API_URL/health" "API health endpoint"
assert_ok "$API_URL/store/regions" "API regions list"
assert_ok "$API_URL/store/products?limit=1" "API products list"

# ── Storefront ───────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Storefront (Customer Facing)${NC}"
assert_ok "$STOREFRONT_URL" "Storefront homepage"
assert_ok "$STOREFRONT_URL/ke" "Storefront localized homepage"
assert_ok "$STOREFRONT_URL/ke/login" "Storefront login page"
assert_ok "$STOREFRONT_URL/ke/register" "Storefront register page"
assert_ok "$STOREFRONT_URL/ke/categories" "Storefront categories page"

# ── Vendor Portal ────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Vendor Portal (Seller Facing)${NC}"
assert_ok "$VENDOR_URL/login" "Vendor login page"
assert_ok "$VENDOR_URL/register" "Vendor register page"

# ── Admin Dashboard ──────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Admin Dashboard${NC}"
assert_ok "$ADMIN_URL" "Admin dashboard"

# ── Auth Flows (basic) ───────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Auth Endpoints${NC}"
# Customer auth
AUTH_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/auth/customer/emailpass/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.local","password":"SmokeTest123!"}' || echo "000")
# 409 = already exists (ok), 200 = created (ok)
if [ "$AUTH_RESP" = "200" ] || [ "$AUTH_RESP" = "409" ]; then
  echo -e "${GREEN}✓${NC} Customer registration endpoint ($AUTH_RESP)"
  ((PASS++))
else
  echo -e "${RED}✗${NC} Customer registration endpoint ($AUTH_RESP)"
  ((FAIL++))
fi

# ── Summary ──────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

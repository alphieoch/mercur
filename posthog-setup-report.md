<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Mercur/OpenMart server-side Node.js API. A `PostHog` singleton was created in both `apps/api` and `packages/core`, and `posthog-node` was added as a dependency. Twelve events covering critical conversion, engagement, and churn signals were instrumented across 10 route files. User identity is correlated between the client-side storefront (which already uses `posthog-js`) and the server-side API via `X-PostHog-Distinct-ID` and `X-PostHog-Session-ID` headers. Environment variables `POSTHOG_API_KEY` and `POSTHOG_HOST` were added to `apps/api/.env`. Exception capture is enabled via `enableExceptionAutocapture: true` on the client, and `captureException` is called in the payout webhook error handler.

| Event | Description | File |
|---|---|---|
| `checkout_completed` | Fired when a customer successfully completes cart checkout | `packages/core/src/api/store/carts/[id]/complete/route.ts` |
| `seller_registered` | Fired when a new vendor registers a seller account | `packages/core/src/api/vendor/sellers/route.ts` |
| `seller_approved` | Fired when an admin approves a seller account | `packages/core/src/api/admin/sellers/[id]/approve/route.ts` |
| `seller_suspended` | Fired when an admin suspends a seller account | `packages/core/src/api/admin/sellers/[id]/suspend/route.ts` |
| `seller_terminated` | Fired when an admin permanently terminates a seller | `packages/core/src/api/admin/sellers/[id]/terminate/route.ts` |
| `seller_payment_details_updated` | Fired when a vendor updates their payout payment details | `packages/core/src/api/vendor/sellers/[id]/payment-details/route.ts` |
| `seller_member_invited` | Fired when an admin invites a new member to a seller team | `packages/core/src/api/admin/sellers/[id]/members/invite/route.ts` |
| `campaign_created` | Fired when a vendor creates a new promotional campaign | `packages/core/src/api/vendor/campaigns/route.ts` |
| `payout_webhook_received` | Fired when a payout provider webhook is received | `packages/core/src/api/hooks/payout/route.ts` |
| `review_created` | Fired when a customer submits a product review | `apps/api/src/api/store/reviews/route.ts` |
| `wishlist_item_added` | Fired when a customer adds a product to their wishlist | `apps/api/src/api/store/wishlist/route.ts` |
| `product_search_performed` | Fired when a customer searches for products (top of funnel) | `apps/api/src/api/store/products/search/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1565151)
- [Checkout Completions Over Time](/insights/dYF6Lk6R)
- [Search → Wishlist → Checkout Funnel](/insights/648rTFEd)
- [Seller Registrations vs Approvals](/insights/Fv3Vjzks)
- [Seller Churn Events](/insights/odXfJbFx)
- [Reviews Created Over Time](/insights/ZcLgTSQv)

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-javascript_node/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>

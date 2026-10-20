# Stripe

TailorKit demo app with a full-page sales dashboard, searchable customers and contracts, billing details, and invoice history. All billing records are fixtures in `src/data.ts`, as of October 20, 2026, in USD. No Stripe SDK, API calls, credentials, or payment actions are used.

The `page` slot exposes a **Stripe** page with the stable instance key `sales`. The navbar button opens the Stripe panel. On CRM contact pages, the panel shows the matching customer's billing data. On the pipeline page, it shows contracts linked to the visible opportunities.

CRM contacts match by billing email or company name. Opportunities match by linked contact and the exact `Company · Contract title`. Unmatched records stay unlinked. These links are derived from current CRM data without changing it. The demo fixtures remain available if CRM links fail to load.

```sh
pnpm --filter @demo/stripe typecheck
pnpm --filter @demo/stripe test
pnpm --filter @demo/stripe build
```

The committed host bindings match Messages and can be refreshed with `pnpm --filter @demo/stripe generate`. The private backend only registers the page instance; no database is needed.

To publish and install in a configured Forma workspace, run `pnpm --filter @demo/stripe deploy`. The first deployment creates a separate app and saves its ID in `tailorkit.config.ts`; it does not reuse Messages. This app is not automatically installed by CRM workspace setup.

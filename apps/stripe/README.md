# Stripe demo

A Patchsmith app with three slots:

- **Panel**: subscription, card details, balances, and recent invoices for the current contact. Other CRM pages show “Select a contact”.
- **Page**: one **Stripe analytics** instance at `/apps/stripe/overview`, with revenue, MRR, subscriptions, outstanding balances, a monthly revenue area chart, a plan-distribution bar chart, and contact/invoice tables.
- **Navbar**: a **View on Stripe ↗** link shown only on contact detail pages. It opens `https://dashboard.stripe.com/test/forma-demo`, an intentionally nonexistent Stripe dashboard route. The contact panel uses the same placeholder destination.

All billing is simulated in USD; the app never calls Stripe or processes payments. Each installation has a separate Patchsmith database. Opening the panel or analytics fetches the authenticated workspace's contacts through the host tool, then runs an internal mutation that seeds missing contacts, refreshes names/email/company, and removes deleted contacts. Existing billing JSON is preserved on conflict, including its original seed date, invoices, subscription, and payment details. Refreshing or opening a different slot reads the same stored data. The host limits workspaces to 50 contacts, so a single unfiltered contact list covers the whole workspace.

The checked-in SQLite migration creates the app's `customers` table. Backend code binds `createFunctions` to the database; clients cannot call the internal reconciliation mutation directly or choose a workspace. The managed runtime supplies the installation database.

Loading uses separate contact-panel and analytics skeletons that follow the content layout, with no visible loading message. The host's shared `Skeleton` accepts optional width, height, and radius tokens; omitted fields retain its original defaults. Deploy the updated host along with the app to enable the new sizing options.

Charts use the host catalog's `AreaChart` and `BarChart`, rendered with shadcn ChartContainer and tooltips over Recharts. Both accept a `label`, `data: { label, value }[]`, optional `valueLabel`, and optional `valueFormat: "number" | "currency"` plus a three-letter `currency` code. Numeric values are display units: Stripe converts saved cents to dollars before passing revenue points. The charts include accessible data tables, fixed-height responsive plots, and empty states. Publish the updated host catalog before the app so these components are available.

## Develop and publish

```sh
pnpm install
pnpm --filter @demo/stripe generate
pnpm --filter @demo/stripe exec tsc --noEmit
pnpm --filter @demo/stripe build
pnpm --filter website test:stripe
```

The host must include the optional `Button.href` field in this branch. Buttons with an absolute HTTP(S) URL render as external anchors in a new tab using the same variant and size classes; disabled links cannot navigate. Buttons without an `href` retain their click behavior. Stripe supplies the placeholder URL above. To generate against a local contract snapshot, use `patchsmith generate --schema /path/to/schema.json`.

The Stripe source app is already published and its real app ID is checked in. Deploy the updated website catalog first, then republish Stripe and Doom to deliver the new charts, skeletons, link buttons, and static page instances. Both page instance lists use `cache: "static"`, so the builder embeds them in the deployment; billing still loads from the installation database at runtime.

To publish Stripe:

```sh
pnpm --filter @demo/stripe exec patchsmith login
pnpm --filter @demo/stripe deploy
```

For a new source app, the first interactive deployment creates it and writes its real `appId` into `patchsmith.config.ts`. Commit that ID before deploying a website that installs it. Subsequent deployments can use `deploy --no-interactive`.

Website setup version 4 installs the published Stripe app for both new and returning workspaces. Earlier Messages and Doom steps remain committed if Stripe installation fails. The website's `@demo/stripe` dependency ensures app-config changes trigger its build. Existing installations are pinned to their published app deployment, as with the other demo apps.

`website/scripts/stripe.test.ts` checks persistent storage across database reopen, idempotent reconciliation, changed/deleted contacts, separate installation databases, aggregate amounts, the installation protocol, and safe external button URLs. It uses temporary local SQLite databases and mocked platform transport, with no live platform writes.

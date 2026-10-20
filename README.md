# Patchsmith demo — Forma CRM

A pnpm workspace. The Next.js CRM lives in `website/`; Patchsmith apps live in `apps/`: [Messages](apps/messages/README.md) and [Stripe](apps/stripe/README.md), a demo billing dashboard linked to CRM customers and contracts.

[Patchsmith](https://patchsmith.io) is the platform brand; Forma is the demo CRM. The current SDK is still published as `tailorkit`, so package imports, CLI commands, configuration filenames, `TAILORKIT_PROJECT_KEY`, API routes, and service URLs retain their existing names for compatibility.

## Run locally

```sh
pnpm install
cp website/.env.example website/.env.local
pnpm --filter website db:up
pnpm --filter website db:push
pnpm dev
```

Set `TAILORKIT_PROJECT_KEY` in `website/.env.local`; workspace setup installs the shared app ID in `apps/messages/tailorkit.config.ts`. Then open http://localhost:3000. First visit creates an anonymous Better Auth account, provisions a private workspace with 30 contacts, 18 deals, and 12 tasks, and installs Messages into the apps panel. Returning visitors resume their workspace; older workspaces install Messages on their next visit. Each collection permits at most 50 records; activity history keeps the latest 50 entries.

Publish Messages with `pnpm --filter @demo/messages deploy`; see [Messages](apps/messages/README.md) for the initial publish and version updates. New workspaces install the shared published app without uploading files.

## Checks

```sh
pnpm check
pnpm --filter website test:db
pnpm build
```

Database tests require the local Postgres container and pushed schema. They create temporary accounts and remove them on completion. Next.js handles application builds; Vite+ provides Oxlint, Oxfmt, and type-aware checking.

See [website/README.md](website/README.md) for configuration, setup versioning, and Vercel/Neon notes.

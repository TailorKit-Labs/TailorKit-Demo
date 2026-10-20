# Patchsmith demo — Forma CRM

A pnpm workspace. The Next.js CRM lives in `website/`; the Patchsmith Messages app lives in `apps/messages/`.

[Patchsmith](https://patchsmith.io) powers the apps platform; Forma is the demo CRM. The workspace uses the Patchsmith SDK beta, published as `patchsmith` and `@patchsmith/*`, with the `patchsmith` CLI and `patchsmith.config.ts` configuration.

## Run locally

```sh
pnpm install
cp website/.env.example website/.env.local
pnpm --filter website db:up
pnpm --filter website db:push
pnpm dev
```

Set `PATCHSMITH_PROJECT_KEY` in `website/.env.local`; workspace setup installs the shared app ID in `apps/messages/patchsmith.config.ts`. Then open http://localhost:3000. First visit creates an anonymous Better Auth account, provisions a private workspace with 30 contacts, 18 deals, and 12 tasks, and installs Messages into the apps panel. Returning visitors resume their workspace; older workspaces install Messages on their next visit. Each collection permits at most 50 records; activity history keeps the latest 50 entries.

Publish Messages with `pnpm --filter @demo/messages deploy`; see [Messages](apps/messages/README.md) for the initial publish and version updates. New workspaces install the shared published app without uploading files.

## Checks

```sh
pnpm check
pnpm --filter website test:db
pnpm build
```

Database tests require the local Postgres container and pushed schema. They create temporary accounts and remove them on completion. Next.js handles application builds; Vite+ provides Oxlint, Oxfmt, and type-aware checking.

See [website/README.md](website/README.md) for configuration, setup versioning, and Vercel/Neon notes.

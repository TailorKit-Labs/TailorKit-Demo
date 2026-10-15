# Forma CRM

Next.js App Router, official Coss UI components with the neutral theme and Geist font, Better Auth anonymous sessions, and Drizzle with PostgreSQL. Coss source files in `components/ui` stay unmodified; application components compose their APIs. Charts use Recharts directly.

Refresh Coss components with `pnpm dlx shadcn@latest add @coss/ui @coss/colors-neutral --overwrite --yes` from `website`, then adapt application callers to upstream API changes. Notifications use Coss `ToastProvider` and `toastManager`; selects use Coss `Select` composition.

## Local development

Run from the repository root:

```sh
pnpm install
cp website/.env.example website/.env.local
pnpm --filter website db:up
pnpm --filter website db:push
pnpm dev
```

The Dockerfile builds a PostgreSQL 17 image; Compose binds it only to localhost and stores data in a named volume. `pnpm --filter website db:down` stops it without deleting data. Schema changes use `drizzle-kit push`, with no migration SQL files.

The env example contains a public development-only signing key: never copy that value into any deployed environment. Generate a private secret using `openssl rand -base64 32` and set `BETTER_AUTH_SECRET` in Vercel before deploying.

## Routes and behavior

- `/`: dashboard-01 KPI cards, interactive area chart, and a full-width opportunities table.
- `/contacts`: search, relationship filters, create and drill into contacts.
- `/contacts/[id]`: contact editing, related deals/tasks, notes and activity.
- `/pipeline`: drag deals between stages or sort cards within a stage (order is saved), edit details, create and delete.
- `/tasks`: all workspace follow-ups, including tasks without a contact, with creation, completion, and deletion controls.
- `/settings`: demo session information and per-collection usage.

Every query and mutation derives the workspace from the authenticated session. Record creation locks the tenant row before checking limits, so concurrent requests cannot exceed 50 contacts, deals, or tasks. User input is validated on the server. Activity history is capped at 50 entries.

## Agent

Below 800px, a floating bar at the bottom center contains **Agent** and a menu icon, opening separate Coss bottom drawers for chat and navigation. The mobile header has no sidebar toggle or bottom navigation tabs. On larger screens, the **Agent** floating button lives in the bottom-right corner and hides while the side panel is open. It opens a Coss bottom drawer below 800px and a chat popover on larger screens. On screens at least 1280px wide, a toggle switches between the popover and a side panel; smaller screens hide that control. Drafts and conversations survive closing, docking, resizing, and in-app navigation. A history dropdown replaces the chat title, with up to eight archived conversations kept in memory for the current session.

The agent uses AI SDK `ToolLoopAgent` and streams text and tool progress through `/api/agent`. It can search/view deals and contacts, create deals, move deals between stages, list/create follow-ups, and complete or reopen tasks. Its tools share the app's validated database operations, workspace isolation, activity logging, and collection limits. Successful writes refresh the visible page. Missing required information is requested in the conversation; new deals default to qualified, no contact, and an expected close in 30 days.

On Vercel, the AI SDK automatically authenticates through the deployment's [OIDC token](https://vercel.com/docs/ai-gateway/authentication-and-byok/oidc), including tokens supplied through trusted request context. Leave `AI_GATEWAY_API_KEY` unset to use OIDC; a configured API key takes priority. Your Vercel team must have available AI Gateway credits and any required billing verification completed. No manually managed model-provider key is needed.

For local use, set `AI_GATEWAY_API_KEY` in `website/.env.local`, or use local OIDC: run `vercel link` and `vercel env pull .env.vercel.local` from `website`, then copy only the `VERCEL_OIDC_TOKEN` entry into your existing `.env.local` to preserve local database/auth settings. Local tokens expire after 12 hours; pull a fresh token when needed and restart the dev server. The agent defaults to `openai/gpt-6-luna` with medium reasoning. `AI_GATEWAY_MODEL` optionally overrides it with another tool-capable Gateway model. Credentials stay on the server. Without Gateway authentication the app still runs, and the chat displays a connection message when used.

`POST /api/agent` uses BotID Basic verification. `instrumentation-client.ts` protects the client request and `withBotId` supplies the required rewrites. Bot checks fail closed if verification is unavailable. Local development uses BotID's documented development behavior; production detection must be checked on a Vercel deployment.

Chats are persisted in Postgres `agent_chats`, scoped to the authenticated workspace. The latest chat is restored on reload, and the history dropdown loads the 20 most recently updated chats. Starting a new chat preserves existing conversations. Messages use the SDK UI format, including tool results. The server saves admitted user messages before generation, checkpoints each completed tool step, and saves the final or interrupted reply while draining the stream independently of the browser. Closing the browser still cancels generation through the request signal; this does not resume an active stream. Stale tabs are rejected instead of overwriting newer messages, and per-chat leases recover after terminated requests. Clearing the anonymous session creates a different workspace and does not grant access to the old chats. Workspace deletion cascades to its chats.

Agent limits are stored atomically in Postgres, shared across serverless instances and regions:

- Each IP receives a bucket of 50,000 input + output model tokens. It fully resets five hours after the bucket starts, without gradual refill.
- Each turn reserves 10,000 tokens before inference; a completed turn refunds unused tokens or charges additional usage across all steps. Fewer than 10,000 remaining tokens prevents another turn. A final model step can cross its reservation; later requests are blocked when the bucket is depleted. This is a demo allowance, not an exact dollar cap.
- Unknown usage, aborted requests, and failed requests retain the reservation. Only one response may run per IP; a 90-second lease recovers from terminated functions.
- An IP may start five turns per minute. Rejections return HTTP 429 with `Retry-After`.
- Turns stop after four steps or when measured usage reaches the turn reservation, with 1,500 output tokens per step, a 45-second generation timeout, and no automatic model retries. Requests are limited to 60 KB and 20 messages.

The IP key is an HMAC using `BETTER_AUTH_SECRET`; raw IPs are not stored in the bucket table. Vercel's trusted `x-vercel-forwarded-for` supplies the IP. Cookie resets and new anonymous workspaces do not reset a network's bucket. People sharing an IP share the allowance. Other production hosts are rejected unless a trusted IP source is explicitly implemented; local development uses one loopback bucket. Expired bucket records are pruned in batches after responses.

Run `pnpm --filter website test:agent` for the real PostgreSQL tool integration tests and a deterministic SDK tool-loop/streaming and persistence test that needs no provider key. Run `pnpm --filter website test:agent-chats` for chat history, workspace isolation, authoritative context, concurrency, interrupted replies, and lease recovery. Run `pnpm --filter website test:agent-rate-limit` for database-backed bucket, concurrency, accounting, reset, and IP identity tests. Live model quality, provider authentication, and production BotID verification require a configured deployment.

## TailorKit panel apps

The side panel's app tabs come from the TailorKit `panel` slot. The built-in Agent tab stays first; installed apps keep the existing draggable tabs, horizontal scrolling, desktop dock, tablet sheet, and mobile drawer. A workspace with no installed apps shows only Agent. Discovery failures show “Apps unavailable” while chat remains usable.

Set `TAILORKIT_PROJECT_KEY` in `website/.env.local` and in each Vercel environment to your TailorKit project key. It stays on the server. The client uses the current browser origin; the server uses the Vercel preview URL for previews, otherwise `BETTER_AUTH_URL` or the Vercel production domain (localhost in development).

`lib/tailorkit.ts` defines the shared contract, `lib/tailorkit-server.ts` mounts it through `/api/tailorkit/[...tailorkit]`, and `lib/tailorkit-client.tsx` provides discovery and rendering. Installations use the `workspace` scope with `{ workspaceId }`, resolved from the authenticated, provisioned workspace. Requests cannot choose another workspace's scope.

Apps supply a default view for `panel` at `/`. The view receives `{ workspace: { id, name }, page }`; `page` follows the current CRM pathname, including contact detail pages. Shared layout primitives use the CRM's border and text color tokens. To add richer host components or contextual views, extend this contract and its client mappings.

Check `GET /api/tailorkit/schema` and `/api/tailorkit/meta` for the contract. `/api/tailorkit/apps` requires a host session. With an app installed for that workspace, its tab appears beside Agent and renders through `RenderSlot` when selected.

## Anonymous setup

Better Auth stores the account/session in Postgres and uses its signed HttpOnly session cookie. The session lasts 30 days with refresh on active use. No signup or sign-in forms are exposed. Clearing cookies creates a fresh workspace on the next visit.

Setup completion is stored in `tenants.setup_version`, rather than trusting a client flag. `lib/provision.ts` owns `CURRENT_SETUP_VERSION`; `lib/workspace.ts` uses it to decide whether setup must resume. To add a setup step, increment this constant and add the step guarded by the previous version inside the locked transaction, advancing the version only after success. Initial seed data is small and provisioning is idempotent, including concurrent tabs. The setup overlay preserves the requested URL and reveals it after completing the steps.

## Verification

```sh
pnpm check
pnpm --filter website typecheck
pnpm --filter website test:db-push
pnpm --filter website test:db
pnpm build # pushes the configured database schema before building
```

The DB integration test covers real anonymous authentication, cookies, concurrent provisioning, validated CRUD, tenant isolation, and racing requests for the last available record slot. It removes all accounts it creates. Browser verification covers setup, navigation, forms, persistence, filters, and responsive layouts.

## Vercel and Neon

Set the Vercel project Root Directory to `website`, using the Next.js preset. Configure:

- `DATABASE_URL`: a Neon PostgreSQL connection URL (include `sslmode=require`; a pooled URL is suitable).
- `DATABASE_URL_UNPOOLED`: the direct PostgreSQL connection URL, required for guarded production/CI pushes so the session advisory lock stays on one backend. Neon supplies this automatically through the Vercel integration.
- `BETTER_AUTH_SECRET`: a generated secret with at least 32 characters, configured for both Preview and Production. These environments use separate keys.
- `BETTER_AUTH_URL`: optionally override the production origin, including `https://`. Otherwise the Vercel production domain is used. Previews use their exact deployment and Git branch hostnames, so no per-preview URL setting is required.

The build command is `pnpm run db:push && next build`. Every deployment pushes `lib/schema.ts` to its assigned database before building; a failed push stops the build. Drizzle uses `DATABASE_URL_UNPOOLED` when available for schema changes, while the app requires pooled `DATABASE_URL`. Missing `DATABASE_URL` fails with a configuration error in every environment, without falling back to localhost.

In the Neon resource's **Projects → Update Project Connection** settings, enable **Create Database Branch For Deployment → Preview** and leave Production unchecked. Neon creates an isolated branch and injects its connection URLs before each preview build. Production builds push the main database. Database branches are not merged: production applies the schema from the code deployed to production.

Local development uses Docker Postgres and `.env.local`; it needs no Neon credentials. Run `pnpm --filter website db:push` after changing the schema. Local `pnpm build` also pushes the configured local database.

Production and CI pushes first inspect Drizzle's JSON dry run. Only new tables and their constraints, new schemas/enums, nullable columns, and nonunique indexes can run automatically. Alterations, drops, required columns, constraints on existing tables, warnings, and unknown operations stop the build before the push. An advisory lock serializes guarded builds against the same database. Preview branches and local development use Drizzle's normal push workflow. Keep **Enable access to System Environment Variables** enabled in Vercel (verified enabled for this project).

Drizzle 1.0 RC blocks some populated-table/column drops and renames in noninteractive CI with `missing_hints` (exit code 2), but can still apply type changes and drops from empty tables without confirmation. The compatibility check protects production from those changes too.

For a change blocked by the compatibility check, inspect `pnpm --filter website db:plan` against the intended database. Use an expand/contract sequence that keeps the running app working, then explicitly run `pnpm --filter website db:push:force` with that database's credentials only after reviewing the SQL and deployment timing. Never add `--force` to the build command. Schema changes happen before the new deployment is ready; a later build failure does not roll them back.

No generated migration files or custom branch-management scripts are required. Vercel's build environment receives the Neon secrets directly; local development does not need to download them.

This is a bounded demo workspace, not a full production account system. Per-workspace record limits do not provide a global storage budget: cookie resets can create additional anonymous accounts. Add expiry cleanup or a global account budget before exposing it to sustained public traffic.

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

Setup creates the account, seeds CRM data, then installs the Messages app in the workspace's TailorKit `panel` slot. `TAILORKIT_PROJECT_KEY` is required. The shared app ID comes directly from `apps/messages/tailorkit.config.ts`, which is also used by `pnpm --filter @demo/messages deploy`. Setup uses `tailorKit.experimental.installApp` to install that published app in the authenticated workspace scope; it never builds or uploads assets. Website dev/build commands are independent of Messages publishing. Setup version 2 adds the app to returning version-1 workspaces without reseeding data; a failed install leaves setup incomplete and retryable. Per-user database locks prevent duplicate installations from concurrent tabs.

Messages offers simulated Email, Slack, and SMS conversations with CRM contacts. Sent messages are readable contact activity notes and share the existing rolling 50-entry history. See [Messages](../apps/messages/README.md) for app development and binding generation.

- `/`: dashboard-01 KPI cards, interactive area chart, and a full-width opportunities table.
- `/contacts`: search, relationship filters, create and drill into contacts.
- `/contacts/[id]`: contact editing, related deals/tasks, notes and activity.
- `/pipeline`: drag deals between stages or sort cards within a stage (order is saved), edit details, create and delete.
- `/tasks`: all workspace follow-ups, including tasks without a contact, with creation, completion, and deletion controls.
- `/settings`: demo session information and per-collection usage.

Every query and mutation derives the workspace from the authenticated session. Record creation locks the tenant row before checking limits, so concurrent requests cannot exceed 50 contacts, deals, or tasks. User input is validated on the server. Activity history is capped at 50 entries.

## API and SSR

The oRPC API lives in `routers/`, alongside `app/` and `lib/`. Domain files (`contacts.ts`, `deals.ts`, `tasks.ts`, `activities.ts`, `workspace.ts`, and `chats.ts`) define procedures and contain their database logic. `routers/index.ts` assembles named procedure imports and is mounted at `POST /rpc`. Browser calls, server renders, the agent and TailorKit tools share these procedures. `routers/schemas.ts` contains browser-safe schemas shared with the TailorKit contract. Middleware resolves workspace identity; expected domain failures use native oRPC errors. HTTP requests use signed session cookies, same-origin checks, POST-only handling, a 60 KB body limit, and private/no-store responses.

React Query owns browser data. `lib/orpc.ts` exports both the browser transport (`rpc`) and typed TanStack Query helpers (`orpc`). Client Components use `useSuspenseQuery(orpc.workspace.snapshot.queryOptions())` and `useMutation(orpc.contacts.create.mutationOptions())`. The query client's mutation cache invalidates oRPC query keys after successful writes, awaiting active refetches before clearing pending state. Counts, linked records and activity stay in sync; rejected mutations do not refetch. The existing views share a workspace snapshot query because their tables, forms and summaries use the same small, bounded collections.

Server Components use query helpers from `lib/orpc.server.ts`, backed by `createRouterClient` for direct calls without HTTP. Each page starts its queries and wraps its client content in `HydrateClient`:

```tsx
import { orpc } from "@/lib/orpc.server";
import { HydrateClient, prefetch } from "@/lib/query.server";

// After checking the session/workspace:
void prefetch(orpc.workspace.snapshot.queryOptions());
return (
  <HydrateClient>
    <CrmPages view="contacts" />
  </HydrateClient>
);
```

`getQueryClient()` in `lib/query.server.tsx` uses `React.cache` to share one query client within the current RSC request. `HydrateClient` dehydrates that cache, including pending queries, so non-awaited prefetches stream into the browser. A 30-second stale time avoids duplicate requests immediately after hydration. `prefetchInfinite(orpc.someProcedure.infiniteOptions(...))` is available separately with typed page parameters; it does not depend on tRPC's key format or `any` casts. The current collections do not use infinite pagination.

The CRM layout prefetches chat history. It keys `QueryProvider` by workspace ID, preserving the cache across navigation and discarding it when the workspace changes. Every server request receives its own cache; authentication is resolved per invocation. Explicit browser/server entry points keep `next/headers`, the router and database out of the client bundle.

There is no `revalidatePath`. Agent completion and the TailorKit `ui.refresh` action invalidate React Query keys, picking up server-side tool writes. The only route refresh follows anonymous setup, to reveal the authenticated server layout. Provisioning uses a session-only procedure before a workspace exists; workspace-scoped tools cannot invoke it. Better Auth and AI streaming retain dedicated protocol handlers.

Internal tools use oRPC `call(procedure, input, { context: verifiedWorkspaceContext(workspaceId) })` with an ID obtained from the authenticated session or verified TailorKit scope. Never pass an ID from model arguments or a public request body to that context helper. oRPC packages are pinned to the v2 version used by TailorKit; installed `middleapi/orpc` skills live in `.agents/skills`.

Run `pnpm --filter website test:rpc` for PostgreSQL coverage of HTTP/direct calls, validation, hydrated/pending queries, mutation invalidation, request protections and concurrent workspace isolation. Add `RPC_SSR_URL=http://localhost:3010` to verify initial SSR HTML against a running production server.

## Agent

Below 800px, a floating bar at the bottom center contains **Agent** and a menu icon, opening separate Coss bottom drawers for chat and navigation. The mobile header has no sidebar toggle or bottom navigation tabs. On larger screens, the **Agent** floating button lives in the bottom-right corner and hides while the side panel is open. It opens a Coss bottom drawer below 800px and a chat popover on larger screens. On screens at least 1280px wide, a toggle switches between the popover and a side panel; smaller screens hide that control. Drafts and conversations survive closing, docking, resizing, and in-app navigation. A history dropdown replaces the chat title, with up to eight archived conversations kept in memory for the current session.

The agent uses AI SDK `ToolLoopAgent` and streams text and tool progress through the typed oRPC `agent.chat` procedure at `POST /rpc/agent/chat`. It can read workspace usage; search, create, edit and delete contacts, deals and follow-ups; move/reorder pipeline deals; complete/reopen tasks; and read activity or add contact notes. Its tools share the app's validated database operations, workspace isolation, activity logging, and collection limits. Agent completion invalidates the browser queries to show committed changes. Missing required information is requested in the conversation; new deals default to qualified, no contact, and an expected close in 30 days.

With `TAILORKIT_PROJECT_KEY` configured, each admitted turn also connects to TailorKit's MCP server through the official `@modelcontextprotocol/client` client. It uses the existing `tailorKit` server in `lib/tailorkit-server.ts`: `tailorKit.mcp.transport({ scopes: { workspace: { workspaceId } } })` supplies the platform URL and auth headers. The workspace ID comes from the authenticated session and matches the host handler and installed apps; neither model arguments nor request JSON can choose it. The existing contract, components, tools, host-origin configuration and `/api/tailorkit` route are reused. No additional host URL variable or MCP proxy is needed. The host must be reachable by TailorKit's app agent; local app builds need a public tunnel configured through the existing `BETTER_AUTH_URL` setting.

Discovered tools are namespaced as `tailorkit_list_apps`, `tailorkit_create_app`, and `tailorkit_edit_app` alongside the CRM tools. Create/edit launches TailorKit's app agent and publishes its changes. The host agent uses them for explicit app requests, carries app/thread IDs into related edits, and does not automatically retry interrupted writes. App-building tools subscribe to standard MCP progress notifications and yield preliminary AI SDK tool outputs over the existing oRPC chat stream. Their cards open while building and show streamed text and file/command/deployment activity. A model `finish` chunk still leaves the card running until the final MCP result arrives. Only that final result reaches the parent model; its complete MCP envelope preserves `isError`. Completed cards retain a bounded preview in saved history. Stop aborts the running MCP request, and interrupted preliminary outputs are removed before the next turn. Completed results are saved, unfinished calls are removed from interrupted replies, and app tabs refresh after a turn finishes or fails. MCP initialization and each discovery page have a ten-second timeout; connections close after the response stream drains, including errors and cancellation. Without a project key, CRM chat works as before; configured MCP failures fail the turn instead of silently hiding the tools.

The function permits five minutes, with a 270-second generation timeout. Longer builds are cancelled and may leave an app or published changes; inspect apps before starting another build. Run `pnpm --filter website test:agent-mcp` for the provider-free HTTP MCP integration test covering the shared host contract, workspace-scoped auth, discovery/execution, progress before completion for create/edit, concurrent stream isolation, model-visible failures, saved previews, malformed chunks, mid-stream cancellation and cleanup. Agent chunks arrive in the namespaced `params._meta["dev.tailorkit/agent-stream"]` field; the standard `message` field stays human-readable. The progress parser also accepts legacy JSON messages and chunk events without the explicit `status: "streaming"` field, and ignores ordinary progress text; no TailorKit package upgrade is required.

On Vercel, the AI SDK automatically authenticates through the deployment's [OIDC token](https://vercel.com/docs/ai-gateway/authentication-and-byok/oidc), including tokens supplied through trusted request context. Leave `AI_GATEWAY_API_KEY` unset to use OIDC; a configured API key takes priority. Your Vercel team must have available AI Gateway credits and any required billing verification completed. No manually managed model-provider key is needed.

For local use, set `AI_GATEWAY_API_KEY` in `website/.env.local`, or use local OIDC: run `vercel link` and `vercel env pull .env.vercel.local` from `website`, then copy only the `VERCEL_OIDC_TOKEN` entry into your existing `.env.local` to preserve local database/auth settings. Local tokens expire after 12 hours; pull a fresh token when needed and restart the dev server. The agent defaults to `openai/gpt-6-luna` with medium reasoning. `AI_GATEWAY_MODEL` optionally overrides it with another tool-capable Gateway model. Credentials stay on the server. Without Gateway authentication the app still runs, and the chat displays a connection message when used.

`POST /rpc/agent/chat` uses [BotID Deep Analysis](https://vercel.com/docs/botid/advanced-configuration), scoped to this procedure only. The client and server share the path/check level in `lib/agents/agent-protection.ts`; `withBotId` supplies the required rewrites. Authentication and input validation run before bot analysis; bot checks run before any model or MCP work and fail closed if verification is unavailable. Verified humans have no per-IP request limit or token quota. Other RPC procedures do not invoke BotID. Deep Analysis requires a Vercel Pro or Enterprise plan; per-route configuration overrides the project's default check level, so there is no need to enable it globally. Local development uses BotID's documented development behavior; real detection must be checked through the app on a Vercel deployment.

The browser's AI SDK transport calls `rpc.agent.chat` with an abort signal and converts the oRPC iterator into a UI message stream. The server drains a second stream branch for persistence and closes MCP through Next.js `after`. The former `/api/agent` handler has been removed. Same-origin POST and 60 KB request limits are enforced by the shared RPC handler. Verified workspace/tool clients cannot invoke inference without the HTTP request and response-lifetime context.

Chats are persisted in Postgres `agent_chats`, scoped to the authenticated workspace. Each page load starts a new chat, and the history dropdown loads the 20 most recently updated chats. Starting a new chat focuses the message input and preserves existing conversations. Messages use the SDK UI format, including tool results. Assistant reply IDs are generated on the server so streamed and saved history agree. Older chats with missing message IDs receive stable IDs when loaded and persist those repairs on their next admitted turn. The server saves admitted user messages before generation, checkpoints each completed tool step, and saves the final or interrupted reply while draining the stream independently of the browser. Closing the browser still cancels generation through the request signal; this does not resume an active stream. There are no per-chat leases or stale-tab rejections; overlapping replies use the latest saved history. Clearing the anonymous session creates a different workspace and does not grant access to the old chats. Workspace deletion cascades to its chats.

Generation stops after four steps, with 1,500 output tokens per step, a 270-second timeout, and no automatic model retries. Requests are limited to 60 KB and 20 messages. The unused `agent_buckets` table and legacy chat concurrency columns remain in the schema for compatibility with older deployments; agent requests no longer use them.

Run `pnpm --filter website test:agent` for the real PostgreSQL tool integration tests and a deterministic SDK tool-loop/streaming and persistence test that needs no provider key. Run `pnpm --filter website test:agent-chats` for chat history, legacy message-ID recovery, workspace isolation, authoritative context, overlapping replies, and interrupted messages. Run `pnpm --filter website test:agent-rpc` for the actual oRPC procedure/AI SDK transport with simulated BotID and Gateway responses, covering follow-ups, reopening, persistence, cancellation, bot rejection/outages, and repeated verified requests without IP or token quotas. Live model quality, provider authentication, and production BotID verification require a configured deployment.

## TailorKit apps

The host setup lives in three files:

- `lib/tailorkit.ts`: the shared contract, theme, view schemas, and page context builders.
- `lib/tailorkit-client.tsx`: component renderers, browser tools, provider, and hooks.
- `lib/tailorkit-server.ts`: server tools and the TailorKit server instance.

`lib/tailorkit.ts` is the browser-safe `defineContract` shared by the host server and client. It declares the `workspace` scope, workspace/page context at `/`, plus a dedicated view for every CRM page. The `navbar` slot renders app actions in each page header. Apps call `ui.openPanel` to open their own installation's panel tab. Panel views render as tabs beside the agent. The `navbar` and `panel` slots support the page views below; apps can implement a specific view or fall back to `/`. The `page` slot uses only the root view `/` and allows multiple instances per app: each instance appears under **App pages** in the sidebar and mobile navigation. The entire group is hidden when no page instances are available.

Page contexts are registered by the page displaying the data and update as its query data or local controls change:

- `/overview` (the home route `/`): contacts, deals, follow-ups, recent activity, revenue, open pipeline value, and relationship/task totals.
- `/contacts`: public contact records and total count. The list also supplies search/status filters, sort order, pagination, visible contact IDs, and selected contact IDs.
- `/contacts/detail`: the full current contact, its deals, follow-ups and activity, the selected contact tab, and currency. It inherits `/contacts` collection context and the root workspace context. List-only controls are omitted on detail pages.
- `/pipeline`: the displayed deals, related contact records, search query, stage counts/values, total value, and currency.
- `/tasks`: follow-ups, contact records, and pending/completed totals.
- `/settings`: workspace collection usage, record limit, and currency.
- `/app-pages`: the requested app ID and instance key, including keys containing spaces or slashes. Identity is available even while discovery is loading or the requested instance is unavailable.

View schemas and context builders live alongside the contract in `lib/tailorkit.ts`. Record contexts omit internal tenant IDs, retain message whitespace, and use the same `YYYY-MM-DD` calendar dates as the app tools. Timestamps remain ISO strings. The root workspace context stays mounted across navigation; page contexts unregister when their page unmounts. Apps implementing only `/` continue to receive that fallback on every page.

Supply page instances with stable keys and `metadata: { label: "Reports" }` to name their links. Missing or blank labels fall back to the app name and instance key. Each link opens `/app-pages/<appId>?instance=<encoded-key>` and renders that exact instance with `RenderSlot`. Keeping the key in the query supports keys containing spaces, slashes, or other URL characters, and links survive reloads. Removed instances show a page-unavailable state. App discovery is refreshed after agent turns so newly created pages appear in navigation.

Set `TAILORKIT_PROJECT_KEY` in the server environment to connect your TailorKit project. Without a configured project, CRM and agent features still work and the panel reports that apps are unavailable.

`tailorKitTheme` in `lib/tailorkit.ts` supplies **the same theme** to `primitives()` and `createClient()`. Apps can use background, text, border, spacing, radius, size and responsive tokens. Semantic colors reference the existing CSS variables, so they follow light/dark mode. Layout breakpoints match the host's 800px mobile and 1280px side-panel boundaries. The SDK's default tokens remain available alongside host additions such as `background="card"`, `textColor="muted"`, `radius="full"`, `width="panel"` and `height="screen"`.

The client implements contracted components using TailorKit primitives and the existing Coss components:

- Layout and interaction: `Box`, `Flex`, `Grid`, `Inline`, `Pressable` (with `onPress()` and an accessible `ariaLabel`).
- Content: `Text`, `Heading`, `Card`, `Badge`, `Avatar`.
- Forms: `Form`, `Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `Switch`, `Button`.
- Tables: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`.
- Feedback and overlays: `Alert`, `Empty`, `Progress`, `Spinner`, `Skeleton`, `Separator`, `Dialog`.

Controls expose plain serializable callbacks: `onChange({ value })`, `onCheckedChange({ checked })`, `onOpenChange({ open })`, `onClick()` and `onSubmit()`. `Form` handles native validation and includes a submit button, with configurable `submitLabel` and `disabled` props. Each input has a visible label and accessible name. `Combobox` searches option labels and optional descriptions, displays a configurable empty state, and emits the selected string ID through `onChange({ value })`. `Dialog` always provides a title. Compose table rows inside their header/body and cells inside rows.

Apps have the same workspace operations as the CRM UI, plus task editing:

| Tool group   | Actions                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| `workspace`  | `get`: workspace name, collection usage/limit, total deal value                                           |
| `contacts`   | `list` (query/status), `get` (details, related deals/tasks, notes/activity), `create`, `update`, `delete` |
| `deals`      | `list` (query/stage/contact), `create`, `update`, `delete`, `move` (stage or before/after another deal)   |
| `tasks`      | `list` (query/completed/contact), `create`, `update`, `delete`, `setCompleted`                            |
| `activities` | `list` (optionally by contact), `addNote`                                                                 |
| `ui`         | `navigate`, `openPanel`, `refresh`, `setTheme`, `notify` (client tools)                                   |

The 18 server tools invoke domain procedures with oRPC `call`, without HTTP. The agent uses `@orpc/ai-sdk` to derive tool schemas and descriptions from those procedures, with explicit `call` execution that validates even direct tool invocations. There is no separate CRM operation/API layer. These paths share validation, tenant isolation, collection limits and activity behavior. The workspace comes from the SDK-verified signed scope, never app input. After successful writes, an app can call `ui.refresh` to invalidate the host queries and display the updated data. The client tools use the host router, apps panel, theme provider and toast manager. Navigation accepts only existing CRM routes, contact detail URLs, and app page URLs.

Lists return at most 50 records (the workspace collection limit); apps can sort, paginate, select and chart those results locally, just as the host does. Read results include creation timestamps and pipeline position. Calendar dates are `YYYY-MM-DD`; timestamps are ISO strings; deal values are whole USD. Contact/deal/task updates take all editable fields, so preserve fields from the latest read when making an edit. `tasks.setCompleted` sets an explicit boolean, making retries idempotent. Deleting a contact removes its notes/activity and retains related deals/tasks with `contactId: null`.

For example, `contacts.create` accepts:

```json
{
  "name": "Alex Chen",
  "email": "alex@example.com",
  "company": "Acme Studio",
  "role": "Designer",
  "status": "lead"
}
```

Use the returned `contact.id` in `tasks.create` with `{ "title": "Follow up", "dueDate": "2026-11-01", "contactId": "…" }`, or in `ui.navigate` as `{ "href": "/contacts/<id>" }`.

Verify the setup with `pnpm check`, `pnpm --filter website typecheck`, and `pnpm build`. Hosted app discovery, signed capability transport and sandbox rendering require a configured TailorKit project.

## Anonymous setup

Better Auth stores the account/session in Postgres and uses its signed HttpOnly session cookie. The session lasts 30 days with refresh on active use. No signup or sign-in forms are exposed. Clearing cookies creates a fresh workspace on the next visit.

Setup completion is stored in `tenants.setup_version`, rather than trusting a client flag. `lib/provision.ts` owns `CURRENT_SETUP_VERSION`; `routers/context.ts` checks it to decide whether setup must resume. To add a setup step, increment this constant and add the step guarded by the previous version inside the locked transaction, advancing the version only after success. Initial seed data is small and provisioning is idempotent, including concurrent tabs. The setup overlay preserves the requested URL and reveals it after completing the steps.

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

No generated migration files are required. Vercel's build environment receives the Neon secrets directly; local development does not need to download them.

### Preview branch cleanup

The [cleanup workflow](../.github/workflows/cleanup-neon-preview.yml) deletes `preview/<git-branch>` when a pull request from this repository is merged or closed without merging. This matches the branch names created by the Vercel integration and frees branch capacity immediately instead of waiting for Vercel deployment retention. Missing branches are a successful no-op; default, protected, and root branches are refused. Fork PRs are skipped because their branch names can collide with this repository's previews.

Configure these under **GitHub → Settings → Secrets and variables → Actions** before relying on cleanup:

- Repository variable `NEON_PROJECT_ID`: the connected project's ID from Neon **Project Settings**.
- Repository secret `NEON_API_KEY`: an API key with access to that project, created in Neon **Account Settings → API Keys**.

The workflow uses `pull_request_target` so the base repository controls cleanup, with no repository checkout and no GitHub token permissions. It becomes active after merging into `main`. Existing branches from already-closed PRs need a one-time cleanup in the Neon Console; this workflow handles future PR closes. Deleting the database branch also ends database access for its old preview URLs. If a PR is reopened, push a commit or redeploy to recreate its preview database.

See [Neon's preview branch cleanup guide](https://neon.com/docs/guides/vercel-branch-cleanup) for integration behavior and setup details.

This is a bounded demo workspace, not a full production account system. Per-workspace record limits do not provide a global storage budget: cookie resets can create additional anonymous accounts. Add expiry cleanup or a global account budget before exposing it to sustained public traffic.

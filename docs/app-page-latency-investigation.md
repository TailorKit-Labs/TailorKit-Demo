# App-page latency investigation — 21 October 2026

## Current findings

The combined discovery endpoint from platform PR #363 is deployed and the production demo uses SDK beta.57. Production was verified through Vercel deployment metadata: demo commit `2bb6278`, compute region `iad1`. The active Cloudflare Worker version is `ceb5b743-68ef-4555-9e78-32a0373dd743`, uploaded at 10:50 UTC, with targeted `aws:us-east-1` placement.

There are two independent problems: redundant discovery in the client and a slower forwarding path to an existing installation. Authentication also performs an avoidable repeated session lookup.

## Measurements

These are small diagnostic samples from an Australian browser, not percentile benchmarks. Requests returned HTTP 200 and expected instance counts. Runtime tokens remained in the browser and are excluded here.

- One Doom navigation issued three sequential page `/views` requests: 830ms, 932ms, and 707ms. Discovery changed the `/app-pages` context after finding the instance, then the managed renderer discovered it again with an app filter.
- Authentication-only `/views` probes using an empty app filter took 280–328ms including the browser-to-US round trip.
- Discovery-only probes using a valid but nonexistent installation UUID took 391–528ms.
- Existing-installation `/views` probes resolving Doom took 835ms and 917ms warm, with a 2,126ms first sample.
- A separate fresh demo workspace, created through the normal incognito UI, returned warm Doom `/views` responses in 470ms and 492ms, with an 848ms first sample. This comparison used the same deployed host and Worker configuration.

Cloudflare live-tail events distinguish the stateless forwarding Worker from Durable Object execution. Three warm queries on the existing installation spent 225ms, 244ms, and 263ms in the forwarding Worker, while Durable Object query invocations took 7ms, 12ms, and 15ms. Warm instance-resolver actions similarly showed 229–241ms in the gateway and 7–9ms in the object. First calls sometimes took substantially longer.

The fresh installation produced much shorter forwarding events, including 30–56ms, with 6–8ms object execution. Direct browser calls still pay Australia–US travel and sometimes CORS preflight, so their browser durations should not be equated with gateway or object durations.

## Interpretation

The existing installation's application execution is fast when warm. A substantial wait is outside its Durable Object execution. The fresh-installation comparison supports the explanation that the older object remains far from the US host/gateway, while the new-object hint is helping fresh installations. The exact object data center was not exposed, so this is an inference, not a verified physical location. The request's ingress `colo` is not the object's execution location.

Cloudflare documents that [Worker placement](https://developers.cloudflare.com/workers/configuration/placement/) affects fetch handlers, while [Durable Object location hints](https://developers.cloudflare.com/durable-objects/reference/data-location/) apply on initial creation. Changing the Worker region or adding `enam` does not relocate an existing object.

The live data supports roughly 470–490ms for a warm `/views` request on this new installation. It does not establish a universal latency target. Existing installations require a supported state-preserving migration if relocation is needed; changing object names or namespaces would create different storage.

## Prepared fixes

### Demo host

- Render the already authorized page instance with `RenderSlot.Controlled`, including its instance data, metadata and the same root workspace/path context. Discovery remains responsible for refresh and removal.
- Authenticate once in the API route using the request headers. React's render cache does not deduplicate the two previous session calls in a route handler.
- Append aggregate `workspace_auth` and `host` Server-Timing durations without buffering the response body or exposing credentials.

### Platform SDK

- Normalize each multiple-slot discovery request to its deepest supported ancestor view. Keep all relevant ancestor layers, including workspace and current page. Ignore changes to deeper context that the slot's resolvers cannot receive.
- Use the same normalization for explicit refreshes. Preserve filters, scope isolation, context errors, cancellation, and freshness behavior.
- Add `views_auth`, `views_discovery`, and `views_instances` Server-Timing durations to `/views` responses.

For this demo's root-only page slot, the SDK normalization prevents the post-discovery app identity update from issuing another page discovery request. Controlled rendering removes the app-filtered discovery request. Together they remove the two avoidable requests in the observed three-request waterfall. This behavior is covered by local regression tests; improved production navigation timings have not been measured because these fixes are not deployed.

The existing `aws:us-east-1` Worker placement, `enam` object hint, object names, namespaces, and stored state are unchanged.

## Validation and remaining rollout

The SDK client-core and core suites pass: 101 and 217 tests, plus their affected dependency typechecks. Repository-wide lint and formatting pass. The demo API integration test verifies one session lookup, rejection of unauthenticated requests, workspace isolation across two users, untrusted context not selecting the authorization scope, and timing/no-store headers. App-page URL/origin tests and the demo typecheck pass.

Merge and release the SDK changes through the normal beta workflow, then upgrade the demo and measure cold/warm navigation request count and Server-Timing stages. Compare existing and fresh installations separately. The location hint alone cannot remove the older installation's forwarding penalty.

# Doom

A Patchsmith app in the CRM's full-page `page` slot, with a lightweight placeholder in the `panel` slot linking directly to `/apps/doom/doom`. Its single page instance is labelled **Can it run DOOM?** in App pages. The host resolves that slug and instance key within the authenticated workspace. Publish the updated Doom app alongside the website so installed panels use the new URL. The host and app use SDK `0.1.0-beta.56`.

Opening **App pages → Can it run DOOM?** or the panel's **Play Doom** link automatically launches the first level; click the game to focus it. Enter selects menu items; P opens or closes the menu. Arrow keys turn and move; W/S move forward/backward and A/D strafe using Doom's native Alt + arrow controls. While either is held, Left/Right also strafe; releasing A/D restores turning. The upstream build's dedicated strafe defaults are custom key codes, not comma/period, and its config-file loading is disabled. Space or F fires, E opens doors, Shift runs, and 1–7 select weapons. Tab releases focus. Pause freezes the game; Resume continues it; Restart starts a fresh first level. Leaving the page disposes the engine. Saves are in-memory and disappear on restart or navigation. Keyboard input is required.

The app runs [ozkl/doomgeneric](https://github.com/ozkl/doomgeneric)'s published Emscripten/WebAssembly build inside Patchsmith's opaque iframe. SDL renders to an iframe-local canvas; the SDK transfers pixels to the host-owned `Canvas`. Only approved keys and pointer events are forwarded while the host canvas is focused. The game runs at 35 FPS with a 640×480 presentation surface to correct Doom's original pixel aspect ratio. A timer drives the hidden iframe's game loop.

Audio is disabled (`-nosound`): the opaque iframe cannot receive the user activation needed by Web Audio through the canvas input bridge. There is no host audio bridge in this demo.

Opening the game downloads about 11.8 MB from [the author's browser build](https://ozkl.github.io/doomgeneric/): `doomgeneric.js`, `doomgeneric.wasm`, and `doomgeneric.data`. SHA-256 subresource integrity pins all three to the build verified on 2026-10-21. An upstream asset change fails visibly; review the upstream changes and update the hashes together. Network access to that origin is required. The data package includes Doom shareware and sound assets; this repo does not redistribute game data or the engine. Upstream's engine is GPL-2.0; game data has its own license. Source and build instructions are in the upstream repository.

From the workspace root:

```sh
pnpm --filter @demo/doom build
pnpm --filter @demo/doom exec tsc --noEmit
pnpm --filter @demo/doom test
pnpm --filter @demo/doom run deploy --no-interactive
```

The committed generated bindings include `Canvas`; the app server exposes the installed page URL to the panel. Generate against an upgraded host (the deployed host must include this branch's canvas contract):

```sh
pnpm --filter @demo/doom generate
```

Publish before deploying the CRM. The app ID in `patchsmith.config.ts` is imported by workspace setup. Setup version 3 installs the shared published app for new and returning workspaces without reseeding data or reinstalling Messages. `PATCHSMITH_PROJECT_KEY` must belong to the same project as the published source app. Existing installations remain pinned to their published deployment, per the SDK installation model.

The app keeps the name **Doom**. Its page heading, sidebar entry (desktop and mobile), and panel tab share the published app logo, with light and dark variants. The bundled wordmark is from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Doom_–_Game’s_logo.svg), credited to id Software / Bethesda. Publish a new Doom deployment and update installations to roll out the logo and page label. The instance key remains `doom`, preserving existing links.

# Doom

A Patchsmith app in the CRM's full-page `page` slot. Its single instance is labelled **Doom** in App pages. The host and app use SDK `0.1.0-beta.55`.

Press **Start Doom**, then click the game to focus it. Enter selects menu items; P opens or closes the menu. Arrow keys turn and move; W/S move forward/backward and A/D strafe. F fires, E or Space opens doors, Shift runs, and 1–7 select weapons. Tab releases focus. Pause freezes the game; Resume continues it; Restart starts a fresh session. Leaving the page disposes the engine. Saves are in-memory and disappear on restart or navigation. Keyboard input is required.

The app runs [ozkl/doomgeneric](https://github.com/ozkl/doomgeneric)'s published Emscripten/WebAssembly build inside Patchsmith's opaque iframe. SDL renders to an iframe-local canvas; the SDK transfers pixels to the host-owned `DoomCanvas`. Only approved keys and pointer events are forwarded while the host canvas is focused. The game runs at 35 FPS with a 640×480 presentation surface to correct Doom's original pixel aspect ratio. A timer drives the hidden iframe's game loop.

Audio is disabled (`-nosound`): the opaque iframe cannot receive the user activation needed by Web Audio through the canvas input bridge. There is no host audio bridge in this demo.

The first start downloads about 11.8 MB from [the author's browser build](https://ozkl.github.io/doomgeneric/): `doomgeneric.js`, `doomgeneric.wasm`, and `doomgeneric.data`. SHA-256 subresource integrity pins all three to the build verified on 2026-10-21. An upstream asset change fails visibly; review the upstream changes and update the hashes together. Network access to that origin is required. The data package includes Doom shareware and sound assets; this repo does not redistribute game data or the engine. Upstream's engine is GPL-2.0; game data has its own license. Source and build instructions are in the upstream repository.

From the workspace root:

```sh
pnpm --filter @demo/doom build
pnpm --filter @demo/doom exec tsc --noEmit
pnpm --filter @demo/doom run deploy --no-interactive
```

The committed generated bindings include `DoomCanvas`. Generate against an upgraded host (the deployed host must include this branch's canvas contract):

```sh
pnpm --filter @demo/doom generate
```

Publish before deploying the CRM. The app ID in `patchsmith.config.ts` is imported by workspace setup. Setup version 3 installs the shared published app for new and returning workspaces without reseeding data or reinstalling Messages. `PATCHSMITH_PROJECT_KEY` must belong to the same project as the published source app. Existing installations remain pinned to their published deployment, per the SDK installation model.

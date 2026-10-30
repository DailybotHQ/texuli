# Canvas page (texuli.com)

**App:** `apps/website`
**Path:** `/canvas-page/` (Components group, after Forms)
**Packages:** `@texuli/canvas` (`model`, `editor`, `viewer`, `sync`,
`export`, `host`), `@texuli/document/sync`, `@texuli/player`; all of the
canvas in development and on npm from `0.8.0`, its first release (pre-1.0);
the `canvas` catalog id is spec `0.8.0`
**Tests:** `apps/website/tests/site-canvas.test.ts`, `tests/e2e/site-canvas.spec.ts`

## Goal

Show the infinite canvas working: the editor on a board with every shape
type, the closed vocabulary, the keyboard model, two local peers on one
CRDT, export, and a canvas an agent wrote, painted read-only by the player.
The frame is the shared `FeaturePage.astro`.

## Layout

| Section | Island | What it shows |
| --- | --- | --- |
| Hero | static | Status (in development, on npm from `0.8.0`) and the subpaths as pieces. |
| `#editor` | `CanvasWorkbench.svelte` | `CanvasEditor` (toolbar, surface with snapping and the minimap, shape tree) on `launchBoard()` (`board.ts`: every `SHAPE_TYPES` entry, every routing and cap); a bar with live counts, selection and zoom from the controller, Reset, and SVG and PNG export as downloads. |
| `#vocabulary` | static | Shape types, tools with their keys, routes, caps, anchors, colors, dashes, text sizes and limits, read from the package at build time. |
| `#keyboard` | static | The keyboard model of `packages/canvas/docs/editor.md`, with the tool row built from `TOOL_KEYS`. |
| `#collab` | `CollabCanvas.svelte` | Ada's and Lin's editors on two `createCanvasSync` replicas through `createMemorySyncHub`; selections travel as presence and are listed under each editor (painting remote cursors in the editor is planned). |
| `#agents` | `AgentCanvasDemo.svelte` | The blueprint JSON and the hostile sticky (static), and the real `<Player>` with `createCanvasPlayerHost()`; the raw CSS paint is refused before painting. |
| `#safety`, `#package-docs` | static | The rules, code samples and doc paths. |

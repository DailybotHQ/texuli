# @texuli/core

**Layer L0: texels.** Framework-free TypeScript behavior and policy that every
Texuli component is built from. No Svelte, no runtime dependencies.
Published to npm as `0.1.0-next.2` under the `next`
dist-tag (by CI, with provenance); no stable release (`latest` is reserved
for 1.0.0), so install it with `@next`. The workspace package stays
`"private": true`.

## What exists today

Every texel in the table below is implemented, tested and documented in this
package. The public API is exactly what the root barrel `src/index.ts`
exports; each texel is also a per-area subpath export in `package.json`
(`@texuli/core/<area>`), so consumers can import narrowly and tree-shake the
rest.

| Texel | Headline exports | Doc |
| --- | --- | --- |
| Announcer | `createAnnouncer`, `createLiveRegion`, `getAnnouncer`, `appendRegion` | [core-announcer](docs/core-announcer.md) |
| Controllable state | `createControllableState` | [core-controllable](docs/core-controllable.md) |
| Direction and locale | `directionOf`, `inlineSideToPhysical`, `createCollator`, `compareLocale`, `resolveMessages` | [core-dir-locale](docs/core-dir-locale.md) |
| Dismiss | `bindDismissLayer`, `isPointerOutside`, `isFocusOutside`, `createDismissOutsideEvent`, `createOpenGestureGuard` | [core-dismiss](docs/core-dismiss.md) |
| Editor model | `loadEditorDocument`, `normalizeDocument`, `validateEditorDocument`, `caret`, `clampSelection`, `inlineToTree`; transforms (`insertText`, `splitBlock`, `deleteBackward`, `toggleMark`, `setLink`, `replaceSelection`, `applyInputRules`…), `editorHistoryReducer`, `createEditorKeymap`, `fromMarkdown`/`toMarkdown` (subpaths `@texuli/core/editor-model`, `editor-transforms`, `editor-history`, `editor-keymap`, `editor-markdown`; not in the root barrel) | [core-editor](docs/core-editor.md) |
| Environment | `isBrowser`, `getOwnerDocument`, `getOwnerWindow`, `listen`, `matchesMedia`, `requestFrame` | [core-env](docs/core-env.md) |
| Focus scope | `createFocusScope` | [core-focus-scope](docs/core-focus-scope.md) |
| Form bridge | `createFormBridge` | [core-form-bridge](docs/core-form-bridge.md) |
| Ids | `createIdScope`, `createIdFamily`, `joinIds`, `ariaLabelledBy`, `ariaDescribedBy`, `ariaControls`, `ensureElementId`, `sanitizeIdPart` | [core-ids](docs/core-ids.md) |
| Inert | `createInertRegistry`, `getInertRegistry`, `computeInertTargets` | [core-inert](docs/core-inert.md) |
| Keyboard | `parseShortcut`, `matchesShortcut`, `formatShortcut`, `createShortcutMap`, `getNavigationIntent`, `normalizeKey`, `detectPlatform` | [core-keyboard](docs/core-keyboard.md) |
| Layer stack | `createLayerStack`, `getLayerStack`, `decideEscape`, `bindLayerStackDocument`, `layerReceivesEscape` | [core-layer-stack](docs/core-layer-stack.md) |
| Lazy chunks | `lazyChunk`, `hasLazyChunk`, `clearLazyChunk(s)` (subpath `@texuli/core/lazy`; not in the root barrel) | — |
| Overlay engine | `createOverlay` (`OVERLAY_MODE_ATTR`, `OVERLAY_Z_BASE`); the reduced surface is the `@texuli/core/overlay-core` subpath | [core-overlay-core](docs/core-overlay-core.md), [overlay-engine](docs/overlay-engine.md) |
| Portal | `createPortal` | [core-portal](docs/core-portal.md) |
| Positioning (DOM) | `positionFloating`, `applyPosition`, `autoUpdate`, `observeMove`, `cssAnchorDeclarations`, `supportsCssAnchorPositioning` | [core-position-dom](docs/core-position-dom.md) |
| Positioning (math) | `computePosition`, `place`, `shiftIntoBoundary`, `sizeToAvailable`, `listPlacements`, `resolvePlacementForDirection`, `rect` | [core-position-math](docs/core-position-math.md) |
| Presence | `createPresence`, `prefersReducedMotion`, `hasPendingMotion`, `parseCssTimeList` | [core-presence](docs/core-presence.md) |
| Roving focus + typeahead | `createRovingFocus`, `createTypeahead`, `stepRovingIndex`, `setRovingTabIndex`, `indexOfSelected` | [core-roving](docs/core-roving.md) |
| Scroll lock | `lockScroll` | [core-scroll-lock](docs/core-scroll-lock.md) |
| Tabbable | `isFocusable`, `isTabbable`, `getFocusableElements`, `getTabbableElements` | [core-tabbable](docs/core-tabbable.md) |
| URL policy (links) | `safeHref`, `type HrefTrust` | [core-url-policy](docs/core-url-policy.md) |
| URL policy (media) | `safeImageSrc`, `safeImageSrcset`, `safeMediaSrc`, `MAX_DATA_IMAGE_BYTES` | [core-url-policy](docs/core-url-policy.md) |

The editor texels are not in the root barrel: the barrel measures 22.64 of
its 24 KiB budget. `pnpm size` (2026-10-26) measures `editor-history` at
773 B and `editor-keymap` at 2.49 KiB, both within the 4 KiB per-texel
default. `editor-markdown` (7.05 of 7.50 KiB), `editor-model` (7.83 of
8.50 KiB) and `editor-transforms` (10.36 of 11 KiB) are over that default
and carry their own budget rows; every entry is within budget.

The tables above name the headline exports per texel, not the full surface:
read `src/index.ts` (and the per-area `index.ts`) for every exported symbol
and type. The threat model behind the URL policy lives in
[docs/SECURITY.md](../../docs/SECURITY.md).

## Examples

```ts
import {
  safeHref,
  createIdScope,
  ariaLabelledBy,
  getLayerStack,
  decideEscape,
  getTabbableElements,
  isTabbable,
} from '@texuli/core';

safeHref('https://example.com/a');            // 'https://example.com/a'
safeHref('http://example.com');               // undefined (untrusted is the default)
safeHref('/docs/button', 'developer');        // '/docs/button'
safeHref('javascript:alert(1)', 'developer'); // undefined in every tier

const ids = createIdScope({ prefix: 'dialog' });
const titleId = ids.next('title');            // scoped, SSR-stable
ariaLabelledBy(titleId);                      // the id list for aria-labelledby

const stack = getLayerStack();
const layer = stack.register({ element: panelEl, label: 'dialog' });
decideEscape(stack, { key: 'Escape' }); // reaches only the topmost layer
layer.unregister();

const stops = getTabbableElements(dialogElement);
isTabbable(stops[0]!);                        // true
```

### URL policy tiers

- **`untrusted`** (default, for agent or user content): only `https:`,
  `mailto:` and `#fragment`.
- **`developer`** (for app-authored props): anything except `javascript:`,
  `vbscript:`, `data:` and any value opening with two slashes or
  backslashes in any mix (`//host`, `/\host`, `\/host`, `\\host`) or with
  any leading backslash, which browsers resolve off-origin.
- Whitespace and ASCII control characters are stripped before the scheme is
  read, so `java\tscript:` is caught.

Images and media use the element-specific policies: `safeImageSrc` allows
HTTPS and relative assets from either tier, plus (developer tier only) HTTP,
valid blob URLs, and PNG, JPEG, GIF, WebP or AVIF base64 data images up to
1 MiB decoded; SVG and non-image data URLs are always refused.
`safeImageSrcset` accepts a comma-separated `srcset` only when every candidate
is safe. `safeMediaSrc` restricts untrusted audio/video to blob URLs or exact
origins from an HTTPS `allowedOrigins` list. Full contract:
[core-url-policy](docs/core-url-policy.md).

## Layout

```text
packages/core/
├── package.json     exports "." and one subpath per texel; script: typecheck
├── tsconfig.json    extends ../../tsconfig.base.json
├── docs/            one contract doc per texel (core-*.md) + overlay-engine.md
├── src/index.ts     the public barrel (only what is exported here is public)
├── src/<area>/      one directory per texel (announcer, roving, layer-stack, …)
└── tests/           26 test files, one or more per texel, including hostile
                     inputs for every policy that guards a sink
```

## Rules

- Framework-free: no Svelte or other UI framework imports; standard DOM types
  are fine.
- No runtime dependencies; no imports from any other workspace package (L0 is
  the bottom layer).
- Policy functions fail closed and document their contract in JSDoc.
- Every export ships with tests in `tests/<name>.test.ts`, including hostile
  inputs for anything that guards a sink.
- Ids never use `Math.random` at module scope; scopes are per-root.

## Testing

```bash
pnpm vitest run packages/core                    # every core texel test
pnpm vitest run packages/core/tests/roving.test.ts   # one texel
pnpm --filter @texuli/core typecheck             # tsc -p tsconfig.json
npx biome check packages/core                    # lint + format
```

Core is shared by every layer above it, so a change here also runs
`pnpm check`, the primitives behavior suite and `pnpm build`
([TESTING_GUIDE](../../docs/TESTING_GUIDE.md)).
To add a texel, follow
[`.agents/skills/add-texel/SKILL.md`](../../.agents/skills/add-texel/SKILL.md).

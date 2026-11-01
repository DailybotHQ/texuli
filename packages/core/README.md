# @texuli/core

The framework-free foundation of [Texuli](https://texuli.com), an MIT-licensed
Svelte 5 component library by Dailybot, Inc. (*Small pieces. Infinite
possibilities.*). `@texuli/core` holds the **texels**: small, tested
TypeScript units of behavior and policy (focus management, roving focus,
layering and Escape handling, positioning, ids, keyboard shortcuts, URL
safety) that every Texuli primitive and component is built from.

Use it directly when you build your own components in any framework, or
when you need Texuli's URL policy to sanitize links and media from agents
or users. It has no runtime dependencies and imports no UI framework.

> **Status: 0.x release.** Texuli is in development. The packages are
> published to npm as `0.11.5`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.12.0`) may contain breaking
> changes, so pin the exact version or use `^0.11.0`, which accepts only 0.11.x.

## Install

```bash
npm install @texuli/core
```

```bash
pnpm add @texuli/core
# or
yarn add @texuli/core
```

No peer dependencies and no CSS. The package is ESM-only and ships
TypeScript declarations.

## Quick start

```ts
import { ariaLabelledBy, createIdScope, safeHref } from '@texuli/core';
import { detectPlatform, matchesShortcut } from '@texuli/core/keyboard';

// URL policy: untrusted (agent or user) content is the default tier.
safeHref('https://example.com/report');        // 'https://example.com/report'
safeHref('http://example.com');                // undefined (https only)
safeHref('/docs/button', 'developer');         // '/docs/button'
safeHref('javascript:alert(1)', 'developer');  // undefined in every tier

// Ids that match on the server and the client.
const ids = createIdScope({ prefix: 'dialog' });
const titleId = ids.next('title');             // 'dialog-0-title'
ariaLabelledBy(titleId);                       // 'dialog-0-title'

// Keyboard shortcuts written as data; Mod is Cmd on Apple platforms, Ctrl elsewhere.
const platform = detectPlatform(navigator);
window.addEventListener('keydown', (event) => {
  if (matchesShortcut(event, 'Mod+K', platform)) {
    // open your command palette
  }
});
```

Everything in the table below is available from the root entry
(`@texuli/core`) and from its own subpath (`@texuli/core/<subpath>`), except
the editor, lazy-chunk, motion, markup, ZIP, expression, data-source and
i18n texels, which are subpath-only. Import subpaths to keep bundles narrow.

## What's inside

| Texel | Subpath | Headline exports |
| --- | --- | --- |
| URL policy | `url-policy` | `safeHref`, `safeImageSrc`, `safeImageSrcset`, `filterImageSrcset`, `safeMediaSrc` |
| Ids | `ids` | `createIdScope`, `createIdFamily`, `ariaLabelledBy`, `ariaDescribedBy`, `ensureElementId` |
| Keyboard | `keyboard` | `parseShortcut`, `matchesShortcut`, `formatShortcut`, `createShortcutMap`, `getNavigationIntent` |
| Roving focus and typeahead | `roving` | `createRovingFocus`, `createTypeahead`, `setRovingTabIndex` |
| Focus scope | `focus-scope` | `createFocusScope` (trap and restore focus) |
| Tabbable | `tabbable` | `isFocusable`, `isTabbable`, `getTabbableElements` |
| Layer stack | `layer-stack` | `getLayerStack`, `decideEscape` (Escape reaches only the topmost layer) |
| Dismiss | `dismiss` | `bindDismissLayer`, `isPointerOutside`, `isFocusOutside` |
| Inert | `inert` | `createInertRegistry`, `computeInertTargets` |
| Scroll lock | `scroll-lock` | `lockScroll` |
| Portal | `portal` | `createPortal` |
| Overlay engine | `overlay`, `overlay-core` | `createOverlay` (combines the texels above for dialogs, popovers and menus); `createOverlayCore` is the reduced surface |
| Positioning (math) | `position-math` | `computePosition`, `place`, `shiftIntoBoundary`, `resolvePlacementForDirection` |
| Positioning (DOM) | `position-dom` | `positionFloating`, `autoUpdate`, `cssAnchorDeclarations` |
| Presence | `presence` | `createPresence`, `prefersReducedMotion` (enter and exit animations) |
| Announcer | `announcer` | `createAnnouncer`, `createLiveRegion` (screen reader announcements) |
| Controllable state | `controllable` | `createControllableState` (controlled and uncontrolled values) |
| Form bridge | `form-bridge` | `createFormBridge` (custom controls in native forms) |
| Direction and locale | `dir-locale` | `directionOf`, `inlineSideToPhysical`, `createCollator`, `resolveMessages` |
| Environment | `env` | `isBrowser`, `getOwnerDocument`, `listen`, `matchesMedia`, `requestFrame` |
| Lazy chunks | `lazy` | `lazyChunk`, `hasLazyChunk` (subpath only) |
| Rich text editor model | `editor-model`, `editor-transforms`, `editor-history`, `editor-keymap`, `editor-markdown` | Document model, transforms, undo history, keymap, Markdown import and export (subpath only) |
| Markup builders | `markup` | `el`, `text`, `linkUrl`, `imageUrl`, `serializeXml`, `serializeHtml`: escaped XML and HTML with no raw-markup API (subpath only) |
| ZIP writer | `zip` | `writeZip`, `writeZipAsync`, `crc32`, `compressBytes`: deterministic archives, deflated where the platform can (subpath only) |
| Expressions | `expression` | `parseExpression`, `parseExpressionText`, `analyzeExpression`, `evaluateExpression`, `CORE_FUNCTIONS`: the closed, bounded expression language of ADR-015 (subpath only; new in 0.8.0) |
| Data sources | `data-source` | `defineSource`, `createSourceRegistry`, `checkSourceQuery`, `createSourceLoader`, `createSourceCollection`, `sourceError`: host-registered sources, the closed query, deduplicated, cancellable, retried and cached reads, optimistic writes with rollback, typed errors (ADR-015; subpath only; new in 0.8.0) |
| Message catalogs | `i18n` | `createI18n`, `parseCatalog`, `formatMessage`, `resolveLabel`, `I18N_CONTEXT`, `pseudoLocalize`: component labels through one catalog, with lazy locales (ADR-016; subpath only; new in 0.8.0) |

The table names the headline exports; each subpath's TypeScript
declarations list the full surface.

## URL policy

Every Texuli component that renders a link or a media source passes it
through this policy, and you can use it the same way. Rejected values return
`undefined` (the policy fails closed).

- **`untrusted`** (the default, for agent or user content): only `https:`,
  `mailto:` and `#fragment` links.
- **`developer`** (for app-authored values): anything except `javascript:`,
  `vbscript:`, `data:`, and values that start with two slashes or
  backslashes in any mix, or with any backslash, which browsers resolve
  off-origin.
- Whitespace and ASCII control characters are stripped before the scheme is
  read, so `java\tscript:` is caught.
- `safeImageSrc` refuses SVG and non-image `data:` URLs in every tier;
  `safeMediaSrc` limits untrusted audio and video to blob URLs or exact
  HTTPS origins you allow.

## Key guarantees

- **Framework-free.** No Svelte, React or other UI framework imports, and no
  runtime dependencies. Standard DOM types only.
- **SSR-friendly ids.** Id scopes are per render root with no module-level
  randomness, so the server and the client produce the same ids; `isBrowser`
  and the owner-document helpers let code skip DOM work on the server.
- **Accessibility building blocks.** Roving focus, focus scopes, inert
  backgrounds and layered Escape handling implement the behavior the
  WAI-ARIA Authoring Practices patterns require.
- **Right-to-left aware.** Direction helpers map logical sides to physical
  ones, and positioning resolves placements for the current direction.

## New in 0.6.0

Ships in `0.6.0`; the `0.5.0` release predates it:

- `@texuli/core/motion` and `@texuli/core/motion/spring`: presence, FLIP
  layout, shared elements, sequences and timelines, and an owned spring
  solver over the Web Animations API, instant on the server and under
  reduced motion ([core-motion](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-motion.md)).
- `@texuli/core/markup` and `@texuli/core/zip`: escaped XML and HTML
  builders and a deterministic ZIP writer for static outputs
  ([core-markup](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-markup.md),
  [core-zip](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-zip.md)).
- Inline extensions in the editor model and Markdown codec (G48:
  `createInlineExtensions`, the `extension` mark and `<sigil>{id|label}`
  tokens), and a reader that is linear on long plain text
  ([core-editor](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-editor.md)).
- Inert exemptions take `raise: false`, so an overlay opened inside a modal
  dialog stays above its backdrop (G75,
  [core-inert](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-inert.md)).

## Documentation

- Website: [texuli.com](https://texuli.com) and the
  [accessibility guide](https://texuli.com/guides/accessibility/)
- URL policy contract: [core-url-policy.md](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-url-policy.md)
- Overlay engine: [overlay-engine.md](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/overlay-engine.md)
- Roving focus: [core-roving.md](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-roving.md)
- Keyboard shortcuts: [core-keyboard.md](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-keyboard.md)
- Positioning: [core-position-math.md](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-position-math.md)
  and [core-position-dom.md](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-position-dom.md)
- Rich text editor model: [core-editor.md](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-editor.md)
- Static outputs: [core-markup.md](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-markup.md) (escaped XML and HTML builders) and [core-zip.md](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-zip.md) (the ZIP writer)
- Motion (`@texuli/core/motion`: animate, presence, FLIP, shared elements, timelines, springs): [core-motion.md](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-motion.md)
- Expressions (`@texuli/core/expression`: the closed AST, its text form, analysis and the bounded evaluator; new in 0.8.0): [core-expression.md](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-expression.md)
- Data sources (`@texuli/core/data-source`: declarations, the closed query, the loader, collections and errors; new in 0.8.0): [core-data-source.md](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-data-source.md)
- Message catalogs (`@texuli/core/i18n`: catalogs, lazy locales, plural and select messages, the instance prop → context → English resolution and the pseudo-locale; new in 0.8.0): [core-i18n.md](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-i18n.md)
- Every texel's contract: [packages/core/docs](https://github.com/DailybotHQ/texuli/tree/main/packages/core/docs)
- Security model: [SECURITY.md](https://github.com/DailybotHQ/texuli/blob/main/docs/SECURITY.md)

## Related packages

- [`@texuli/primitives`](https://www.npmjs.com/package/@texuli/primitives): headless Svelte 5 primitives built on these texels.
- [`texuli`](https://www.npmjs.com/package/texuli): styled, ready-to-use components.
- [`@texuli/tokens`](https://www.npmjs.com/package/@texuli/tokens): the theme engine and design tokens.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-core).

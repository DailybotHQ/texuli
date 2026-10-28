# Upgrading from 0.3.0 to 0.4.0

**Applies to:** `@texuli/slides` `0.3.0` (on npm) → `0.4.0` (in the
repository, **not on npm yet**)  
**Tests that pin the path:** `packages/deck/tests/model-migrate.test.ts`
(every input shape, fixtures in `packages/deck/tests/fixtures/migrate/`),
`tests/layouts.test.ts` (a migrated v1 deck on the v2 stage),
`tests/export.test.ts` and `tests/export-v2.test.ts` (both export paths)

`0.4.0` is a new minor of a pre-1.0 package, so it may break; it changes
the deck model and the stage's defaults. It is not published yet: the
upgrade below describes the code in the repository, and it ships when the
owner approves the release, together with the first publication of
`@texuli/deck` ([RELEASE](../../../docs/RELEASE.md)).

## What changes

- **A new engine package.** The deck model, validation, Markdown dialect,
  navigation engine and authoring helpers move to `@texuli/deck` (layer L0,
  framework-free, no runtime dependencies). `@texuli/slides` becomes the
  Svelte stage on top of it and moves from layer L7 to L8, because it now
  depends on `@texuli/player` to paint catalog components
  ([ADR-009](../../../docs/DECISIONS.md)).
- **Model v2 is the canonical deck.** `formatVersion: 2`, `meta`, `style`,
  `navigation`, `outline`, and slides told apart by `layout` (20 catalog
  layouts, `free`, `component`, `custom`). Model v1 stays readable: it
  migrates losslessly to v2 ([model.md](model.md#migrating-a-v1-deck-to-model-v2)).
- **New dependencies.** `@texuli/slides` `0.4.0` depends on `@texuli/deck`
  and `@texuli/player` in addition to blocks, catalog, media and tokens.
- **Blueprint spec `0.4.0`.** The `layout-deck` and `deck-slide` catalog
  entries gain optional model v2 props. The change is additive: a spec
  `0.3.0` blueprint migrates by restamping `spec` only
  (`@texuli/spec/migrate`).

Every public name of `0.3.0` is still exported: the `model`, `grammar` and
`templates` subpaths keep the model v1 API unchanged, `DeckPrint` and the v1
PPTX writer still take v1 decks, and every `DeckStage` prop of `0.3.0` is
still accepted (`mediaTrust` is now an alias of `tier`).

## Behavior changes on the stage

A `0.3.0` deck keeps presenting, but the stage around it behaves
differently. Check these if a host depends on the old behavior:

| Change | `0.3.0` | `0.4.0` | To keep the old behavior |
| --- | --- | --- | --- |
| URL hash | untouched | `#/<slide>/<step>` written with `replaceState` and followed (`syncHash`, default `true`); only the first stage on a page claims it | `syncHash={false}` |
| Click on the slide | nothing | advances (`clickToAdvance`, default `true`); links, controls and the chrome never do | `clickToAdvance={false}` |
| Canvas | the stage did not scale slides to the deck aspect | a fixed virtual canvas (1280 × 720 for 16:9) scaled and letterboxed into the host box | `fit="viewport"` fills the window height instead; there is no unscaled mode |
| Keys | Left and Right, Page Up and Down, Space, Enter, Backspace, Home, End, `O`, `P` (presenter), `S` (focus the notes in presenter mode), `F`, Esc; only while focus is inside the deck | also Up and Down, Shift+Space, `S` (presenter), `B` or `.` (blackout), `L` (laser) and `?` (help); Esc closes the innermost layer first; the deck that owns the hash also takes keys while nothing on the page has focus | `syncHash={false}` keeps keys to focus inside the deck |
| Steps | absolute: a gap between authored steps costs an empty click | renumbered densely on migration (reported as a `migrated` warning) | — |
| Invalid deck | the host checked `parseDeck` first | the stage validates, shows the diagnostics and calls `onError` | — |
| Chrome | prev, next, counter and a few buttons | a full toolbar (slide list, overview, presenter, blackout, laser, copy link, print, help), a progress bar and a first-visit hint | replace the toolbar with the `chrome` snippet; `?hint=0` turns the hint off |

The full key map and chrome are in [stage.md](stage.md).

## Step by step

1. **Install both packages** (once published):
   `npm install @texuli/slides@0.4.0 @texuli/deck@0.4.0`. Internal Texuli
   dependencies are pinned exactly, so upgrade every `@texuli/*` package of
   the same release together.
2. **Keep presenting v1 decks.** Pass them to `DeckStage` as they are; it
   detects the shape, migrates and validates. Nothing else is needed to keep
   a deck on screen.
3. **Convert stored decks.** Run `migrateDeck` and the v2 `parseDeck` from
   `@texuli/deck/model` once, review the `migrated` warnings, and store the
   v2 deck, so it loads without migration. Model v1 and v2 share names
   (`parseDeck`, `Deck`, `DeckSlide`): import from `@texuli/deck/model` for
   v2 and from `@texuli/slides/model` for v1.
4. **Adopt layouts where they fit.** Migrated slides are free slides with
   their v1 master, so they look the same. `lintDeck` from
   `@texuli/deck/authoring` suggests a catalog layout (`prefer-layout`) for a
   free slide that holds a chart, table, quote, code or image block.
5. **Agent decks.** Untrusted JSON goes through `loadUntrustedDeck`
   (`@texuli/deck/model`: byte, depth and node bounds, migration and
   validation); Markdown through `parseDeckMarkdown` (`@texuli/deck/markdown`).
   Pass the stage's `validateDeckBlock` as `validateBlock` so block bodies
   get the stage's checks. Catalog trees from an agent go through
   `validateDeckDraft` from `@texuli/catalog/validate`, then `migrateDeck` and
   `parseDeck` ([grammar.md](grammar.md#model-v2-deck-trees)); the v1
   `validateDeckDraft` of `@texuli/slides/grammar` still validates v1 trees.
6. **Print.** For a v2 deck, render `DeckPrintView` from
   `@texuli/slides/export` when `parseDeckPrintFlags` sees `?print=1`
   (the stage's print button opens that URL). `DeckPrint` keeps printing v1
   decks ([export.md](export.md)).
7. **PPTX.** `exportDeckPptx`, `writeDeckPptx` and `buildDeckPptx` take
   either model. For a v2 deck they return promises and accept the host's
   `loadImage` and `snapshotChart`; without them images and charts are
   omitted and reported ([export.md](export.md#powerpoint-pptx)).
8. **Presenter screen.** A `DeckSync` from `createDeckSync` still links two
   stages. The v2 stage also opens its own presenter window over the engine's
   presenter protocol; the host no longer needs to open the second window
   itself.
9. **Starter decks.** The v1 templates stay in `@texuli/slides/templates`
   ([templates.md](templates.md)); the v2 templates are
   `createDeckTemplate` in `@texuli/deck/templates`.

## Not changed

- The URL policy: every link and media source still passes `safeHref`,
  `safeImageSrc` or `safeMediaSrc` at paint, at the host's tier (`untrusted`
  by default). The deck never carries its own tier.
- Themes: catalog ids and embedded themes, applied by the `@texuli/tokens`
  engine, a slide's theme over the deck's.
- No HTML sinks, and local, deterministic export.

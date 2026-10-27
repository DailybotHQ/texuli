# Catalog build (content-addressed, with emit tiers)

**Package:** `@texuli/catalog` · **Imports:** `@texuli/catalog/build` (browser-safe) and
`@texuli/catalog/build/node` (discovery and file writing)

The build turns every authored manifest group into one closed catalog file,
`catalog-<sha256>.json`, and says which component ids each kind of author may
emit.

```bash
pnpm exec tsx packages/catalog/src/build/cli.ts [--out <dir>] [--json]
# writes <dir>/catalog-<sha256>.json (default packages/catalog/dist/, git-ignored)
```

## Manifest groups are discovered

Every folder of `packages/catalog/src/manifests/` that has an `index.ts` is a
group named after the folder. The build imports it and collects every
exported manifest: lists such as `FORMS_MANIFESTS` and single manifests, each
once. A new group (overlays, layouts…) is picked up with **no change to the
build**.

## Content addressing

- The file is **canonical JSON**: keys sorted at every depth, no whitespace,
  `undefined` fields dropped. Values JSON cannot carry exactly (NaN, dates,
  functions) fail the build.
- Groups and entries are sorted, so the input order does not matter. There is
  no timestamp.
- The name is the SHA-256 of the file's exact bytes:
  `catalog-<sha256>.json`. `verifyCatalog(fileName, text)` rehashes and returns
  the catalog, or `null` for a tampered or misnamed file.
- The same manifests always give the same file; any change gives a new name.
- An optional `"schemaVersion": 1` on a manifest is authoring metadata: the
  build strips it before hashing, so declaring it or omitting it gives the
  same bytes (see `MANIFEST_SCHEMA_VERSION` in `@texuli/catalog/manifest`).

```ts
{
  format: 'texuli-catalog',
  version: 1,
  groups:  { content: [...ids], display: [...], forms: [...] },
  entries: [{ ...manifest, group, emit: ['developer', 'untrusted'] }],  // sorted by id
  tiers:   { developer: [...ids], untrusted: [...ids] },
}
```

## Emit tiers

### Normative developer tier (roadmap decision D5)

The built catalog's `developer` tier is exactly the ids marked
`agentEmittable: true` in the validated manifests. The default view from
`renderCatalogFromBuild(catalog)` enforces that set: a known id outside it is
present for lookup and produces a visible `tier-denied` placeholder. It does
not become allowed merely because its manifest is included in the catalog.

`renderCatalogFromBuild(catalog, { developer: 'all' })` is the explicit
trusted-host override for app-authored trees that need non-emittable app
chrome. Hosts must choose this deliberately; it is not the default policy for
agent output. `untrusted` remains the narrower Tier U set in either mode.

The tier is selected by the host at validation/render time. An envelope's
declared `tier` is producer metadata and is ignored by `validateDraft`; it
cannot grant permission. `renderCatalogFromSpecs` is a test-spec helper, not a
substitute for the normative built catalog view: its developer behavior allows
every listed spec id.

| Tier | Who emits | Holds |
| --- | --- | --- |
| `developer` | Developers and trusted agents | Every `agentEmittable` component |
| `untrusted` (**Tier U**) | Untrusted model output | Only content components (`tier: 'content'`) and the content layouts `card`, `page`, `doc`, `deck`, `grid` (in the `layouts` group, also as `layout-<name>` or `<name>-layout`) |

Tier U never holds overlays, focus traps or shells:
- the `overlays`, `navigation` and `shells` groups;
- overlay and focus-trap ids (dialog, modal, sheet, drawer, popover,
  tooltip, hover-card, menu, menubar, toast, command, combobox, overlay,
  portal, focus-trap);
- shell ids (shell, sidebar, navbar, app-bar, titlebar).

**The build fails** (`CatalogBuildError` with diagnostics) when:
- any manifest is invalid (the manifest validator), or an id repeats across
  groups;
- a group name is not kebab-case or repeats;
- an overlay or focus trap is marked `agentEmittable` (`overlay-emittable`),
  wherever it is authored.

`isTierU(catalog, id)` answers the renderer's question for one id.

## Today's catalog

133 entries (`pnpm exec tsx packages/catalog/src/build/cli.ts --json`):
- `content`: 35 (nine `blocks-*` families, 23 charts and three media
  components);
- `display`: 17 (including the `inline-text` node, audit G03);
- `forms`: 28, app tier, not emittable (including `combobox` and
  `multi-select`, whose `filter` and `loadOptions` are function props a host
  passes, never agent output);
- `layouts`: 27;
- `overlays`: 26.

Emit tiers: 41 entries for developers and 41 in Tier U.

## Tests

`pnpm vitest run packages/catalog/tests/build.test.ts` (5 grouped tests, Node
environment) covers:
- canonical JSON and SHA-256;
- addressing, order independence, change detection and tamper refusal;
- groups and tiers, and build failures;
- Tier U membership and the overlay, focus-trap and shell exclusions;
- the real catalog reading every group folder and writing a verifiable file;
- discovery of new `overlays` and `layouts` groups from a temporary folder.

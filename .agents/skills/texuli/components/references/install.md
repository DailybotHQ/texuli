# Install: packages or copied source

Back to [`../SKILL.md`](../SKILL.md).

## A. Use the packages

The packages are on npm in the 0.17 line, every one at `0.17.2`, a pre-1.0 line
(`latest` points to the newest, and `next` is no longer maintained and stays on `0.12.1`; 1.0.0 will be the first stable release). An app outside a
Texuli checkout installs them plainly, for example
`pnpm add texuli @texuli/tokens`, and pins the exact version or `^0.17.0`
(for 0.x it accepts only 0.17.x, since a new minor may break) (the developer
runs the install; it uses the network). `@texuli/drag`,
`@texuli/workflows`, `@texuli/deck`, `@texuli/slides`, `@texuli/editor` (first published
in `0.5.0`), `@texuli/document` and `@texuli/pages` (both first published
in `0.7.0`), `@texuli/forms`, `@texuli/canvas` and `@texuli/sheets` (all
three first published in `0.8.0`) and `@texuli/mcp` (first published in
`0.9.0`) are in development and on npm as `0.17.2`.

New in `0.13.1` (an additive patch): `@texuli/blocks/code-field` (`CodeField`),
`registerIcons` and `IconsProvider` in `texuli/icons`, `srcDark` and
`darkMode` on `Image` (`@texuli/media/image`), and `AvatarGroupGrid`
(`texuli/avatar`). They are not in `0.13.0`, so an app that uses them pins
`^0.13.1`. `CodeField`, `AvatarGroupGrid`, `srcDark` and `darkMode` are
not in the `0.13.x` catalog; spec `0.12.0` (new in `0.14.0`) adds the
`code-field` and `avatar-group-grid` ids (app tier) and the `media-image`
`srcDark` and `darkMode` props.

New in `0.14.0` (a `0.x` minor with no breaking API; an app that uses these
pins `^0.14.0`, and the `0.13.x` packages do not have them):

- `TimelineView` (`@texuli/data/timeline`): group header rows and bands
  through `getGroup`, `bind:collapsed` with `onCollapsedChange`,
  `onGroupAdd`, `bind:selectedRow` with `onRowSelect`, and `markers`
  (`{ at, label, tone }`). In the catalog, `data-timeline` lists `groups`,
  `markers`, the bindable `collapsed` and `selectedRow`, and the
  `collapse` event; `onGroupAdd` is not in the catalog.
- `MotionLoop` (`texuli/motion/loop`, presets `pulse` and `wave`), still
  under reduced motion; not in the blueprint motion vocabulary.
- Lazy icons: `registerIcons({ name: () => import(...) }, { fallback })`
  and `IconsProvider` `fallback` (types `IconLoader`, `IconRegistryOptions`).
- `AlertDialog` `confirmDisabled`; `Breadcrumb` items take `ariaLabel` and
  `onSelect(item, event)`; tab items take `panelId`.
- Design systems on spec `0.12.0`: a layer's `darkOpacity`,
  `components.card["font-size"]` (the card content size), the
  `aa-non-text` check (`checkDesignSystemIndicators`,
  `evaluateDesignSystemIndicators`) and compiler version 3
  ([`../../design-systems/SKILL.md`](../../design-systems/SKILL.md)).

New in `0.14.1` (an additive patch; an app that uses these pins `^0.14.1`):

- `CalendarView` (`@texuli/data/calendar/view`): an `event` snippet,
  `(item, { view, compact, time })`, for the chip content in every view.
  The chip stays Texuli's button, named by the snippet's visible content
  plus hidden details, so show the title and add no links or buttons.
- Month view: `maxEventsPerDay` (default 3) and `onMoreEvents(date)`, which
  makes "3 more events" a button named "3 more events on November 5"
  (label `moreEventsOn`).
- `Board` (`@texuli/data/board`): `bind:collapsedLanes` with
  `onCollapsedLanesChange` (a disclosure in each lane heading; a collapsed
  lane still counts in column totals and WIP limits; label `hiddenCards`),
  and `cellFooter(column, lane)`, with `lane` `DEFAULT_LANE` without lanes.
- Not in the agent catalog yet: `collapsedLanes`, `cellFooter` and
  `maxEventsPerDay`. There is no `laneHeader` snippet.

New in `0.14.2` (a patch; an app that uses these pins `^0.14.2`):

- `TimelineView`: `formatTick(date, { zoom, locale, monthStart })` (compact
  day-zoom labels by default) and `initialDate`; without it the timeline
  opens at today when today is within the plan. Exports
  `formatTimelineTick`, `timelineAnchor`, `TimelineTickContext`.
- `ToggleGroup` `deselectable` (default `true`); `Select.Root` `block` and a
  `ghost` trigger variant (per instance, not a design-system default);
  `Sidebar` draws `item.icon`; `badgeLabel` on sidebar and bottom-nav
  items; `IconButton` `badge` and `badgeLabel`.
- Component CSS hooks (each falls back to the look before it): the pressed
  toggle colors, radio size, ring and dot, the radio card alignment, the
  switch thumb inset, the input placeholder color, tab badge colors, the
  dialog close icon size, the PIN cell border, the `IconButton` badge
  colors and a scrim blur (a `backdrop-filter` value, default `none`).
  The `texuli` component docs name each one.
- Fixes: a dialog or sheet mounted open shows its backdrop; side sheets,
  drawers and `DetailPanel` fill their block size (a contained
  `DetailPanel` needs a `position: relative` container).
- Behavior: with `bind:pressed` and `onPressedChange` on `Toggle` (or
  `bind:value` and `onValueChange` on `ToggleGroup`), the handler must set
  the value; a controlled `pressed` with a handler renders the prop.
- Not in the agent catalog yet: `initialDate`, `Select` `block` and
  `ghost`, the `IconButton` badge.

New in `0.17.2` (a patch; blueprint spec stays `0.15.0`; `^0.17.0` picks it
up; no export removed):

- The runtime and static lock agree for every catalog id: part parents
  come from declared catalog relations (`CATALOG_PART_PARENTS` in
  `@texuli/catalog/manifest`), never a shared hyphen prefix, so
  `alert-dialog`, `icon-button` and `form-field` are their own ids.
  `mapLockedRenderPage` forwards `composed`, and an allow axis list is
  read in any declared shape (a value, `{ values }` or a value map).
- `importBrand` keeps fonts and style words apart (`Headings in Fraunces,
  rounded corners, compact spacing`) and reports every word it did not
  read.
- `changesModel` compares every library approval field, `approvedAt`
  included, at full length, and every library entry.
- Every package ships a `CHANGELOG.md` generated from the release notes.

New in `0.17.1` (a patch; blueprint spec stays `0.15.0`; `^0.17.0` picks it
up; no export removed):

- The locked render check is strict again: a catalog root nested in an
  allowed root passes only as a declared part or composed id of that
  parent, and the host reads only the component attribute its caller
  chose (`data-tx-component` by default; pass `componentAttribute:
  'data-ds-check-component'` for a conformance sheet). Each finding code
  keeps its own cap.
- The host `map()` takes the full part-to-parent map (`partParentMap` in
  `@texuli/catalog/manifest`) and a `composed` map, and the prebuilt host
  is a package export: `@texuli/tools/ds-check/host.iife.js`.
- `importBrand` reads whole prose clauses (roles, fonts, several colors in
  order) and reports what it skipped; a repair names the token it changed.
- `changesModel` compares up to 4,096 allow keys (with `warnings` past the
  cap) and every library approval field. Icon buttons keep the 24px target
  minimum.

New in `0.17.0` (a `0.x` minor with blueprint spec `0.15.0`; pin `^0.17.0`,
since `^0.16.0` never picks it up; no export removed):

- `ds generate` keeps the brand seed when it repairs contrast (it pins the
  failing role), reads colors in a prose brief and prefers `--font-sans`.
- Bundles keep every allow entry up to the 4,096-key cap or refuse, and
  refuse duplicate library source ids and a stale current-version history.
- The locked render check ships a prebuilt host script
  (`dist/ds-check/host.iife.js`), reads `data-tx-component`, maps compound
  parts and extension ids to their allowed parent, reports
  `render-disabled-value`, and `--locked --report --baseline <file>` fails
  only on new findings.
- `KitAllowManifest.library` is `{ id, status, version }` (the compiled
  shape); the kit models are in `@texuli/spec/design-system`.
- `VirtualListView`: `mode`, `selectable` and `surface="plain"` are in the
  catalog; `bind:ref`, rest props and handlers follow the component
  contract; feed articles are named from the row's `labelId` or heading.

New in `0.16.1` (a patch; pin `^0.16.1`):

- `texuli ds check` and `ds validate` take `--extensions <file>...`: host
  catalog extension manifests (`<ns>:<id>`) merged by `mergeCatalogs`, so
  `allow` passes or fails the same way as the host's own
  `checkDesignSystemAllow`; `loadMergedCatalog` in `@texuli/tools/ds-check`
  returns that merge.
- A locked prototype counts compound parts (`<Select.Content>`,
  `DropdownMenu.*`, `MultiSelect.*`, `Tabs.*`) as the parent catalog id.
- The locked report lists the imports it did not read
  (`prototype.unchecked`); `--scan-workspace` reads workspace packages.
- `VirtualListView` takes `mode="feed"` (an APG feed of articles for rows
  with their own controls, Page Up and Page Down) and `selectable={false}`.
  Both are component props only: the catalog entry gains them in the next
  minor.

New in `0.16.0` (a `0.x` minor with no breaking API change; pin `^0.16.0`,
since `^0.15.0` never picks it up):

- Released: `texuli/ds-kit`, `texuli ds generate` and the importers,
  `ds validate`, `ds check --locked` (`--report`, and `--render` with
  `--url` for a page you serve), portable bundles
  (`ds pack`, `ds unpack`), the contract schemas and `checkBlueprintAllow`.
- Blueprint spec `0.14.0`: the label palette, a `color` axis (`none`,
  `chart-1` to `chart-8`, each with an AA-gated ink from the theme) on `Avatar`,
  `Badge` and `Tag`, and `allow` `colors`.
- `VirtualListView` (`@texuli/data/virtual-list`); `Mark`, `Link` and
  `ColorSwatch` (`texuli/typography`); `List` (`texuli/list-item`); `Box`
  `fill`, soft tones, `canvas`, `dashed`; `Input` and `Textarea`
  `appearance="plain"` and `textSize`; `NumberField` `commit`.

New in `0.15.0` (a `0.x` minor with no breaking API change; pin `^0.15.0`,
since `^0.14.0` never picks it up):

- Locked design systems (blueprint spec `0.13.0`): a design-system document
  takes `allow` (the catalog ids, and host extension ids `<ns>:<id>`, with
  their enabled variants, sizes, tones, densities and states), `library` and
  `approval` with a content hash; `texuli ds init --locked`, `ds approve`,
  `ds hash`, and `ds check` reports the allowed set and stale hashes. An
  approval records who approved; it cannot prove it.
- `texuli/typography`: `Heading`, `Text`, `Prose` and `Box`.
- `Button` and `IconButton` take `tone` (`default`, `destructive`,
  `success`, `warning`), independent of `variant`.
- In development then (released in `0.16.0`): the kit, `ds generate`, the
  locked checkers, bundles and the contract schemas.

New in `0.14.4` (a patch; pin `^0.14.4`): `TimelineView` holds its opening
day as rows load after mount and as the zoom changes, until the reader
scrolls, and exports `scrollToDate(date)` (bind the instance).

New in `0.14.3` (a patch; an app that uses these pins `^0.14.3`):

- Controls: `labelContent` snippet on `Checkbox`, `Radio` and `Switch`;
  `Field` `counter={{ value, max }}` (in the description, read on focus,
  not a live region); `NumberField.Root` `display="output"`; `Avatar`
  `tone` and `shape`; `iconSize` (`xs` to `lg`) on `Button` and
  `IconButton`.
- Layouts: `BottomNav` item `emphasis: 'action'`; `MobileHeader`
  `eyebrow`, `leading`, `closeHref` or `onClose` with `closeLabel`;
  `SplitView` `listWidth`, `breakpoint`, `context` and `contextLabel`;
  `Stat` `tone` and a `Progress` track hook.
- `ListItem` from `texuli/list-item` only (not the root).
- `Composer` `layout="row"` and `sendButton="icon"`; slides
  `three-column-cards` icons from the host icon registry (register the
  names); `DeckStage` `canvasFit="reflow"`.
- Opt-in Spanish labels: `TEXULI_LABELS_ES` (`texuli/i18n/es`),
  `BLOCKS_LABELS_ES`, `PAGES_LABELS_ES`, passed to `LabelsProvider`; no
  native-speaker review yet.
- Not in the agent catalog yet: these props and `ListItem`.

Behavior that changes on the move is in
[`../../upgrade/SKILL.md`](../../upgrade/SKILL.md) ("0.13 → 0.14").

Inside this monorepo, an app depends on the workspace packages:

```json
{
  "dependencies": {
    "@texuli/tokens": "workspace:*",
    "texuli": "workspace:*"
  }
}
```

An app in another folder can link a local checkout (paths relative to the
app):

```json
{
  "dependencies": {
    "@texuli/tokens": "link:../texuli/packages/tokens",
    "texuli": "link:../texuli/packages/texuli"
  }
}
```

Then the developer (in this monorepo, the lockfile owner) runs their package
manager's install. The packages ship Svelte and TypeScript sources, so the
app's bundler compiles them: Vite with `@sveltejs/vite-plugin-svelte`,
SvelteKit, or Astro with `@astrojs/svelte` (Astro needs
`vite.ssr.noExternal: ['texuli', /^@texuli\//]`). An Astro 7 site in a Texuli
workspace can also use `@texuli/astro`: its `texuli()` integration applies the
cached theme and mode before paint (CSP-friendly bootstrap, nonce option), and
`@texuli/astro/styles.css` carries the token contract (see
`packages/astro/README.md`). For a whole site, `defineSite` from
`@texuli/astro/site` validates the pages, navigation and canonical metadata
once; `sitePageMeta` gives each page its title, description and canonical
URL, and `siteSitemap` writes the sitemap from the same model
(`packages/astro/docs/site.md`). `@texuli/astro/content` parses a closed set
of content blocks (`parseTexuliBlocks`), so page content never reaches an
HTML sink.

**Always load `@texuli/tokens/base.css`** (once, before any component). Since
`0.9.0` component CSS reads the system tokens (the space unit, control and
icon sizes, shape radii and type roles of `@texuli/tokens/system`) with no
fallback, and a theme does not declare them: an app with its own reset that skips `base.css`
renders controls with no size. From `0.10.0`, such an app can
load `@texuli/tokens/system.css` instead: the system token defaults alone,
with no reset.

Import each component through its subpath:

```svelte
<script lang="ts">
  import { Button } from 'texuli/button';
  import { Card, CardContent, CardHeader, CardTitle } from 'texuli/card';
</script>

<Card>
  <CardHeader>
    <CardTitle>Invoices</CardTitle>
  </CardHeader>
  <CardContent>
    <Button variant="secondary" onclick={() => console.log('export')}>Export</Button>
  </CardContent>
</Card>
```

## Wire tokens and CSS once: `texuli init`

`texuli init` detects Vite, Astro or SvelteKit from `package.json` and writes:
- the stylesheet (`@texuli/tokens/base.css` plus the theme's light and dark
  tokens);
- its import in the app's entry;
- the no-flash script and `data-tx-theme` on `<html>`;
- `texuli.config.json`.

Running it again changes nothing. It never writes outside the app or through
a symlink. See `packages/tools/docs/cli-init.md`.

## B. Copy a component: `texuli add`

`texuli add <id>` copies a styled component's source (its `.svelte`, `.ts` and
`.css` files) into `src/components/texuli/<id>` in the app, or `--out <dir>`.
Every copied file starts with a provenance block: an HTML comment in
`.svelte` files, a block comment in `.ts`, `.js` and `.css` files:

```ts
/**
 * @texuli/add — copied styled source. Do not remove this block.
 * id: button
 * package: texuli
 * version: 0.1.0
 * source: packages/texuli/src/components/button/index.ts
 */
```

The app then imports its own copy instead of the package:

```ts
import { Button } from './components/texuli/button/index.ts';
```

What `texuli add` refuses:
- unknown ids (`--list` shows the addable ones);
- anything under `@texuli/primitives` (copies keep importing primitives);
- existing files, unless `--force`;
- destinations outside the app, or behind a symlink.

A copied component still imports `texuli/cx` (and, for some, `texuli/button`
or `texuli/icons`): those stay package dependencies. See
`packages/tools/docs/cli-add.md`.

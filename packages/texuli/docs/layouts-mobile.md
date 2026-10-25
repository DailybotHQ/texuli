# Mobile layouts: tab bar and drawer, with stacked navigation

**Package:** `texuli` · **Import:** `texuli/layouts/mobile`

There are two `LayoutHost` layouts for phone apps. They are ported from
Protoyard's `MobileTabsLayout` and `MobileDrawerLayout` and completed with
stacked navigation:

| Layout id | Frame |
| --- | --- |
| `mobile-tabs` | Sticky header (Back, title, actions), the screen, and a sticky bottom **tab bar** of the top-level items. The first nav action becomes the bar's primary action. With more than five items, four stay and a **More** tab opens a bottom sheet with the rest and the user. |
| `mobile-drawer` | Sticky header (Back, title, actions, menu button). The whole nav model is in a side **drawer**: brand, sections with nested items, actions and user. There is no bottom bar, so a screen's composer reaches the edge. |

Both are also the catalog's responsive fallbacks. For example, `sidebar`
falls back to `mobile-drawer` below 768 px, and `rail` to `mobile-tabs` below
640 px.

```svelte
<script lang="ts">
  import { LayoutHost } from 'texuli/layouts/host';
  import { registerMobileLayouts } from 'texuli/layouts/mobile';

  registerMobileLayouts(); // each layout is its own lazy chunk
</script>

<LayoutHost layout="mobile-tabs" {nav} {path} options={{ title: deal?.name ?? '' }}>
  {#snippet children()}<Screen />{/snippet}
</LayoutHost>
```

## Stacked navigation

`stackHeader(sections, path, fallbackTitle, title?)` builds the header from the
nav model's active trail:

| Where | Title | Back |
| --- | --- | --- |
| A tab's root (`#/deals`) | The item's label | None (`depth` 0) |
| A nested nav item (`#/deals/won`) | That item's label | To its parent item |
| Deeper than any item (`#/deals/42`) | `options.title` when set, else the parent's label | To the deepest matching item |
| No match | `options.title`, the brand, or "Home" | None |

- **Back** is a link to the parent screen's href. That makes it predictable,
  shareable and keyboard-native; it never depends on the browser history.
- **Name:** the visible word comes first in its name ("Back: Deals",
  WCAG 2.5.3).
- **RTL:** the chevron mirrors.

## Behavior

- **Current page:**
  - `aria-current="page"` marks a link only when it is the current screen
    itself (`navCurrent`).
  - The tab or link above a detail screen gets `aria-current="true"`.
  - The current tab also shows a bar, so the state never relies on color.
  - The More tab says when it contains the current page.
- **Links:** every nav, Back and action href passes `safeHref`; an unsafe
  href renders a link without `href`.
- **Path:** the layouts follow the `path` prop, or `location.hash` with
  `hashchange` and `popstate` when there is none. They never read `window`
  at import.
- **Landmarks:**
  - The screen region is the page's `<main>`, with a skip link to it.
  - Inside a page that already has a `<main>` (an embedded preview), it
    renders a `div`, so the page keeps one main landmark.
- **Layout:**
  - The host becomes a flex column that fills its frame. The header sticks to
    the top and the tab bar to the bottom, even on a short screen.
  - Safe-area insets pad the edges.
  - Logical properties throughout, so RTL mirrors: the first tab sits on
    the right.
- **Closing overlays:** the More sheet (texuli `Sheet`, bottom) and the drawer
  (`LayoutDrawer`, on the Dialog primitive) close on Escape, the close
  button, a link, or in-app navigation, and return focus to their button.
- **Screen state:** the routed screen keeps its local state across layout
  switches (the host's one stable outlet).

## Options (flat data, translatable)

| Option | Default |
| --- | --- |
| `title` | none (the current screen's title, used on detail screens) |
| `backLabel` | `Back` |
| `moreLabel` | `More` |
| `moreCurrentLabel` | `(contains the current page)` |
| `tabsLabel` | `Primary` (the tab bar's `nav` name) |
| `menuLabel` | `Open navigation` |
| `closeLabel` | `Close` |
| `homeLabel` | `Home` |
| `tabLimit` | `5` |

## API

- `registerMobileLayouts()` and `MOBILE_LAYOUTS` (the lazy `{ load }`
  entries).
- `splitTabs(items, limit)`, `MOBILE_TAB_LIMIT`, `topLevelItems(sections)`.
- `stackHeader`, `StackHeader`, `navCurrent`, `currentHashPath`.
- `mobileLabels(options)`.

## Size

Measured with `pnpm size` on 2026-10-24:

| Entry | Initial gzip | Lazy |
| --- | ---: | ---: |
| `texuli/layouts/mobile` | 1.72 KiB | 28.93 KiB (both layouts, with Sheet, Dialog, chrome and CSS 4.83 KiB) |

## Verified

- **Unit tests:** `pnpm vitest run packages/texuli/tests/layouts-mobile.test.ts`
  has 15 tests.
  - Model: tab splitting, stack headers for root, nested, detail and unknown
    paths, `navCurrent`, options, and lazy registration.
  - Components through `LayoutHost`:
    - the tab bar, badges, the primary action and More;
    - the More sheet, closing on a link or in-app navigation;
    - Back and the title on a detail screen;
    - following `hashchange`;
    - unsafe hrefs;
    - the drawer with nested items;
    - screen state kept across a layout switch, and RTL;
    - a nested `<main>`;
    - no nav model.
- **Real browsers:** a scratch Playwright spec on Chromium, WebKit and Pixel 7
  (lane N, not committed) passed 64 checks:
  - axe reported no violations for the three examples, the More sheet and the
    drawer, in light and dark, with forced colors on and off. After
    FIX-avatar-navicon this holds with no exclusions.
  - Keyboard: tabs, a detail screen with Back, More with Escape returning
    focus.
  - The tab bar sits at the frame's bottom and the header at its top.
  - Touch: tapping a More item.
  - The drawer at desktop width.
  - RTL order and the mirrored chevron.
- **Visual baselines:** `layouts-mobile-tabs`, `layouts-mobile-drawer` and
  `layouts-mobile-rtl`, light and dark, Chromium and Pixel 7.

## Limits

- **No transition animation** between stacked screens.
- **Tab bar items are links:** it is navigation, not an ARIA tablist.
- **Firefox** was not checked.

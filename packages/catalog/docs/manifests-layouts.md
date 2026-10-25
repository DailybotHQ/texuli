# Catalog manifests: layouts and shells

**Package:** `@texuli/catalog`  
**Import:** `@texuli/catalog/manifests/layouts`  
**Group:** `layouts` (discovered automatically by the catalog build)  
**Tests:** `packages/catalog/tests/manifests-layouts.test.ts`

## Goal

Authored manifests for Texuli **layouts and shells**, with prop-name parity
against each component’s public surface.

| Kind | Tier | Agent-emittable | Examples |
| --- | --- | --- | --- |
| Content composition | `content` | **yes** (Tier U) | `layout-card`, `layout-page`, `layout-doc`, `layout-deck`, `layout-grid`, `deck-slide` |
| App shells / chrome | `app` | **no** | `layout-host`, `layout-sidebar`, `layout-docs`, … |

Content composition ids match `CONTENT_LAYOUT_IDS` in the catalog build so
untrusted agents may emit them. App chrome never appears in Tier U.

`layout-deck` and `deck-slide` close the G11 gap of the expressiveness audit:

- **`layout-deck`** accepts the deck metadata the `@texuli/slides` model
  validates: `description`, `locale`, `aspect` (`16:9`, `4:3`, `1:1`),
  `themeRef`, `masters` and `settings`.
- **`deck-slide`** is one slide: a required `slideId`, plus `title`, `notes`,
  `master` (the eight built-in masters), `transition` (`none`, `fade`,
  `fade-up`) and `themeRef`, with block children.

Like every content layout, neither has a Svelte component in `texuli`; a host
maps them (the slides stage, or a player). The catalog checks prop kinds and
enum values. Theme references, `settings` and `masters` are checked in depth
by `parseDeckRenderTree` in `@texuli/slides`, not by the renderer.

## Usage

```ts
import { LAYOUTS_MANIFESTS, layoutHostManifest } from '@texuli/catalog/manifests/layouts';
import { buildCatalog } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';

const groups = await discoverManifestGroups();
// includes { name: 'layouts', manifests: [...] } with no build code change
const { catalog } = await buildCatalog(groups);
```

## Files

| File | Role |
| --- | --- |
| `prop-names.ts` | Canonical `$props()` name lists |
| `manifests.ts` | `defineCatalogManifest` entries + `LAYOUTS_MANIFESTS` |
| `index.ts` | Public exports |

## Related

- Host contract: `texuli/layouts/host` (`LAYOUT_IDS`, `LayoutProps`)
- Build tiers: `@texuli/catalog/build` (`isContentLayoutId`, `isTierU`)

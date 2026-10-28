# Appearance switcher

**Import:** `@texuli/astro/appearance`

A light, dark or system appearance switcher for Astro sites, as a Svelte 5
island. It stores the choice per site in the namespaced appearance cache
(`texuli.<namespace>.appearance`, from `@texuli/tokens/no-flash`) that the
[integration's bootstrap](integration.md) reads before paint, so a reload
shows the chosen mode without a flash.

```astro
---
import { AppearanceSwitcher } from '@texuli/astro/appearance';
---

<AppearanceSwitcher client:idle namespace="docs" />
```

Use the same `namespace` (and `fallbackMode`, when you set one) as the
`texuli({ namespace })` integration option. The island needs
`@astrojs/svelte` and Svelte 5, the package's peer dependencies.

## Props

| Prop | Default | Behavior |
| --- | --- | --- |
| `namespace` | `site` | Appearance cache namespace; match the integration. |
| `fallbackMode` | `system` | Mode System returns to; match the integration's `fallbackMode`. |
| `themeId` | — | Theme id cached when neither the cache nor the root `data-tx-theme` names a valid one; otherwise `default`. |
| `label` | `Appearance` | Accessible name of the radio group (visually hidden). |
| `labels` | `Light`, `Dark`, `System` | Visible option names, per choice. |
| `onchange` | — | Called with the choice after it is stored and applied. |
| `class` | — | Extra class on the group. |

## Behavior

- **Light or Dark** caches `{ themeId, mode, vars: {} }`. A cached theme id,
  surface, reduced-motion and component styles are kept; cached `--tx-*`
  variables are dropped (they belong to the previous mode) and removed from
  the root. The mode is applied to the root at once (`data-tx-mode`, the
  `light`/`dark` class and `color-scheme`).
- **System** removes the cache, so the bootstrap's fallback mode applies on
  the next load, and applies the fallback now. With the `system` fallback the
  island follows `prefers-color-scheme` and `prefers-contrast` changes while
  it is mounted (the bootstrap does the same on pages without the island).
  Clearing the cache also forgets a theme another switcher cached in the same
  namespace.
- A cached `high-contrast` mode is shown with no option selected.
- Another tab writing the same namespace updates the selection through the
  `storage` event.
- Before it mounts (server render), no option is selected, so the server
  never guesses the stored choice.

## Accessibility

The switcher is a native radio group (`role="radiogroup"` named by `label`):
one tab stop, arrow keys move and select, and the focused option shows a
`--tx-ring` outline. In forced-colors mode the selected option keeps a
system-color outline. Spacing uses logical properties, so it mirrors in
right-to-left pages.

## CSP

The island adds no inline script and no `style` attribute; its CSS is a
component stylesheet that Astro bundles. The only inline script remains the
integration's bootstrap, whose hash is unchanged. Astro's own island
hydration code is the same as for any other Svelte island.

## Framework-free model

The same subpath exports the model the island uses, for hosts with their own
control:

| Export | Behavior |
| --- | --- |
| `readAppearanceChoice(namespace, storage?)` | The stored `light`, `dark` or `high-contrast` mode; a missing or malformed cache is `system`. |
| `applyAppearanceChoice(namespace, choice, options?)` | Stores and applies a choice as described above; returns the resolved mode. Options: `root`, `storage`, `themeId`, `fallbackMode`, `matchMedia`. |
| `APPEARANCE_CHOICES` | `['light', 'dark', 'system']`. |

Types: `AppearanceChoice`, `StoredAppearanceChoice`, `ApplyAppearanceOptions`.

Tests: [`appearance.test.ts`](../tests/appearance.test.ts).

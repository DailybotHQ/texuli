# Texuli design language

The cross-surface visual contract, **as observed on dev on 2026-10-25**
(`abde0e58`). It tells a new surface (a native Compose renderer, a builder
pane, a chat view) how to look and behave like the rest of Texuli by reading
the same tokens and rules, without copying component CSS. Every value below
cites the code that defines it. What the code does not do yet is marked
**PLANNED**.

The source of truth is `@texuli/tokens`: a theme document compiles to
`--tx-*` custom properties (`packages/tokens/src/css/apply.ts`), and
`packages/tokens/src/css/base.css` sets the global base layer. Components live
in `@layer tx.components` and read only those properties, each with a system
color fallback (for example `var(--tx-ring, Highlight)`).

## 1. Color: semantic roles, never raw values

**Rule:** paint with semantic roles, not hex values or reference scales.

- A theme defines **50 semantic roles** for light and dark separately
  (`SEMANTIC_ROLES`, `packages/tokens/src/contract/semantic.ts`). Pairs are
  named for their job: `background`/`foreground`, `surface`/`surfaceForeground`,
  `elevated`/`elevatedForeground`, `muted`/`mutedForeground`,
  `subtle`/`subtleForeground`, `primary`/`primaryForeground` and
  `primarySoft`/`primarySoftForeground`, the status families (`destructive`,
  `success`, `warning`, `info`, each with a soft pair), chrome (`border`,
  `borderStrong`, `input`, `ring`), sidebar roles, `overlay`, `scrim`,
  `shadow`, `link`, `linkVisited`, `selection`/`selectionForeground` and
  `canvas`.
- **Always use the pair:** text on `X` uses `XForeground`. That is the pair
  the AA gate checks.
- Interactive roles (`INTERACTIVE_SEMANTIC_ROLES`: `primary`, `secondary`,
  `accent`, `destructive`, `success`, `warning`, `info`, `muted`, `input`,
  `link`, `sidebarPrimary`) carry `hover`, `active`, `disabled` and `focus`
  states. A surface uses those state tokens instead of darkening a
  color itself.
- Charts read `--tx-chart-1` to `--tx-chart-8` (categorical),
  `--tx-chart-sequential-1` to `-9`, `--tx-chart-diverging-1` to `-9`, plus
  `--tx-chart-grid` and `--tx-chart-axis`, which fall back to `border` and
  `mutedForeground` (`apply.ts`).

**Contrast floor (enforced):** every role pair of every theme and mode passes
WCAG 2.x AA: **4.5:1** for text and **3:1** for UI and non-text
(`packages/tokens/docs/tokens-aa-gate.md`, `tests/aa-gate.test.ts`). APCA is
out of scope.

### Modes

| Mode | Where the colors come from |
| --- | --- |
| Light, dark | The theme's two separately authored palettes (`[data-tx-mode]` and `color-scheme`) |
| High contrast | Platform system colors (`Canvas`, `CanvasText`, `Highlight`, `HighlightText`, and related), not an inverted palette (`packages/tokens/docs/tokens-modes.md`) |
| System | `prefers-contrast: more` selects high contrast first, then `prefers-color-scheme` |

Under `forced-colors: active`, `@texuli/tokens/forced-colors.css` maps every
semantic role to a system keyword (`FORCED_COLORS_ROLE_MAP`), and 132 source
files carry their own `forced-colors: active` rules. Example: `.tx-button`
paints a `ButtonText` border under forced colors
(`packages/texuli/src/components/button/button.css`).

## 2. Spacing rhythm and density

**Observed rhythm:** spacing is authored in `rem` on a **0.25rem (4 px) step**.
Counting `gap`, `padding` and `margin` declarations across `texuli`, `player`,
`chat` and `media`, the most common values are 0.5rem (166), 0.75rem (125),
0.25rem (84), 1rem (73), 1.25rem (27), 1.5rem (22) and 2rem (12). Use
those steps.

- Off-step values exist (0.35rem in 37 declarations, 0.375rem in 37, 0.15rem,
  0.2rem, 0.625rem, 0.65rem). New surfaces should not copy them.
- **Spacing scale (token contract v2, ADR-020, from `0.9.0`):** `--tx-space-unit`
  (`calc(0.25rem * var(--tx-density, 1))`) and `--tx-space-0` … `--tx-space-12`
  (0 to 3rem at density 1) exist in `@texuli/tokens/system`. `base.css`
  declares them (with every other system default) once per token scope
  (`:root`, `[data-tx-theme]`, `[data-tx-scope]`), so density follows the
  nearest theme; reads are plain `var(--tx-space-4)` (`systemVar`), and a
  component token read carries one fallback level
  (`var(--tx-button-gap, var(--tx-space-2))`). The Tailwind preset's
  `--spacing` reads `--tx-space-unit` with its density fallback. The `texuli`
  styled components and layouts read the scale through their component and
  system tokens (T-adopt-core), with no visual change under the
  visual-baseline theme; the domain packages are **PLANNED**. Tables:
  [tokens-components.md](../packages/tokens/docs/tokens-components.md).

**Density:** a theme carries `density` from **0.75 to 1.25**
(`DENSITY_MIN`/`DENSITY_MAX`), emitted as `--tx-density`. The presets are
compact 0.875, default 1, comfortable 1.125 and spacious 1.25 (`DENSITY_PRESETS`,
`packages/tokens/src/style-presets/presets.ts`).

- Components multiply their spacing by it, for example
  `calc(0.75rem * var(--tx-density, 1))` and `calc(2.75rem * var(--tx-density, 1))`.
- `densityTargetSize` scales the preferred 44 px target by density and never
  returns less than **24 px** (WCAG 2.2 target size).
- **Observed gap:** only the table, tree and carousel components (plus the
  `@texuli/astro` and `@texuli/slides` styles) read `--tx-density` today, so
  most controls do not change with density. **PLANNED:** density adoption
  across controls and layouts.

## 3. Sizing and touch targets

The button sizes are the reference (`button.css`):

| Size | Height | Inline padding |
| --- | --- | --- |
| sm | 2rem | 0.75rem |
| md | 2.25rem | 1rem |
| lg | 2.75rem | 1.5rem |
| icon | 2.25rem square | 0 |

Below 640 px (`@media (max-width: 639px)`), `sm`, `md` and `icon` grow to
`max(2.75rem, 44px)`. Token contract v2 names these values
`--tx-size-control-{sm,md,lg}` (2, 2.25 and 2.75rem, plus `xs` 1.75rem) and
`--tx-size-target-touch` (`max(2.75rem, 44px)`); the button reads them through
`--tx-button-height-{sm,md,lg,touch}`. Rule for new surfaces: interactive targets are at least
44 px on small screens and never below 24 px anywhere. The site's own specs
assert 44 px targets on the agent chat page (`tests/e2e/site-agent-chat.spec.ts`).

## 4. Shape, borders and elevation

- **Radius:** `--tx-radius` (default `0.625rem`, `DEFAULT_RADIUS`) plus a
  step scale derived from the style's `radiusScale`: `--tx-radius-step-2`,
  `-4` and `-6` are 2, 4 and 6 px times the scale. The radius presets are
  square 0, sharp 0.25rem, default 0.625rem, round 1rem and pill 9999px
  (`RADIUS_PRESETS`).
- **Borders:** `--tx-border-width` (default `1px`), consumed in 27 source
  files. The base layer sets every element's `border-color` to `--tx-border`.
- **Elevation is a theme choice, not a per-component one.** The style's
  `elevation` (`flat`, `soft` (default), `crisp`, `glow`, `layered`) compiles
  two shadows (`shadows()` in `apply.ts`):
  - `--tx-shadow-soft`: resting raised surfaces. Used by card, input fields,
    tabs and accordion, slider, choice and stat.
  - `--tx-shadow-float`: floating layers. Used by dialog, popover, menus,
    select, combobox, tooltip and toast.
  - `flat` sets both to `none`, so separation must also read from `border`
    and the `surface`/`elevated` roles. A new surface keeps a border or a role
    change on every raised layer and never relies on shadow alone.
- **Surfaces:** a `solid` (default) or `glass` style. Glass applies only under
  `[data-tx-surface="glass"]` and only where `backdrop-filter` is supported,
  using `--tx-glass-opacity` (82%) and `--tx-glass-blur` (16px) (`base.css`).

## 5. Motion

| Preset | fast | base | slow | Easing |
| --- | --- | --- | --- | --- |
| none | 0 | 0 | 0 | linear |
| subtle | 100 ms | 150 ms | 200 ms | ease-out |
| standard (default) | 150 ms | 200 ms | 300 ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| expressive | 200 ms | 300 ms | 500 ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` |

Sources: `MOTION_PRESETS` and `DEFAULT_THEME_STYLE`. They are emitted as
`--tx-motion-fast`, `--tx-motion-base`, `--tx-motion-slow` and
`--tx-motion-easing`, which 19, 20, 7 and 28 source files consume. Use `fast`
for hover and press feedback, `base` for most state changes, and `slow` for
entering layers; take the easing from the token, never a literal.

**Reduced motion (enforced globally):** under `prefers-reduced-motion: reduce`,
or inside `[data-tx-motion="reduce"]`, `base.css` forces all three durations
to `0ms`, the easing to `linear`, animation and transition durations and delays
to `0s` (so a `visibility` change is instant and nested content never appears
one level per frame), and
`scroll-behavior` to `auto`. `themeVariables({ reducedMotion: true })` emits the
same zeros. Components with looping or meaningful animation also opt out
locally (36 source files reference `prefers-reduced-motion`; for example, the
button spinner stops and shows a static ring).

## 6. Focus

- The base rule is `:focus-visible { outline: var(--tx-focus-ring-width, 2px)
  solid var(--tx-ring, Highlight); outline-offset: var(--tx-focus-ring-offset, 2px) }`
  (`base.css`). Defaults: width `2px`, offset `2px` (`DEFAULT_THEME_STYLE`).
- In `packages/texuli`, 56 rules repeat that exact outline; across packages and the site, 65 files read
  `--tx-focus-ring-width`. The ring color is always the `ring` role, whose
  contrast the AA gate checks as UI (3:1).
- In forced colors the ring maps to `Highlight`.
- **Observed gaps:**
  - The theme's `focusRing.style` (`ring`, `outline`, `glow`, `inset`) is
    validated and emitted as `--tx-focus-ring-style`, but no component reads
    it, so every surface draws a plain outline. **PLANNED.**
  - 8 rules in `packages/texuli` hard-code `outline: 2px solid var(--tx-ring, Highlight)`
    instead of the width token.

## 7. Typography

- Families: `--tx-font-sans`, `--tx-font-heading` (defaults to sans) and
  `--tx-font-mono`, with system-first defaults (`DEFAULT_FONT_SANS`,
  `DEFAULT_FONT_MONO`) and no bundled webfonts.
- Weights: body 400, medium 500, heading 600, bold 700.
- Size steps `--tx-font-size-xs` to `--tx-font-size-9xl` default to 0.75,
  0.875, 1, 1.125, 1.25, 1.5, 1.875, 2.25, 3, 3.75, 4.5, 6 and 8 rem. A theme
  with a type-scale ratio (compact 1.067, default 1.2, comfortable 1.25,
  display 1.333) recomputes them as ratio^n rem (`FONT_SIZES`, `apply.ts`).
- Headings use `text-wrap: balance` (`base.css`).

## 8. Direction and layout

- Logical CSS only: `inline-size`, `margin-inline`, `inset-inline-start`.
  `docs/quality/responsive-sweep.md` records a scan of the PLAN_004 surfaces
  with zero physical properties.
- Safe areas come from `--tx-safe-area-inline-start` and its siblings, which
  swap under `:dir(rtl)` (`base.css`).
- The app height is `--tx-app-height`, never a raw `100dvh`.
- Horizontal arrow keys follow reading direction: they swap in RTL, as in the
  player's frame keyboard, `control-choice`, the timeline editor and the
  builder outline.
- Wide content scrolls inside its own labelled region rather than widening the
  page (the animation timeline's table, `tests/e2e/responsive-sweep.spec.ts`).

## 9. For a new surface

1. Read colors from semantic roles and their foreground pair; pick state
   tokens for interaction.
2. Space on the 0.25rem step; multiply by `--tx-density` where spacing should
   follow density.
3. Use `--tx-radius` / `--tx-radius-step-*`, `--tx-border-width`, and the two
   elevation shadows; keep a border or role change on every raised layer.
4. Time motion with `--tx-motion-*` and the easing token; honor reduced motion
   (durations to 0).
5. Draw focus with the ring role at the focus width and offset; keep 44 px
   touch targets on small screens and never less than 24 px.
6. Support light, dark and high contrast through the roles and the system
   color fallbacks.

**Native Compose today does not follow this from the token engine:**
`native/texuli-compose/.../TexuliTheme.kt` hard-codes a Material 3 light and
dark color scheme (for example primary `#2F57D9` light and `#9DB7FF` dark).
**PLANNED:** the `texuli-tokens` native module, which would project the same
theme document (roles, radius, motion, density) into Compose, so native and
web come from one source.

## Cited examples (visual baselines)

`texuli-button`, `texuli-card` and `ui-dialog-variants` are registry examples
with light and dark baselines (desktop and Pixel 7) in
`tests/visual/visual.spec.ts-snapshots/`. They show the button sizes, resting
elevation (`--tx-shadow-soft`) and floating elevation (`--tx-shadow-float`)
described above:

```bash
TEXULI_E2E_PORT=4990 pnpm visual -g "texuli-button|texuli-card|ui-dialog-variants"
```

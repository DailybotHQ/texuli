# Primitive performance

This page records measured primitive bundle sizes and overlay opening time. Bundle figures are gzip -9 bytes from `pnpm size`; the size script builds each public export subpath independently with Svelte external. The Dialog timing is measured in-page from the opening trigger to the first focus event in the layer, using seven samples and p75.

## Overlay composition

`@texuli/core/overlay-core` exports `createOverlayCore(options, features)`. Its engine always includes layer registration, dismissal, presence and focus rescue. The `position`, `focusScope`, `inert`, `scrollLock` and `portal` texels are injected independently. A primitive should import only the texels it uses and pass only those features:

- Dialog imports focus scope, inert and scroll lock. It is unanchored and does not import `@texuli/core/position-dom`.
- Tooltip and Menu import positioning only; they do not bundle focus trapping, inert or scroll lock.
- Popover imports positioning plus focus scope, inert and scroll lock because it supports a modal mode; it does not portal. Select and Combobox import positioning only.
- `@texuli/core/overlay` remains a convenience entry that composes every feature; floating primitives use `@texuli/core/overlay-core` instead.

Combobox previously used that all-feature convenience entry. It now uses `createOverlayCore` with only `positionFloating`, reducing its measured entry by 4,144 B gzip.

## Floating primitive bundle sizes

Historical comparison measured 2026-10-23 in the lane worktree. The only source change in that measurement was Combobox's overlay import; other entries therefore had equal before and after measurements. These figures are superseded by the current 2026-10-25 table below.

| Public entry | Before (gzip B) | After (gzip B) | CSS gzip B | Result |
| --- | ---: | ---: | ---: | --- |
| `@texuli/primitives/dialog` | 11,589 | 11,589 | 116 | Within repository's 12,288 B cap; above the requested 8,192 B target |
| `@texuli/primitives/tooltip` | 11,533 | 11,533 | 0 | Within 16,384 B cap |
| `@texuli/primitives/menu` | 15,868 | 15,868 | 0 | Within its 20,480 B cap |
| `@texuli/primitives/popover` | 14,800 | 14,800 | 0 | Within 16,384 B cap |
| `@texuli/primitives/hover-card` | 7,685 | 7,685 | 83 | Within 16,384 B cap |
| `@texuli/primitives/select` | 13,764 | 13,764 | 0 | Within its 20,480 B cap |
| `@texuli/primitives/navigation-menu` | 8,510 | 8,510 | 0 | Within its 20,480 B cap |
| `@texuli/primitives/combobox` | 17,390 | 13,246 | 131 | Within its 24,576 B cap; reduction of 4,144 B |
| `@texuli/primitives/toast` | 6,175 | 6,175 | 0 | Within its 16,384 B cap |

In the historical 2026-10-23 snapshot, AlertDialog and Sheet/Drawer did not have measurable public subpaths. `@texuli/core/overlay-core` measures 5,172 B gzip, while the all-feature convenience entry `@texuli/core/overlay` measures 13,248 B. Individual core texels are separately exported. That historical core snapshot had all individual texel entries within their then-current subpath caps except `position-dom` at 4,783 B. The `@texuli/core` root barrel measures 22,113 B, within its then-current 24,576 B budget but 5,729 B above the requested 16,384 B target.

In that historical snapshot, Dialog did not meet the requested 8,192 B target and remained under the then-existing 12,288 B cap. It does not pull in positioning. Meeting 8,192 B needs further work on the shared overlay engine or Dialog's feature composition; this change does not raise any budgets. Reducing the `@texuli/core` root barrel to 16,384 B also needs a deliberate public-API decision: every current core texel is re-exported there, and package docs demonstrate those root imports. Primitives now use their per-texel subpaths.

### Latest size run: 2026-10-25, dev `852b8d2a`

`pnpm size --filter primitives` and `pnpm size --filter core` both passed.
Values below are current gzip bytes; lazy chunks are shown separately.

| Public entry | gzip B | CSS gzip B | Budget B |
| --- | ---: | ---: | ---: |
| `@texuli/primitives/dialog` | 11,989 | 151 | 12,288 |
| `@texuli/primitives/alert-dialog` | 12,246 | 150 | 13,312 |
| `@texuli/primitives/sheet` | 14,819 | 151 | 16,384 |
| `@texuli/primitives/tooltip` | 12,389 | 0 | 16,384 |
| `@texuli/primitives/menu` | 16,868 | 0 | 20,480 |
| `@texuli/primitives/popover` | 12,169 (4,470 lazy) | 0 | 16,384 |
| `@texuli/primitives/hover-card` | 8,523 | 83 | 16,384 |
| `@texuli/primitives/select` | 14,276 | 0 | 20,480 |
| `@texuli/primitives/navigation-menu` | 8,821 | 0 | 20,480 |
| `@texuli/primitives/combobox` | 16,099 | 131 | 24,576 |
| `@texuli/primitives/toast` | 6,274 | 0 | 16,384 |
| `@texuli/core/overlay-core` | 5,199 | 0 | 5,632 |
| `@texuli/core/overlay` | 13,972 | 0 | 14,336 |
| `@texuli/core/position-dom` | 5,557 | 0 | 6,144 |
| `@texuli/core` (root barrel) | 23,172 | 0 | 24,576 |

AlertDialog and Sheet now have public subpaths. Popover loads its modal
features lazily (the 4,470 B lazy chunk), so the non-modal path no longer
bundles them. Dialog is still above the 8,192 B target. Across all 42 primitive
entries, every cap passes. Entries with less than 10% remaining headroom
include accordion (4,039/4,096 B), alert-dialog (12,246/13,312 B), calendar
(13,363/14,336 B), color-picker (4,090/4,096 B), date-picker
(29,297/29,696 B), number-field (5,834/6,144 B), slider (4,257/4,608 B),
tabs (4,526/4,608 B), tags-input (4,288/4,608 B), and toggle (5,052/5,120 B).

## Open-to-focus

The current Dialog behavior scenario passed 14/14 rows on Chromium on
2026-10-25. The latest archived `focus-moves-in` sample set remains the
2026-10-24 run (p75 **1.8 ms**, below the 50 ms ceiling); the current gate
does not print a new sample series. This is not a cross-browser performance
guarantee.

Recheck size and focus behavior with:

```sh
pnpm size --filter primitives
TEXULI_E2E_PORT=<lane-port> pnpm exec playwright test tests/behavior/scenarios/dialog.spec.ts --project=chromium
```

## Gate status

Re-run 2026-10-25: `pnpm size --filter primitives` passed all 42 primitive
entries, and `pnpm size --filter core` passed all core entries. The previous
full `pnpm size` snapshot is historical (2026-10-24): it recorded
`@texuli/tokens/aa-gate` at 10,817 B against 10,624 B. This task did not
rerun the full repository size matrix. The two catalog failures recorded on
2026-10-23 were resolved by the later budget update; their latest measurements
are outside this focused core/primitives run.

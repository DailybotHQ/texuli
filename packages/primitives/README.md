# @texuli/primitives

**Layer L1: owned headless primitives.** 41 Svelte 5 primitives built from
scratch on the `@texuli/core` texels, held to the WAI-ARIA Authoring
Practices patterns. No styles, no other component library.
Published to npm as `0.1.0-next.1` under the `next`
dist-tag (by CI, with provenance); no stable release (`latest` is reserved
for 1.0.0), so install it with `@next`. The workspace package stays
`"private": true`.

## What exists today

Every primitive below is implemented and exported. Each one ships a subpath
(`@texuli/primitives/<name>`), a contract doc in `docs/prim-<name>.md` and a
browser scenario in the behavior suite (`tests/behavior/scenarios/<name>`),
which owns keyboard, focus, ARIA and axe. Unit tests in `tests/` (models,
forms, overlays, composites and consumer ids) cover only what the suite does
not reach: models, form participation, edge cases and fixed findings. The root barrel `src/index.ts`
re-exports every primitive; import subpaths to keep bundles narrow.

| Primitive | Subpath | Doc |
| --- | --- | --- |
| Accordion | `@texuli/primitives/accordion` | [prim-accordion](docs/prim-accordion.md) |
| Alert dialog | `@texuli/primitives/alert-dialog` | [prim-alert-dialog](docs/prim-alert-dialog.md) |
| Avatar | `@texuli/primitives/avatar` | [prim-avatar](docs/prim-avatar.md) |
| Calendar | `@texuli/primitives/calendar` | [prim-calendar](docs/prim-calendar.md) |
| Checkbox | `@texuli/primitives/checkbox` | [prim-checkbox](docs/prim-checkbox.md) |
| Collapsible | `@texuli/primitives/collapsible` | [prim-collapsible](docs/prim-collapsible.md) |
| Color picker | `@texuli/primitives/color-picker` | [prim-color-picker](docs/prim-color-picker.md) |
| Combobox | `@texuli/primitives/combobox` | [prim-combobox](docs/prim-combobox.md) |
| Command | `@texuli/primitives/command` | [prim-command](docs/prim-command.md) |
| Context menu | `@texuli/primitives/context-menu` | [prim-context-menu](docs/prim-context-menu.md) |
| Date field | `@texuli/primitives/date-field` | [prim-date-field](docs/prim-date-field.md) |
| Date picker | `@texuli/primitives/date-picker` | [prim-date-picker](docs/prim-date-picker.md) |
| Dialog | `@texuli/primitives/dialog` | [prim-dialog](docs/prim-dialog.md) |
| File drop | `@texuli/primitives/file-drop` | [prim-file-drop](docs/prim-file-drop.md) |
| Hover card | `@texuli/primitives/hover-card` | [prim-hover-card](docs/prim-hover-card.md) |
| Label | `@texuli/primitives/label` | [prim-label](docs/prim-label.md) |
| Listbox | `@texuli/primitives/listbox` | [prim-listbox](docs/prim-listbox.md) |
| Menu | `@texuli/primitives/menu` | [prim-menu](docs/prim-menu.md) |
| Menubar | `@texuli/primitives/menubar` | [prim-menubar](docs/prim-menubar.md) |
| Navigation menu | `@texuli/primitives/navigation-menu` | [prim-navigation-menu](docs/prim-navigation-menu.md) |
| Number field | `@texuli/primitives/number-field` | [prim-number-field](docs/prim-number-field.md) |
| Pagination | `@texuli/primitives/pagination` | [prim-pagination](docs/prim-pagination.md) |
| Pin input | `@texuli/primitives/pin-input` | [prim-pin-input](docs/prim-pin-input.md) |
| Popover | `@texuli/primitives/popover` | [prim-popover](docs/prim-popover.md) |
| Portal | `@texuli/primitives/portal` | [prim-portal](docs/prim-portal.md) |
| Progress | `@texuli/primitives/progress` | [prim-progress](docs/prim-progress.md) |
| Radio group | `@texuli/primitives/radio-group` | [prim-radio-group](docs/prim-radio-group.md) |
| Scroll area | `@texuli/primitives/scroll-area` | [prim-scroll-area](docs/prim-scroll-area.md) |
| Select | `@texuli/primitives/select` | [prim-select](docs/prim-select.md) |
| Separator | `@texuli/primitives/separator` | [prim-separator](docs/prim-separator.md) |
| Sheet | `@texuli/primitives/sheet` | [prim-sheet](docs/prim-sheet.md) |
| Slider | `@texuli/primitives/slider` | [prim-slider](docs/prim-slider.md) |
| Splitter | `@texuli/primitives/splitter` | [prim-splitter](docs/prim-splitter.md) |
| Switch | `@texuli/primitives/switch` | [prim-switch](docs/prim-switch.md) |
| Tabs | `@texuli/primitives/tabs` | [prim-tabs](docs/prim-tabs.md) |
| Tags input | `@texuli/primitives/tags-input` | [prim-tags-input](docs/prim-tags-input.md) |
| Toast | `@texuli/primitives/toast` | [prim-toast](docs/prim-toast.md) |
| Toggle | `@texuli/primitives/toggle` | [prim-toggle](docs/prim-toggle.md) |
| Toolbar | `@texuli/primitives/toolbar` | [prim-toolbar](docs/prim-toolbar.md) |
| Tooltip | `@texuli/primitives/tooltip` | [prim-tooltip](docs/prim-tooltip.md) |
| Tree | `@texuli/primitives/tree` | [prim-tree](docs/prim-tree.md) |

Two cross-cutting docs describe package-wide contracts:

- [consumer-ids](docs/consumer-ids.md) — a consumer `id` on any part wins
  over the generated one, and every internal reference to that part follows
  it.
- [svelte-attachments](docs/svelte-attachments.md) — how the framework-free
  texels bind to Svelte 5 through attachments, each owning its resources and
  cleanup.

## How the primitives are built

- Framework-free behavior lives in `@texuli/core` (overlay engine, roving
  focus, layer stack, positioning, URL policy…); this package binds it to
  Svelte 5 runes and attachments.
- Compound, headless component APIs (`Tooltip.Provider` / `.Root` /
  `.Trigger` / …) that leave all styling to the caller.
- Escaping, focus order and dismissal go through the shared texels: Escape
  reaches only the topmost layer, portals render through
  `@texuli/core`'s portal, and roving lists share one focus implementation.
- Every rendered link or media source passes the core URL policy at the
  `untrusted` tier when content can come from users or agents.

## Testing

```bash
pnpm vitest run packages/primitives        # 183 unit + component tests (5 files)
pnpm --filter @texuli/primitives typecheck # svelte-aware typecheck
npx biome check packages/primitives        # lint + format
```

Browser behavior lives in the shared behavior suite
([tests/behavior](../../tests/behavior/README.md)): one scenario directory
and spec per primitive (42 specs today), run with
`TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior`.

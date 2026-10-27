# texuli

Styled Texuli components, layouts and shells: the L3 layer that composes
`@texuli/primitives` behavior with the `@texuli/tokens` engine into
ready-to-use Svelte 5 components. Published to npm as `0.1.0-next.1` under the `next`
dist-tag (by CI, with provenance); no stable release (`latest` is reserved
for 1.0.0), so install it with `@next`. The workspace package stays
`"private": true`.

## Status

Implemented in `src/` and exported through [`package.json`](package.json)
(the root and 69 subpaths): 41 styled component families, the `cx`/variant helpers, the
icon system, and the layout families listed below. They are covered by 205
unit tests in 6 files (`pnpm vitest run packages/texuli`). Per-item notes
live in [`docs/`](docs/) here until they are folded into this README.

## Using the components

The package peers on Svelte 5 (`^5.57.2`); its `@texuli/*` dependencies are
workspace links. Components style themselves on the `--tx-*` token contract
inside `@layer tx.components`, so a page needs the token stylesheet first:

```css
@import '@texuli/tokens/base.css';
```

```svelte
<script lang="ts">
  import { Button } from 'texuli/button';
  import { cx } from 'texuli/cx';
</script>

<Button variant="outline" size="sm" onclick={() => {}}>Save draft</Button>
```

Every component subpath follows the same shape: `texuli/<family>` exports the
Svelte components, their variant constants, and the class helpers. The
guides at the bottom of this page cover the class-value contract, CSS
customization and the control-props convention.

## Components

41 families, one subpath and one doc each:

| Import | Documentation |
| --- | --- |
| `texuli/alert` | [Alert, Callout and Banner](docs/ui-alert.md) |
| `texuli/avatar` | [Avatar and AvatarGroup](docs/ui-avatar.md) |
| `texuli/badge` | [Badge, Tag and Chip](docs/ui-badge.md) |
| `texuli/button` | [Button, IconButton and ButtonGroup](docs/ui-button.md) |
| `texuli/card` | [Card](docs/ui-card.md) |
| `texuli/carousel` | [Carousel](docs/ui-carousel.md) |
| `texuli/choice` | [Checkbox, Radio and Switch](docs/ui-choice.md) |
| `texuli/combobox` | [Combobox and MultiSelect](docs/ui-combobox.md) |
| `texuli/command` | [Command palette](docs/ui-command.md) |
| `texuli/date` | [Calendar, DatePicker and DateRangePicker](docs/ui-date.md) |
| `texuli/dialog` | [Dialog and AlertDialog](docs/ui-dialog.md) |
| `texuli/empty` | [EmptyState and ErrorState](docs/ui-empty.md) |
| `texuli/feedback` | [Skeleton, Spinner and Progress](docs/ui-feedback.md) |
| `texuli/field` | [Field, Label, Description, FieldError and Form](docs/ui-field.md) |
| `texuli/file-upload` | [FileUpload](docs/ui-file-upload.md) |
| `texuli/icons` | [Icon system](docs/ui-icons.md) |
| `texuli/input` | [Input, InputGroup and Textarea](docs/ui-input.md) |
| `texuli/kbd-code` | [Kbd, Code and CopyButton](docs/ui-kbd-code.md) |
| `texuli/menus` | [DropdownMenu, ContextMenu and Menubar](docs/ui-menus.md) |
| `texuli/navigation` | [NavigationMenu, Breadcrumb and Pagination](docs/ui-navigation.md) |
| `texuli/number-pin` | [NumberField and PinInput](docs/ui-number-pin.md) |
| `texuli/popover` | [Popover and HoverCard](docs/ui-popover.md) |
| `texuli/rating` | [Rating](docs/ui-rating.md) |
| `texuli/resizable` | [Resizable panels](docs/ui-resizable.md) |
| `texuli/scroll-area` | [ScrollArea](docs/ui-scroll-area.md) |
| `texuli/select` | [Select](docs/ui-select.md) |
| `texuli/separator-aspect` | [Separator, AspectRatio and VisuallyHidden](docs/ui-separator-aspect.md) |
| `texuli/sheet` | [Sheet, Drawer, DetailPanel and ResponsiveModal](docs/ui-sheet.md) |
| `texuli/sidebar` | [Sidebar and AppNav](docs/ui-sidebar.md) |
| `texuli/slider` | [Slider](docs/ui-slider.md) |
| `texuli/stat` | [Stat and KPI](docs/ui-stat.md) |
| `texuli/stepper` | [Stepper and Wizard](docs/ui-stepper.md) |
| `texuli/table` | [Table](docs/ui-table.md) |
| `texuli/tabs-accordion` | [Tabs, Accordion and Collapsible](docs/ui-tabs-accordion.md) |
| `texuli/tags-color` | [TagsInput and ColorPicker](docs/ui-tags-color.md) |
| `texuli/timeline` | [Timeline](docs/ui-timeline.md) |
| `texuli/toast` | [Toaster](docs/ui-toast.md) |
| `texuli/toggle` | [Toggle and ToggleGroup](docs/ui-toggle.md) |
| `texuli/toolbar` | [Toolbar](docs/ui-toolbar.md) |
| `texuli/tooltip` | [Tooltip](docs/ui-tooltip.md) |
| `texuli/tree` | [TreeView](docs/ui-tree.md) |

## Layouts, shells and the host kit

| Import | Documentation |
| --- | --- |
| `texuli/layouts/app/*` (`rail`, `master-detail`) | [Rail and master-detail](docs/layouts-rail-master-detail.md) |
| `texuli/layouts/app/*` (`sidebar`, `dual-sidebar`, `split-view`, `top-nav`) | Exported and typed in source; per-family docs not written yet |
| `texuli/layouts/auth-settings` (+ `/register`) | [Auth and settings layouts](docs/layouts-auth-settings.md) |
| `texuli/layouts/content/*` (`blog`, `docs`, `editorial`) | Exported and typed in source; per-family docs not written yet |
| `texuli/layouts/dashboard` (+ `/register`) | [Dashboard layout](docs/layouts-dashboard.md) |
| `texuli/layouts/host` (+ `/chrome`, `/drawer`) | [Host layout kit](docs/layout-host.md) |
| `texuli/layouts/marketing` (+ `/entry`, `/landing`, `/pricing`, `/register`, `/section`) | [Marketing layouts](docs/layouts-marketing.md) |
| `texuli/layouts/mobile` (+ `/register`) | [Mobile layouts](docs/layouts-mobile.md) |
| `texuli/layouts/shells` | [AppShell](docs/layouts-shells.md) |
| register-only subpaths (cold-start registration) | [Layout register subpaths](docs/layout-register-subpaths.md) |

## Helpers

| Import | Purpose | Documentation |
| --- | --- | --- |
| `texuli` | The public barrel re-exporting every family | — |
| `texuli/cx` | `cx`, variant builders and control props | [Class values](docs/class-value.md), [variants in CSS](docs/variants-css.md), [control props](docs/control-props.md) |
| `texuli/icons` | Ten owned SVG paths plus the consumer-supplied `Icon` component | [Icon system](docs/ui-icons.md) |
| `texuli/icons/lucide` | Optional bridge types for hosts that use Lucide icon components; the host provides that package | [Icon system](docs/ui-icons.md) |

## Verification

```bash
pnpm vitest run packages/texuli     # 205 tests / 6 files
pnpm --filter texuli typecheck      # exit 0
npx biome check packages/texuli     # exit 0
```

The website and the packed consumer fixtures exercise these components in a
browser; see the repository's [testing guide](../../docs/TESTING_GUIDE.md).

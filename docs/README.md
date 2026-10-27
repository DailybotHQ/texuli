# Texuli documentation

Every guide in the repository. Start with [`../AGENTS.md`](../AGENTS.md) for
the rules and quick commands, and [`../README.md`](../README.md) for the
project overview.

## Repository guides (`docs/`)

| Guide | What it covers |
| --- | --- |
| [PRODUCT_SPEC](PRODUCT_SPEC.md) | What Texuli is, who it is for, capabilities, non-goals, release status |
| [RELEASE](RELEASE.md) | Independent package versions, prerelease and stable dist-tags, owner-GO publication waves |
| [ARCHITECTURE](ARCHITECTURE.md) | The down-only layer graph, every package and its subpaths, the website, build and test shape |
| [DECISIONS](DECISIONS.md) | Architecture decisions: options, choice, why, how to reverse |
| [EDITOR_ARCHITECTURE](EDITOR_ARCHITECTURE.md) | The rich text editor's contracts (ADR-003): model, selection, history, keyboard, paste security, interchange. The model exists as core texels and the editor package implements the surface |
| [STANDARDS](STANDARDS.md) | TypeScript, Svelte 5, Astro, CSS, Biome, naming, accessibility |
| [DESIGN_LANGUAGE](DESIGN_LANGUAGE.md) | The cross-surface visual contract: color roles and modes, spacing and density, shape and elevation, motion and reduced motion, focus, typography, direction |
| [TESTING_GUIDE](TESTING_GUIDE.md) | Every gate, the source→test map, scoped commands, blind spots, posture, and PLAN_006 SEO/AEO/analytics/theme evidence |
| [DEVELOPMENT_COMMANDS](DEVELOPMENT_COMMANDS.md) | Every root script and package script, verbatim, plus opt-in SEO/AEO audit commands |
| [CI](CI.md) | GitHub Actions workflows, npm publishing waves, Cloudflare Pages deployment settings |
| [SECURITY](SECURITY.md) | Threat model: URL policy, HTML sinks, untrusted agent output, CSP, supply chain |
| [PERFORMANCE](PERFORMANCE.md) | Size budgets, measured numbers, perf tests |
| [ACCESSIBILITY](ACCESSIBILITY.md) | Accessibility contract and how it is checked |
| [AI_AGENT_ONBOARDING](AI_AGENT_ONBOARDING.md) | First-session checklist |
| [AI_AGENT_COLLAB](AI_AGENT_COLLAB.md) | Ownership, owner-held files, commits, handoffs, plans and delegation |

## Package and app front pages

| Module | README |
| --- | --- |
| `@texuli/blocks` | [packages/blocks/README.md](../packages/blocks/README.md): Content blocks: closed vocabulary, untrusted guard, formula AST and catalog metadata for pages, documents and slides. |
| `@texuli/catalog` | [packages/catalog/README.md](../packages/catalog/README.md): The agent catalog and the renderer with no HTML sinks. |
| `@texuli/charts` | [packages/charts/README.md](../packages/charts/README.md): Chart math and every chart family, one lazy subpath per family. |
| `@texuli/chat` | [packages/chat/README.md](../packages/chat/README.md): Chat interfaces: thread, message list, composer and typing indicator, generic for people and agents. |
| `@texuli/editor` | [packages/editor/README.md](../packages/editor/README.md): The rich text editor surface, toolbar, link dialog and clipboard import on the core editor texels. |
| `@texuli/core` | [packages/core/README.md](../packages/core/README.md): Texels: framework-free behavior and policy that every Texuli component is built from. |
| `@texuli/data` | [packages/data/README.md](../packages/data/README.md): Data views: grid, tree, board, calendar, timeline, map, activity and files. |
| `@texuli/examples` | [packages/examples/README.md](../packages/examples/README.md): The examples registry every component writes once for tests, visuals and the website (private). |
| `@texuli/media` | [packages/media/README.md](../packages/media/README.md): Media: images, galleries, video, audio and layered compositions. |
| `@texuli/primitives` | [packages/primitives/README.md](../packages/primitives/README.md): Owned, headless Svelte 5 primitives built on the texels. |
| `texuli` | [packages/texuli/README.md](../packages/texuli/README.md): Styled Texuli components, layouts and shells. |
| `@texuli/tokens` | [packages/tokens/README.md](../packages/tokens/README.md): The OKLCH theme engine, the --tx-* token contract, 200+ themes and compiled CSS. |
| `@texuli/tools` | [packages/tools/README.md](../packages/tools/README.md): Agent and developer tools: the copy-in CLI, the MCP server, custom elements, adapters and the golden set. |
| `@texuli/website` | [apps/website/README.md](../apps/website/README.md): texuli.com: the Texuli documentation, catalog and live examples, built with Astro. |

Other entry points: the agent skill [`skills/texuli/SKILL.md`](../skills/texuli/SKILL.md),
the behavior suite [`tests/behavior/README.md`](../tests/behavior/README.md),
the visual suite [`tests/visual/README.md`](../tests/visual/README.md), and the
agent kit [`.agents/README.md`](../.agents/README.md).

## Every topic guide

### Quality reports (`docs/quality/`)

| Doc | Title |
| --- | --- |
| [a11y-display](quality/a11y-display.md) | Accessibility sweep: display, data and media |
| [a11y-forms](quality/a11y-forms.md) | Accessibility sweep: forms and inputs |
| [a11y-overlays](quality/a11y-overlays.md) | Overlay and navigation accessibility sweep |
| [a11y-site](quality/a11y-site.md) | Accessibility sweep: texuli.com |
| [a11y-slides](quality/a11y-slides.md) | Accessibility sweep: slides |
| [consumers](quality/consumers.md) | Consumer apps: Vite, Astro and SvelteKit |
| [consumers-registry](quality/consumers-registry.md) | Consumer apps installing the published packages from the npm registry |
| [csp](quality/csp.md) | Strict CSP and Trusted Types |
| [packaging](quality/packaging.md) | Packaging, publint and attw |
| [perf-builder](quality/perf-builder.md) | Blueprint builder performance at scale |
| [perf-data](quality/perf-data.md) | Data, chart and composition performance checks |
| [perf-primitives](quality/perf-primitives.md) | Primitive performance |
| [responsive-sweep](quality/responsive-sweep.md) | Responsive and right-to-left sweep: PLAN_004 surfaces |
| [sr-transcripts](quality/sr-transcripts.md) | Screen-reader transcripts (VoiceOver, macOS) |
| [sr-transcripts-slides](quality/sr-transcripts-slides.md) | Screen-reader transcripts: slides (VoiceOver, macOS) |
| [sr-transcripts-site](quality/sr-transcripts-site.md) | Screen-reader transcripts: website (accessibility-tree pass, no screen reader run) |
| [ssr](quality/ssr.md) | SSR and hydration smoke check |
| [supply-chain](quality/supply-chain.md) | Supply chain and SBOM |

### Website (`apps/website/docs/`)

| Doc | Title |
| --- | --- |
| [site-agents-page](../apps/website/docs/site-agents-page.md) | texuli.com: Texuli for agents |
| [site-blocks-page](../apps/website/docs/site-blocks-page.md) | Blocks and templates |
| [site-brand](../apps/website/docs/site-brand.md) | texuli.com: brand and home page |
| [site-builder](../apps/website/docs/site-builder.md) | Blueprint builder (texuli.com) |
| [site-charts-page](../apps/website/docs/site-charts-page.md) | Charts gallery (texuli.com) |
| [site-color-explorer](../apps/website/docs/site-color-explorer.md) | texuli.com: Color and token explorer |
| [site-component-pages](../apps/website/docs/site-component-pages.md) | Component pages generator |
| [site-docs-shell](../apps/website/docs/site-docs-shell.md) | Docs shell (texuli.com) |
| [site-editor](../apps/website/docs/site-editor.md) | texuli.com: editor area and the builder's rich text fields |
| [site-evidence](../apps/website/docs/site-evidence.md) | texuli.com: Evidence on every component page |
| [site-examples](../apps/website/docs/site-examples.md) | texuli.com: live examples |
| [site-foundation](../apps/website/docs/site-foundation.md) | texuli.com: site foundation |
| [site-gallery-components](../apps/website/docs/site-gallery-components.md) | Component gallery |
| [site-gallery-themes](../apps/website/docs/site-gallery-themes.md) | texuli.com: theme gallery |
| [site-guides](../apps/website/docs/site-guides.md) | texuli.com: Guides |
| [site-ia](../apps/website/docs/site-ia.md) | Site information architecture |
| [site-landing](../apps/website/docs/site-landing.md) | texuli.com library landing |
| [site-live-components](../apps/website/docs/site-live-components.md) | Live interactive component pages |
| [site-live-primitives](../apps/website/docs/site-live-primitives.md) | Live primitive demos |
| [site-media-page](../apps/website/docs/site-media-page.md) | texuli.com: media lab |
| [site-perf](../apps/website/docs/site-perf.md) | Site performance |
| [site-playground](../apps/website/docs/site-playground.md) | Agent playground (texuli.com) |
| [site-primitives-page](../apps/website/docs/site-primitives-page.md) | Primitives reference |
| [site-search](../apps/website/docs/site-search.md) | Site search (texuli.com) |
| [site-seo](../apps/website/docs/site-seo.md) | texuli.com: SEO, social images and sitemap |
| [site-showcase](../apps/website/docs/site-showcase.md) | Showcase: complete interfaces |
| [site-sidebar-nav](../apps/website/docs/site-sidebar-nav.md) | Site navigation and docs layout |
| [site-slides-page](../apps/website/docs/site-slides-page.md) | texuli.com: slides area |
| [site-skill](../apps/website/docs/site-skill.md) | The Texuli skill page |
| [site-theme-studio](../apps/website/docs/site-theme-studio.md) | Theme studio (texuli.com) |
| [site-theme-swatches](../apps/website/docs/site-theme-swatches.md) | Theme swatches (own palette) |
| [site-theme-switcher](../apps/website/docs/site-theme-switcher.md) | texuli.com: theme and mode switcher |

### `@texuli/blocks` (`packages/blocks/docs/`)

| Doc | Title |
| --- | --- |
| [blocks-data](../packages/blocks/docs/blocks-data.md) | Blocks: table, stat, chart and KPI |
| [code](../packages/blocks/docs/code.md) | Code blocks |
| [interactive](../packages/blocks/docs/interactive.md) | Interactive blocks |
| [map](../packages/blocks/docs/map.md) | Map block |
| [media](../packages/blocks/docs/media.md) | Media blocks |
| [structure](../packages/blocks/docs/structure.md) | Structure blocks |
| [text](../packages/blocks/docs/text.md) | Text blocks |

### `@texuli/catalog` (`packages/catalog/docs/`)

| Doc | Title |
| --- | --- |
| [catalog-build](../packages/catalog/docs/catalog-build.md) | Catalog build (content-addressed, with emit tiers) |
| [manifests-display](../packages/catalog/docs/manifests-display.md) | Display and feedback manifests |
| [manifests-layouts](../packages/catalog/docs/manifests-layouts.md) | Catalog manifests: layouts and shells |
| [render-frame](../packages/catalog/docs/render-frame.md) | Artifact frame |
| [render-grammar](../packages/catalog/docs/render-grammar.md) | Composition grammar |
| [render-hostile](../packages/catalog/docs/render-hostile.md) | Hostile corpus |
| [render-limits](../packages/catalog/docs/render-limits.md) | Catalog tree limits |
| [render-renderer](../packages/catalog/docs/render-renderer.md) | Catalog renderer core |
| [render-richtext](../packages/catalog/docs/render-richtext.md) | Catalog rich-text renderer |

### `@texuli/charts` (`packages/charts/docs/`)

| Doc | Title |
| --- | --- |
| [charts-interaction](../packages/charts/docs/charts-interaction.md) | Chart interaction |
| [charts-matrix](../packages/charts/docs/charts-matrix.md) | Charts: heatmap, scatter and bubble |

### `@texuli/chat` (`packages/chat/docs/`)

| Doc | Title |
| --- | --- |
| [chat-composer](../packages/chat/docs/chat-composer.md) | Chat composer and typing indicator |
| [chat-thread](../packages/chat/docs/chat-thread.md) | Chat thread and message list |

### `@texuli/editor` (`packages/editor/docs/`)

| Doc | Title |
| --- | --- |
| [editor-controller](../packages/editor/docs/editor-controller.md) | Editor controller |
| [editor-link-dialog](../packages/editor/docs/editor-link-dialog.md) | Link dialog |
| [editor-paste](../packages/editor/docs/editor-paste.md) | Clipboard import |
| [editor-surface](../packages/editor/docs/editor-surface.md) | Editor surface |
| [editor-toolbar](../packages/editor/docs/editor-toolbar.md) | Editor toolbar |

### `@texuli/core` (`packages/core/docs/`)

| Doc | Title |
| --- | --- |
| [core-announcer](../packages/core/docs/core-announcer.md) | Texel: live-region announcer |
| [core-controllable](../packages/core/docs/core-controllable.md) | Controllable state |
| [core-dir-locale](../packages/core/docs/core-dir-locale.md) | Direction, locale and messages |
| [core-dismiss](../packages/core/docs/core-dismiss.md) | Texel: outside interaction (pointer vs focus) |
| [core-env](../packages/core/docs/core-env.md) | Environment and SSR helpers |
| [core-focus-scope](../packages/core/docs/core-focus-scope.md) | Texel: focus scope and trap |
| [core-form-bridge](../packages/core/docs/core-form-bridge.md) | Native form bridge |
| [core-ids](../packages/core/docs/core-ids.md) | Core ids — deterministic, SSR-stable identifiers |
| [core-inert](../packages/core/docs/core-inert.md) | Texel: inert outside, with an exemption registry |
| [core-keyboard](../packages/core/docs/core-keyboard.md) | Keyboard model |
| [core-layer-stack](../packages/core/docs/core-layer-stack.md) | Texel: dismissable-layer stack |
| [core-overlay-core](../packages/core/docs/core-overlay-core.md) | Overlay core (per-feature overlay engine) |
| [core-portal](../packages/core/docs/core-portal.md) | Core portal |
| [core-position-dom](../packages/core/docs/core-position-dom.md) | Positioning on the page |
| [core-position-math](../packages/core/docs/core-position-math.md) | Positioning math |
| [core-presence](../packages/core/docs/core-presence.md) | Core presence — mount until exit motion ends |
| [core-roving](../packages/core/docs/core-roving.md) | Roving focus and typeahead |
| [core-scroll-lock](../packages/core/docs/core-scroll-lock.md) | Scroll lock |
| [core-tabbable](../packages/core/docs/core-tabbable.md) | Texel: tabbable query |
| [core-url-policy](../packages/core/docs/core-url-policy.md) | Core URL policy |
| [overlay-engine](../packages/core/docs/overlay-engine.md) | Overlay engine |

### `@texuli/data` (`packages/data/docs/`)

| Doc | Title |
| --- | --- |
| [data-activity](../packages/data/docs/data-activity.md) | Activity feed |
| [data-files](../packages/data/docs/data-files.md) | File browser |
| [data-grid-columns](../packages/data/docs/data-grid-columns.md) | Data grid column operations |
| [data-grid-core](../packages/data/docs/data-grid-core.md) | Data grid core |
| [data-grid-editing](../packages/data/docs/data-grid-editing.md) | Data grid editing |
| [data-map](../packages/data/docs/data-map.md) | Offline map |
| [data-timeline](../packages/data/docs/data-timeline.md) | Timeline and Gantt |
| [data-tree-view](../packages/data/docs/data-tree-view.md) | Tree data view |

### `@texuli/media` (`packages/media/docs/`)

| Doc | Title |
| --- | --- |
| [animation](../packages/media/docs/animation.md) | Composition keyframe animation |
| [audio](../packages/media/docs/audio.md) | Audio player and waveform |
| [captions](../packages/media/docs/captions.md) | Captions and chapters |
| [composition-svg](../packages/media/docs/composition-svg.md) | Composition SVG renderer |
| [gallery](../packages/media/docs/gallery.md) | Gallery and Lightbox |
| [generator-slot](../packages/media/docs/generator-slot.md) | Generator slot |
| [image-editor](../packages/media/docs/image-editor.md) | Image editor |
| [image](../packages/media/docs/image.md) | Image |
| [media-composition-canvas](../packages/media/docs/media-composition-canvas.md) | Composition renderer: canvas |
| [media-export](../packages/media/docs/media-export.md) | Media export |
| [video](../packages/media/docs/video.md) | Video player |

### `@texuli/primitives` (`packages/primitives/docs/`)

| Doc | Title |
| --- | --- |
| [consumer-ids](../packages/primitives/docs/consumer-ids.md) | Consumer ids (FIX-consumer-ids) |
| [prim-accordion](../packages/primitives/docs/prim-accordion.md) | Primitive: Accordion |
| [prim-alert-dialog](../packages/primitives/docs/prim-alert-dialog.md) | AlertDialog |
| [prim-avatar](../packages/primitives/docs/prim-avatar.md) | Avatar |
| [prim-calendar](../packages/primitives/docs/prim-calendar.md) | Calendar |
| [prim-checkbox](../packages/primitives/docs/prim-checkbox.md) | Primitive: Checkbox |
| [prim-collapsible](../packages/primitives/docs/prim-collapsible.md) | Collapsible |
| [prim-color-picker](../packages/primitives/docs/prim-color-picker.md) | ColorPicker primitive |
| [prim-combobox](../packages/primitives/docs/prim-combobox.md) | Combobox |
| [prim-command](../packages/primitives/docs/prim-command.md) | Command |
| [prim-context-menu](../packages/primitives/docs/prim-context-menu.md) | ContextMenu |
| [prim-date-field](../packages/primitives/docs/prim-date-field.md) | DateField and TimeField |
| [prim-date-picker](../packages/primitives/docs/prim-date-picker.md) | DatePicker and DateRangePicker |
| [prim-dialog](../packages/primitives/docs/prim-dialog.md) | Dialog |
| [prim-file-drop](../packages/primitives/docs/prim-file-drop.md) | FileDrop primitive |
| [prim-hover-card](../packages/primitives/docs/prim-hover-card.md) | HoverCard |
| [prim-label](../packages/primitives/docs/prim-label.md) | Primitive: Label and Field |
| [prim-listbox](../packages/primitives/docs/prim-listbox.md) | Listbox |
| [prim-menu](../packages/primitives/docs/prim-menu.md) | Menu (dropdown) |
| [prim-menubar](../packages/primitives/docs/prim-menubar.md) | Menubar |
| [prim-navigation-menu](../packages/primitives/docs/prim-navigation-menu.md) | NavigationMenu primitive |
| [prim-number-field](../packages/primitives/docs/prim-number-field.md) | Primitive: NumberField |
| [prim-pagination](../packages/primitives/docs/prim-pagination.md) | Pagination |
| [prim-pin-input](../packages/primitives/docs/prim-pin-input.md) | PinInput primitive |
| [prim-popover](../packages/primitives/docs/prim-popover.md) | Popover |
| [prim-portal](../packages/primitives/docs/prim-portal.md) | Primitive: Portal |
| [prim-progress](../packages/primitives/docs/prim-progress.md) | Progress |
| [prim-radio-group](../packages/primitives/docs/prim-radio-group.md) | Primitive: RadioGroup |
| [prim-scroll-area](../packages/primitives/docs/prim-scroll-area.md) | ScrollArea |
| [prim-select](../packages/primitives/docs/prim-select.md) | Primitive: Select |
| [prim-separator](../packages/primitives/docs/prim-separator.md) | Separator |
| [prim-sheet](../packages/primitives/docs/prim-sheet.md) | Sheet, Drawer, Panel and ResponsiveModal |
| [prim-slider](../packages/primitives/docs/prim-slider.md) | Primitive: Slider and range slider |
| [prim-splitter](../packages/primitives/docs/prim-splitter.md) | Splitter (resizable panels) |
| [prim-switch](../packages/primitives/docs/prim-switch.md) | Switch primitive |
| [prim-tabs](../packages/primitives/docs/prim-tabs.md) | Primitive: Tabs |
| [prim-tags-input](../packages/primitives/docs/prim-tags-input.md) | Primitive: TagsInput |
| [prim-toast](../packages/primitives/docs/prim-toast.md) | Toast region |
| [prim-toggle](../packages/primitives/docs/prim-toggle.md) | Toggle and ToggleGroup |
| [prim-toolbar](../packages/primitives/docs/prim-toolbar.md) | Toolbar |
| [prim-tooltip](../packages/primitives/docs/prim-tooltip.md) | Tooltip primitive |
| [prim-tree](../packages/primitives/docs/prim-tree.md) | Tree primitive |
| [svelte-attachments](../packages/primitives/docs/svelte-attachments.md) | Svelte attachments for primitives |

### `texuli` (`packages/texuli/docs/`)

| Doc | Title |
| --- | --- |
| [layout-host](../packages/texuli/docs/layout-host.md) | LayoutHost and the layout contract |
| [layouts-auth-settings](../packages/texuli/docs/layouts-auth-settings.md) | Auth, onboarding and settings layouts |
| [layouts-dashboard](../packages/texuli/docs/layouts-dashboard.md) | Dashboard grid and analytics layouts |
| [layouts-marketing](../packages/texuli/docs/layouts-marketing.md) | Marketing layouts |
| [layouts-mobile](../packages/texuli/docs/layouts-mobile.md) | Mobile layouts: tab bar and drawer, with stacked navigation |
| [layouts-shells](../packages/texuli/docs/layouts-shells.md) | Generic app shells |
| [ui-alert](../packages/texuli/docs/ui-alert.md) | Components: Alert, Callout and Banner |
| [ui-avatar](../packages/texuli/docs/ui-avatar.md) | Avatar and AvatarGroup |
| [ui-badge](../packages/texuli/docs/ui-badge.md) | Badge, Tag and Chip |
| [ui-button](../packages/texuli/docs/ui-button.md) | Button, IconButton and ButtonGroup |
| [ui-card](../packages/texuli/docs/ui-card.md) | Card |
| [ui-carousel](../packages/texuli/docs/ui-carousel.md) | Carousel |
| [ui-choice](../packages/texuli/docs/ui-choice.md) | Checkbox, Radio and Switch |
| [ui-combobox](../packages/texuli/docs/ui-combobox.md) | Combobox and MultiSelect |
| [ui-command](../packages/texuli/docs/ui-command.md) | Command palette |
| [ui-date](../packages/texuli/docs/ui-date.md) | Date: Calendar, DatePicker and DateRangePicker |
| [ui-dialog](../packages/texuli/docs/ui-dialog.md) | Dialog and AlertDialog |
| [ui-empty](../packages/texuli/docs/ui-empty.md) | EmptyState and ErrorState |
| [ui-feedback](../packages/texuli/docs/ui-feedback.md) | Skeleton, Spinner and Progress |
| [ui-field](../packages/texuli/docs/ui-field.md) | Component: Field, Label, Description, FieldError and Form |
| [ui-file-upload](../packages/texuli/docs/ui-file-upload.md) | FileUpload |
| [ui-icons](../packages/texuli/docs/ui-icons.md) | Icon system |
| [ui-input](../packages/texuli/docs/ui-input.md) | Components: Input, InputGroup and Textarea |
| [ui-kbd-code](../packages/texuli/docs/ui-kbd-code.md) | Kbd, Code and CopyButton |
| [ui-menus](../packages/texuli/docs/ui-menus.md) | DropdownMenu, ContextMenu and Menubar |
| [ui-navigation](../packages/texuli/docs/ui-navigation.md) | NavigationMenu, Breadcrumb and Pagination |
| [ui-number-pin](../packages/texuli/docs/ui-number-pin.md) | NumberField and PinInput |
| [ui-popover](../packages/texuli/docs/ui-popover.md) | Popover and HoverCard |
| [ui-rating](../packages/texuli/docs/ui-rating.md) | Rating |
| [ui-resizable](../packages/texuli/docs/ui-resizable.md) | Resizable panels |
| [ui-scroll-area](../packages/texuli/docs/ui-scroll-area.md) | ScrollArea |
| [ui-select](../packages/texuli/docs/ui-select.md) | Select |
| [ui-separator-aspect](../packages/texuli/docs/ui-separator-aspect.md) | Separator, AspectRatio and VisuallyHidden |
| [ui-sheet](../packages/texuli/docs/ui-sheet.md) | Sheet, Drawer, DetailPanel and ResponsiveModal |
| [ui-sidebar](../packages/texuli/docs/ui-sidebar.md) | Sidebar and AppNav |
| [ui-slider](../packages/texuli/docs/ui-slider.md) | Component: Slider |
| [ui-stat](../packages/texuli/docs/ui-stat.md) | Stat and KPI |
| [ui-stepper](../packages/texuli/docs/ui-stepper.md) | Component: Stepper and Wizard |
| [ui-table](../packages/texuli/docs/ui-table.md) | Table |
| [ui-tabs-accordion](../packages/texuli/docs/ui-tabs-accordion.md) | Tabs, Accordion and Collapsible |
| [ui-tags-color](../packages/texuli/docs/ui-tags-color.md) | TagsInput and ColorPicker |
| [ui-timeline](../packages/texuli/docs/ui-timeline.md) | Timeline |
| [ui-toast](../packages/texuli/docs/ui-toast.md) | Component: Toaster |
| [ui-toggle](../packages/texuli/docs/ui-toggle.md) | Components: Toggle and ToggleGroup |
| [ui-toolbar](../packages/texuli/docs/ui-toolbar.md) | Component: Toolbar |
| [ui-tooltip](../packages/texuli/docs/ui-tooltip.md) | Tooltip |
| [ui-tree](../packages/texuli/docs/ui-tree.md) | TreeView |
| [using-with-your-css](../packages/texuli/docs/using-with-your-css.md) | Using Texuli with your own CSS |

### `@texuli/tokens` (`packages/tokens/docs/`)

| Doc | Title |
| --- | --- |
| [tokens-aa-gate](../packages/tokens/docs/tokens-aa-gate.md) | AA gate for every theme |
| [tokens-contract](../packages/tokens/docs/tokens-contract.md) | Three-tier token contract |
| [tokens-css](../packages/tokens/docs/tokens-css.md) | Cascade layers and compiled CSS |
| [tokens-forced-colors](../packages/tokens/docs/tokens-forced-colors.md) | Forced colors and prefers-contrast |
| [tokens-generator](../packages/tokens/docs/tokens-generator.md) | Theme generator |
| [tokens-library-expand](../packages/tokens/docs/tokens-library-expand.md) | Tokens: Expand the library to 200+ themes |
| [tokens-library-port](../packages/tokens/docs/tokens-library-port.md) | Theme library (64-theme port) |
| [tokens-modes](../packages/tokens/docs/tokens-modes.md) | Color modes |
| [tokens-no-flash](../packages/tokens/docs/tokens-no-flash.md) | No-flash appearance bootstrap |
| [tokens-palette](../packages/tokens/docs/tokens-palette.md) | OKLCH palette engine |
| [tokens-style-presets](../packages/tokens/docs/tokens-style-presets.md) | Style presets |
| [tokens-tailwind](../packages/tokens/docs/tokens-tailwind.md) | Tokens: Tailwind 4 preset |
| [tokens-tone-soft](../packages/tokens/docs/tokens-tone-soft.md) | Soft tone roles (Alert / Callout) |

### `@texuli/tools` (`packages/tools/docs/`)

| Doc | Title |
| --- | --- |
| [a2ui](../packages/tools/docs/a2ui.md) | A2UI adapter (experimental) |
| [cli-add](../packages/tools/docs/cli-add.md) | texuli add |
| [cli-init](../packages/tools/docs/cli-init.md) | texuli init and texuli theme |
| [cli-update](../packages/tools/docs/cli-update.md) | texuli diff and texuli update |
| [elements](../packages/tools/docs/elements.md) | Custom elements |
| [golden](../packages/tools/docs/golden.md) | Agent golden set and scorer |
| [llms](../packages/tools/docs/llms.md) | llms.txt and agent docs bundle |

# Texuli documentation

Every guide in the repository. Start with [`../AGENTS.md`](../AGENTS.md) for
the rules and quick commands, and [`../README.md`](../README.md) for the
project overview.

## Repository guides (`docs/`)

| Guide | What it covers |
| --- | --- |
| [PRODUCT_SPEC](PRODUCT_SPEC.md) | What Texuli is, who it is for, capabilities, non-goals, release status |
| [RELEASE](RELEASE.md) | Independent package versions, 0.x versioning, prerelease and stable dist-tags, owner-GO publication waves |
| [ARCHITECTURE](ARCHITECTURE.md) | The down-only layer graph, every package and its subpaths, the website, build and test shape |
| [DECISIONS](DECISIONS.md) | Architecture decisions: options, choice, why, how to reverse |
| [EDITOR_ARCHITECTURE](EDITOR_ARCHITECTURE.md) | The rich text editor's contracts (ADR-003): model, selection, history, keyboard, paste security, interchange. The model exists as core texels and the editor package implements the surface |
| [STANDARDS](STANDARDS.md) | TypeScript, Svelte 5, Astro, CSS, Biome, naming, accessibility |
| [DESIGN_LANGUAGE](DESIGN_LANGUAGE.md) | The cross-surface visual contract: color roles and modes, spacing and density, shape and elevation, motion and reduced motion, focus, typography, direction |
| [TESTING_GUIDE](TESTING_GUIDE.md) | Every gate, the source→test map, scoped commands, blind spots, posture, and PLAN_006 SEO/AEO/analytics/theme evidence |
| [DEVELOPMENT_COMMANDS](DEVELOPMENT_COMMANDS.md) | Every root script and package script, verbatim, plus opt-in SEO/AEO audit commands |
| [CI](CI.md) | GitHub Actions workflows and budget audits, npm publishing waves, Cloudflare Pages deployment and Functions |
| [SECURITY](SECURITY.md) | Threat model: URL policy, HTML sinks, untrusted agent output, CSP, supply chain, edge functions and analytics |
| [PERFORMANCE](PERFORMANCE.md) | Size budgets, measured numbers, perf tests |
| [ACCESSIBILITY](ACCESSIBILITY.md) | Accessibility contract and how it is checked |
| [AI_AGENT_ONBOARDING](AI_AGENT_ONBOARDING.md) | First-session checklist |
| [AI_AGENT_COLLAB](AI_AGENT_COLLAB.md) | Ownership, owner-held files, commits, handoffs, plans and delegation |
| [SKILL_INSTALLATION](SKILL_INSTALLATION.md) | Installing the Texuli agent skill on each host |
| [SKILL_COMPATIBILITY](SKILL_COMPATIBILITY.md) | What is proven about installing the skill on each route and host, and what is not |

## Package and app front pages

| Module | README |
| --- | --- |
| `@texuli/astro` | [packages/astro/README.md](../packages/astro/README.md): Astro integration, content layouts and Svelte islands for Texuli sites. |
| `@texuli/blocks` | [packages/blocks/README.md](../packages/blocks/README.md): Content blocks: closed vocabulary, untrusted guard, formula AST and catalog metadata for pages, documents and slides. |
| `@texuli/catalog` | [packages/catalog/README.md](../packages/catalog/README.md): The agent catalog and the renderer with no HTML sinks. |
| `@texuli/charts` | [packages/charts/README.md](../packages/charts/README.md): Chart math and every chart family, one lazy subpath per family. |
| `@texuli/chat` | [packages/chat/README.md](../packages/chat/README.md): Chat interfaces: thread, message list, composer and typing indicator, generic for people and agents. |
| `@texuli/editor` | [packages/editor/README.md](../packages/editor/README.md): In development, on npm as `0.7.0` (first published as `0.5.0`): the rich text editor surface, toolbar, link dialog, clipboard import and Markdown in and out on the core editor texels. |
| `@texuli/core` | [packages/core/README.md](../packages/core/README.md): Texels: framework-free behavior and policy that every Texuli component is built from. |
| `@texuli/date` | [packages/date/README.md](../packages/date/README.md): Owned Gregorian date arithmetic for Texuli calendars and date fields. |
| `@texuli/deck` | [packages/deck/README.md](../packages/deck/README.md): In development, on npm as `0.7.0` (first published as `0.4.0`): the framework-free deck engine (deck model v2 from JSON or Markdown, layouts, engine, authoring). |
| `@texuli/document` | [packages/document/README.md](../packages/document/README.md): In development, first on npm as `0.7.0`: the framework-free block document engine (model, schema, operations, Markdown, pagination, DOCX and PDF, sync, collaboration). |
| `@texuli/drag` | [packages/drag/README.md](../packages/drag/README.md): In development, on npm as `0.7.0`: the framework-free drag engine (sortable, gesture, spatial, graph). |
| `@texuli/data` | [packages/data/README.md](../packages/data/README.md): Data views: grid, tree, board, calendar, timeline, map, activity and files. |
| `@texuli/examples` | [packages/examples/README.md](../packages/examples/README.md): The examples registry every component writes once for tests, visuals and the website (private). |
| `@texuli/media` | [packages/media/README.md](../packages/media/README.md): Media: images, galleries, video, audio and layered compositions. |
| `@texuli/pages` | [packages/pages/README.md](../packages/pages/README.md): In development, first on npm as `0.7.0`: the block document editor and reader on `@texuli/document` (paged view, export, collaboration, document host). |
| `@texuli/player` | [packages/player/README.md](../packages/player/README.md): Svelte paint runtime for validated Texuli catalog blueprints. |
| `@texuli/primitives` | [packages/primitives/README.md](../packages/primitives/README.md): Owned, headless Svelte 5 primitives built on the texels. |
| `@texuli/slides` | [packages/slides/README.md](../packages/slides/README.md): The presentation stage on `@texuli/deck` (in development; on npm as `0.7.0`, the v2 stage from `0.4.0`, after the `0.3.0` model v1 stage). |
| `@texuli/spec` | [packages/spec/README.md](../packages/spec/README.md): The schema-first blueprint contract: JSON schemas, the catalog vocabulary, TypeScript and Kotlin projections, and the conformance harness. |
| `texuli` | [packages/texuli/README.md](../packages/texuli/README.md): Styled Texuli components, layouts and shells. |
| `@texuli/tokens` | [packages/tokens/README.md](../packages/tokens/README.md): The OKLCH theme engine, the --tx-* token contract, 200+ themes and compiled CSS. |
| `@texuli/workflows` | [packages/workflows/README.md](../packages/workflows/README.md): In development, on npm as `0.7.0`: the accessible workflow graph editor and viewer. |
| `@texuli/tools` | [packages/tools/README.md](../packages/tools/README.md): Agent and developer tools: the copy-in CLI, the MCP server, custom elements, adapters and the golden set. |
| `@texuli/website` | [apps/website/README.md](../apps/website/README.md): texuli.com: the Texuli documentation, catalog and live examples, built with Astro; the Pages Functions live in the root `functions/`. |
| `@texuli/agent` | [apps/agent/README.md](../apps/agent/README.md): The texuli.com agent service: prompt to validated blueprint draft, fake replay provider only, not deployed. |
| `native/` | [native/README.md](../native/README.md): The Gradle Kotlin Multiplatform twin (`texuli-spec`, `texuli-compose`, `conformance`); not a pnpm package. |

Other entry points: the agent skill [`skills/texuli/SKILL.md`](../skills/texuli/SKILL.md),
the behavior suite [`tests/behavior/README.md`](../tests/behavior/README.md),
the visual suite [`tests/visual/README.md`](../tests/visual/README.md), the
published catalog [`apps/website/public/catalog/README.md`](../apps/website/public/catalog/README.md), and the
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
| [consumers-registry](quality/consumers-registry.md) | Consumer apps against the npm registry |
| [consumers](quality/consumers.md) | Consumer apps: Vite, Astro and SvelteKit |
| [csp](quality/csp.md) | Strict CSP and Trusted Types |
| [packaging](quality/packaging.md) | Packaging, publint and attw |
| [perf-builder](quality/perf-builder.md) | Blueprint builder performance at scale |
| [perf-data](quality/perf-data.md) | Data, chart and composition performance checks |
| [perf-primitives](quality/perf-primitives.md) | Primitive performance |
| [responsive-sweep](quality/responsive-sweep.md) | Responsive and right-to-left sweep: PLAN_004 surfaces |
| [sr-transcripts-site](quality/sr-transcripts-site.md) | Screen-reader transcripts: website (accessibility-tree pass) |
| [sr-transcripts-slides](quality/sr-transcripts-slides.md) | Screen-reader transcripts: slides (VoiceOver, macOS) |
| [sr-transcripts](quality/sr-transcripts.md) | Screen-reader transcripts (VoiceOver, macOS) |
| [ssr](quality/ssr.md) | SSR and hydration smoke check |
| [supply-chain](quality/supply-chain.md) | Supply chain and SBOM |

### Website (`apps/website/docs/`)

| Doc | Title |
| --- | --- |
| [site-aeo](../apps/website/docs/site-aeo.md) | texuli.com agent surfaces (AEO) |
| [site-agent-chat](../apps/website/docs/site-agent-chat.md) | texuli.com: agent chat |
| [site-agents-page](../apps/website/docs/site-agents-page.md) | texuli.com: Texuli for agents |
| [site-analytics](../apps/website/docs/site-analytics.md) | texuli.com analytics (Umami) |
| [site-architecture](../apps/website/docs/site-architecture.md) | texuli.com architecture page (web and native) |
| [site-blocks-page](../apps/website/docs/site-blocks-page.md) | Blocks and templates |
| [site-brand](../apps/website/docs/site-brand.md) | texuli.com: brand and home page |
| [site-builder](../apps/website/docs/site-builder.md) | Blueprint builder (texuli.com) |
| [site-charts-page](../apps/website/docs/site-charts-page.md) | Charts gallery (texuli.com) |
| [site-color-explorer](../apps/website/docs/site-color-explorer.md) | texuli.com: Color and token explorer |
| [site-component-pages](../apps/website/docs/site-component-pages.md) | Component pages generator |
| [site-csp](../apps/website/docs/site-csp.md) | Built-site Content Security Policy |
| [site-drag](../apps/website/docs/site-drag.md) | Drag page (texuli.com) |
| [site-docs-shell](../apps/website/docs/site-docs-shell.md) | Docs shell (texuli.com) |
| [site-documents](../apps/website/docs/site-documents.md) | texuli.com: documents page |
| [site-editor](../apps/website/docs/site-editor.md) | texuli.com: editor area |
| [site-evidence](../apps/website/docs/site-evidence.md) | texuli.com: Evidence on every component page |
| [site-examples](../apps/website/docs/site-examples.md) | texuli.com: live examples |
| [site-foundation](../apps/website/docs/site-foundation.md) | texuli.com: site foundation |
| [site-gallery-components](../apps/website/docs/site-gallery-components.md) | Component gallery |
| [site-gallery-themes](../apps/website/docs/site-gallery-themes.md) | texuli.com: theme gallery |
| [site-guides](../apps/website/docs/site-guides.md) | texuli.com: Guides |
| [site-ia](../apps/website/docs/site-ia.md) | Site information architecture |
| [site-landing](../apps/website/docs/site-landing.md) | texuli.com landing system |
| [site-live-components](../apps/website/docs/site-live-components.md) | Live interactive component pages |
| [site-live-generation](../apps/website/docs/site-live-generation.md) | texuli.com: live generation playground |
| [site-live-primitives](../apps/website/docs/site-live-primitives.md) | Live primitive demos |
| [site-media-page](../apps/website/docs/site-media-page.md) | texuli.com: media lab |
| [site-motion](../apps/website/docs/site-motion.md) | texuli.com: motion page |
| [site-native](../apps/website/docs/site-native.md) | texuli.com native landing |
| [site-perf](../apps/website/docs/site-perf.md) | Site performance |
| [site-playground](../apps/website/docs/site-playground.md) | Agent playground (texuli.com) |
| [site-primitives-page](../apps/website/docs/site-primitives-page.md) | Primitives reference |
| [site-search](../apps/website/docs/site-search.md) | Site search (texuli.com) |
| [site-seo](../apps/website/docs/site-seo.md) | texuli.com: SEO, social images and sitemap |
| [site-showcase](../apps/website/docs/site-showcase.md) | Showcase: complete interfaces |
| [site-sidebar-nav](../apps/website/docs/site-sidebar-nav.md) | Site navigation and docs layout |
| [site-skill](../apps/website/docs/site-skill.md) | The Texuli skill page |
| [site-slides-page](../apps/website/docs/site-slides-page.md) | texuli.com: slides area |
| [site-subsite](../apps/website/docs/site-subsite.md) | texuli.com sub-sites: routes, doors and breadcrumbs |
| [site-theme-studio](../apps/website/docs/site-theme-studio.md) | Theme studio (texuli.com) |
| [site-theme-swatches](../apps/website/docs/site-theme-swatches.md) | Theme swatches (own palette) |
| [site-theme-sweep](../apps/website/docs/site-theme-sweep.md) | Theme sweep tooling |
| [site-theme-switcher](../apps/website/docs/site-theme-switcher.md) | texuli.com: theme and mode switcher |
| [site-visual](../apps/website/docs/site-visual.md) | Visual polish |
| [site-workflows](../apps/website/docs/site-workflows.md) | Workflows pages (texuli.com) |

### Agent service (`apps/agent/docs/`)

| Doc | Title |
| --- | --- |
| [csp-reports](../apps/agent/docs/csp-reports.md) | Agent service: CSP report intake |
| [evals](../apps/agent/docs/evals.md) | Agent service: offline eval harness |
| [key-store](../apps/agent/docs/key-store.md) | Agent service: provider key store and local dev boundary |
| [providers](../apps/agent/docs/providers.md) | Agent service: the provider interface and adapters |
| [service-runbook](../apps/agent/docs/service-runbook.md) | Agent service contract and runbook |
| [streaming](../apps/agent/docs/streaming.md) | Agent service: streaming generation |

### `@texuli/astro` (`packages/astro/docs/`)

| Doc | Title |
| --- | --- |
| [appearance](../packages/astro/docs/appearance.md) | Appearance switcher (`@texuli/astro/appearance`) |
| [content](../packages/astro/docs/content.md) | Content block parser |
| [integration](../packages/astro/docs/integration.md) | Astro integration |
| [layouts-content-layout](../packages/astro/docs/layouts-content-layout.md) | `ContentLayout` |
| [sections-hero](../packages/astro/docs/sections-hero.md) | `Hero` |
| [sections-section](../packages/astro/docs/sections-section.md) | `Section` |
| [site](../packages/astro/docs/site.md) | Site model |
| [styles](../packages/astro/docs/styles.md) | `@texuli/astro/styles.css` |

### `@texuli/blocks` (`packages/blocks/docs/`)

| Doc | Title |
| --- | --- |
| [blocks-data](../packages/blocks/docs/blocks-data.md) | Blocks: table, stat, chart and KPI |
| [code](../packages/blocks/docs/code.md) | Code blocks |
| [embed](../packages/blocks/docs/embed.md) | Embed blocks |
| [formula](../packages/blocks/docs/formula.md) | `@texuli/blocks/formula` |
| [interactive](../packages/blocks/docs/interactive.md) | Interactive blocks |
| [map](../packages/blocks/docs/map.md) | Map block |
| [media](../packages/blocks/docs/media.md) | Media blocks |
| [structure](../packages/blocks/docs/structure.md) | Structure blocks |
| [text](../packages/blocks/docs/text.md) | Text blocks |

### `@texuli/catalog` (`packages/catalog/docs/`)

| Doc | Title |
| --- | --- |
| [catalog-build](../packages/catalog/docs/catalog-build.md) | Catalog build (content-addressed, with emit tiers) |
| [edit](../packages/catalog/docs/edit.md) | Blueprint edit operations |
| [envelope](../packages/catalog/docs/envelope.md) | Blueprint envelope |
| [manifests-display](../packages/catalog/docs/manifests-display.md) | Display and feedback manifests |
| [manifests-layouts](../packages/catalog/docs/manifests-layouts.md) | Catalog manifests: layouts and shells |
| [player](../packages/catalog/docs/player.md) | Document player core |
| [render-frame](../packages/catalog/docs/render-frame.md) | Artifact frame |
| [render-grammar](../packages/catalog/docs/render-grammar.md) | Composition grammar |
| [render-hostile](../packages/catalog/docs/render-hostile.md) | Hostile corpus |
| [render-limits](../packages/catalog/docs/render-limits.md) | Catalog tree limits |
| [render-renderer](../packages/catalog/docs/render-renderer.md) | Catalog renderer core |
| [render-richtext](../packages/catalog/docs/render-richtext.md) | Catalog rich-text renderer |
| [validate](../packages/catalog/docs/validate.md) | Draft validation |

### `@texuli/charts` (`packages/charts/docs/`)

| Doc | Title |
| --- | --- |
| [charts-annotations](../packages/charts/docs/charts-annotations.md) | Charts: annotations |
| [charts-axis](../packages/charts/docs/charts-axis.md) | Chart axes |
| [charts-calendar](../packages/charts/docs/charts-calendar.md) | Charts: calendar heatmap |
| [charts-canvas](../packages/charts/docs/charts-canvas.md) | Charts: canvas renderer |
| [charts-cartesian](../packages/charts/docs/charts-cartesian.md) | Charts: line, area, bar, stacked bar and combo |
| [charts-colors](../packages/charts/docs/charts-colors.md) | Chart color scales |
| [charts-compact](../packages/charts/docs/charts-compact.md) | Charts: sparkline, bullet, gauge and progress ring |
| [charts-flow](../packages/charts/docs/charts-flow.md) | Charts: funnel, sankey and network |
| [charts-geo](../packages/charts/docs/charts-geo.md) | Charts: geo map and point map |
| [charts-histogram](../packages/charts/docs/charts-histogram.md) | Charts: histogram |
| [charts-interaction](../packages/charts/docs/charts-interaction.md) | Chart interaction |
| [charts-large-series](../packages/charts/docs/charts-large-series.md) | Windowed cartesian series |
| [charts-matrix](../packages/charts/docs/charts-matrix.md) | Charts: heatmap, scatter and bubble |
| [charts-pack](../packages/charts/docs/charts-pack.md) | Charts: circle packing |
| [charts-part-whole](../packages/charts/docs/charts-part-whole.md) | Charts: pie, donut, sunburst and treemap |
| [charts-rtl](../packages/charts/docs/charts-rtl.md) | Charts in right-to-left layouts |
| [charts-schemas](../packages/charts/docs/charts-schemas.md) | Charts: prop schemas and tiers |
| [charts-sparkline-lite](../packages/charts/docs/charts-sparkline-lite.md) | Charts: light sparkline |
| [charts-statistical](../packages/charts/docs/charts-statistical.md) | Charts: statistical marks |
| [charts-worker](../packages/charts/docs/charts-worker.md) | Charts: worker offload |

### `@texuli/chat` (`packages/chat/docs/`)

| Doc | Title |
| --- | --- |
| [chat-composer](../packages/chat/docs/chat-composer.md) | Chat composer and typing indicator |
| [chat-thread](../packages/chat/docs/chat-thread.md) | Chat thread and message list |

### `@texuli/core` (`packages/core/docs/`)

| Doc | Title |
| --- | --- |
| [core-announcer](../packages/core/docs/core-announcer.md) | Texel: live-region announcer |
| [core-controllable](../packages/core/docs/core-controllable.md) | Controllable state |
| [core-dir-locale](../packages/core/docs/core-dir-locale.md) | Direction, locale and messages |
| [core-dismiss](../packages/core/docs/core-dismiss.md) | Texel: outside interaction (pointer vs focus) |
| [core-editor](../packages/core/docs/core-editor.md) | Editor texels |
| [core-env](../packages/core/docs/core-env.md) | Environment and SSR helpers |
| [core-focus-scope](../packages/core/docs/core-focus-scope.md) | Texel: focus scope and trap |
| [core-form-bridge](../packages/core/docs/core-form-bridge.md) | Native form bridge |
| [core-ids](../packages/core/docs/core-ids.md) | Core ids — deterministic, SSR-stable identifiers |
| [core-inert](../packages/core/docs/core-inert.md) | Texel: inert outside, with an exemption registry |
| [core-keyboard](../packages/core/docs/core-keyboard.md) | Keyboard model |
| [core-layer-stack](../packages/core/docs/core-layer-stack.md) | Texel: dismissable-layer stack |
| [core-markup](../packages/core/docs/core-markup.md) | Core markup: escaped XML and HTML builders (new in `0.6.0`) |
| [core-motion](../packages/core/docs/core-motion.md) | Core motion: Web Animations with an owned spring solver (new in `0.6.0`) |
| [core-overlay-core](../packages/core/docs/core-overlay-core.md) | Overlay core (per-feature overlay engine) |
| [core-portal](../packages/core/docs/core-portal.md) | Core portal |
| [core-position-dom](../packages/core/docs/core-position-dom.md) | Positioning on the page |
| [core-position-math](../packages/core/docs/core-position-math.md) | Positioning math |
| [core-presence](../packages/core/docs/core-presence.md) | Core presence — mount until exit motion ends |
| [core-roving](../packages/core/docs/core-roving.md) | Roving focus and typeahead |
| [core-scroll-lock](../packages/core/docs/core-scroll-lock.md) | Scroll lock |
| [core-tabbable](../packages/core/docs/core-tabbable.md) | Texel: tabbable query |
| [core-url-policy](../packages/core/docs/core-url-policy.md) | Core URL policy |
| [core-zip](../packages/core/docs/core-zip.md) | Core ZIP writer (new in `0.6.0`) |
| [overlay-engine](../packages/core/docs/overlay-engine.md) | Overlay engine |

### `@texuli/data` (`packages/data/docs/`)

| Doc | Title |
| --- | --- |
| [data-activity](../packages/data/docs/data-activity.md) | Activity feed |
| [data-activity-inbox](../packages/data/docs/data-activity-inbox.md) | Notification inbox (`@texuli/data/activity/inbox`) |
| [data-board](../packages/data/docs/data-board.md) | Board (kanban) |
| [data-calendar-reschedule](../packages/data/docs/data-calendar-reschedule.md) | Calendar rescheduling, creating and the clock |
| [data-cohort](../packages/data/docs/data-cohort.md) | Cohort retention table (`@texuli/data/cohort`) |
| [data-files](../packages/data/docs/data-files.md) | File browser |
| [data-filter-builder](../packages/data/docs/data-filter-builder.md) | Filter builder (`@texuli/data/filter-builder`) |
| [data-grid-columns](../packages/data/docs/data-grid-columns.md) | Data grid column operations |
| [data-grid-core](../packages/data/docs/data-grid-core.md) | Data grid core |
| [data-grid-edit-a11y](../packages/data/docs/data-grid-edit-a11y.md) | Editable grid accessibility: read-only cells, editor focus, tab stop |
| [data-grid-edit-virtual](../packages/data/docs/data-grid-edit-virtual.md) | Editable grid row windowing |
| [data-grid-editing](../packages/data/docs/data-grid-editing.md) | Data grid editing |
| [data-grid-virtual](../packages/data/docs/data-grid-virtual.md) | Virtual data grid |
| [data-map](../packages/data/docs/data-map.md) | Offline map |
| [data-timeline](../packages/data/docs/data-timeline.md) | Timeline and Gantt |
| [data-tree-view](../packages/data/docs/data-tree-view.md) | Tree data view |

### `@texuli/deck` (`packages/deck/docs/`)

| Doc | Title |
| --- | --- |
| [authoring](../packages/deck/docs/authoring.md) | Authoring (`@texuli/deck/authoring`) |
| [engine](../packages/deck/docs/engine.md) | Engine (`@texuli/deck/engine`) |
| [markdown](../packages/deck/docs/markdown.md) | Markdown dialect (`@texuli/deck/markdown`) |
| [math](../packages/deck/docs/math.md) | Math (`@texuli/deck/math`) |
| [model](../packages/deck/docs/model.md) | Deck model v2 (`@texuli/deck/model`) |
| [schema](../packages/deck/docs/schema.md) | Schema kit (`@texuli/deck/schema`) |
| [templates](../packages/deck/docs/templates.md) | Templates (`@texuli/deck/templates`) |

### `@texuli/document` (`packages/document/docs/`)

| Doc | Title |
| --- | --- |
| [collab](../packages/document/docs/collab.md) | Collaboration: comments, suggestions, versions and presence (`@texuli/document/collab`) |
| [docx](../packages/document/docs/docx.md) | DOCX writer (`@texuli/document/docx`) |
| [markdown](../packages/document/docs/markdown.md) | Markdown in and out (`@texuli/document/markdown`) |
| [model](../packages/document/docs/model.md) | Document model (`@texuli/document/model`) |
| [ops](../packages/document/docs/ops.md) | Operations, patches and the op log (`@texuli/document/ops`) |
| [paged](../packages/document/docs/paged.md) | Paged layout (`@texuli/document/paged`) |
| [pdf](../packages/document/docs/pdf.md) | PDF writer (`@texuli/document/pdf`) |
| [schema](../packages/document/docs/schema.md) | Schema and untrusted loader (`@texuli/document/schema`) |
| [sync](../packages/document/docs/sync.md) | CRDT sync core (`@texuli/document/sync`) |

### `@texuli/drag` (`packages/drag/docs/`)

| Doc | Title |
| --- | --- |
| [contract](../packages/drag/docs/contract.md) | Interaction, accessibility and i18n contract |
| [parity](../packages/drag/docs/parity.md) | Capability parity (SortableJS-class), one test per row |

### `@texuli/editor` (`packages/editor/docs/`)

| Doc | Title |
| --- | --- |
| [editor-controller](../packages/editor/docs/editor-controller.md) | Editor controller |
| [editor-link-dialog](../packages/editor/docs/editor-link-dialog.md) | Link dialog |
| [editor-markdown](../packages/editor/docs/editor-markdown.md) | Markdown in and out |
| [editor-paste](../packages/editor/docs/editor-paste.md) | Clipboard import |
| [editor-surface](../packages/editor/docs/editor-surface.md) | Editor surface |
| [editor-toolbar](../packages/editor/docs/editor-toolbar.md) | Editor toolbar |

### `@texuli/media` (`packages/media/docs/`)

| Doc | Title |
| --- | --- |
| [animation](../packages/media/docs/animation.md) | Composition keyframe animation |
| [audio](../packages/media/docs/audio.md) | Audio player and waveform |
| [captions](../packages/media/docs/captions.md) | Captions and chapters |
| [composition-svg](../packages/media/docs/composition-svg.md) | Composition SVG renderer |
| [composition-v2](../packages/media/docs/composition-v2.md) | Composition v2: groups and layer timing |
| [gallery](../packages/media/docs/gallery.md) | Gallery and Lightbox |
| [generator-slot](../packages/media/docs/generator-slot.md) | Generator slot |
| [image-editor](../packages/media/docs/image-editor.md) | Image editor |
| [image](../packages/media/docs/image.md) | Image |
| [media-composition-canvas](../packages/media/docs/media-composition-canvas.md) | Composition renderer: canvas |
| [media-export](../packages/media/docs/media-export.md) | Media export |
| [timeline](../packages/media/docs/timeline.md) | Animation timeline |
| [video](../packages/media/docs/video.md) | Video player |

### `@texuli/pages` (`packages/pages/docs/`)

| Doc | Title |
| --- | --- |
| [collab](../packages/pages/docs/collab.md) | Collaboration UI (`@texuli/pages/collab`) |
| [editor](../packages/pages/docs/editor.md) | Page editor (`@texuli/pages/editor`) |
| [export](../packages/pages/docs/export.md) | Export (`@texuli/pages/export`) |
| [host](../packages/pages/docs/host.md) | Document host for the player (`@texuli/pages/host`) |
| [paged](../packages/pages/docs/paged.md) | Paged view and print (`@texuli/pages/paged`) |
| [reader](../packages/pages/docs/reader.md) | Page reader (`@texuli/pages/reader`) |
| [styles](../packages/pages/docs/styles.md) | Stylesheet (`@texuli/pages/styles.css`) |

### `@texuli/player` (`packages/player/docs/`)

| Doc | Title |
| --- | --- |
| [blueprint-flow](../packages/player/docs/blueprint-flow.md) | Embedding the blueprint flow |
| [embedding](../packages/player/docs/embedding.md) | Embedding the player |
| [paint-proof](../packages/player/docs/paint-proof.md) | Untrusted at paint: the player's security property |
| [reference](../packages/player/docs/reference.md) | Player reference: loaders, layouts, keyboard, state, flows, actions, drag between lists, iframe protocol |
| [streaming](../packages/player/docs/streaming.md) | Streaming mode (new in `0.6.0`) |

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
| [prim-sortable](../packages/primitives/docs/prim-sortable.md) | Sortable primitive (new in `0.4.0`) |
| [prim-tree](../packages/primitives/docs/prim-tree.md) | Tree primitive |
| [svelte-attachments](../packages/primitives/docs/svelte-attachments.md) | Svelte attachments for primitives |

### `@texuli/slides` (`packages/slides/docs/`)

| Doc | Title |
| --- | --- |
| [components](../packages/slides/docs/components.md) | Components on slides |
| [export](../packages/slides/docs/export.md) | Print, PDF and PPTX export |
| [grammar](../packages/slides/docs/grammar.md) | Catalog grammar and agent decks |
| [layouts](../packages/slides/docs/layouts.md) | Layouts and their renderers |
| [migration](../packages/slides/docs/migration.md) | Upgrading from 0.3.0 to 0.4.0 |
| [model](../packages/slides/docs/model.md) | Deck model v1 |
| [stage](../packages/slides/docs/stage.md) | Stage: DeckStage and DeckPrint |
| [styles](../packages/slides/docs/styles.md) | Stylesheet |
| [templates](../packages/slides/docs/templates.md) | Starter templates |

### `@texuli/spec` (`packages/spec/docs/`)

| Doc | Title |
| --- | --- |
| [contract](../packages/spec/docs/contract.md) | The spec contract: files, generation, conformance, versioning, spec 0.3.0 and the state surface |
| [motion](../packages/spec/docs/motion.md) | Spec motion: the closed motion vocabulary (spec 0.6.0) |
| [stream](../packages/spec/docs/stream.md) | Streamed blueprints (new in `0.6.0`) |

### `texuli` (`packages/texuli/docs/`)

| Doc | Title |
| --- | --- |
| [class-value](../packages/texuli/docs/class-value.md) | `class` prop: Svelte 5 ClassValue |
| [control-props](../packages/texuli/docs/control-props.md) | Control and wrapper attributes (FIX-choice-aria) |
| [layout-host](../packages/texuli/docs/layout-host.md) | LayoutHost and the layout contract |
| [layout-register-subpaths](../packages/texuli/docs/layout-register-subpaths.md) | Layout register-only subpaths |
| [layouts-auth-settings](../packages/texuli/docs/layouts-auth-settings.md) | Auth, onboarding and settings layouts |
| [layouts-content](../packages/texuli/docs/layouts-content.md) | Content layouts (`texuli/layouts/content`) |
| [layouts-dashboard](../packages/texuli/docs/layouts-dashboard.md) | Dashboard grid and analytics layouts |
| [layouts-marketing](../packages/texuli/docs/layouts-marketing.md) | Marketing layouts |
| [layouts-mobile](../packages/texuli/docs/layouts-mobile.md) | Mobile layouts: tab bar and drawer, with stacked navigation |
| [layouts-rail-master-detail](../packages/texuli/docs/layouts-rail-master-detail.md) | App layouts: rail and master-detail |
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
| [ui-motion](../packages/texuli/docs/ui-motion.md) | Motion: the motion prop and MotionProvider (new in `0.6.0`) |
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
| [variants-css](../packages/texuli/docs/variants-css.md) | Recipe helpers import their CSS |

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
| [tokens-motion](../packages/tokens/docs/tokens-motion.md) | Motion tokens (new in `0.6.0`) |
| [tokens-no-flash](../packages/tokens/docs/tokens-no-flash.md) | No-flash appearance bootstrap |
| [tokens-palette](../packages/tokens/docs/tokens-palette.md) | OKLCH palette engine |
| [tokens-style-presets](../packages/tokens/docs/tokens-style-presets.md) | Style presets |
| [tokens-tailwind](../packages/tokens/docs/tokens-tailwind.md) | Tokens: Tailwind 4 preset |
| [tokens-tone-soft](../packages/tokens/docs/tokens-tone-soft.md) | Soft tone roles (Alert / Callout) |

### `@texuli/tools` (`packages/tools/docs/`)

| Doc | Title |
| --- | --- |
| [a2ui](../packages/tools/docs/a2ui.md) | A2UI adapter (experimental) |
| [cli-add](../packages/tools/docs/cli-add.md) | `texuli add` |
| [cli-init](../packages/tools/docs/cli-init.md) | `texuli init` and `texuli theme` |
| [cli-update](../packages/tools/docs/cli-update.md) | `texuli diff` and `texuli update` |
| [deck](../packages/tools/docs/deck.md) | Deck commands |
| [document](../packages/tools/docs/document.md) | Document commands |
| [elements](../packages/tools/docs/elements.md) | Custom elements |
| [golden](../packages/tools/docs/golden.md) | Agent golden set and scorer |
| [llms](../packages/tools/docs/llms.md) | llms.txt and agent docs bundle |

### Native (`native/docs/`)

| Doc | Title |
| --- | --- |
| [ADOPTION](../native/docs/ADOPTION.md) | Adopting the native renderer |
| [kmp-aichat-migration](../native/docs/kmp-aichat-migration.md) | KMPAIChat migration validation |
| [kmp-pttdynamics-migration](../native/docs/kmp-pttdynamics-migration.md) | KMPPTTDynamics migration validation |
| [kmp-starter-migration](../native/docs/kmp-starter-migration.md) | KMPStarter migration validation |
| [kmp-tapduel-migration](../native/docs/kmp-tapduel-migration.md) | KMPTapDuelGame migration validation |
| [kmp-todo-migration](../native/docs/kmp-todo-migration.md) | KMPTodoApp migration validation |
| [kmp-voicechat-migration](../native/docs/kmp-voicechat-migration.md) | KMPAIVoiceChat migration validation |

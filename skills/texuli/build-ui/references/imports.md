# Public import map (build-ui)

Prefer these entries. Never import package `src/internal` paths from apps.
Every package and its layer: [`../../router/packages.md`](../../router/packages.md)
(derived from the real `exports`).

## texuli (styled)

| Need | Import |
| --- | --- |
| Classes | `texuli/cx` — `cx`, `variants` |
| Button | `texuli/button` |
| Input / textarea | `texuli/input` |
| Card | `texuli/card` |
| Badge | `texuli/badge` |
| Select | `texuli/select` |
| Toggle | `texuli/toggle` |
| Dialog / sheet | `texuli/dialog`, `texuli/sheet` |
| Layout hosts | layout subpaths under `texuli` (see package exports) |

## @texuli/core (texels)

| Need | Import |
| --- | --- |
| Roving tab | `@texuli/core/roving` |
| URL policy | `@texuli/core/url-policy` |
| Focus scope | `@texuli/core/focus-scope` (when present) |

Never `@texuli/core` root barrel for app code.

## @texuli/tokens

| Need | Import |
| --- | --- |
| Library themes | `@texuli/tokens/library` / `library-expand` |
| Modes | `@texuli/tokens/modes` |
| CSS compile | `@texuli/tokens` (`compileThemeCss`, `applyTheme`) |
| No-flash | `@texuli/tokens/no-flash` |
| AA gate | `@texuli/tokens/aa-gate` |

## @texuli/catalog

| Need | Import |
| --- | --- |
| Build | `@texuli/catalog/build`, `@texuli/catalog/build/node` |
| Manifest groups | `@texuli/catalog/manifests/display` (and forms, content, layouts, …) |
| Render | `@texuli/catalog/render/renderer` |
| Limits | `@texuli/catalog/render/limits` |
| Grammar | `@texuli/catalog/render/grammar` |
| Rich text nodes | `@texuli/catalog/render/richtext` |
| Artifact frame | `@texuli/catalog/render/frame` |
| Validate untrusted blueprints | `@texuli/catalog/validate` (`validateDraft`) |
| Envelope and lifecycle | `@texuli/catalog/envelope` |
| Edit ops and undo | `@texuli/catalog/edit` |
| Player core (framework-free) | `@texuli/catalog/player` |

## Layers above texuli

| Area | Import style |
| --- | --- |
| Data views | `@texuli/data/<view>` |
| Charts | `@texuli/charts/<family>` (`cartesian`, `compact`, `flow`, `geo`, `matrix`, `part-whole`, …) |
| Media | `@texuli/media/<area>` |
| Chat | `@texuli/chat` (`ChatThread`, `Composer`, `parseMessageText`) |
| Content blocks | `@texuli/blocks/<family>` (lazy) or `@texuli/blocks/<family>/renderers` |
| Decks | `@texuli/slides/model`, `@texuli/slides/grammar`, `@texuli/slides/stage` |
| Paint a validated blueprint | `@texuli/player` (+ `@texuli/player/styles.css`) |
| Class helpers from those packages | `texuli/cx` only |

## CSS layers

```css
@layer tx.base, tx.components;
```

Consumer utilities win over component defaults when ordered correctly.

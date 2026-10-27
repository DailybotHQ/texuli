# Interface recipes

Each recipe is a **starting checklist**, not a generated app. Stay offline;
import public subpaths only.

## 1. Dashboard

**Brief shape:** KPI row, primary chart or table, filters, optional side nav.

| Need | Prefer |
| --- | --- |
| Shell | App layout / sidebar from `texuli` layouts (developer tier) |
| KPIs | `stat` / `kpi` (display manifests) |
| Grouping | `card` + `CardGrid` |
| Dense data | `@texuli/data/*` views (grid, tree, board, calendar, timeline, files, …) |
| Charts | `@texuli/charts/*` lazy families (`cartesian`, `compact`, `part-whole`, …) |
| Theme | `enterprise-neutral` or themes skill search |

**Compose order:** shell → filter bar → KPI row → main visualization → detail
drawer (if needed). Validate empty and loading states.

**Gates:** unit tests for any new host logic; typecheck `texuli` / `data` /
`charts` as touched; optional website showcase e2e if you edit showcase.

## 2. Landing page

**Brief shape:** hero, value props, CTA, optional social proof, footer.

| Need | Prefer |
| --- | --- |
| Structure | Page layout / content sections |
| CTA | `button` (forms manifest) |
| Labels | `badge` for status chips |
| Hero media | media skill `Image` with URL policy |
| Theme | brand-friendly library theme |

**Compose order:** hero (title, lead, primary+secondary CTA) → feature cards →
closing CTA. Keep motion optional and respect `prefers-reduced-motion`.

## 3. Form flow

**Brief shape:** multi-step intake or settings save.

| Need | Prefer |
| --- | --- |
| Progress | `stepper` |
| Fields | `input`, textarea, select, checkbox/radio via forms components |
| Actions | `button` primary submit + secondary back |
| Errors | `alert` near fields; `error-state` for full-page failure |
| Success | inline alert or empty-state with next action |

**Compose order:** stepper → current step fields → validation messages →
footer actions. Wire pending state on submit. Never store secrets in
prototypes as real credentials.

**Gates:** forms unit tests; axe on the flow when e2e exists
(`tests/e2e/a11y-forms.spec.ts` pattern).

## 4. Slide / deck

**Brief shape:** sequential slides for a pitch or lesson.

| Need | Prefer |
| --- | --- |
| Deck model | `@texuli/slides/model` (`parseDeck`): validated slides of `@texuli/blocks` content, notes, masters, theme references |
| Agent catalog tree | `@texuli/slides/grammar` (`toDeckRenderTree`): `layout-deck` with one `deck-slide` child per slide (`slideId`, `title`, `notes`, `master`, `transition`, `themeRef`) and block-family children |
| Validate agent output | `validateDeckDraft(input, { catalog })`: the catalog's `validateDraft` (ids, props, sinks, block schemas, grammar, `layout-deck` root) plus deck rules (slide ids, declared masters, theme references); returns the deck and per-slide master, transition, theme and step count |
| Interchange / legacy | `toDeckGrammar` (structured `slides[]` prop; not checked node by node by the renderer); `projectLegacyDeck` reads the older deck-of-cards shape |
| Present | `@texuli/slides/stage` (`DeckStage`, optional `@texuli/slides/styles.css`): one slide at a time, previous/next, Home/End, `o` overview, `p` presenter view (notes, next slide or step; timer opt-in), `f` fullscreen (visible window-filling fallback), slot masters split at top-level dividers, `fade`/`fade-up`/`none` transitions, reduced motion honoured |
| Print / export | `DeckPrint` (`@texuli/slides/stage`) + `requestDeckPdf` (`@texuli/slides/export`, browser print to PDF), `exportDeckPptx` (`@texuli/slides/export`: text, bullets and notes; media and charts are reported as omitted) |
| Starter decks | `createDeckFromTemplate('report' \| 'pitch' \| 'review')` from `@texuli/slides/templates`: real blocks that validate, render, print and export like any deck |
| Text | block content or plain text — not HTML strings |
| Chrome | developer shell only outside the deck frame |

**Compose order:** deck model → validate with `parseDeck` → present with
`DeckStage`. For agent output: emit the `deck-slide` tree → `validateDeckDraft`
→ show diagnostics on a draft, never activate an invalid one. Reveal steps
play on the stage: put `step` (and optionally `reveal`) on top-level slide
blocks only; a list with a `step` reveals one item per step. Print and PPTX
flatten them. A presenter screen is a second same-origin window linked with
`createDeckSync` (BroadcastChannel, no server): do not promise another device.

## 5. Media story

**Brief shape:** narrative with images or video chapters.

| Need | Prefer |
| --- | --- |
| Media | [`../../media/SKILL.md`](../../media/SKILL.md) — Image, Gallery, Video + captions |
| Framing | `card` / content layouts |
| URLs | `safeImageSrc` / `safeMediaSrc` on every src |

**Compose order:** story outline → media slots with policy-safe URLs →
captions/chapters → export only if the brief asks (media export docs).

## Shared acceptance for every recipe

- [ ] Primary path works with real handlers (no dead buttons)
- [ ] Empty and error states are reachable
- [ ] Keyboard order is sane; focus visible
- [ ] AA contrast in light and dark for chrome you ship
- [ ] No foreign network in the static or fixture path
- [ ] Imports are public subpaths; `texuli/cx` for classes

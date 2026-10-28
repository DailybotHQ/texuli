# Starter templates

**Import:** `@texuli/slides/templates` (also re-exported from `@texuli/slides`)  
**Source:** `packages/slides/src/templates/`  
**Tests:** `tests/decks.test.ts`

Three starter decks built from the model v1 deck ([model.md](model.md)),
its masters and block types. Each returns a validated v1 `Deck`, so it
renders, prints and exports like any other deck; the v2 stage migrates it
when it presents it.

> **Model v1 templates.** These are the `0.3.0` templates, kept for
> compatibility. The model v2 templates of `0.4.0` live in `@texuli/deck/templates`:
> `createDeckTemplate(id, title?)` returns a validated v2 deck for one of
> the nine ids in `DECK_TEMPLATES` (`pitch`, `review`, `qbr`, `launch`,
> `status`, `training`, `lesson`, `report`, `talk`), built from the brief
> outlines of `@texuli/deck/authoring` (`generateDeckFromBrief`), with
> placeholder content marked as draft guidance. The repository also keeps
> fictional starter decks as JSON and Markdown pairs in
> [`packages/deck/decks/`](../../deck/decks); the deck tests read them, and
> the texuli.com slides page presents a copy of one.

`DECK_TEMPLATE_IDS` lists them (`DeckTemplateId`). `DECK_TEMPLATES` maps each
id to its `DeckTemplate`: `label`, `description`, default `themeId`,
`imageSlots`, and `create(options)`.

| Template | Default theme | Slides (master) |
| --- | --- | --- |
| `report` | `enterprise-neutral` | cover (title), summary, key numbers (`kpi`), trend (media-left figure), risks (callout), next steps (closing) |
| `pitch` | `ocean` | cover (title), problem (section), solution (media-right image), traction (`stat`), customer voice (quote), the ask (closing) |
| `review` | `graphite` | cover (title), goals (`checklist`), what shipped (two-column `columns`), demo (media-left figure + code), next sprint (closing) |

```ts
import { createDeckFromTemplate } from '@texuli/slides/templates';

const deck = createDeckFromTemplate('pitch', {
  title: 'Northwind',
  themeRef: { kind: 'catalog', id: 'emerald', mode: 'dark' },
  images: { product: { src: 'assets/product.png', alt: 'Dashboard', width: 1280, height: 720 } },
});
```

`createDeckFromTemplate(id, options)` takes `DeckTemplateOptions`:

- `title`, which also sets the cover slide's title;
- `themeRef`, a catalog id or reference. Every slide inherits the deck theme,
  so this rebrands the whole deck. The defaults are token-library ids.
- `aspect` and `locale`;
- `images`, by slot name, each a `DeckTemplateImage` (`src`, `alt`, `width`,
  `height`). Each template has one slot. The default sources are relative
  placeholder paths such as `images/pitch-product.png`; they pass the
  untrusted paint policy, but the host must serve those files or replace them.

Options that make the deck invalid throw a `TypeError` (for example a
multi-line title, a bad locale or theme id, or a `javascript:` image). Each
call returns a fresh deck. Every template validates with zero diagnostics as
an untrusted agent tree (`toDeckRenderTree` + `validateDeckDraft`). The
content is fictional and meant to be replaced.

In PPTX export, each template's image and its data block (`kpi`, `stat` or
`checklist`) are reported as omitted.

The examples registry renders each template in `DeckStage`
(`slides-template-report`, `slides-template-pitch`, `slides-template-review`),
with committed light and dark baselines on desktop Chromium and the Pixel 7.

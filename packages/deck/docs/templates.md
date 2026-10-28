# Templates (`@texuli/deck/templates`)

Built-in, deterministic deck templates, backed by the
[brief outlines](authoring.md#brief-outlines) of `@texuli/deck/authoring`
(ADR-009). A template is a validated deck of draft slides: the structure and
layouts are chosen for you, and every content field says what to add instead
of inventing it.

> **Status:** in development; `@texuli/deck` is on npm from `0.4.0`.

```ts
import { createDeckTemplate, DECK_TEMPLATES } from '@texuli/deck/templates';

const review = createDeckTemplate('review', 'Support review');
// review.meta.title === 'Support review'; 8 validated draft slides

for (const template of DECK_TEMPLATES) console.log(template.id, template.label);
```

- `createDeckTemplate(id, title?)` returns a validated `Deck`. Without a
  title it is `<Id> draft` (`Pitch draft`). An unknown id throws a
  `TypeError` (a developer error; ids are a closed set).
- `DECK_TEMPLATES` lists every template (`DeckTemplate`: `id`, `label`,
  `description`). `DeckTemplateId` is an outline id or `review`.

| Template | Label | Description | Built from |
| --- | --- | --- | --- |
| `pitch` | Pitch | A source-led story from problem to ask. | the `pitch` outline |
| `review` | Review | A review of outcomes, risks, evidence and next decisions. | the `qbr` outline |
| `qbr` | Quarterly review | A balanced quarter review with evidence and next priorities. | the `qbr` outline |
| `launch` | Launch | Audience, product promise, launch plan and risks. | the `launch` outline |
| `status` | Status | Progress, blockers, decisions and next period. | the `status` outline |
| `training` | Training | Learning outcomes, demonstration, practice and checks. | the `training` outline |
| `lesson` | Lesson | A compact lesson with example and practice. | the `lesson` outline |
| `report` | Report | Question, method, findings, limits and recommendations. | the `report` outline |
| `talk` | Talk | A memorable talk with one central idea and useful takeaways. | the `talk` outline |

The same id always produces the same deck: `tests/authoring.test.ts` checks
that every outline generates byte-stable decks and that every template
validates.

## Starter decks

The repository also keeps seven finished, fictional starter decks in
`packages/deck/decks/`, each as a JSON file and a Markdown file that parse to
the same deck. They are not an exported subpath (copy the file you need);
`tests/authoring.test.ts` checks that every pair validates, matches, lints
with no errors or warnings and round-trips through `deckToMarkdown`.

| Deck | Title | Slides | What it shows |
| --- | --- | --- | --- |
| `example` | Example presentation | 7 | A short general-purpose deck |
| `harbor-ops-pitch` | Harbor operations pitch | 7 | A pitch deck with a team slide and a big stat |
| `northwind-qbr` | Northwind quarterly review | 8 | A quarterly review with a timeline and a big stat |
| `lumen-launch` | Lumen launch plan | 9 | A product launch plan |
| `cedar-training` | Cedar operations training | 9 | A training session with process steps |
| `texuli-create-anything` | Texuli: create anything | 25 | The flagship: every catalog layout in one story |
| `everything` | Texuli deck feature catalog | 35 | Coverage: every catalog layout, all 13 background presets, and twenty component families as component items on free slides |

`texuli-create-anything` is the deck the website's `/slides-page/` (in `apps/website`) presents
(through a verbatim copy that `apps/website/tests/site-slides.test.ts` keeps
in sync). The Markdown files are good references for the
[Markdown dialect](markdown.md): layouts with `:::` regions, `.element`
attributes, code highlights, chart fences and component fences.

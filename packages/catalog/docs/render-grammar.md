# Composition grammar

**Package:** `@texuli/catalog`  
**Import:** `@texuli/catalog/render/grammar`  
**Tests:** `packages/catalog/tests/render-grammar.test.ts`

## Goal

After the sink-free renderer builds a {@link RenderNode} tree, the **composition
grammar** checks structure that accessibility and layout hosts rely on:

| Rule | Failure code |
| --- | --- |
| Heading levels do not skip ranks; at most one `h1` | `heading-skip`, `heading-multiple-h1`, `heading-level-invalid` |
| Interactive controls are not nested | `interactive-nesting` |
| At most one primary action per container | `primary-action-multiple` |
| Landmarks unique (`main` at most once) | `landmark-duplicate`, `landmark-multiple-main` |
| No order-breaking props (`position`, `order`, …) | `visual-order` |

## Usage

```ts
import { renderCatalogTree } from '@texuli/catalog/render/renderer';
import {
  checkCompositionGrammar,
  defaultGrammarRoles,
} from '@texuli/catalog/render/grammar';

const { roots } = renderCatalogTree(tree, { catalog: view });
const { ok, issues, roots: repaired } = checkCompositionGrammar(roots, {
  roles: defaultGrammarRoles,
  mode: 'repair', // or 'report'
});
```

## Modes

- **`report`** (default): diagnostics only; input roots unchanged.
- **`repair`**: clamp heading levels, replace nested interactives with
  placeholders, demote extra primary actions, strip order-breaking props.

## Roles

Hosts extend {@link DEFAULT_GRAMMAR_ROLES} via `grammarRolesFromList`. Unknown
component ids default to `static` (no hard failure).

The default roles know the catalog's own ids, so the outline they check is
the one a host paints:
- `blocks-text` is a heading only when its block is a `heading`, at the
  block's `level` (`headingBlockProp: 'block'`; repair rewrites the level
  inside the block);
- `layout-page`, `layout-doc` and `layout-deck` are the `main` landmark, and
  a non-empty `title` is their h1 (`titleHeading: 1`);
- a titled `layout-card` is a container whose title sits one rank below the
  nearest titled frame or card around it (`titleHeading: 'nested'`);
  `layout-grid` is a container;
- titled charts render a fixed rank: cartesian and matrix charts h2; flow,
  geo and part-whole charts h3. Compact charts render none.

A titled doc holding two h1 text blocks and an h4 reports two
`heading-multiple-h1` issues and one `heading-skip`.

### Decks (G11)

`DECK_GRAMMAR_IDS` names the deck's stable ids: `layout-deck` (the deck, the
`main` landmark with its title as h1) and `deck-slide` (one slide). Both are
agent-emittable catalog layouts. The other four ids name deck stage surfaces
for hosts that check a rendered stage, and have no catalog manifest:

- `deck-controls`: a container;
- `deck-overview`: the `navigation` landmark;
- `deck-notes`: the `complementary` landmark;
- `deck-up-next`: a `region`.

`deck-slide` derives from `layout-card`, so a titled slide sits one rank below
the deck title and its headings rank below it. `deck-notes` declares
`nestedRoles`: inside a `deck-slide` it is `static` slide data, so a deck
whose slides each carry notes has no duplicate landmarks, while two presenter
notes surfaces side by side report `landmark-duplicate`. A deck needs a title:
in an untitled deck each slide title is an h1, which reports
`heading-multiple-h1`. `@texuli/slides` builds these trees with
`toDeckRenderTree`.

### Derived and nested roles (G15 v2)

A host row may set `deriveFrom` to inherit every field it does not set from
another id — resolved first against the list, then against the built-in
defaults; cycles fall back to the row's own fields (`static` when it has no
explicit role). The built-in `blocks-heading` and `text-heading` ids derive
from `heading` this way.

A meta row may also declare `nestedRoles`: a list of `{ inside, role }`
overrides applied when the node sits inside one of the `inside` ids. The
override keeps only the visual-order props; every other behavior follows the
new role. By default, a `heading` nested inside an interactive control
(`button`, `link`, `icon-button`, `tabs-trigger`) is treated as
`static`, so control labels never enter the document outline.

## Security

Grammar never injects HTML or `class`/`style`. It only rewrites plain prop bags
and may emit placeholders already defined by the renderer.

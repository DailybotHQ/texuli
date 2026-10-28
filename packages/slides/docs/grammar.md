# Catalog grammar and agent decks

**Import:** `@texuli/slides/grammar` (also re-exported from `@texuli/slides`)  
**Source:** `packages/slides/src/grammar/`  
**Tests:** `tests/decks.test.ts` (model, grammar, chart projection, render
tree, slots, fragments, templates and golden decks)

Encodings between the model v1 deck ([model.md](model.md)) and catalog
trees, plus the validation entry point for model v1 decks an agent returns.

> **Model v1.** This subpath encodes the `0.3.0` deck model and is kept for
> compatibility. Model v2 decks (the next minor, `0.4.0`, in the repository
> and not on npm yet) travel as catalog trees too, under spec `0.4.0`; they
> are validated by `@texuli/catalog/validate` and the `@texuli/deck` model,
> not by this subpath. See [Model v2 deck trees](#model-v2-deck-trees).

## Block families

`BLOCK_CATALOG_IDS` maps every block type to its catalog family id
(`DeckBlockCatalogId`, such as `blocks-text` or `blocks-media`), and
`catalogIdForBlock(type)` looks one up. `DECK_BLOCK_CATALOG_IDS` lists the
distinct families. Both directions of every encoding check that a block's
family matches its type.

## Three encodings

| Form | Encode | Decode | Use |
| --- | --- | --- | --- |
| Render tree (G11) | `toDeckRenderTree` | `parseDeckRenderTree` | What the catalog renderer and composition grammar check, node by node |
| Structured `slides[]` | `toDeckGrammar` | `parseDeckGrammar` | Interchange: one `layout-deck` node with a typed `slides` prop |
| Legacy cards | — | `projectLegacyDeck` | One-way migration of `layout-deck` with `layout-card` children (the g16 shape) |

`DECK_ROOT_CATALOG_ID` (`layout-deck`) and `DECK_SLIDE_CATALOG_ID`
(`deck-slide`) come from the catalog's `DECK_GRAMMAR_IDS`.

### Render tree

`toDeckRenderTree(deck)` returns a `DeckRenderTreeNode`: `layout-deck` with
one `deck-slide` child per slide, and each slide's blocks as block-family
children. `parseDeckRenderTree(tree)` decodes it back into a validated deck.
It rejects a root that also carries `slides[]`, and children that are not
`deck-slide`. Errors point at tree paths, such as `children[0].props.master`.

`renderCatalogTree` validates every node at the untrusted tier, including
slide notes, transitions and masters against the `deck-slide` manifest.
`checkCompositionGrammar` with the default roles then checks the outline: the
deck title is the h1, each slide title one rank below it, and slide headings
below their slide. The catalog renderer is stricter than `parseDeck` in one
place: it refuses HTML-looking strings (`html-string`) in any prop, including
titles and notes.

### Structured `slides[]`

`toDeckGrammar(deck)` returns a `DeckGrammar`: deck metadata, masters,
settings and `slides[]` (`DeckGrammarSlide`, with block nodes
`DeckGrammarBlockNode`). `parseDeckGrammar(value)` validates it and rejects a
root that also has `children`. The catalog renderer does not look inside
`slides[]`, so this form gets no per-node renderer validation.

### Legacy cards

`projectLegacyDeck(value)` projects each `layout-card` child to a slide
(`slide-1`, `slide-2`, …), validates its block or supported `charts-*`
children, and returns a `DeckParseResult`. New output should use the render
tree.

## Validating agent decks

`validateDeckDraft(input, options)` takes a tree or JSON text and never
throws. It runs the catalog's `validateDraft` at the host's tier (`untrusted`
by default) with:

- deep block schemas (`safeParseBlock`);
- `layout-deck` as the only allowed root;
- the catalog checks for ids, props, sinks, limits and grammar.

It then applies the deck rules the catalog cannot see, through
`parseDeckRenderTree`: slide id syntax and uniqueness, declared masters,
theme references, settings and the [reveal step
rules](model.md#reveal-steps-fragments) (no `step` or `reveal` on nested
blocks, at most 32 steps per slide). A `layout-card` deck still projects through
`projectLegacyDeck`, with a `deck-legacy-cards` warning.
`ValidateDeckDraftOptions` are the catalog's draft options plus
`reducedMotion`.

The `DeckDraftResult` carries:

- `ok` and `status`;
- `draft`, the catalog result;
- `diagnostics` (`DeckDraftDiagnostic`): catalog findings, then deck findings
  (`DeckDraftIssue`, `check: 'deck'`);
- the validated `deck`, or `null`;
- `slides` (`ResolvedDeckSlide`): per slide, the resolved master layout, the
  `slots` its blocks fill in reading order
  ([slot masters](model.md#composition-slots-and-media-regions)), the
  transition (every slide cuts with `reducedMotion: true`), the effective
  theme reference, and `stepCount`, the slide's last reveal step
  (`slideStepCount`: list items and code highlights count one step each).

Hostile reveal shapes fail closed with diagnostics and never throw: a
negative, fractional, string or out-of-range `step` and an unknown or
non-string `reveal` fail the block schema; a nested `step` or `reveal` and a
slide past 32 steps fail the deck rules. `tests/decks.test.ts`
pins them.

The golden decks in [`tests/golden/`](../tests/golden) pin this end to end:

- `deck-notes-and-steps` and `deck-theme-and-masters` validate at the
  untrusted tier and resolve as pinned;
- `deck-legacy-cards` keeps the card shape working;
- `deck-hostile` holds 16 inputs that must fail closed, each pinned to its
  exact diagnostics: bad, duplicate and missing slide ids, unknown and
  undeclared masters, an unknown transition, a bad theme reference, foreign
  children, a malformed block, a block-family mismatch, a `javascript:` image
  source, HTML in notes, `class`/`style` props, both encodings at once, a
  non-deck root and an empty deck.

## Model v2 deck trees

Spec `0.4.0` (in the repository only; npm's `@texuli/spec` still carries
spec 0.2.0) extends the `layout-deck` and `deck-slide` manifests with
optional model v2 props: the 9:16 aspect, the `slide`, `zoom` and `morph`
transitions, motion, navigation, outline, the slide `layout` and its
`props`, `background`, step labels and component slides. A model v1 tree is
still a valid `0.4.0` tree.

An agent's v2 deck tree is validated in two steps, neither of which is this
subpath:

1. `validateDeckDraft` from `@texuli/catalog/validate` (a different function
   from the v1 `validateDeckDraft` above, with the same name) runs the
   catalog's draft validation with `layout-deck` as the only root and maps
   the tree to a plain `formatVersion: 2` object. It never throws.
2. `migrateDeck` and `parseDeck` from `@texuli/deck/model` validate the
   model rules. The catalog does not depend on `@texuli/deck`, so a host
   chains them, or passes them as the catalog's `loadDeck` option.

```ts
import { validateDeckDraft } from '@texuli/catalog/validate';
import { migrateDeck, parseDeck } from '@texuli/deck/model';

const draft = validateDeckDraft(agentJson, { catalog }); // untrusted tier by default
if (draft.ok && draft.deck) {
  const result = parseDeck(migrateDeck(draft.deck).deck);
  // result.ok: present result.deck with DeckStage
}
```

`DeckStage` also takes a grammar tree directly: it migrates it
(`texuli-grammar` in `detectDeckShape`) and validates it before it paints.
The catalog side is documented in
[validate.md](../../catalog/docs/validate.md#deck-drafts-model-v2).

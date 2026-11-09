## Model v2

The canonical document is data: `formatVersion`, `meta`, `style`, optional `navigation` and `outline`, and `slides`. Everything in `@texuli/deck/model` is a pure function. Untrusted input goes through `loadUntrustedDeck`, which bounds bytes, depth and nodes, migrates earlier shapes, then validates.

```ts
import { loadUntrustedDeck, migrateDeck, parseDeck } from '@texuli/deck/model';
```

A slide names a `layout` and `props` for that layout, or `blocks` on the `free` layout. Fragments and steps live on the model; the stage only paints them.

## Markdown dialect

`parseDeckMarkdown` from `@texuli/deck/markdown` reads the same model. `---` separates slides. `Note:` starts speaker notes. Pass `validateDeckBlock` from the stage so block bodies use the stage's checks. Raw HTML, iframes, `class`, `style` and event handlers are refused. The dialect is inspired by reveal.js Markdown and is not compatible with it.

```svelte
<script lang="ts">
  import { parseDeckMarkdown } from '@texuli/deck/markdown';
  import { DeckStage, validateDeckBlock } from '@texuli/slides/stage';

  const result = parseDeckMarkdown(source, { validateBlock: validateDeckBlock });
</script>
```

## Engine

`createDeckController` in `@texuli/deck/engine` is the framework-free runtime: navigation, hash routes, the controls registry, canvas fit, auto-slide and the presenter protocol. It does not touch `window` or `document`.

```ts
import { createDeckController } from '@texuli/deck/engine';

const controller = createDeckController(deck);
controller.next();
controller.goTo('closing');
controller.getState();
```

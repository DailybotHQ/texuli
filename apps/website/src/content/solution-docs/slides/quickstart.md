## Install

Svelte 5 (`^5.57.2`) is a peer of `@texuli/slides`. `@texuli/deck` has no runtime or peer dependencies.

```bash
npm install @texuli/slides @texuli/deck svelte
```

Import the stylesheet once:

```ts
import '@texuli/slides/styles.css';
```

## A JSON deck on the stage

`DeckStage` validates before it paints and shows diagnostics instead of a broken slide. The default trust tier is `untrusted`.

```svelte
<script lang="ts">
  import '@texuli/slides/styles.css';
  import { DeckStage } from '@texuli/slides/stage';

  const deck = {
    formatVersion: 2,
    meta: { title: 'Quarterly update', locale: 'en' },
    style: { theme: 'ocean', transition: 'slide' },
    slides: [
      {
        id: 'opening',
        layout: 'title-hero',
        props: { title: 'Quarterly update', subtitle: 'Fictional numbers for Northwind' },
      },
    ],
  };
</script>

<DeckStage {deck} />
```

## Parse first

`parseDeck` never throws. It reports every issue at once, each with a code, a JSON path and a fix.

```ts
import { parseDeck } from '@texuli/deck/model';
import { formatDiagnostic } from '@texuli/deck/schema';

const result = parseDeck({
  formatVersion: 2,
  meta: { title: 'Quarterly review', locale: 'en' },
  slides: [{ id: 'opening', layout: 'title-hero', props: { title: 'Quarterly review' } }],
});

if (result.ok) {
  console.log(result.deck.slides.length);
} else {
  for (const issue of result.issues) console.log(formatDiagnostic(issue));
}
```

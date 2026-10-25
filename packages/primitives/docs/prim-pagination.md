# Pagination

`@texuli/primitives/pagination` exports an owned, headless Svelte 5 pagination
control. `Pagination.Root` supplies a named navigation landmark, a 1-based
bindable page, page count, a compact page-token model and state to its parts.

```svelte
<script lang="ts">
import { Pagination } from '@texuli/primitives/pagination';

let page = $state(1);
</script>

<Pagination.Root bind:page total={47} pageSize={10} label="Invoice pages">
  {#snippet children({ pages })}
    <ul>
      <li><Pagination.PreviousButton>Previous</Pagination.PreviousButton></li>
      {#each pages as token (token)}
        <li>
          {#if typeof token === 'number'}
            <Pagination.Page page={token}>{token}</Pagination.Page>
          {:else}
            <Pagination.Ellipsis />
          {/if}
        </li>
      {/each}
      <li><Pagination.NextButton>Next</Pagination.NextButton></li>
    </ul>
  {/snippet}
</Pagination.Root>
```

Pass `pageCount` instead of `total` to supply a known number of pages; `pageSize`
defaults to 10. `siblings` and `boundaries` default to 1. Short gaps are shown
as page numbers, larger gaps as ellipses. Pass `previousLabel`, `nextLabel` and
`getPageLabel` to localize built-in labels; custom snippets receive these values
too. The root also renders a basic control when no `children` snippet is
supplied. Page and navigation buttons are native buttons, so Enter and Space
work without a custom keyboard model. Root, page and navigation button parts
accept `child` snippets for element composition; page and navigation buttons
also accept `children` snippets for their content. The `getPageTokens` and
`getPageCount` helpers are exported for
consumers that need the same model outside the component.

`disabled` on the root disables its navigation controls. A selected page uses
`aria-current="page"` and `data-state="active"`; unavailable navigation buttons
use the native `disabled` attribute and `data-state="disabled"`. The package
does not impose styles; consumers own spacing, focus rings and visual states.

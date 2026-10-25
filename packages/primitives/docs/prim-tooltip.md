# Tooltip primitive

`@texuli/primitives/tooltip` exports a headless compound Tooltip API. Its provider groups tooltips so the first pointer-open waits for the configured delay and nearby tooltips skip that delay briefly. Focus opens immediately, touch opens on a long press, and Escape dismisses the topmost tooltip through the shared overlay engine.

```svelte
<script lang="ts">
  import { Tooltip } from '@texuli/primitives/tooltip';
</script>

<Tooltip.Provider delayDuration={300} skipDelayDuration={300}>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <button {...props}>Save draft</button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="top" align="center" sideOffset={6}>
      Saves without publishing
    </Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
```

`Tooltip.Root` supports `bind:open`, `disabled`, a root-level `delayDuration` override, and `onOpenChange(open)`. Without a provider, each root gets its own delay group. `Tooltip.Trigger` renders a button by default; use its `child` snippet to compose props onto another focusable element. The primitive retains its trigger id, `data-state`, disabled state and `aria-describedby` association when composing child props. `Tooltip.Content` provides `role="tooltip"`, defaults to the top side, and accepts `top`, `right`, `bottom` or `left`, `start`, `center` or `end`, an offset, a class and a content snippet.

The tooltip content is non-modal and does not dismiss on outside pointer or focus. Positioning and Escape ownership use the shared overlay engine; no trigger focus trap or scroll lock is enabled.

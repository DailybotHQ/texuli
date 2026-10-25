# Collapsible

`@texuli/primitives/collapsible` provides a headless disclosure with animated
height and retained content presence. The trigger is a native button. Its `aria-expanded`
and `aria-controls` values stay connected to the content id, and closed content
is inert and hidden from assistive technology. The content node remains in the
DOM, so the trigger's `aria-controls` target continues to resolve while closed.

```svelte
<script lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from '@texuli/primitives/collapsible';

let open = $state(false);
</script>

<CollapsibleRoot bind:open>
  <CollapsibleTrigger>Shipping details</CollapsibleTrigger>
  <CollapsibleContent>
    <p>Orders ship within two fictional days.</p>
  </CollapsibleContent>
</CollapsibleRoot>
```

`defaultOpen` initializes uncontrolled state; `open` with `bind:open` keeps the
parent synchronized. `onOpenChange` reports changes. Set `disabled` on the root
or trigger to prevent changes. The closed panel remains inert and hidden from
assistive technology.

The trigger accepts a `child` snippet for composition. It receives a `props`
object containing the button behavior and accessible state; spread those props
onto the snippet's button root. The helper composes event handlers and classes
while keeping primitive-owned state attributes authoritative.

The content animates its block size and opacity, honors
`prefers-reduced-motion`, and uses `data-state="open|closed"` for styling.
The component adds no visual theme or colors of its own.

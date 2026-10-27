# ScrollArea

**Package:** `texuli`  
**Export:** `texuli/scroll-area`  
**Tests:** `packages/texuli/tests/display.test.ts`

`ScrollArea` styles the native, focusable viewport from `@texuli/primitives/scroll-area`.
The native viewport remains the source of scrolling for keyboard, touch, wheel and assistive
technology. The optional scrollbar is decorative and hidden from assistive technology.

```svelte
<script lang="ts">
  import { ScrollArea } from 'texuli/scroll-area';
</script>

<ScrollArea label="Recent activity" size="md" type="auto">
  <!-- long content -->
</ScrollArea>
```

`label` names the scroll region. `size` accepts `sm`, `md` or `lg` and sets the maximum block
size. `type` accepts `hover`, `scroll`, `auto` or `always`; native scrolling works for every type.
The root accepts `dir="rtl"` and forwards standard div attributes. Styles use `--tx-*` tokens,
logical properties and the `tx.components` cascade layer.

The registered `texuli-scroll-area` example shows the default, size variants, scrollbar visibility
states including content without overflow, RTL content and a dark surface. The unit suite verifies
the public label, native viewport, variant composition and decorative scrollbar semantics.

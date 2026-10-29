# Tooltip

**Package:** `texuli`  
**Import:** `import { Tooltip } from 'texuli/tooltip'`  
**Tests:** `packages/texuli/tests/overlays.test.ts`  
**Example:** `texuli-tooltip`

## Contract

Styled tooltip on `@texuli/primitives/tooltip` and the token contract:

| Prop | Role |
| --- | --- |
| `content` | String or snippet body |
| `children` | Trigger snippet — spread `{ props }` onto a focusable control |
| `shortcut` | Optional string or list of keys (rendered with `Kbd`) |
| `side` / `align` / `sideOffset` | Placement (default top / center / 6) |
| `delayDuration` | Open delay ms (default 300) |
| `disabled` | Blocks open |
| `open` | Bindable controlled open state |
| `class` | Extra classes on the content |

### Behavior

- Hover / focus opens; Escape closes (primitive dismiss)
- Touch long-press open (primitive)
- Local `Provider` — no app shell required
- Styles in `@layer tx.components` with inverted surface colors and forced-colors borders
- Shortcut chips are decorative (`aria-hidden`); the accessible name is the text content via `aria-describedby` on the trigger

### Example

```svelte
<Tooltip content="Save draft" shortcut={['⌘', 'S']} side="top">
  {#snippet children({ props })}
    <button type="button" {...props}>Save</button>
  {/snippet}
</Tooltip>
```

## Motion

`motion`: a quick scale in and fade out through `@texuli/core/motion`
([ui-motion](ui-motion.md)), replacing the former CSS keyframes. Instant under
reduced motion.

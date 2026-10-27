# Separator, AspectRatio and VisuallyHidden

**Package:** `texuli`  
**Import:** `import { Separator, AspectRatio, VisuallyHidden } from 'texuli/separator-aspect'`  
**Tests:** `packages/texuli/tests/display.test.ts`  
**Example:** `texuli-separator-aspect`

## Contract

Layout utilities on the token contract:

| Component | Role |
| --- | --- |
| `Separator` | Styled line on `@texuli/primitives/separator` |
| `AspectRatio` | Box that keeps a fixed aspect ratio for media / previews |
| `VisuallyHidden` | Screen-reader-only text (clipped, still in the a11y tree) |

### Separator

| Prop | Role |
| --- | --- |
| `orientation` | `horizontal` (default) \| `vertical` |
| `decorative` | Default `true` (role `none`). `false` → semantic `role="separator"` |
| `variant` | `default` \| `subtle` \| `strong` |

### AspectRatio

| Prop | Role |
| --- | --- |
| `ratio` | Named: `1/1`, `16/9`, `4/3`, `3/2`, `21/9`, `9/16` (default `16/9`) |
| `custom` | Free-form CSS value via `--tx-aspect-ratio` (e.g. `"5 / 4"`) |

Children sit in an absolutely positioned content layer; images/videos cover the box.

### VisuallyHidden

| Prop | Role |
| --- | --- |
| `as` | `span` (default) \| `div` \| `p` \| `label` |

## Usage

```svelte
<script lang="ts">
  import { AspectRatio, Separator, VisuallyHidden } from 'texuli/separator-aspect';
</script>

<section>
  <h2>Notes <VisuallyHidden>(Harbor Notes, fictional)</VisuallyHidden></h2>
  <Separator />
  <AspectRatio ratio="16/9">
    <img src="/harbor-cover.example.webp" alt="" />
  </AspectRatio>
</section>
```

Styles live in `@layer tx.components`. Logical properties only. Forced-colors: separator uses `ButtonText`.

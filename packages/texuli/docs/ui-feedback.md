# Skeleton, Spinner and Progress

**Package:** `texuli` · **Import:** `texuli/feedback`

Loading feedback on the token contract. Progress is built on the owned
`@texuli/primitives/progress` root.

| Export | Role |
| --- | --- |
| `Skeleton` | Decorative pulse placeholder (`aria-hidden`) |
| `Spinner` | Spinning indicator; optional live `label` (`role="status"`) |
| `Progress` | Linear or circular progressbar with label, tones and sizes |

## Skeleton

```svelte
<script lang="ts">
  import { Skeleton } from 'texuli/feedback';
</script>

<Skeleton size="md" />
<Skeleton circle size="lg" />
```

- `size`: `sm` | `md` | `lg`
- `circle`: round avatar-style block
- Pulse animation respects `prefers-reduced-motion`

## Spinner

```svelte
<Spinner label="Saving notes" tone="primary" size="md" />
```

Without `label` the spinner is decorative. With `label` it is a polite status region.

## Progress

```svelte
<script lang="ts">
  import { Progress } from 'texuli/feedback';
  let value = $state<number | null>(40);
</script>

<Progress label="Upload" {value} showValue tone="success" />
<Progress shape="circular" value={72} showValue ariaLabel="Disk used" />
<Progress label="Working" value={null} />
```

| Prop | Default | Notes |
| --- | --- | --- |
| `value` | `0` | `null` = indeterminate |
| `max` / `min` | `100` / `0` | Range for the primitive |
| `shape` | `linear` | or `circular` |
| `tone` | `primary` | primary · success · warning · destructive · info · neutral |
| `size` | `md` | sm · md · lg |
| `showValue` | `false` | percent text (or loading word when indeterminate + circular) |
| `loadingLabel` | `"Loading"` | `aria-valuetext` while indeterminate |

Indicator width / arc use CSS custom properties (no static `style=` chrome). Motion stops under reduced motion.

## Styles

`@layer tx.components` in `feedback.css`. Logical properties. Forced-colors borders on tracks and skeletons.

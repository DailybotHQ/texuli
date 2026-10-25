# Badge, Tag and Chip

**Package:** `texuli` · **Import:** `texuli/badge` or `texuli`

Status labels and compact selectors on the token contract (`--tx-*`).

| Component | Role |
| --- | --- |
| `Badge` | Non-interactive status / count pill |
| `Tag` | Label with optional remove control (pending-aware) |
| `Chip` | Toggle button (`aria-pressed`) for filters |

## Variants

`default` · `secondary` · `outline` · `success` · `warning` · `destructive` · `info` · `neutral`

Filled variants use token **pairs** (e.g. `--tx-success` / `--tx-success-foreground`) so small text meets WCAG AA. Tone is never the only signal: Tag and Chip always show a text label.

## Usage

```svelte
<script lang="ts">
  import { Badge, Tag, Chip } from 'texuli/badge';
</script>

<Badge variant="success">Live</Badge>
<Badge variant="info" label="Shipped" />
<Tag label="Design" onRemove={() => {}} />
<Chip label="Unread" selected={true} />
```

Badge also takes a `label` (optional string) that gives it plain text without a snippet. It is
rendered as escaped text (never markup), and a non-empty `label` replaces
`children` when both are given; an empty or missing `label` keeps `children`.
Tested in `packages/texuli/tests/label-prop.test.ts`.

Styles live in `@layer tx.components`. Import `@texuli/tokens/base.css` once at the app root. Consumer classes compose via `class=`; layers decide conflicts (no tailwind-merge).

## A11y

- Badge is a `span` (decorative status next to named content).
- Tag remove is a real `button` with `aria-label` including the tag word.
- Chip is a `button` with `aria-pressed` when used as a toggle.
- Forced-colors: border falls back to `ButtonText`.

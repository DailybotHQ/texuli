# EmptyState and ErrorState

**Package:** `texuli` · **Import:** `texuli/empty`

Feedback surfaces for empty lists and failed loads.

| Component | Role |
| --- | --- |
| `EmptyState` | Title, optional description, illustration slot, actions |
| `ErrorState` | `role="alert"`, title, message, retry (pending-aware Button) |

## EmptyState

```svelte
<script lang="ts">
  import { EmptyState } from 'texuli/empty';
  import { Button } from 'texuli/button';
</script>

<EmptyState title="No notes yet" description="Create a note to get started." size="md">
  {#snippet action()}
    <Button>Add note</Button>
  {/snippet}
</EmptyState>
```

- `size`: `sm` | `md` (default)
- `illustration` snippet replaces the default inbox glyph (decorative, `aria-hidden`)

## ErrorState

```svelte
<ErrorState
  title="Could not load"
  message="The network is offline (simulated)."
  onRetry={() => reload()}
  retryLabel="Try again"
/>
```

Retry uses `Button` with automatic pending when `onRetry` returns a promise.

## Styles

`@layer tx.components` in `empty.css`. Token colors for muted icon wells and destructive error chrome. Forced-colors borders on icon wells.

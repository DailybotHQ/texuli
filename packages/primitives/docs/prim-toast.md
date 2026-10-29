# Toast region

**Package:** `@texuli/primitives`  
**Import:** `import { Toast, createToastManager } from '@texuli/primitives/toast'`  
**Tests:** `packages/primitives/tests/models.test.ts`, `packages/primitives/tests/overlays.test.ts`  
**Behavior:** `tests/behavior/scenarios/toast.spec.ts`

## Contract

Headless toast **region** with a priority queue, following WAI-ARIA practices and R16:

| Part | Role |
| --- | --- |
| `Toast.Provider` | Queue context, F6 focus entry, pause/resume, live announce |
| `Toast.Viewport` | `role="region"`, `popover="manual"`, inert exemption (R16) |
| `Toast.Root` | One toast item; auto-dismiss timer; swipe-to-dismiss |
| `Toast.Title` / `Description` | Content slots |
| `Toast.Action` / `Close` | Focusable actions (Action dismisses after click) |
| `Toast.Toaster` | Convenience Provider + Viewport + list |
| `createToastManager` | Framework-free publish / dismiss queue |

### Behavior

- **Queue:** `publish` / `dismiss` / `dismissAll`; priority `high` > `normal` > `low`
- **Pause:** hover or focus inside the viewport pauses timers; leave resumes
- **Swipe:** horizontal drag past 64px dismisses the item
- **F6:** focuses the first actionable control in the viewport (R16 entry)
- **R16:** viewport registers with `getInertRegistry().exempt` and uses manual popover top-layer when available
- **Announce:** new toasts go through `@texuli/core/announcer` (polite background / assertive foreground)

### Example

```svelte
<script>
  import { Toast, createToastManager } from '@texuli/primitives/toast';
  const manager = createToastManager();
</script>

<Toast.Provider {manager} label="Notifications">
  <button type="button" onclick={() => manager.publish({ title: 'Saved', description: 'Draft stored.' })}>
    Save
  </button>
  <Toast.Viewport>
    {#each manager.list() as toast (toast.id)}
      <Toast.Root {toast}>
        <Toast.Title />
        <Toast.Description />
        <Toast.Action>Undo</Toast.Action>
        <Toast.Close />
      </Toast.Root>
    {/each}
  </Toast.Viewport>
</Toast.Provider>
```

For reactive lists, subscribe to `manager.subscribe` or use `Toast.Toaster` with a `toast` snippet.

## Top layer under modals and ordering (FIX-toaster-viewport)

- When another popover opens (for example a modal's overlay), `Toast.Viewport`
  hides and re-shows itself so it returns to the top of the top layer. That
  keeps toasts clickable as well as keyboard-reachable (R16). Other toast
  regions are ignored, so two toasters do not loop.
- **`active`** (default `true`): whether a top-layer viewport is shown. Pass
  `false` while there is nothing to show; the styled Toaster passes
  `rendered.length > 0`, so an empty region never sits in the top layer.
- **`mode`** (`'top-layer'` default or `'contained'`) and **`container`**:
  a contained viewport has no `popover` attribute, never enters the top
  layer, and is moved into `container`, which becomes its containing block.
- Toasts published in the same millisecond list newest first, deterministically.
- `Toast.Toaster` forwards extra attributes (`class`, `data-*`) to its
  viewport, so a consumer can style or place it (for example
  `class="tx-toaster__viewport" data-position="bottom-end"`).

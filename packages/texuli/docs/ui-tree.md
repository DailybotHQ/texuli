# TreeView

`TreeView` styles the owned `@texuli/primitives/tree` tree with Texuli tokens,
folder and file glyphs, and a visual checkbox for multi-selection. Its public
subpath is `texuli/tree`.

```svelte
<script lang="ts">
  import { TreeView, type TreeNode } from 'texuli/tree';

  const pages: readonly TreeNode[] = [
    { id: 'guides', label: 'Guides', children: [{ id: 'setup', label: 'Setup' }] },
    { id: 'release-notes', label: 'Release notes' },
  ];
  let expanded = $state(['guides']);
  let selected = $state(['setup']);
</script>

<TreeView
  items={pages}
  bind:expanded
  bind:selected
  selectionMode="multiple"
  label="Product documentation"
/>
```

## Behavior and accessibility

- `items` follows the `TreeNode` contract from `@texuli/primitives/tree`.
- The root has `role="tree"`; rows expose their hierarchy, expansion,
  selection and disabled state. The primitive provides arrow, Home/End,
  typeahead and selection keyboard behavior.
- `expanded` and `selected` are bindable. Multiple selection adds decorative
  checkboxes while the tree item's `aria-selected` remains the accessible
  selection state.
- `variant` is `default` or `bordered`; `density` is `compact`, `default` or
  `comfortable`. Consumer classes are appended after the component classes.
- The optional `item` snippet receives a `VisibleTreeNode` and replaces the
  default row label; the folder/file and selection indicators remain present.
- Indentation uses a numeric tree depth, logical CSS properties, system color
  fallbacks, forced-colors styling and reduced-motion-aware transitions.

The registered `texuli-tree` example covers each variant and density, nested
and disabled rows, selected and expanded states, RTL, and dark mode. Its
Chromium, WebKit and Pixel 7 browser checks pass axe in light and dark. The
committed visual baselines cover light and dark on desktop Chromium and Pixel
7. Checks:

```sh
pnpm vitest run packages/texuli/tests/display.test.ts packages/texuli/tests/contracts.test.ts
TEXULI_E2E_PORT=4850 pnpm exec playwright test tests/e2e/a11y-display.spec.ts --project chromium
TEXULI_E2E_PORT=4850 pnpm visual:update -g texuli-tree
pnpm size --filter texuli/tree
```

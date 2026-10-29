<script lang="ts">
import { ContentLayout, type TocEntry, type TocItem } from '../../src/layouts/content/index.ts';

let {
  toc,
  initial = '',
  onChange,
}: {
  toc?: readonly TocEntry[];
  initial?: string;
  onChange?: (id: string, item: TocItem | undefined) => void;
} = $props();
// svelte-ignore state_referenced_locally
let activeId = $state(initial);
</script>

<ContentLayout kind="docs" {toc} bind:activeId onActiveHeadingChange={onChange}>
  <h2 id="one">One</h2>
  <p>First.</p>
  <h2 id="two">Two</h2>
  <p>Second.</p>
  <h3 id="three">Three</h3>
  <p>Third.</p>
</ContentLayout>
<output data-testid="active">{activeId}</output>

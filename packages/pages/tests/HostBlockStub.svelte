<script lang="ts">
// A host block renderer for the G111 tests: a form the host owns, with the
// node's text interpolated (never as markup).
import type { PagesHostNode } from '../src/shared/block-host.ts';

let { node }: { node: PagesHostNode } = $props();
const title = $derived(
  node.type === 'block' && typeof node.props.title === 'string' ? node.props.title : node.id
);
</script>

<form class="host-form" data-host-node={node.id} aria-label={`Host ${title}`}>
  <p>{title}</p>
  <input type="email" aria-label="Email" />
</form>

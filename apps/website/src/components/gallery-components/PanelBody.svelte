<script lang="ts">
/**
 * The open "Props and code" section of a gallery card: the props panel and
 * the code sample. Loaded on first open, so closed cards cost no JavaScript
 * for it.
 */
import CodeSample from '../live/CodeSample.svelte';
import PropsPanel from '../live/PropsPanel.svelte';
import type { LivePropSchema } from '../live/props-state.ts';

type Props = {
  schema: readonly LivePropSchema[];
  values: Record<string, unknown>;
  code: string;
  onChange: (name: string, value: unknown) => void;
};

let { schema, values, code, onChange }: Props = $props();
</script>

<PropsPanel {schema} {values} {onChange} />
<CodeSample {code} />

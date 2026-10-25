<script lang="ts">
import type { FieldIssue } from '../core/schema/primitives.ts';
import BoardDiagram from './BoardDiagram.svelte';
import FlowDiagram from './FlowDiagram.svelte';
import { parseDiagram } from './schema.ts';
import TerminalDiagram from './TerminalDiagram.svelte';
import TreeDiagram from './TreeDiagram.svelte';
import './diagram.css';

interface Props {
  /** Untrusted block data; validated before anything renders. */
  block: unknown;
  oninvalid?: (issues: FieldIssue[]) => void;
}

let { block, oninvalid }: Props = $props();

const parsed = $derived(parseDiagram(block));

$effect(() => {
  if (!parsed.success) {
    oninvalid?.(
      parsed.issues.map((issue) => ({
        path: [],
        message: `${issue.jsonPath}: ${issue.message}`,
      }))
    );
  }
});
</script>

{#if !parsed.success}
  <p class="tx-diagram-fallback" role="note" data-tx-diagram-invalid>
    This diagram could not be shown. The data failed validation.
  </p>
{:else if parsed.data.type === 'flow'}
  <FlowDiagram block={parsed.data} />
{:else if parsed.data.type === 'tree'}
  <TreeDiagram block={parsed.data} />
{:else if parsed.data.type === 'board'}
  <BoardDiagram block={parsed.data} />
{:else if parsed.data.type === 'terminal'}
  <TerminalDiagram block={parsed.data} />
{:else}
  <p class="tx-diagram-fallback" role="note">This block renderer is not available yet.</p>
{/if}

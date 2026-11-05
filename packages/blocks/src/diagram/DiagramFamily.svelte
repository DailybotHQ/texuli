<script lang="ts">
import { localizeLabels } from '@texuli/core/i18n';
import { useMessages } from 'texuli/i18n';
import type { FieldIssue } from '../core/schema/primitives.ts';
import BoardDiagram from './BoardDiagram.svelte';
import FlowDiagram from './FlowDiagram.svelte';
import { DEFAULT_DIAGRAM_BLOCK_LABELS } from './labels.ts';
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
const msg = useMessages();
// The diagram's own words follow the label dictionary in context (ids
// `blocks.diagram.<key>`); the catalog manifest has no `labels` prop.
const text = $derived(localizeLabels(msg, 'blocks.diagram', DEFAULT_DIAGRAM_BLOCK_LABELS));

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
    {text.invalid}
  </p>
{:else if parsed.data.type === 'flow'}
  <FlowDiagram block={parsed.data} labels={text} />
{:else if parsed.data.type === 'tree'}
  <TreeDiagram block={parsed.data} labels={text} />
{:else if parsed.data.type === 'board'}
  <BoardDiagram block={parsed.data} labels={text} />
{:else if parsed.data.type === 'terminal'}
  <TerminalDiagram block={parsed.data} labels={text} />
{:else}
  <p class="tx-diagram-fallback" role="note">{text.unsupported}</p>
{/if}

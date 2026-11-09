<script lang="ts">
import { countLabel, DEFAULT_DIAGRAM_BLOCK_LABELS, type DiagramBlockLabels } from './labels.ts';
import type { TerminalDiagram as TerminalDiagramData } from './schema.ts';
import './diagram.css';

/**
 * Terminal session as text: prompts, output and comments in order.
 * `$` is decoration; assistive tech hears "Command:".
 */
let {
  block,
  labels = DEFAULT_DIAGRAM_BLOCK_LABELS,
}: { block: TerminalDiagramData; labels?: DiagramBlockLabels } = $props();

const commands = $derived(block.lines.filter((line) => line.kind === 'prompt').length);
</script>

<figure class="tx-diagram" data-tx-diagram="terminal" data-tx-component="blocks-diagram">
  <div class="tx-diagram-terminal">
    <div class="tx-diagram-terminal__chrome" aria-hidden="true">
      <span class="tx-diagram-terminal__dot"></span>
      <span class="tx-diagram-terminal__dot"></span>
      <span class="tx-diagram-terminal__dot"></span>
    </div>
    <ol
      class="tx-diagram-terminal__lines"
      aria-label={countLabel(labels.terminalSummaryOne, labels.terminalSummaryOther, commands)}
    >
      {#each block.lines as line, index (index)}
        <li class="tx-diagram-terminal__line" data-kind={line.kind}>
          {#if line.kind === 'prompt'}
            <span class="tx-diagram-terminal__prompt-mark" aria-hidden="true">{'$ '}</span>
            <span class="tx-diagram-sr">{`${labels.terminalCommand} `}</span>
            <span class="tx-diagram-terminal__prompt-text">{line.text}</span>
          {:else}
            {line.text}
          {/if}
        </li>
      {/each}
    </ol>
  </div>
</figure>

<script lang="ts">
/**
 * Server-rendered preview of the report-on-demand golden: its semantic outline, read from
 * the checked-in conformance trace (the roles, names and heading levels both the web player
 * and Compose Desktop must produce). The live web player loads inside the island on request,
 * so this page does not hoist the stylesheet of every painter the player can load.
 */
import { NATIVE_DEMO_TRACE } from './native-demo-data.ts';

type TraceNode = {
  id?: string;
  role?: string;
  name?: string;
  level?: number;
  children?: readonly TraceNode[];
};

const root = (NATIVE_DEMO_TRACE.trace as readonly TraceNode[])[0];
const items = root?.children ?? [];
</script>

<div class="native-demo-preview" data-tx-native-demo-preview="report-on-demand">
  {#if root}
    <p class="native-demo-preview__title">
      <span class="native-demo-preview__role">{root.role}</span>
      <strong>{root.name}</strong>
    </p>
    <ol class="native-demo-preview__outline" aria-label="Semantic outline of the report">
      {#each items as item, index (index)}
        <li data-component-id={item.id}>
          <span class="native-demo-preview__role">
            {item.role}{item.level ? ` ${item.level}` : ''}
          </span>
          {#if item.name}<span>{item.name}</span>{/if}
          <code>{item.id}</code>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .native-demo-preview {
    display: grid;
    gap: 0.6rem;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  .native-demo-preview__title {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
    margin: 0;
  }
  .native-demo-preview__outline {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .native-demo-preview__outline li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.6rem;
    align-items: baseline;
    padding-block: 0.35rem;
    border-block-end: 1px solid color-mix(in oklab, var(--tx-border, GrayText) 60%, transparent);
  }
  .native-demo-preview__role {
    min-inline-size: 5.5rem;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .native-demo-preview code {
    margin-inline-start: auto;
    color: var(--tx-muted-foreground, GrayText);
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.78rem;
  }
</style>

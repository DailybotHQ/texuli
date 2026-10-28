<script lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from 'texuli/card';
import { Accordion, Tabs } from 'texuli/tabs-accordion';
import BlockIcon from '../icons/BlockIcon.svelte';
import { checkStructureBlock } from './check.ts';
import type { StructureBlockViewProps } from './family.ts';
import { resolveStructureBlockLabels } from './labels.ts';
import NestedBlocks from './NestedBlocks.svelte';
import SafeBody from './SafeBody.svelte';
import './structure.css';

/**
 * Structure family renderer: columns, grid, tabs, accordion, cards, divider
 * and cta. Untrusted data is validated before anything paints.
 */
let { block, labels, resolveIcon, resolveAvatar, oninvalid }: StructureBlockViewProps = $props();

const check = $derived(checkStructureBlock(block));
const text = $derived(resolveStructureBlockLabels(labels));

$effect(() => {
  if (!check.ok) oninvalid?.(check.issues);
});

function colsAttr(n: number | undefined, fallback: number): string {
  return String(n ?? fallback);
}
</script>

{#if !check.ok}
  <p class="tx-block-invalid" role="note" data-tx-block="invalid">{text.invalid}</p>
{:else}
  {@const b = check.block}
  {#if b.type === 'columns'}
    <div
      class="tx-structure-columns"
      data-tx-block="columns"
      data-cols={colsAttr(b.columns.length, 2)}
      data-tone={b.tone}
      role="group"
      aria-label={text.columnsLabel}
    >
      {#each b.columns as column, c (c)}
        <div class="tx-structure-column" data-column={c}>
          <NestedBlocks blocks={column} labels={text} {resolveIcon} {resolveAvatar} />
        </div>
      {/each}
    </div>
  {:else if b.type === 'grid'}
    <section
      class="tx-block"
      data-tx-block="grid"
      data-tone={b.tone}
      aria-label={b.title ?? text.gridLabel}
    >
      {#if b.title}
        <h3 class="tx-structure-section-title">{b.title}</h3>
      {/if}
      <div class="tx-structure-grid" data-cols={colsAttr(b.columns, 3)}>
        {#each b.cells as cell, i (i)}
          <article class="tx-structure-cell" data-tone={cell.tone}>
            {#if cell.title}
              <h4 class="tx-structure-cell-title">{cell.title}</h4>
            {/if}
            {#if cell.body}
              <div class="tx-structure-cell-body"><SafeBody text={cell.body} /></div>
            {/if}
          </article>
        {/each}
      </div>
    </section>
  {:else if b.type === 'tabs'}
    {@const items = b.panels.map((panel) => ({ value: panel.id, label: panel.label }))}
    {@const initial = b.defaultPanel ?? b.panels[0]?.id ?? ''}
    <div class="tx-structure-tabs" data-tx-block="tabs" data-tone={b.tone} data-block-id={b.id}>
      <Tabs items={items} value={initial} label={b.label} variant="line">
        {#snippet content(item)}
          {@const panel = b.panels.find((p) => p.id === item.value)}
          {#if panel}
            <div class="tx-structure-panel">
              <NestedBlocks blocks={panel.blocks} labels={text} {resolveIcon} {resolveAvatar} />
            </div>
          {/if}
        {/snippet}
      </Tabs>
    </div>
  {:else if b.type === 'accordion'}
    {@const items = b.items.map((item) => ({
      value: item.id,
      title: item.title,
      content: item.body,
    }))}
    <div
      class="tx-structure-accordion"
      data-tx-block="accordion"
      data-tone={b.tone}
      data-block-id={b.id}
      role="group"
      aria-label={b.label}
    >
      <Accordion items={items} type={b.mode === 'multiple' ? 'multiple' : 'single'} variant="default">
        {#snippet content(item)}
          {@const source = b.items.find((i) => i.id === item.value)}
          {#if source?.body}
            <SafeBody text={source.body} />
          {/if}
        {/snippet}
      </Accordion>
    </div>
  {:else if b.type === 'cards'}
    <section
      class="tx-block"
      data-tx-block="cards"
      data-tone={b.tone}
      aria-label={b.title ?? text.cardsLabel}
    >
      {#if b.title}
        <h3 class="tx-structure-section-title">{b.title}</h3>
      {/if}
      <ul class="tx-structure-cards" data-cols={colsAttr(b.columns, 3)}>
        {#each b.items as card, i (i)}
          <li>
            <Card
              variant="flat"
              href={card.href}
              hrefTrust="untrusted"
            >
              <CardHeader>
                <BlockIcon name={card.icon} {resolveIcon} class="tx-structure-card-icon" />
                {#if card.eyebrow}
                  <p class="tx-structure-card-eyebrow">{card.eyebrow}</p>
                {/if}
                <CardTitle level={4}>{card.title}</CardTitle>
              </CardHeader>
              {#if card.body}
                <CardContent>
                  <SafeBody text={card.body} />
                </CardContent>
              {/if}
            </Card>
          </li>
        {/each}
      </ul>
    </section>
  {:else if b.type === 'divider'}
    {#if b.variant === 'space'}
      <div class="tx-structure-divider-space" data-tx-block="divider" data-variant="space" aria-hidden="true"></div>
    {:else if b.label}
      <!-- A named separator: the visible label is its accessible name (separator children are presentational). -->
      <div
        class="tx-structure-divider-labeled"
        data-tx-block="divider"
        data-tone={b.tone}
        role="separator"
        aria-label={b.label}
      >
        <span class="tx-structure-divider-label">{b.label}</span>
      </div>
    {:else}
      <hr class="tx-structure-divider" data-tx-block="divider" data-tone={b.tone} />
    {/if}
  {:else if b.type === 'cta'}
    <nav
      class="tx-structure-cta"
      data-tx-block="cta"
      data-tone={b.tone}
      aria-label={text.ctaLabel}
    >
      {#each b.actions as action, i (i)}
        <a href={action.href}>{action.label}</a>
      {/each}
    </nav>
  {/if}
{/if}

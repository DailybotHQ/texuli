<script lang="ts">
import type { WorkflowNodeContext } from './types.ts';

/**
 * The default node body: label, type, and any `url` or `image` props, each
 * passed through the URL policy at the `untrusted` tier. Text only.
 */
let { item }: { item: WorkflowNodeContext } = $props();

const fields = $derived(Object.entries(item.spec?.props ?? {}));
const links = $derived(
  fields.flatMap(([name, spec]) => {
    if (spec.kind !== 'url') return [];
    const href = item.safeHref(item.node.props?.[name]);
    return href ? [{ name, href, label: spec.label ?? name }] : [];
  })
);
const image = $derived(
  fields
    .filter(([, spec]) => spec.kind === 'image')
    .map(([name]) => item.safeImageSrc(item.node.props?.[name]))
    .find((src) => src !== undefined)
);
</script>

<span class="tx-workflow-body">
  {#if image}
    <img class="tx-workflow-body__icon" src={image} alt="" width="20" height="20" loading="lazy" referrerpolicy="no-referrer" />
  {/if}
  <span class="tx-workflow-body__text">
    <span class="tx-workflow-body__title">{item.node.label || item.spec?.label || item.node.type}</span>
    <span class="tx-workflow-body__type">{item.spec?.label ?? item.node.type}</span>
  </span>
  {#each links as link (link.name)}
    <a
      class="tx-workflow-body__link"
      href={link.href}
      rel="noopener noreferrer nofollow"
      target="_blank"
      tabindex={item.focused ? 0 : -1}
      onpointerdown={(event) => event.stopPropagation()}>{link.label}</a
    >
  {/each}
</span>

<style>
  @layer tx.components {
    .tx-workflow-body {
      display: flex;
      align-items: center;
      gap: var(--tx-space-2);
      min-inline-size: 0;
      block-size: 100%;
    }

    .tx-workflow-body__icon {
      flex: none;
      border-radius: var(--tx-shape-radius-sm);
    }

    .tx-workflow-body__text {
      display: grid;
      min-inline-size: 0;
      flex: 1;
    }

    .tx-workflow-body__title,
    .tx-workflow-body__type {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tx-workflow-body__title {
      font-weight: 600;
    }

    .tx-workflow-body__type {
      font-size: var(--tx-type-caption-size);
      color: var(--tx-muted-foreground, GrayText);
    }

    .tx-workflow-body__link {
      flex: none;
      font-size: var(--tx-type-caption-size);
      color: var(--tx-primary, LinkText);
      min-block-size: 24px;
      display: inline-flex;
      align-items: center;
    }
  }
</style>

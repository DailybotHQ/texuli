<script lang="ts">
import { safeHref, safeImageSrc } from '@texuli/core/url-policy';
import {
  formatLabel,
  resolveWorkflowLabels,
  type WorkflowLabelsOverrides,
} from '../editor/labels.ts';
import type { NodeTypeRegistry } from '../model/registry.ts';
import type {
  PropSpec,
  WorkflowError,
  WorkflowGraph,
  WorkflowOp,
  WorkflowScalar,
} from '../model/types.ts';

/**
 * Edit one node: its label, position and every prop its node type declares,
 * with a field per prop kind. Edits are ops handed to `onapply`, so the
 * editor's history (or any host) owns them. URL and image fields show the
 * URL policy's verdict at the `untrusted` tier before anything is applied.
 */
interface Props {
  graph: WorkflowGraph;
  registry: NodeTypeRegistry;
  /** The node to edit; nothing to edit shows a hint. */
  nodeId: string | null;
  onapply: (ops: WorkflowOp[]) => { ok: true } | { ok: false; error: WorkflowError };
  readonly?: boolean;
  labels?: WorkflowLabelsOverrides;
  class?: string;
}

let {
  graph,
  registry,
  nodeId,
  onapply,
  readonly = false,
  labels: overrides = {},
  class: className = '',
}: Props = $props();

const uid = $props.id();
const labels = $derived(resolveWorkflowLabels(overrides));
const node = $derived(
  nodeId === null ? undefined : graph.nodes.find((candidate) => candidate.id === nodeId)
);
const spec = $derived(node ? registry.get(node.type) : undefined);
const fields = $derived(Object.entries(spec?.props ?? {}));
let errors = $state<Record<string, string>>({});

function reason(error: WorkflowError): string {
  return formatLabel(labels.reasons[error.code] ?? labels.reasons['invalid-op']);
}

function commit(key: string, ops: WorkflowOp[]): void {
  const result = onapply(ops);
  const next = { ...errors };
  if (result.ok) delete next[key];
  else next[key] = formatLabel(labels.refused, { reason: reason(result.error) });
  errors = next;
}

function setProp(name: string, prop: PropSpec, raw: string | boolean): void {
  if (!node) return;
  const id = node.id;
  if (raw === '' && prop.kind !== 'text') {
    commit(name, [{ op: 'setProps', id, unset: [name] }]);
    return;
  }
  let value: WorkflowScalar = raw;
  if (prop.kind === 'number') value = Number(raw);
  if ((prop.kind === 'url' || prop.kind === 'image') && typeof raw === 'string') {
    const safe = prop.kind === 'url' ? safeHref(raw, 'untrusted') : safeImageSrc(raw, 'untrusted');
    if (safe === undefined) {
      errors = { ...errors, [name]: formatLabel(labels.invalidUrl) };
      return;
    }
  }
  commit(name, [{ op: 'setProps', id, props: { [name]: value } }]);
}

function setPosition(axis: 'x' | 'y', raw: string): void {
  if (!node) return;
  const value = Number(raw);
  if (!Number.isFinite(value)) return;
  const position = { ...node.position, [axis]: value };
  commit(`position-${axis}`, [{ op: 'moveNodes', moves: [{ id: node.id, ...position }] }]);
}

const portCounts = $derived.by(() => {
  if (!node) return [];
  return (spec?.ports ?? []).map((port) => ({
    port,
    count: graph.edges.filter((edge) =>
      port.direction === 'out'
        ? edge.from.node === node.id && edge.from.port === port.id
        : edge.to.node === node.id && edge.to.port === port.id
    ).length,
  }));
});

const fieldId = (name: string) => `${uid}-${name}`;
const errorId = (name: string) => `${uid}-${name}-error`;
</script>

<section class={['tx-workflow-inspector', className]} aria-labelledby={`${uid}-title`}>
  <h2 id={`${uid}-title`} class="tx-workflow-inspector__title">{formatLabel(labels.inspector)}</h2>
  {#if !node}
    <p class="tx-workflow-inspector__empty">{formatLabel(labels.inspectorEmpty)}</p>
  {:else}
    {#key node.id}
      <p class="tx-workflow-inspector__type">{spec?.label ?? node.type}</p>
      <div class="tx-workflow-inspector__field">
        <label for={fieldId('label')}>{formatLabel(labels.inspectorLabel)}</label>
        <input
          id={fieldId('label')}
          value={node.label}
          readonly={readonly}
          aria-invalid={errors.label ? true : undefined}
          aria-describedby={errors.label ? errorId('label') : undefined}
          onchange={(event) => commit('label', [{ op: 'setProps', id: node.id, label: event.currentTarget.value }])}
        />
        {#if errors.label}<p id={errorId('label')} class="tx-workflow-inspector__error">{errors.label}</p>{/if}
      </div>
      <div class="tx-workflow-inspector__row">
        {#each ['x', 'y'] as const as axis (axis)}
          <div class="tx-workflow-inspector__field">
            <label for={fieldId(`position-${axis}`)}
              >{formatLabel(axis === 'x' ? labels.inspectorPositionX : labels.inspectorPositionY)}</label
            >
            <input
              id={fieldId(`position-${axis}`)}
              type="number"
              value={node.position[axis]}
              readonly={readonly}
              onchange={(event) => setPosition(axis, event.currentTarget.value)}
            />
          </div>
        {/each}
      </div>

      {#each fields as [name, prop] (name)}
        {@const value = node.props?.[name]}
        {@const id = fieldId(`prop-${name}`)}
        {@const error = errors[name]}
        <div class="tx-workflow-inspector__field">
          {#if prop.kind === 'boolean'}
            <label class="tx-workflow-inspector__check">
              <input
                {id}
                type="checkbox"
                checked={value === true}
                disabled={readonly}
                onchange={(event) => setProp(name, prop, event.currentTarget.checked)}
              />
              {prop.label ?? name}
            </label>
          {:else}
            <label for={id}>{prop.label ?? name}</label>
            {#if prop.kind === 'enum'}
              <select
                {id}
                value={typeof value === 'string' ? value : ''}
                disabled={readonly}
                onchange={(event) => setProp(name, prop, event.currentTarget.value)}
              >
                <option value="">—</option>
                {#each prop.values as option (option)}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            {:else if prop.kind === 'text' && (prop.maxLength ?? 2000) > 120}
              <textarea
                {id}
                rows="3"
                value={typeof value === 'string' ? value : ''}
                maxlength={prop.maxLength}
                readonly={readonly}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId(name) : undefined}
                onchange={(event) => setProp(name, prop, event.currentTarget.value)}
              ></textarea>
            {:else}
              <input
                {id}
                type={prop.kind === 'number' ? 'number' : prop.kind === 'url' || prop.kind === 'image' ? 'url' : 'text'}
                value={value === undefined ? '' : String(value)}
                min={prop.kind === 'number' ? prop.min : undefined}
                max={prop.kind === 'number' ? prop.max : undefined}
                maxlength={prop.kind === 'text' ? prop.maxLength : undefined}
                readonly={readonly}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId(name) : undefined}
                onchange={(event) => setProp(name, prop, event.currentTarget.value)}
              />
              {#if prop.kind === 'image' && safeImageSrc(value, 'untrusted')}
                <img class="tx-workflow-inspector__preview" src={safeImageSrc(value, 'untrusted')} alt="" width="48" height="48" referrerpolicy="no-referrer" />
              {/if}
            {/if}
          {/if}
          {#if error}<p id={errorId(name)} class="tx-workflow-inspector__error">{error}</p>{/if}
        </div>
      {/each}

      {#if portCounts.length > 0}
        <h3 class="tx-workflow-inspector__subtitle">{formatLabel(labels.inspectorPorts)}</h3>
        <ul class="tx-workflow-inspector__ports">
          {#each portCounts as item (item.port.id)}
            <li>{formatLabel(labels.inspectorConnections, { port: item.port.label ?? item.port.id, count: item.count })}</li>
          {/each}
        </ul>
      {/if}
    {/key}
  {/if}
</section>

<style>
  @layer tx.components {
    .tx-workflow-inspector {
      display: grid;
      gap: var(--tx-space-3);
      align-content: start;
      font-size: var(--tx-type-label-size);
    }

    .tx-workflow-inspector__title {
      margin: 0;
      font-size: var(--tx-type-body-size);
    }

    .tx-workflow-inspector__subtitle {
      margin: 0;
      font-size: var(--tx-type-label-size);
    }

    .tx-workflow-inspector__type,
    .tx-workflow-inspector__empty {
      margin: 0;
      color: var(--tx-muted-foreground, GrayText);
    }

    .tx-workflow-inspector__row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--tx-space-2);
    }

    .tx-workflow-inspector__field {
      display: grid;
      gap: var(--tx-space-1);
    }

    .tx-workflow-inspector__field :global(input:not([type='checkbox'])),
    .tx-workflow-inspector__field :global(select),
    .tx-workflow-inspector__field :global(textarea) {
      min-block-size: 2rem;
      padding: var(--tx-space-1) var(--tx-space-2);
      font: inherit;
      color: inherit;
      background: var(--tx-surface, Field);
      border: var(--tx-border-width-thin) solid var(--tx-border, FieldText);
      border-radius: var(--tx-shape-radius-sm);
    }

    .tx-workflow-inspector__field :global(:focus-visible) {
      outline: 3px solid var(--tx-ring, Highlight);
      outline-offset: 1px;
    }

    .tx-workflow-inspector__check {
      display: flex;
      align-items: center;
      gap: var(--tx-space-2);
      min-block-size: 24px;
    }

    .tx-workflow-inspector__check :global(input) {
      inline-size: 1.25rem;
      block-size: 1.25rem;
    }

    .tx-workflow-inspector__error {
      margin: 0;
      color: var(--tx-danger, CanvasText);
    }

    .tx-workflow-inspector__preview {
      border-radius: var(--tx-shape-radius-sm);
    }

    .tx-workflow-inspector__ports {
      margin: 0;
      padding-inline-start: var(--tx-space-5);
    }
  }
</style>

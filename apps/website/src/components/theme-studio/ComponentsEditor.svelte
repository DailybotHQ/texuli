<script lang="ts">
/**
 * The `components` section: pick a component, then set its default variant
 * and size and any of its tokens. The token registry
 * (`@texuli/tokens/components`) loads when this editor first opens, so the
 * page pays for it only when a visitor edits components.
 */
import { DESIGN_DEFAULTS_VOCABULARY } from 'texuli/defaults';
import {
  componentTokenField,
  type FieldSpec,
  getAt,
  issuesAt,
  type StudioDocument,
  type StudioIssue,
  tokenKind,
} from './ds-studio.ts';
import StudioField from './StudioField.svelte';

type Family = {
  component: string;
  title: string;
  tokens: readonly { key: string; default: string }[];
};

let {
  doc,
  issues,
  oncommit,
}: {
  doc: StudioDocument;
  issues: readonly StudioIssue[];
  oncommit: (spec: FieldSpec, value: unknown) => void;
} = $props();

const VOCABULARY = DESIGN_DEFAULTS_VOCABULARY as Readonly<
  Record<string, { variant?: readonly string[]; size?: readonly string[] }>
>;

let families = $state<readonly Family[]>([]);
let loadError = $state('');
let component = $state('button');

$effect(() => {
  import('@texuli/tokens/components').then(
    (module) => {
      families = module.COMPONENT_TOKEN_FAMILIES as readonly Family[];
    },
    () => {
      loadError = 'The component token list could not be loaded from this site.';
    }
  );
});

const ids = $derived(
  [...new Set([...families.map((family) => family.component), ...Object.keys(VOCABULARY)])].sort()
);
const family = $derived(families.find((entry) => entry.component === component));
const vocabulary = $derived(VOCABULARY[component]);
const defaultFields = $derived(
  [
    vocabulary?.variant?.length
      ? ({
          path: ['components', component, 'defaults', 'variant'],
          label: 'Default variant',
          kind: 'enum',
          options: vocabulary.variant,
        } satisfies FieldSpec)
      : null,
    vocabulary?.size?.length
      ? ({
          path: ['components', component, 'defaults', 'size'],
          label: 'Default size',
          kind: 'enum',
          options: vocabulary.size,
        } satisfies FieldSpec)
      : null,
  ].filter((spec): spec is FieldSpec => spec !== null)
);
const tokenFields = $derived(
  (family?.tokens ?? []).map((token) =>
    componentTokenField(component, token.key, tokenKind(token.key, token.default))
  )
);
const configured = $derived(
  Object.entries((getAt(doc, ['components']) ?? {}) as Record<string, Record<string, unknown>>)
);
</script>

<div class="components" data-tx-ds-components="">
  <p class="hint">
    Component tokens step through the system scales (a radius step, a space or control size, a type
    role); defaults choose a variant and size when a prop is omitted.
  </p>
  {#if loadError}
    <p class="hint" role="alert">{loadError}</p>
  {/if}
  <label class="label" for="ds-component-pick">Component</label>
  <select
    id="ds-component-pick"
    class="select"
    value={component}
    onchange={(event) => {
      component = (event.currentTarget as HTMLSelectElement).value;
    }}
  >
    {#each ids.length > 0 ? ids : ['button'] as id (id)}
      <option value={id}>{id}</option>
    {/each}
  </select>
  {#each defaultFields as spec (spec.path.join('.'))}
    <StudioField
      {spec}
      value={getAt(doc, spec.path)}
      issues={issuesAt(issues, spec.path)}
      {oncommit}
    />
  {/each}
  {#if tokenFields.length > 0}
    <details class="tokens">
      <summary>{family?.title ?? component} tokens ({tokenFields.length})</summary>
      <div class="tokens__grid">
        {#each tokenFields as spec (spec.path.join('.'))}
          <StudioField
            {spec}
            value={getAt(doc, spec.path)}
            issues={issuesAt(issues, spec.path)}
            {oncommit}
          />
        {/each}
      </div>
    </details>
  {/if}
  {#if configured.length > 0}
    <p class="hint" data-tx-ds-components-set="">
      Set in this document:
      {configured
        .map(([id, values]) => `${id} (${Object.keys(values).join(', ')})`)
        .join('; ')}.
    </p>
  {/if}
</div>

<style>
  .components,
  .tokens,
  .tokens__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.6rem;
  }
  .hint {
    margin: 0;
    font-size: 0.8125rem;
  }
  .label {
    font-size: 0.875rem;
    font-weight: 600;
  }
  .select {
    min-block-size: 2.5rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    font: inherit;
  }
  .select:focus-visible,
  .tokens summary:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .tokens summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
  }
  @media (forced-colors: active) {
    .select {
      border-color: CanvasText;
    }
  }
</style>

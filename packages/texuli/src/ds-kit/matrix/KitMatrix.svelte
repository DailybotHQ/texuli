<script lang="ts">
/**
 * KitMatrix (kit API §5.2, §11.4): every enabled control of the design system, light and
 * dark, from the allow manifest and the catalog. Per component: the variant × size grid as a
 * table, then a strip per prop-backed state, tone and density, and one live sample for the
 * pseudo-states (hover, focus, press). Disallowed values are marked as text, never rendered
 * (flagged, not removed: ADR-032); disallowed components are listed. Deterministic (catalog,
 * axis value and state order) with `data-tx-ds-kit-*` attributes on every cell; the samples
 * carry the components' own root attributes. Built-in samples for `texuli` ids, host
 * `samples` snippets above, a placeholder otherwise. No raw HTML, no network.
 */
import type { Snippet } from 'svelte';
import { useMessages } from '../../i18n/use-messages.ts';
import { kitItemId, kitPrefix, kitSectionId } from '../shared/navigation.ts';
import type {
  KitAllowManifest,
  KitAxis,
  KitCatalog,
  KitMode,
  KitModeView,
  KitSampleContext,
  KitState,
} from '../shared/types.ts';
import '../shared/ds-kit.css';
import './matrix.css';
import {
  type MatrixCell,
  type MatrixComponent,
  matrixAttributes,
  matrixCells,
  matrixModel,
  matrixProps,
  PSEUDO_STATES,
} from './model.ts';
import SampleCell from './SampleCell.svelte';
import { builtinSample } from './samples.ts';

type Props = {
  /** The catalog vocabulary (`components.json`), as data. */
  catalog: KitCatalog;
  /** The resolved allow manifest; omitted or without `allow`: unlocked. */
  allow?: KitAllowManifest;
  /**
   * Live samples for catalog ids the kit cannot import, keyed by catalog id: L4+ packages, and
   * host extension components (`<ns>:<id>` from `mergeCatalogs`; pass the merged catalog).
   */
  samples?: Readonly<Record<string, Snippet<[KitSampleContext]>>>;
  /** `grid` (default): variants × sizes plus strips; `full`: the whole product, capped. */
  matrix?: 'grid' | 'full';
  /** List the components the design system does not allow. Default true. */
  showDisallowed?: boolean;
  /** Light and dark side by side, or one mode. Default `both`. */
  modeView?: KitModeView;
  /** Heading level of the section title (components use the next level). Default 3. */
  headingLevel?: 2 | 3 | 4;
  /** Prefix of every `id` (deep links). Default `tx-ds-kit`. */
  idPrefix?: string;
  /** The current item (a catalog id): its block gets `aria-current`. */
  currentItem?: string;
};

let {
  catalog,
  allow,
  samples,
  matrix = 'grid',
  showDisallowed = true,
  modeView = 'both',
  headingLevel = 3,
  idPrefix,
  currentItem,
}: Props = $props();

const model = $derived(matrixModel(catalog, allow));
const prefix = $derived(kitPrefix(idPrefix));
const sid = $derived(kitSectionId(prefix, 'matrix'));
const modes = $derived<KitMode[]>(modeView === 'both' ? ['light', 'dark'] : [modeView]);
const h = $derived(`h${headingLevel}`);
const h2 = $derived(`h${Math.min(headingLevel + 1, 6)}`);
const msg = useMessages();
const modeLabel = (mode: KitMode) =>
  mode === 'light'
    ? msg('texuli.ds-kit.mode-light', 'Light')
    : msg('texuli.ds-kit.mode-dark', 'Dark');
const hostSample = (id: string) =>
  samples && Object.hasOwn(samples, id) ? samples[id] : undefined;
const valuesText = (cell: MatrixCell) =>
  [
    ...Object.values(cell.values).filter((v): v is string => typeof v === 'string'),
    ...(cell.state ? [cell.state] : []),
  ].join(' · ') || msg('texuli.ds-kit.matrix.default', 'default');
const axisOf = (component: MatrixComponent, axis: KitAxis) =>
  component.axes.find((a) => a.axis === axis);
const hasPseudo = (component: MatrixComponent) =>
  component.states.allowed.some((s) => PSEUDO_STATES.has(s));
</script>

{#snippet cellBody(component: MatrixComponent, cell: MatrixCell, mode: KitMode, live: boolean)}
  {@const builtin = builtinSample(component.id)}
  {@const host = hostSample(component.id)}
  {@const props = matrixProps(component, cell.values)}
  {#if host}
    {@render host({
      id: component.id,
      mode,
      props,
      ...(cell.state ? { state: cell.state as KitState } : {}),
      attributes: matrixAttributes(component, cell.values),
    })}
  {:else if builtin && (!cell.state || live || builtin.stateProps[cell.state])}
    <SampleCell
      sample={builtin}
      props={{ ...props, ...(cell.state ? builtin.stateProps[cell.state] : {}) }}
      pending={valuesText(cell)}
    />
  {:else if builtin}
    <span class="tx-ds-kit__muted" data-tx-ds-kit-placeholder="state">
      {msg('texuli.ds-kit.matrix.state-in-app', 'Shown in a live app: this state has no prop to set.')}
    </span>
  {:else}
    <span class="tx-ds-kit__muted" data-tx-ds-kit-placeholder="host">
      {msg('texuli.ds-kit.matrix.host-sample', 'Live sample supplied by the host app')}
    </span>
  {/if}
{/snippet}

{#snippet cellFigure(component: MatrixComponent, cell: MatrixCell, mode: KitMode)}
  <figure
    class="tx-ds-kit__cell"
    data-tx-ds-kit-cell={cell.key}
    data-tx-ds-kit-cell-kind={cell.kind}
    data-tx-ds-kit-mode={mode}
    data-tx-ds-kit-state={cell.state}
  >
    {@render cellBody(component, cell, mode, false)}
    <figcaption>{valuesText(cell)}</figcaption>
  </figure>
{/snippet}

<section
  class="tx-ds-kit__section tx-ds-kit-matrix"
  id={sid}
  aria-labelledby={`${sid}-title`}
  data-tx-ds-kit-section="matrix"
  data-tx-ds-kit-locked={model.locked ? 'true' : 'false'}
>
  <svelte:element this={h} id={`${sid}-title`} class="tx-ds-kit__title">
    {msg('texuli.ds-kit.section.matrix', 'Components')}
  </svelte:element>
  <p class="tx-ds-kit__note">
    {model.locked
      ? msg('texuli.ds-kit.matrix.locked', '{0} components allowed by this design system.', { 0: model.enabled.length })
      : msg('texuli.ds-kit.matrix.unlocked', 'Unlocked: every catalog component is allowed ({0}).', { 0: model.enabled.length })}
  </p>

  {#if model.issues.length > 0}
    <section class="tx-ds-kit__group" aria-labelledby={`${sid}-issues-title`} data-tx-ds-kit-matrix-issues="">
      <svelte:element this={h2} id={`${sid}-issues-title`} class="tx-ds-kit__subtitle">
        {msg('texuli.ds-kit.matrix.issues', 'Not in the catalog')}
      </svelte:element>
      <ul>
        {#each model.issues.slice(0, 100) as issue, i (i)}
          <li data-tx-ds-kit-issue={issue.code}><code>{issue.id}</code>{#if issue.detail}: {issue.detail}{/if}</li>
        {/each}
      </ul>
    </section>
  {/if}

  {#each model.enabled as component (component.id)}
    {@const cid = kitItemId(prefix, 'matrix', component.id)}
    {@const layout = matrixCells(component, matrix)}
    {@const variants = axisOf(component, 'variant')?.allowed ?? []}
    {@const sizes = axisOf(component, 'size')?.allowed ?? []}
    <section
      class="tx-ds-kit__group tx-ds-kit__matrix-component"
      id={cid}
      aria-labelledby={`${cid}-title`}
      aria-current={currentItem === component.id ? 'true' : undefined}
      data-tx-ds-kit-component={component.id}
      data-tx-ds-kit-extension={component.id.includes(':') ? component.id.split(':')[0] : undefined}
    >
      <svelte:element this={h2} id={`${cid}-title`} class="tx-ds-kit__subtitle">
        {component.label} <code class="tx-ds-kit__muted">{component.id}</code>
      </svelte:element>

      {#each component.axes.filter((a) => a.disallowed.length > 0) as axis (axis.axis)}
        <p class="tx-ds-kit__disallowed" data-tx-ds-kit-disallowed={axis.axis}>
          <span class="tx-ds-kit__badge">{msg('texuli.ds-kit.matrix.not-allowed', 'Not allowed')}</span>
          {axis.axis}: {axis.disallowed.join(', ')}
        </p>
      {/each}
      {#if component.states.disallowed.length > 0}
        <p class="tx-ds-kit__disallowed" data-tx-ds-kit-disallowed="state">
          <span class="tx-ds-kit__badge">{msg('texuli.ds-kit.matrix.not-allowed', 'Not allowed')}</span>
          {msg('texuli.ds-kit.matrix.states', 'states')}: {component.states.disallowed.join(', ')}
        </p>
      {/if}
      {#if layout.capped}
        <p class="tx-ds-kit__note" data-tx-ds-kit-capped="">
          {msg('texuli.ds-kit.matrix.capped', 'Too many combinations for the full view: showing the grid.')}
        </p>
      {/if}

      <div class="tx-ds-kit__matrix-modes">
        {#each modes as mode (mode)}
          <div class="tx-ds-kit__matrix-mode" data-tx-ds-kit-mode={mode}>
            <p class="tx-ds-kit__label">{modeLabel(mode)}</p>
            {#if layout.view === 'grid' && variants.length > 0 && sizes.length > 0}
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <div
                class="tx-ds-kit__table-wrap"
                role="region"
                tabindex="0"
                aria-label={msg('texuli.ds-kit.matrix.grid-label', '{0}: variants by size, {1}', { 0: component.label, 1: modeLabel(mode) })}
              >
                <table class="tx-ds-kit__table" data-tx-ds-kit-grid={mode}>
                  <thead>
                    <tr>
                      <th scope="col">{msg('texuli.ds-kit.matrix.variant-size', 'Variant / size')}</th>
                      {#each sizes as size (size)}<th scope="col">{size}</th>{/each}
                    </tr>
                  </thead>
                  <tbody>
                    {#each variants as variant (variant)}
                      <tr>
                        <th scope="row">{variant}</th>
                        {#each sizes as size (size)}
                          {@const cell = layout.cells.find((c) => c.kind === 'grid' && c.values.variant === variant && c.values.size === size)}
                          <td>
                            {#if cell}
                              <div class="tx-ds-kit__cell" data-tx-ds-kit-cell={cell.key} data-tx-ds-kit-cell-kind="grid" data-tx-ds-kit-mode={mode}>
                                {@render cellBody(component, cell, mode, false)}
                              </div>
                            {/if}
                          </td>
                        {/each}
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
              <div class="tx-ds-kit__strip">
                {#each layout.cells.filter((c) => c.kind !== 'grid') as cell (cell.key)}
                  {@render cellFigure(component, cell, mode)}
                {/each}
              </div>
            {:else}
              <div class="tx-ds-kit__strip">
                {#each layout.cells as cell (cell.key)}
                  {@render cellFigure(component, cell, mode)}
                {/each}
              </div>
            {/if}
            {#if hasPseudo(component)}
              {@const live = { key: 'live', kind: 'state' as const, values: component.defaults }}
              <figure class="tx-ds-kit__cell" data-tx-ds-kit-cell="live" data-tx-ds-kit-cell-kind="live" data-tx-ds-kit-mode={mode}>
                {@render cellBody(component, live, mode, true)}
                <figcaption>
                  {msg('texuli.ds-kit.matrix.live', 'Hover, focus or press this sample')}
                  ({component.states.allowed.filter((s) => PSEUDO_STATES.has(s)).join(', ')})
                </figcaption>
              </figure>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/each}

  {#if showDisallowed && model.disallowedComponents.length > 0}
    <section class="tx-ds-kit__group" aria-labelledby={`${sid}-disallowed-title`} data-tx-ds-kit-disallowed-components="">
      <svelte:element this={h2} id={`${sid}-disallowed-title`} class="tx-ds-kit__subtitle">
        {msg('texuli.ds-kit.matrix.not-in-system', 'Not in this design system')}
        <span class="tx-ds-kit__count">({model.disallowedComponents.length})</span>
      </svelte:element>
      <ul class="tx-ds-kit__matrix-disallowed">
        {#each model.disallowedComponents as id (id)}<li><code>{id}</code></li>{/each}
      </ul>
    </section>
  {/if}
</section>

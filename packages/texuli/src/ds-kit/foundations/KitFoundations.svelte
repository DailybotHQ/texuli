<script lang="ts" module>
import type { MessageLookup } from '@texuli/core/i18n';

/** The label of a foundations item (a token group, contrast or assets) in the active locale. */
export function foundationLabel(msg: MessageLookup, id: string): string {
  switch (id) {
    case 'color':
      return msg('texuli.ds-kit.foundations.color', 'Color roles');
    case 'data-viz':
      return msg('texuli.ds-kit.foundations.data-viz', 'Data visualization');
    case 'typography':
      return msg('texuli.ds-kit.foundations.typography', 'Typography');
    case 'spacing':
      return msg('texuli.ds-kit.foundations.spacing', 'Spacing');
    case 'radius':
      return msg('texuli.ds-kit.foundations.radius', 'Radius');
    case 'elevation':
      return msg('texuli.ds-kit.foundations.elevation', 'Elevation and shadow');
    case 'motion':
      return msg('texuli.ds-kit.foundations.motion', 'Motion');
    case 'contrast':
      return msg('texuli.ds-kit.foundations.contrast', 'Contrast');
    case 'assets':
      return msg('texuli.ds-kit.foundations.assets', 'Fonts, assets and notes');
    default:
      return msg('texuli.ds-kit.foundations.other', 'Other tokens');
  }
}
</script>

<script lang="ts">
/**
 * KitFoundations (kit API §5.1): every token of a compiled design system, light and dark,
 * grouped for reading: color roles and the data-viz palette as swatches, typography as
 * samples, spacing as bars, radius as boxes, elevation as cards, motion and the rest as
 * values. Every value is also printed as text (never color alone). Values reach styles only
 * through `style:` directives, after the runtime's own value filter (`foundationsModel`);
 * logos pass `safeImageSrc` at the untrusted tier. No raw HTML, no network. Labels go through
 * `texuli.ds-kit.*` message ids (ADR-016).
 */
import { safeImageSrc } from '@texuli/core/url-policy';
import { useMessages } from '../../i18n/use-messages.ts';
import { kitItemId, kitPrefix, kitSectionId } from '../shared/navigation.ts';
import type { KitCompiled, KitMode, KitModeView } from '../shared/types.ts';
import '../shared/ds-kit.css';
import { type FoundationGroupId, type FoundationToken, foundationsModel } from './model.ts';

type Props = {
  compiled: KitCompiled;
  /** Light and dark side by side, or one mode. Default `both`. */
  modeView?: KitModeView;
  /** Heading level of the section title (groups use the next level). Default 3. */
  headingLevel?: 2 | 3 | 4;
  /** Prefix of every `id` (deep links). Default `tx-ds-kit`. */
  idPrefix?: string;
  /** The current item (its group gets `aria-current`). */
  currentItem?: string;
};

let { compiled, modeView = 'both', headingLevel = 3, idPrefix, currentItem }: Props = $props();

const model = $derived(foundationsModel(compiled));
const prefix = $derived(kitPrefix(idPrefix));
const modes = $derived(
  model.modes.filter((mode) => modeView === 'both' || mode === modeView) as KitMode[]
);
const h = $derived(`h${headingLevel}`);
const h2 = $derived(`h${Math.min(headingLevel + 1, 6)}`);
const msg = useMessages();
const modeLabel = (mode: KitMode) =>
  mode === 'light'
    ? msg('texuli.ds-kit.mode-light', 'Light')
    : msg('texuli.ds-kit.mode-dark', 'Dark');
const sample = $derived(
  msg('texuli.ds-kit.foundations.type-sample', 'The quick brown fox jumps over the lazy dog')
);
const passText = (pass: boolean) =>
  pass ? msg('texuli.ds-kit.foundations.pass', 'Pass') : msg('texuli.ds-kit.foundations.fail', 'Fail');

const swatch = (group: FoundationGroupId) => group === 'color' || group === 'data-viz';
const shadow = (token: FoundationToken) => /^--tx-elevation-\d+$/.test(token.name);
const logos = $derived(
  Object.entries(model.logo)
    .map(([key, value]) => ({ key, src: safeImageSrc(value, 'untrusted') }))
    .slice(0, 4)
);
</script>

<section
  class="tx-ds-kit__section tx-ds-kit-foundations"
  id={kitSectionId(prefix, 'foundations')}
  aria-labelledby={`${kitSectionId(prefix, 'foundations')}-title`}
  data-tx-ds-kit-section="foundations"
>
  <svelte:element this={h} id={`${kitSectionId(prefix, 'foundations')}-title`} class="tx-ds-kit__title">
    {msg('texuli.ds-kit.section.foundations', 'Foundations')}
  </svelte:element>
  {#if model.modes.length === 0}
    <p class="tx-ds-kit__note">
      {msg('texuli.ds-kit.foundations.no-modes', 'This design system has no compiled mode to show.')}
    </p>
  {/if}

  {#each model.groups as group (group.id)}
    {@const gid = kitItemId(prefix, 'foundations', group.id)}
    <section
      class="tx-ds-kit__group"
      id={gid}
      aria-labelledby={`${gid}-title`}
      aria-current={currentItem === group.id ? 'true' : undefined}
      data-tx-ds-kit-group={group.id}
    >
      <svelte:element this={h2} id={`${gid}-title`} class="tx-ds-kit__subtitle">
        {foundationLabel(msg, group.id)}
        <span class="tx-ds-kit__count">({group.tokens.length})</span>
      </svelte:element>

      {#if group.id === 'typography' && model.typeRoles.length > 0}
        <ul class="tx-ds-kit__type-roles" aria-label={msg('texuli.ds-kit.foundations.type-roles', 'Type roles')}>
          {#each model.typeRoles as role (role.role)}
            {@const v = model.groups.find((g) => g.id === 'typography')?.tokens}
            {@const value = (name: string) => v?.find((t) => t.name === name)?.values}
            {@const m = modes[0] ?? 'light'}
            <li class="tx-ds-kit__type-role" data-tx-ds-kit-type-role={role.role}>
              <span class="tx-ds-kit__label">{role.role}</span>
              <span
                class="tx-ds-kit__type-sample"
                style:font-family={value(role.vars.family)?.[m]}
                style:font-size={value(role.vars.size)?.[m]}
                style:font-weight={value(role.vars.weight)?.[m]}
                style:line-height={value(role.vars.line)?.[m]}
                style:letter-spacing={value(role.vars.tracking)?.[m]}>{sample}</span
              >
            </li>
          {/each}
        </ul>
      {/if}

      <!-- A scrollable region is focusable so keyboard users can scroll it (axe scrollable-region-focusable). -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="tx-ds-kit__table-wrap" role="region" aria-labelledby={`${gid}-title`} tabindex="0">
        <table class="tx-ds-kit__table">
          <thead>
            <tr>
              <th scope="col">{msg('texuli.ds-kit.foundations.token', 'Token')}</th>
              {#each modes as mode (mode)}
                <th scope="col">{modeLabel(mode)}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each group.tokens as token (token.name)}
              <tr data-tx-ds-kit-token={token.name}>
                <th scope="row"><code>{token.name}</code></th>
                {#each modes as mode (mode)}
                  {@const value = token.values[mode]}
                  <td data-tx-mode-cell={mode}>
                    {#if value === undefined}
                      <span class="tx-ds-kit__muted">{msg('texuli.ds-kit.foundations.not-set', 'not set')}</span>
                    {:else}
                      {#if swatch(group.id)}
                        <span class="tx-ds-kit__swatch" style:background-color={value} aria-hidden="true"></span>
                      {:else if group.id === 'spacing'}
                        <span class="tx-ds-kit__bar" style:inline-size={value} aria-hidden="true"></span>
                      {:else if group.id === 'radius'}
                        <span class="tx-ds-kit__radius" style:border-radius={value} aria-hidden="true"></span>
                      {:else if group.id === 'elevation' && shadow(token)}
                        <span class="tx-ds-kit__shadow" style:box-shadow={value} aria-hidden="true"></span>
                      {/if}
                      <code class="tx-ds-kit__value">{value}</code>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/each}

  {#if modes.some((mode) => (model.contrast[mode]?.length ?? 0) > 0)}
    {@const cid = kitItemId(prefix, 'foundations', 'contrast')}
    <section
      class="tx-ds-kit__group"
      id={cid}
      aria-labelledby={`${cid}-title`}
      aria-current={currentItem === 'contrast' ? 'true' : undefined}
      data-tx-ds-kit-group="contrast"
    >
      <svelte:element this={h2} id={`${cid}-title`} class="tx-ds-kit__subtitle">{foundationLabel(msg, 'contrast')}</svelte:element>
      {#if model.accessibility}
        <p class="tx-ds-kit__note">
          {msg('texuli.ds-kit.foundations.target', 'Target: {0} contrast, controls at least {1} px.', {
            0: model.accessibility.contrast,
            1: model.accessibility.targetMin,
          })}
        </p>
      {/if}
      {#each modes as mode (mode)}
        {@const rows = model.contrast[mode] ?? []}
        {#if rows.length > 0}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div class="tx-ds-kit__table-wrap" role="region" aria-label={msg('texuli.ds-kit.foundations.contrast-table', '{0} contrast', { 0: modeLabel(mode) })} tabindex="0">
            <table class="tx-ds-kit__table" data-tx-mode-table={mode}>
              <caption>{modeLabel(mode)}</caption>
              <thead>
                <tr>
                  <th scope="col">{msg('texuli.ds-kit.foundations.foreground', 'Foreground')}</th>
                  <th scope="col">{msg('texuli.ds-kit.foundations.background', 'Background')}</th>
                  <th scope="col">{msg('texuli.ds-kit.foundations.ratio', 'Ratio')}</th>
                  <th scope="col">{msg('texuli.ds-kit.foundations.result', 'Result')}</th>
                </tr>
              </thead>
              <tbody>
                {#each rows as row, i (i)}
                  <tr>
                    <td><code>{row.foreground}</code></td>
                    <td><code>{row.background}</code></td>
                    <td>
                      {msg('texuli.ds-kit.foundations.ratio-value', '{0}:1 (needs {1}:1, {2})', {
                        0: row.ratio,
                        1: row.required,
                        2: row.kind,
                      })}
                    </td>
                    <td>{passText(row.pass)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/each}
      {#if model.targets.length > 0}
        <ul class="tx-ds-kit__list" aria-label={msg('texuli.ds-kit.foundations.targets', 'Target sizes')}>
          {#each model.targets as target (target.variable)}
            <li>
              <code>{target.variable}</code>:
              {msg('texuli.ds-kit.foundations.target-value', '{0} px (needs {1} px), {2}', {
                0: target.px,
                1: target.required,
                2: passText(target.pass),
              })}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}

  {#if model.fonts.length > 0 || logos.length > 0 || model.warnings.length > 0}
    {@const aid = kitItemId(prefix, 'foundations', 'assets')}
    <section
      class="tx-ds-kit__group"
      id={aid}
      aria-labelledby={`${aid}-title`}
      aria-current={currentItem === 'assets' ? 'true' : undefined}
      data-tx-ds-kit-group="assets"
    >
      <svelte:element this={h2} id={`${aid}-title`} class="tx-ds-kit__subtitle">{foundationLabel(msg, 'assets')}</svelte:element>
      {#if model.fonts.length > 0}
        <p>{msg('texuli.ds-kit.foundations.fonts', 'Font faces: {0}', { 0: model.fonts.join(', ') })}</p>
      {/if}
      {#each logos as logo (logo.key)}
        {#if logo.src}
          <img class="tx-ds-kit__logo" src={logo.src} alt={msg('texuli.ds-kit.foundations.logo', 'Logo ({0})', { 0: logo.key })} />
        {:else}
          <p class="tx-ds-kit__muted">
            {msg('texuli.ds-kit.foundations.logo-unsafe', 'Logo ({0}) not shown: unsafe source.', { 0: logo.key })}
          </p>
        {/if}
      {/each}
      {#if model.warnings.length > 0}
        <ul class="tx-ds-kit__list" aria-label={msg('texuli.ds-kit.foundations.notes', 'Compiler notes')}>
          {#each model.warnings as warning, i (i)}
            <li>{warning}</li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}

  {#if model.clipped > 0}
    <p class="tx-ds-kit__note">
      {msg('texuli.ds-kit.foundations.clipped', '{0} more tokens not shown.', { 0: model.clipped })}
    </p>
  {/if}
</section>

<script lang="ts">
/**
 * The design-systems demo island (PLAN_017 T-demo, `client:visible`). A visitor picks one of
 * three fictional brand inputs, reads the generation report, previews the compiled brand on
 * real Texuli components in light or dark, switches allow entries off and on, and reads the
 * locked check of a sample prototype update. Everything heavy happened at build time
 * (`build.ts`): the brand variables arrive as scoped CSS in the page, and the island only
 * flips `data-tx-ds` and `data-tx-mode`. The locked check ran at build time for every toggle
 * combination (`checkLockedUsage`, what `texuli ds validate --locked` runs); the island
 * reads the result for the current toggles.
 *
 * Native radios and checkboxes (keyboard and screen readers for free), one polite live
 * region, no motion, no HTML sinks: every string renders as text.
 */
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from 'texuli/card';
import { Input } from 'texuli/input';
import type { DemoBrand } from './build.ts';
import { DEMO_INPUT_LABELS } from './fixtures/brands.ts';
import {
  DEMO_TOGGLES,
  DEMO_TOGGLES_ON,
  type DemoFinding,
  type DemoToggleId,
  type DemoToggles,
  demoCheckSummary,
  demoFindingsFor,
  demoNodeAllowed,
} from './model.ts';

interface Props {
  brands: readonly DemoBrand[];
  /** Findings per toggle combination, computed at build time. */
  checks: Readonly<Record<string, readonly DemoFinding[]>>;
}

let { brands, checks }: Props = $props();

const uid = $props.id();
let brandId = $state('');
let mode = $state<'light' | 'dark'>('light');
let toggles = $state<DemoToggles>({ ...DEMO_TOGGLES_ON });

const brand = $derived(brands.find((entry) => entry.id === brandId) ?? brands[0]);
const findings = $derived(demoFindingsFor(checks, toggles) ?? []);
const summary = $derived(demoCheckSummary(findings));
const badgeAllowed = $derived(demoNodeAllowed(findings, 3));
const ghostAllowed = $derived(demoNodeAllowed(findings, 2));
const scopeAttrs = $derived(brand?.attrs ?? {});

function setToggle(id: DemoToggleId, on: boolean): void {
  toggles = { ...toggles, [id]: on };
}

function reset(): void {
  brandId = brands[0]?.id ?? '';
  mode = 'light';
  toggles = { ...DEMO_TOGGLES_ON };
}

const MODES = ['light', 'dark'] as const;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
</script>

{#if brand}
  <div class="ds-demo-app" data-tx-ds-demo="" data-brand={brand.id}>
    <fieldset class="ds-demo-app__brands">
      <legend>1. Pick a brand input</legend>
      <div class="ds-demo-app__brand-list">
        {#each brands as entry (entry.id)}
          <label class="ds-demo-app__brand" data-checked={entry.id === brand.id ? '' : undefined}>
            <input
              type="radio"
              name="{uid}-brand"
              value={entry.id}
              checked={entry.id === brand.id}
              onchange={() => (brandId = entry.id)}
            />
            <span class="ds-demo-app__brand-name">{entry.name}</span>
            <span class="ds-demo-app__brand-kind">{DEMO_INPUT_LABELS[entry.kind]}</span>
            <span class="ds-demo-app__brand-summary">{entry.summary}</span>
          </label>
        {/each}
      </div>
    </fieldset>

    <div class="ds-demo-app__grid">
      <section class="ds-demo-app__panel" aria-labelledby="{uid}-input-title">
        <h3 id="{uid}-input-title">2. The input and its report</h3>
        <pre class="ds-demo-app__code" aria-label="{brand.name} input"><code>{brand.source}</code></pre>
        <p class="ds-demo-app__command"><code>{brand.command}</code></p>
        <p class="ds-demo-app__report-summary" data-tx-ds-demo-report="">
          {plural(brand.losses.length, 'dropped value')} · {plural(brand.repairs.length, 'repair')} ·
          contrast, focus and target size {brand.guaranteesPassed ? 'hold' : 'need review'}
        </p>
        {#if brand.losses.length > 0}
          <p class="ds-demo-app__list-title">Dropped</p>
          <ul class="ds-demo-app__list">
            {#each brand.losses as line (line.path + line.reason)}
              <li><code>{line.path}</code> {line.reason}</li>
            {/each}
          </ul>
        {/if}
        {#if brand.repairs.length > 0}
          <p class="ds-demo-app__list-title">Repaired</p>
          <ul class="ds-demo-app__list">
            {#each brand.repairs as line (line.path + line.reason)}
              <li>
                <code>{line.path}</code> {line.reason}{line.count > 1 ? ` (${line.count} values)` : ''}
              </li>
            {/each}
          </ul>
        {/if}
        <p class="ds-demo-app__approval">
          Status: <strong>draft</strong>. A person approves it with <code>texuli ds approve</code> and a reviewed
          commit, not here.
        </p>
      </section>

      <section class="ds-demo-app__panel" aria-labelledby="{uid}-preview-title">
        <h3 id="{uid}-preview-title">3. Preview the {brand.name} kit</h3>
        <fieldset class="ds-demo-app__modes">
          <legend class="ds-demo-app__sr">Preview mode</legend>
          {#each MODES as value (value)}
            <label>
              <input type="radio" name="{uid}-mode" {value} checked={mode === value} onchange={() => (mode = value)} />
              {value === 'light' ? 'Light' : 'Dark'}
            </label>
          {/each}
        </fieldset>
        <div
          class="ds-demo-app__scope"
          {...scopeAttrs}
          data-tx-ds={brand.id}
          data-tx-mode={mode}
          data-tx-scope=""
          data-tx-ds-demo-scope=""
        >
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Join the {brand.name} beta</CardTitle>
              <CardDescription>A sample prototype, built only from catalog components.</CardDescription>
            </CardHeader>
            <CardContent>
              <label class="ds-demo-app__field" for="{uid}-email">
                <span>Work email</span>
                <Input id="{uid}-email" type="email" placeholder="you@example.com" autocomplete="off" />
              </label>
            </CardContent>
            <CardFooter>
              <div class="ds-demo-app__actions">
                <Button variant="default" type="button">Join the beta</Button>
                {#if ghostAllowed}
                  <Button variant="ghost" type="button">Maybe later</Button>
                {:else}
                  <span class="ds-demo-app__blocked" data-tx-ds-demo-blocked="button-ghost">Ghost button: not allowed</span>
                {/if}
                {#if badgeAllowed}
                  <Badge variant="secondary">New</Badge>
                {:else}
                  <span class="ds-demo-app__blocked" data-tx-ds-demo-blocked="badge">Badge: not allowed</span>
                {/if}
              </div>
            </CardFooter>
          </Card>
        </div>
      </section>

      <section class="ds-demo-app__panel" aria-labelledby="{uid}-allow-title">
        <h3 id="{uid}-allow-title">4. Lock the allowed set</h3>
        <fieldset class="ds-demo-app__toggles">
          <legend>Allowed in this design system</legend>
          {#each DEMO_TOGGLES as toggle (toggle.id)}
            <label>
              <input
                type="checkbox"
                checked={toggles[toggle.id]}
                onchange={(event) => setToggle(toggle.id, event.currentTarget.checked)}
              />
              {toggle.label} <span class="ds-demo-app__muted">({toggle.detail})</span>
            </label>
          {/each}
        </fieldset>
        <p class="ds-demo-app__status" role="status" data-tx-ds-demo-status={findings.length === 0 ? 'pass' : 'fail'}>
          {summary}
        </p>
        {#if findings.length > 0}
          <ul class="ds-demo-app__list" aria-label="Findings">
            {#each findings as finding (finding.path)}
              <li data-tx-ds-demo-finding={finding.code}>
                <code>{finding.code}</code> at <code>{finding.path}</code>: {finding.message}
              </li>
            {/each}
          </ul>
        {/if}
        <p class="ds-demo-app__muted">
          The same check runs in CI as <code>texuli ds validate --locked</code>, on your sources and blueprints.
        </p>
        <div class="ds-demo-app__reset">
          <Button variant="outline" type="button" onclick={reset}>Reset</Button>
        </div>
      </section>
    </div>
  </div>
{/if}

<style>
  .ds-demo-app {
    display: grid;
    gap: 1.25rem;
    min-inline-size: 0;
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-inline-size: 0;
  }
  legend,
  h3 {
    margin: 0 0 0.75rem;
    font-size: 1.0625rem;
    font-weight: 700;
  }
  .ds-demo-app__brand-list {
    display: grid;
    gap: 0.75rem;
  }
  @media (min-width: 48rem) {
    .ds-demo-app__brand-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  .ds-demo-app__brand {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.25rem 0.5rem;
    align-items: center;
    padding: 0.875rem 1rem;
    border: 1px solid color-mix(in oklab, var(--tx-border) 80%, transparent);
    border-radius: calc(var(--tx-radius, 0.5rem) * 1.5);
    background: var(--tx-background);
    cursor: pointer;
  }
  .ds-demo-app__brand[data-checked] {
    border-color: var(--home-accent, var(--tx-primary));
    box-shadow: 0 0 0 1px var(--home-accent, var(--tx-primary));
  }
  .ds-demo-app__brand:focus-within {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .ds-demo-app__brand-name {
    font-weight: 700;
  }
  .ds-demo-app__brand-kind {
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    background: var(--tx-muted);
    color: var(--tx-foreground);
    font-size: 0.8125rem;
  }
  .ds-demo-app__brand-summary {
    grid-column: 1 / -1;
    color: var(--tx-muted-foreground);
    font-size: 0.9375rem;
  }
  .ds-demo-app__grid {
    display: grid;
    gap: 1.25rem;
  }
  @media (min-width: 64rem) {
    .ds-demo-app__grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  .ds-demo-app__panel {
    display: grid;
    align-content: start;
    gap: 0.75rem;
    min-inline-size: 0;
    padding: 1.25rem;
    border: 1px solid color-mix(in oklab, var(--tx-border) 80%, transparent);
    border-radius: calc(var(--tx-radius, 0.5rem) * 1.5);
    background: var(--tx-background);
  }
  .ds-demo-app__panel h3 {
    margin: 0;
  }
  .ds-demo-app__code {
    margin: 0;
    max-block-size: 12rem;
    overflow: auto;
    padding: 0.75rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-muted);
    font-size: 0.8125rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .ds-demo-app__command,
  .ds-demo-app__report-summary,
  .ds-demo-app__approval,
  .ds-demo-app__status,
  .ds-demo-app__list-title,
  .ds-demo-app__muted {
    margin: 0;
  }
  .ds-demo-app__command code,
  .ds-demo-app__list code {
    overflow-wrap: anywhere;
    font-size: 0.8125rem;
  }
  .ds-demo-app__report-summary,
  .ds-demo-app__status {
    font-weight: 650;
  }
  .ds-demo-app__list-title {
    font-weight: 650;
    font-size: 0.9375rem;
  }
  .ds-demo-app__list {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding-inline-start: 1.1rem;
    font-size: 0.9375rem;
  }
  .ds-demo-app__muted {
    color: var(--tx-muted-foreground);
    font-size: 0.9375rem;
  }
  .ds-demo-app__modes {
    display: flex;
    gap: 1rem;
  }
  .ds-demo-app__modes label,
  .ds-demo-app__toggles label {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    min-block-size: 2.75rem;
  }
  .ds-demo-app__modes input,
  .ds-demo-app__toggles input,
  .ds-demo-app__brand input {
    inline-size: 1.125rem;
    block-size: 1.125rem;
    margin: 0;
    accent-color: var(--home-accent, var(--tx-primary));
  }
  .ds-demo-app__sr {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .ds-demo-app__scope {
    padding: 1rem;
    border-radius: calc(var(--tx-radius, 0.5rem) * 1.25);
    background: var(--tx-background);
    color: var(--tx-foreground);
    font-family: var(--tx-font-sans, inherit);
  }
  .ds-demo-app__field {
    display: grid;
    gap: 0.35rem;
    font-weight: 600;
  }
  .ds-demo-app__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .ds-demo-app__blocked {
    padding: 0.35rem 0.6rem;
    border: 1px dashed var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    color: var(--tx-muted-foreground);
    font-size: 0.875rem;
  }
  .ds-demo-app__reset {
    justify-self: start;
  }
</style>

<script lang="ts">
/**
 * /motion-page/ tokens explorer: every motion token from
 * `@texuli/tokens/motion` with its value and custom property, in Tabs (the
 * indicator glides: layout motion). Play a token and the preview runner
 * crosses its track with that timing, at the page's settings.
 */
import { animate, type MotionTiming } from '@texuli/core/motion';
import {
  MOTION_DURATION_STEPS,
  MOTION_DURATIONS,
  MOTION_EASING_NAMES,
  MOTION_EASINGS,
  MOTION_SPRING_NAMES,
  MOTION_SPRINGS,
  motionDurationVar,
  motionEasingVar,
  motionSpringVars,
} from '@texuli/tokens/motion';
import { MotionProvider } from 'texuli/motion';
import { Tabs } from 'texuli/tabs-accordion';
import SettingsNote from './SettingsNote.svelte';
import { describeRun, MOTION_SETTINGS, providerReduced, runtimeTiming } from './settings.svelte.ts';

const TABS = [
  { value: 'durations', label: 'Durations' },
  { value: 'easings', label: 'Easings' },
  { value: 'springs', label: 'Springs' },
];
/** Easings preview at the `slower` step, long enough to see the curve. */
const EASING_PREVIEW_MS = MOTION_DURATIONS.slower;

let tab = $state('durations');
let track = $state<HTMLElement | null>(null);
let runner = $state<HTMLElement | null>(null);
let playing = $state('Pick a token to play it');
let outcome = $state<string | undefined>(undefined);

function play(label: string, timing: MotionTiming): void {
  if (!track || !runner) return;
  const distance = Math.max(0, track.clientWidth - runner.offsetWidth - 8);
  const run = animate(
    runner,
    [{ transform: 'translateX(0)' }, { transform: `translateX(${distance}px)` }],
    { ...timing, ...runtimeTiming() }
  );
  playing = label;
  outcome = describeRun(run);
  void run.finished.then((result) => {
    outcome = describeRun(run, result);
  });
}
</script>

<MotionProvider level={MOTION_SETTINGS.level} reducedMotion={providerReduced()}>
  <div class="tokens" data-motion-tokens="">
    <div class="preview">
      <p class="preview__label" data-motion-token-playing="">{playing}</p>
      <div class="preview__track" bind:this={track}>
        <span class="preview__runner" bind:this={runner} aria-hidden="true"></span>
      </div>
    </div>

    <Tabs bind:value={tab} items={TABS} label="Motion tokens" variant="pills">
      {#snippet content(item)}
        {#if item.value === 'durations'}
          <div class="table-scroll" role="region" aria-label="Duration tokens" tabindex="0"><table>
            <caption>Five duration steps (theme defaults)</caption>
            <thead>
              <tr><th scope="col">Step</th><th scope="col">Default</th><th scope="col">Custom property</th><th scope="col"><span class="sr-only">Play</span></th></tr>
            </thead>
            <tbody>
              {#each MOTION_DURATION_STEPS as step (step)}
                <tr>
                  <th scope="row"><code>{step}</code></th>
                  <td>{MOTION_DURATIONS[step]} ms</td>
                  <td><code>{motionDurationVar(step)}</code></td>
                  <td>
                    <button
                      type="button"
                      data-token-play={step}
                      onclick={() =>
                        play(`Duration ${step}: ${MOTION_DURATIONS[step]} ms, standard easing`, {
                          duration: MOTION_DURATIONS[step],
                          easing: MOTION_EASINGS.standard,
                        })}>Play <span class="sr-only">{step}</span></button
                    >
                  </td>
                </tr>
              {/each}
            </tbody>
          </table></div>
        {:else if item.value === 'easings'}
          <div class="table-scroll" role="region" aria-label="Easing tokens" tabindex="0"><table>
            <caption>Five easings (previewed at {EASING_PREVIEW_MS} ms)</caption>
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Value</th><th scope="col">Custom property</th><th scope="col"><span class="sr-only">Play</span></th></tr>
            </thead>
            <tbody>
              {#each MOTION_EASING_NAMES as name (name)}
                <tr>
                  <th scope="row"><code>{name}</code></th>
                  <td><code>{MOTION_EASINGS[name]}</code></td>
                  <td><code>{motionEasingVar(name)}</code></td>
                  <td>
                    <button
                      type="button"
                      onclick={() =>
                        play(`Easing ${name} over ${EASING_PREVIEW_MS} ms`, {
                          duration: EASING_PREVIEW_MS,
                          easing: MOTION_EASINGS[name],
                        })}>Play <span class="sr-only">{name}</span></button
                    >
                  </td>
                </tr>
              {/each}
            </tbody>
          </table></div>
        {:else}
          <div class="table-scroll" role="region" aria-label="Spring tokens" tabindex="0"><table>
            <caption>Three springs (stiffness, damping, mass; a precomputed linear() curve)</caption>
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Parameters</th><th scope="col">Custom properties</th><th scope="col"><span class="sr-only">Play</span></th></tr>
            </thead>
            <tbody>
              {#each MOTION_SPRING_NAMES as name (name)}
                {@const spring = MOTION_SPRINGS[name]}
                {@const vars = motionSpringVars(name)}
                <tr>
                  <th scope="row"><code>{name}</code></th>
                  <td>{spring.stiffness} / {spring.damping} / {spring.mass}, {spring.durationMs} ms</td>
                  <td><code>{vars.easing}</code> <code>{vars.duration}</code></td>
                  <td>
                    <button
                      type="button"
                      onclick={() =>
                        play(`Spring ${name}: settles in ${spring.durationMs} ms`, {
                          spring: { stiffness: spring.stiffness, damping: spring.damping, mass: spring.mass },
                        })}>Play <span class="sr-only">{name}</span></button
                    >
                  </td>
                </tr>
              {/each}
            </tbody>
          </table></div>
        {/if}
      {/snippet}
    </Tabs>
    <SettingsNote name="tokens" {outcome} />
  </div>
</MotionProvider>

<style>
  .tokens {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    min-inline-size: 0;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .preview {
    display: grid;
    gap: 0.4rem;
  }
  .preview__label {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .preview__track {
    block-size: 2rem;
    padding: 0.25rem;
    border-radius: 999px;
    background: var(--tx-muted, Canvas);
    border: 1px solid var(--tx-border, CanvasText);
  }
  .preview__runner {
    display: block;
    inline-size: 2.5rem;
    block-size: 1.5rem;
    border-radius: 999px;
    background: var(--tx-primary, CanvasText);
  }
  .tokens :global(.tx-tabs),
  .tokens :global(.tx-tabs__panel) {
    min-inline-size: 0;
  }
  .table-scroll {
    /* Contains the visually hidden labels, which are absolutely positioned. */
    position: relative;
    max-inline-size: 100%;
    overflow-x: auto;
  }
  .table-scroll:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  table {
    inline-size: 100%;
    min-inline-size: 30rem;
    border-collapse: collapse;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }
  caption {
    margin-block: 0.75rem 0.4rem;
    text-align: start;
    color: var(--tx-muted-foreground, CanvasText);
  }
  th,
  td {
    padding: 0.4rem 0.5rem;
    border-block-end: 1px solid var(--tx-border, CanvasText);
    text-align: start;
    vertical-align: middle;
  }
  thead th {
    font-weight: 600;
  }
  td code {
    overflow-wrap: anywhere;
  }
  button {
    min-block-size: 2rem;
    padding-inline: 0.7rem;
    border: 1px solid var(--tx-border, ButtonText);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (forced-colors: active) {
    .preview__runner {
      forced-color-adjust: none;
      background: CanvasText;
    }
  }
</style>

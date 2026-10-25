<script lang="ts">
import type { Component } from 'svelte';
import { type ClassValue, cx } from 'texuli/cx';
import { EASING_NAMES, type EasingName } from '../animation/types.ts';
import type { CompositionIssue } from '../composition-model/types.ts';
import { sampleCompositionV2 } from '../composition-v2/animation.ts';
import {
  createTimelineHistory,
  snapTime,
  type TimelineAction,
  type TimelineDocument,
  type TimelineHistory,
  timelineDuration,
  timelineHistoryReducer,
  timelineRows,
} from './model.ts';
import './timeline.css';

type Props = {
  /** Composition v2 (or v1) data; validated when it changes. */
  composition: unknown;
  /** A v1 animation doc over that composition. */
  animation: unknown;
  trust?: 'developer' | 'untrusted';
  /** The edited doc; also reported through `onchange`. */
  value?: TimelineDocument | undefined;
  onchange?: (doc: TimelineDocument) => void;
  /** Bindable playhead, in milliseconds. */
  timeMs?: number;
  /** Keyboard and drag step, in milliseconds. Shift moves ten steps. */
  stepMs?: number;
  /** Show a rendered preview of the frame at the playhead. */
  preview?: boolean;
  title?: string;
  class?: ClassValue;
};

let {
  composition: compositionInput,
  animation: animationInput,
  trust = 'untrusted',
  value = $bindable(),
  onchange,
  timeMs = $bindable(0),
  stepMs = 100,
  preview = true,
  title = 'Animation timeline',
  class: className,
}: Props = $props();

type Validated =
  | { ok: true; doc: TimelineDocument }
  | { ok: false; errors: readonly CompositionIssue[] };

let history = $state.raw<TimelineHistory | null>(null);
let loadErrors = $state.raw<readonly CompositionIssue[] | null>(null);
let SvgHost = $state.raw<Component<Record<string, unknown>> | null>(null);
let selected = $state<{ layerId: string; index: number } | null>(null);
let announcement = $state('');
let rootEl: HTMLElement | undefined = $state();

// Validate the inputs with the full v2 validators, loaded on demand so the
// timeline entry stays small. A new input replaces the history.
$effect(() => {
  const compositionValue = compositionInput;
  const animationValue = animationInput;
  const tier = trust;
  let active = true;
  void import('../composition-v2/validate.ts').then(async ({ validateCompositionV2 }) => {
    const { validateAnimationV2 } = await import('../composition-v2/animation.ts');
    const composition = validateCompositionV2(compositionValue, { trust: tier });
    let result: Validated;
    if (!composition.ok) result = composition;
    else {
      const animation = validateAnimationV2(animationValue, composition.composition);
      result = animation.ok
        ? {
            ok: true,
            doc: { composition: composition.composition, animation: animation.animation },
          }
        : { ok: false, errors: animation.errors };
    }
    if (!active) return;
    if (result.ok) {
      loadErrors = null;
      history = createTimelineHistory(result.doc);
      value = result.doc;
    } else {
      loadErrors = result.errors;
      history = null;
    }
  });
  return () => {
    active = false;
  };
});

$effect(() => {
  if (!preview || SvgHost) return;
  void import('../composition-svg/CompositionSvg.svelte').then((module) => {
    SvgHost = module.default as unknown as Component<Record<string, unknown>>;
  });
});

let doc = $derived(history?.present ?? null);
let durationMs = $derived(doc ? timelineDuration(doc) : 0);
let rows = $derived(doc ? timelineRows(doc) : []);
let frame = $derived(
  doc && preview ? sampleCompositionV2(doc.composition, doc.animation, timeMs) : null
);
let selectedKeyframe = $derived.by(() => {
  if (!doc || !selected) return null;
  const track = doc.animation.tracks.find((t) => t.layerId === selected?.layerId);
  return track?.keyframes[selected.index] ?? null;
});

const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const percent = (ms: number) => (durationMs > 0 ? (ms / durationMs) * 100 : 0);

function dispatch(next: TimelineHistory, message: string) {
  const before = history;
  history = next;
  if (next.errors.length > 0 && next.present === before?.present) {
    announcement = `Not applied: ${next.errors[0]?.message ?? 'invalid edit'}`;
    return;
  }
  if (next.present !== before?.present) {
    announcement = message;
    value = next.present;
    onchange?.(next.present);
  }
}

function apply(action: TimelineAction, message: string) {
  if (history) dispatch(timelineHistoryReducer(history, { type: 'apply', action }), message);
}

function undo() {
  if (history) dispatch(timelineHistoryReducer(history, { type: 'undo' }), 'Undone.');
}

function redo() {
  if (history) dispatch(timelineHistoryReducer(history, { type: 'redo' }), 'Redone.');
}

function onRootKeydown(event: KeyboardEvent) {
  const mod = event.ctrlKey || event.metaKey;
  if (!mod) return;
  const key = event.key.toLowerCase();
  if (key === 'z' && !event.shiftKey) {
    event.preventDefault();
    undo();
  } else if ((key === 'z' && event.shiftKey) || key === 'y') {
    event.preventDefault();
    redo();
  }
}

function setWindow(layerId: string, edge: 'start' | 'end', raw: number) {
  const row = rows.find((r) => r.layerId === layerId);
  const compositionMs = doc?.composition.durationMs;
  if (!row || compositionMs === undefined) return;
  const time = snapTime(raw, stepMs, compositionMs);
  const startMs = edge === 'start' ? time : row.window.startMs;
  const endMs = edge === 'end' ? time : row.window.endMs;
  apply(
    { type: 'set-window', layerId, startMs, endMs },
    `${row.label} shows from ${seconds(startMs)} to ${seconds(endMs)}.`
  );
}

function moveKeyframe(layerId: string, index: number, timeMsValue: number) {
  if (!doc) return;
  const time = snapTime(timeMsValue, 1, doc.animation.durationMs);
  apply(
    { type: 'move-keyframe', layerId, index, timeMs: time },
    `Keyframe moved to ${seconds(time)}.`
  );
  // Moving reorders the track: keep the selection on the moved keyframe.
  const track = history?.present.animation.tracks.find((t) => t.layerId === layerId);
  const moved = track?.keyframes.findIndex((k) => k.timeMs === time) ?? -1;
  if (moved >= 0) selected = { layerId, index: moved };
}

function onKeyframeKeydown(event: KeyboardEvent, layerId: string, index: number, at: number) {
  const step = stepMs * (event.shiftKey ? 10 : 1);
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    const forward = event.key === 'ArrowRight' ? 1 : -1;
    // Arrows follow reading direction: in right-to-left layouts Left moves later.
    const rtl = rootEl ? getComputedStyle(rootEl).direction === 'rtl' : false;
    moveKeyframe(layerId, index, at + step * forward * (rtl ? -1 : 1));
    focusKeyframe(layerId);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    apply({ type: 'remove-keyframe', layerId, index }, `Keyframe at ${seconds(at)} removed.`);
    selected = null;
  }
}

function focusKeyframe(layerId: string) {
  queueMicrotask(() => {
    const index = selected?.layerId === layerId ? selected.index : 0;
    rootEl
      ?.querySelector<HTMLButtonElement>(`[data-tx-timeline-keyframe="${layerId}:${index}"]`)
      ?.focus();
  });
}

let drag: { layerId: string; index: number; track: DOMRect; rtl: boolean } | null = null;

function onKeyframePointerDown(event: PointerEvent, layerId: string, index: number) {
  const track = (event.currentTarget as HTMLElement).closest('[data-tx-timeline-track]');
  if (!track) return;
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  drag = {
    layerId,
    index,
    track: track.getBoundingClientRect(),
    rtl: getComputedStyle(track).direction === 'rtl',
  };
  selected = { layerId, index };
}

function onKeyframePointerMove(event: PointerEvent) {
  if (!drag || !doc || drag.track.width <= 0) return;
  const offset = drag.rtl ? drag.track.right - event.clientX : event.clientX - drag.track.left;
  const ratio = Math.min(Math.max(offset / drag.track.width, 0), 1);
  const time = snapTime(ratio * durationMs, stepMs, doc.animation.durationMs);
  moveKeyframe(drag.layerId, drag.index, time);
  if (selected) drag = { ...drag, index: selected.index };
}

function onKeyframePointerUp() {
  drag = null;
}
</script>

<!-- Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z or +Y undo and redo inside the timeline. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  bind:this={rootEl}
  class={cx('tx-animation-timeline', className)}
  aria-label={title}
  data-tx-animation-timeline
  onkeydown={onRootKeydown}
>
  {#if loadErrors}
    <p class="tx-animation-timeline__error" role="alert">This animation cannot be edited.</p>
    <ul class="tx-animation-timeline__issues">
      {#each loadErrors as issue (issue.path + issue.message)}
        <li><code>{issue.path || 'doc'}</code>: {issue.message}</li>
      {/each}
    </ul>
  {:else if doc}
    {#if preview}
      <div class="tx-animation-timeline__stage" data-tx-timeline-stage>
        {#if SvgHost && frame}
          <SvgHost composition={frame} title={`${title} at ${seconds(timeMs)}`} {trust} validate={false} />
        {:else}
          <p role="status">Loading preview…</p>
        {/if}
      </div>
    {/if}

    <div class="tx-animation-timeline__toolbar" role="group" aria-label="Timeline controls">
      <button
        type="button"
        class="tx-animation-timeline__btn"
        disabled={(history?.past.length ?? 0) === 0}
        onclick={undo}>Undo</button
      >
      <button
        type="button"
        class="tx-animation-timeline__btn"
        disabled={(history?.future.length ?? 0) === 0}
        onclick={redo}>Redo</button
      >
      <label class="tx-animation-timeline__playhead">
        <span>Playhead</span>
        <input
          type="range"
          min="0"
          max={durationMs}
          step={stepMs}
          value={timeMs}
          aria-valuetext={seconds(timeMs)}
          data-tx-timeline-playhead
          oninput={(event) => (timeMs = Number(event.currentTarget.value))}
        />
      </label>
      <output class="tx-animation-timeline__time">{seconds(timeMs)} / {seconds(durationMs)}</output>
    </div>

    <p class="tx-animation-timeline__status" role="status" aria-live="polite" data-tx-timeline-status>
      {announcement}
    </p>

    <!-- Narrow screens scroll the table sideways instead of widening the editor. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="tx-animation-timeline__table-scroll"
      role="region"
      aria-label="Layers, windows and keyframes"
      tabindex="0"
      data-tx-timeline-table-scroll
    >
    <table class="tx-animation-timeline__table">
      <caption class="tx-animation-timeline__caption">Layers, windows and keyframes</caption>
      <thead>
        <tr>
          <th scope="col">Layer</th>
          <th scope="col">Window</th>
          <th scope="col">Keyframes</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.layerId)}
          <tr data-tx-timeline-row={row.layerId} data-kind={row.kind}>
            <th scope="row" class="tx-animation-timeline__layer" style={`--tx-timeline-depth: ${row.depth}`}>
              <span class="tx-animation-timeline__label">{row.label}</span>
              <span class="tx-animation-timeline__kind">{row.kind}</span>
            </th>
            <td class="tx-animation-timeline__window">
              <div class="tx-animation-timeline__bar" aria-hidden="true">
                <span
                  class="tx-animation-timeline__span"
                  style={`inset-inline-start: ${percent(row.effective.startMs)}%; inline-size: ${percent(row.effective.endMs - row.effective.startMs)}%`}
                ></span>
              </div>
              {#if doc.composition.durationMs !== undefined}
                <label class="tx-animation-timeline__edge">
                  <span>Start</span>
                  <input
                    type="range"
                    min="0"
                    max={doc.composition.durationMs}
                    step={stepMs}
                    value={row.window.startMs}
                    aria-label={`Start of ${row.label}`}
                    aria-valuetext={seconds(row.window.startMs)}
                    data-tx-timeline-start={row.layerId}
                    onchange={(event) => setWindow(row.layerId, 'start', Number(event.currentTarget.value))}
                  />
                </label>
                <label class="tx-animation-timeline__edge">
                  <span>End</span>
                  <input
                    type="range"
                    min="0"
                    max={doc.composition.durationMs}
                    step={stepMs}
                    value={row.window.endMs}
                    aria-label={`End of ${row.label}`}
                    aria-valuetext={seconds(row.window.endMs)}
                    data-tx-timeline-end={row.layerId}
                    onchange={(event) => setWindow(row.layerId, 'end', Number(event.currentTarget.value))}
                  />
                </label>
                {#if row.window.own}
                  <button
                    type="button"
                    class="tx-animation-timeline__btn"
                    aria-label={`Show ${row.label} for the whole timeline`}
                    onclick={() =>
                      apply({ type: 'clear-window', layerId: row.layerId }, `${row.label} shows for the whole timeline.`)}
                    >Clear</button
                  >
                {/if}
              {:else}
                <span class="tx-animation-timeline__note">Static composition</span>
              {/if}
            </td>
            <td class="tx-animation-timeline__keys">
              <div class="tx-animation-timeline__track" data-tx-timeline-track>
                {#each row.keyframes as at, index (`${row.layerId}:${index}`)}
                  <button
                    type="button"
                    class="tx-animation-timeline__keyframe"
                    style={`inset-inline-start: ${percent(at)}%`}
                    aria-label={`Keyframe ${index + 1} of ${row.keyframes.length} on ${row.label} at ${seconds(at)}`}
                    aria-pressed={selected?.layerId === row.layerId && selected.index === index}
                    data-tx-timeline-keyframe={`${row.layerId}:${index}`}
                    onclick={() => {
                      selected = { layerId: row.layerId, index };
                      timeMs = at;
                    }}
                    onkeydown={(event) => onKeyframeKeydown(event, row.layerId, index, at)}
                    onpointerdown={(event) => onKeyframePointerDown(event, row.layerId, index)}
                    onpointermove={onKeyframePointerMove}
                    onpointerup={onKeyframePointerUp}
                    onpointercancel={onKeyframePointerUp}
                  ></button>
                {/each}
              </div>
              <button
                type="button"
                class="tx-animation-timeline__btn"
                aria-label={`Add a keyframe to ${row.label} at ${seconds(timeMs)}`}
                data-tx-timeline-add={row.layerId}
                onclick={() =>
                  apply(
                    { type: 'add-keyframe', layerId: row.layerId, timeMs: Math.round(Math.min(timeMs, doc?.animation.durationMs ?? 0)) },
                    `Keyframe added to ${row.label} at ${seconds(timeMs)}.`
                  )}>Add keyframe</button
              >
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>

    {#if selected && selectedKeyframe}
      {@const current = selected}
      <fieldset class="tx-animation-timeline__inspector" data-tx-timeline-inspector>
        <legend>Keyframe at {seconds(selectedKeyframe.timeMs)} on {rows.find((r) => r.layerId === current.layerId)?.label}</legend>
        <label>
          <span>Easing into this keyframe</span>
          <select
            value={selectedKeyframe.easing ?? 'linear'}
            onchange={(event) =>
              apply(
                { type: 'set-easing', layerId: current.layerId, index: current.index, easing: event.currentTarget.value as EasingName },
                `Easing set to ${event.currentTarget.value}.`
              )}
          >
            {#each EASING_NAMES as easing (easing)}
              <option value={easing}>{easing}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>Opacity</span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={selectedKeyframe.opacity ?? ''}
            onchange={(event) => {
              const opacity = Number(event.currentTarget.value);
              apply(
                { type: 'update-keyframe', layerId: current.layerId, index: current.index, values: { opacity } },
                `Opacity set to ${opacity}.`
              );
            }}
          />
        </label>
      </fieldset>
    {/if}
  {:else}
    <p role="status">Loading timeline…</p>
  {/if}
</section>

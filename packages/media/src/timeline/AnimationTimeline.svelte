<script lang="ts">
import type { Component } from 'svelte';
import type { ClassValue } from 'texuli/cx';
import type { TimelineLabels } from './labels.ts';
import type { TimelineDocument } from './model.ts';

/**
 * The animation timeline editor. This entry stays small: the editor UI, its
 * model and the preview renderer load as separate chunks when it mounts.
 */
type Props = {
  composition: unknown;
  animation: unknown;
  trust?: 'developer' | 'untrusted';
  value?: TimelineDocument | undefined;
  onchange?: (document: TimelineDocument) => void;
  timeMs?: number;
  stepMs?: number;
  preview?: boolean;
  title?: string;
  labels?: Partial<TimelineLabels>;
  class?: ClassValue;
};

let { value = $bindable(), timeMs = $bindable(0), ...rest }: Props = $props();

let Editor = $state.raw<Component<Props, Record<string, never>, 'value' | 'timeMs'> | null>(null);
let failed = $state(false);

$effect(() => {
  if (Editor) return;
  void import('./TimelineEditor.svelte').then(
    (module) => {
      Editor = module.default as unknown as Component<
        Props,
        Record<string, never>,
        'value' | 'timeMs'
      >;
    },
    () => {
      failed = true;
    }
  );
});
</script>

{#if Editor}
  <Editor {...rest} bind:value bind:timeMs />
{:else if failed}
  <p role="alert">{rest.labels?.loadFailed ?? 'The animation timeline could not be loaded.'}</p>
{:else}
  <p role="status">{rest.labels?.loadingTimeline ?? 'Loading timeline…'}</p>
{/if}

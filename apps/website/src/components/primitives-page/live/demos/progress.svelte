<script lang="ts" module>
import { type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'number', name: 'value', label: 'value', min: 0, max: 100, step: 5, default: 40 },
    {
      kind: 'boolean',
      name: 'indeterminate',
      label: 'Indeterminate (value={null})',
      default: false,
    },
    {
      kind: 'enum',
      name: 'tone',
      label: 'Tone',
      options: ['primary', 'success', 'warning', 'destructive'],
      default: 'primary',
    },
    { kind: 'enum', name: 'size', label: 'Size', options: ['sm', 'md', 'lg'], default: 'md' },
  ],
  keys: [],
  uncontrolled: 'A fixed value from the props panel: the bar only reports it, with aria-valuenow.',
  controlled: 'The value lives in your state; buttons outside advance or reset the upload.',
  code: (v) => `<script lang="ts">
  import { Progress } from '@texuli/primitives/progress';
  let value = $state<number | null>(${v.indeterminate === true ? 'null' : String(v.value)});
${SCRIPT_END}

<span id="upload-label">Uploading report.pdf</span>
<Progress.Root {value} max={100} aria-labelledby="upload-label">
  <div class="indicator" style:inline-size="{value ?? 0}%"></div>
</Progress.Root>
${recipeLine('progressClass', 'texuli/feedback', { tone: String(v.tone), size: String(v.size), shape: 'linear' })}`,
  controlCheck: {
    act: '[data-demo-act="advance"]',
    expect: {
      selector: '[data-demo-part="Progress.Root"]',
      attribute: 'aria-valuenow',
      value: '35',
    },
  },
};
</script>

<script lang="ts">
import { Progress } from '@texuli/primitives/progress';
import { Button } from 'texuli/button';
import { progressClass } from 'texuli/feedback';
import { bool, type DemoProps, num, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const TONES = ['primary', 'success', 'warning', 'destructive'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const tone = $derived(TONES.find((entry) => entry === str(values, 'tone')) ?? 'primary');
const size = $derived(SIZES.find((entry) => entry === str(values, 'size')) ?? 'md');
const indeterminate = $derived(bool(values, 'indeterminate'));

let uploaded = $state(10);
const value = $derived<number | null>(
  mode === 'uncontrolled' ? (indeterminate ? null : num(values, 'value', 40)) : uploaded
);
const labelId = $derived(`demo-progress-${mode}`);
</script>

<div
  class={progressClass({ tone, size, shape: 'linear' })}
  data-tx-progress=""
  data-shape="linear"
  data-tone={tone}
  data-size={size}
  data-state={value === null ? 'indeterminate' : value >= 100 ? 'complete' : 'loading'}
>
  <div class="tx-progress__head">
    <span class="tx-progress__label" id={labelId}>Uploading report.pdf</span>
    {#if value !== null}
      <span class="tx-progress__value" data-tx-progress-value="">{value}%</span>
    {/if}
  </div>
  <Progress.Root
    {value}
    max={100}
    aria-labelledby={labelId}
    aria-valuetext={value === null ? 'Loading' : `${value}%`}
    class="tx-progress__track"
    data-tx-progress-track=""
    data-demo-part="Progress.Root"
  >
    <div
      class={['tx-progress__indicator', value === null && 'tx-progress__indicator--indeterminate']}
      style:--tx-progress-value={value === null ? undefined : `${value}%`}
      data-tx-progress-indicator=""
    ></div>
  </Progress.Root>
</div>

{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>Uploaded: {uploaded}%</output>
    <Button size="sm" variant="outline" onclick={() => (uploaded = Math.min(100, uploaded + 25))} data-demo-act="advance">Add 25%</Button>
    <Button size="sm" variant="ghost" onclick={() => (uploaded = 10)}>Reset</Button>
  </div>
{/if}

<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'enum', name: 'size', label: 'Size', options: ['sm', 'md', 'lg'], default: 'lg' },
    { kind: 'number', name: 'delayMs', label: 'delayMs', min: 0, max: 2000, step: 250, default: 0 },
    { kind: 'string', name: 'initials', label: 'Fallback text', default: 'AE' },
  ],
  keys: [],
  uncontrolled:
    'Side by side: a same-origin photo that loads, and a source the URL policy blocks, which keeps the fallback.',
  controlled: 'bind:loadingStatus reports loading, loaded or error; swap the source from outside.',
  code: (v) => `<script lang="ts">
  import { Avatar } from '@texuli/primitives/avatar';
  let status = $state<'loading' | 'loaded' | 'error'>('loading');
${SCRIPT_END}

<Avatar.Root bind:loadingStatus={status}${attr('delayMs', v.delayMs ?? 0, 0)}>
  <Avatar.Image src="/media-lab/harbor.svg" srcTrust="developer" alt="" />
  <Avatar.Fallback>${v.initials}</Avatar.Fallback>
</Avatar.Root>

${recipeLine('avatarRootClass', 'texuli/avatar', { size: v.size ?? 'lg' })}`,
  controlCheck: {
    act: '[data-demo-act="block"]',
    expect: { selector: '[data-demo-part="Avatar.Root"]', attribute: 'data-state', value: 'error' },
  },
};
</script>

<script lang="ts">
import { Avatar } from '@texuli/primitives/avatar';
import { AVATAR_PIXELS, type AvatarSize, avatarRootClass } from 'texuli/avatar';
import { Button } from 'texuli/button';
import { type DemoProps, num, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
/** A same-origin, fictional picture shipped with the site. */
const PHOTO = `${BASE}media-lab/harbor.svg`;
/** `data:image/svg+xml` is refused by the image URL policy, so it never loads. */
const BLOCKED = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';

const size = $derived<AvatarSize>(
  (['sm', 'md', 'lg'] as const).find((option) => option === str(values, 'size')) ?? 'lg'
);
const delayMs = $derived(num(values, 'delayMs'));
const initials = $derived(str(values, 'initials').slice(0, 3) || 'AE');
const pixels = $derived(AVATAR_PIXELS[size]);

let status = $state<'loading' | 'loaded' | 'error'>('loading');
let src = $state(PHOTO);
</script>

{#snippet avatar(source: string, label: string)}
  <div class={avatarRootClass({ size })} data-tx-avatar="" data-size={size} role="img" aria-label={label}>
    <Avatar.Root class="tx-avatar__surface" {delayMs} aria-hidden="true" data-demo-part="Avatar.Root">
      <Avatar.Image src={source} srcTrust="developer" alt="" width={pixels} height={pixels} class="tx-avatar__image" data-demo-part="Avatar.Image" />
      <Avatar.Fallback class="tx-avatar__fallback" data-demo-part="Avatar.Fallback">{initials}</Avatar.Fallback>
    </Avatar.Root>
  </div>
{/snippet}

{#if mode === 'uncontrolled'}
  <div class="demo-controls">
    {#key delayMs}
      {@render avatar(PHOTO, 'Harbor crew (photo loads)')}
      {@render avatar(BLOCKED, 'Ada Example (source blocked, fallback shown)')}
    {/key}
  </div>
{:else}
  <div class="demo-controls">
    <div class={avatarRootClass({ size })} data-tx-avatar="" data-size={size} role="img" aria-label="Ada Example">
      <Avatar.Root class="tx-avatar__surface" {delayMs} bind:loadingStatus={status} aria-hidden="true" data-demo-part="Avatar.Root">
        <Avatar.Image {src} srcTrust="developer" alt="" width={pixels} height={pixels} class="tx-avatar__image" data-demo-part="Avatar.Image" />
        <Avatar.Fallback class="tx-avatar__fallback" data-demo-part="Avatar.Fallback">{initials}</Avatar.Fallback>
      </Avatar.Root>
    </div>
    <output data-demo-readout>loadingStatus: {status}</output>
    <Button size="sm" variant="outline" onclick={() => (src = BLOCKED)} data-demo-act="block">Use a blocked source</Button>
    <Button size="sm" variant="ghost" onclick={() => (src = PHOTO)}>Use the photo</Button>
  </div>
{/if}

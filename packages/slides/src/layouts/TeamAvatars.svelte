<script lang="ts">
/**
 * `team-avatars`: up to eight people. An avatar id resolves through the host
 * adapter and a media source through the URL policy at the host's tier;
 * without either, the person shows their initials.
 */
import { Image } from '@texuli/media/image';
import { fitContent, fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { avatarId, initials, layoutImageSrc } from './media.ts';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'team-avatars'> = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
let people = $derived(
  p.people.map((person) => {
    const src = person.avatar
      ? layoutImageSrc(person.avatar, context.tier, context.resolveAvatar)
      : undefined;
    // Host-resolved avatars passed the developer tier inside `layoutImageSrc`.
    const trust = person.avatar && avatarId(person.avatar) ? 'developer' : context.tier;
    return { person, src, trust };
  })
);
</script>

<LayoutFrame layout="team-avatars" root={steps.at([])}>
  {#if p.title}
    <h2 class="tx-deck-layout__title" data-slot="title" data-clamp="2" {@attach fitText(40)}>
      {p.title}
    </h2>
  {/if}
  <ul class="people" data-slot="people" data-count={p.people.length} {@attach fitContent()}>
    {#each people as { person, src, trust }, index (index)}
      <li class="person" data-slot="person" {...steps.at(['people', index])}>
        <span class="avatar" data-avatar={src ? 'image' : 'initials'}>
          {#if src}
            <Image {src} alt="" fit="cover" {trust} loading="eager" />
          {:else}
            <span aria-hidden="true">{initials(person.name)}</span>
          {/if}
        </span>
        <p class="tx-deck-layout__lead name">{person.name}</p>
        {#if person.role}
          <p class="tx-deck-layout__caption">{person.role}</p>
        {/if}
      </li>
    {/each}
  </ul>
</LayoutFrame>

<style>
  .people {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-content: center;
    justify-items: center;
    gap: clamp(20px, 3cqi, 40px) clamp(16px, 2cqi, 28px);
    min-block-size: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .people[data-count="1"],
  .people[data-count="2"],
  .people[data-count="3"] {
    grid-template-columns: repeat(var(--tx-deck-people, 3), minmax(0, 1fr));
  }

  .people[data-count="1"] {
    --tx-deck-people: 1;
  }

  .people[data-count="2"] {
    --tx-deck-people: 2;
  }

  .person {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(6px, 0.8cqi, 12px);
    min-inline-size: 0;
    text-align: center;
  }

  .avatar {
    display: grid;
    place-items: center;
    inline-size: clamp(96px, 11cqi, 160px);
    block-size: clamp(96px, 11cqi, 160px);
    overflow: hidden;
    border: clamp(3px, 0.4cqi, 6px) solid var(--tx-deck-accent);
    border-radius: 50%;
    background: var(--tx-deck-panel);
    font-family: var(--tx-font-heading, inherit);
    font-size: clamp(32px, 3.6cqi, 52px);
    font-weight: 700;
  }

  .avatar :global(.tx-image),
  .avatar :global(img) {
    inline-size: 100%;
    block-size: 100%;
    max-inline-size: none;
    object-fit: cover;
  }

  .name {
    font-weight: 600;
    font-family: var(--tx-font-heading, inherit);
    overflow-wrap: anywhere;
  }

  @container (max-inline-size: 48rem) {
    .people,
    .people[data-count] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>

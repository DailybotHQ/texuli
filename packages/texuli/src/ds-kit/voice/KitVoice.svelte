<script lang="ts" module>
import type { MessageLookup } from '@texuli/core/i18n';

/** The label of a voice item in the active locale. */
export function voiceLabel(msg: MessageLookup, id: string): string {
  switch (id) {
    case 'identity':
      return msg('texuli.ds-kit.voice.identity', 'Identity');
    case 'tone':
      return msg('texuli.ds-kit.voice.tone', 'Tone');
    case 'lexicon':
      return msg('texuli.ds-kit.voice.lexicon', 'Lexicon');
    case 'guidelines':
      return msg('texuli.ds-kit.voice.guidelines', 'Guidelines');
    case 'accessibility':
      return msg('texuli.ds-kit.voice.accessibility', 'Accessibility');
    case 'rules':
      return msg('texuli.ds-kit.voice.rules', 'Locked-mode rules');
    default:
      return id;
  }
}
</script>

<script lang="ts">
/**
 * KitVoice (kit API §5.5): the document's identity, voice (tone, lexicon,
 * guidelines), accessibility targets and locked-mode rules, as escaped text.
 * No HTML sinks, no network. Hostile strings stay text and are clipped.
 * Every group has a stable `id` for deep links (kit API §11.1). Labels go
 * through `texuli.ds-kit.*` message ids (ADR-016).
 */
import { useMessages } from '../../i18n/use-messages.ts';
import { kitItemId, kitPrefix, kitSectionId } from '../shared/navigation.ts';
import '../shared/ds-kit.css';
import { type VoiceText, voiceModel } from './model.ts';

type Props = {
  /** The source document (untrusted data). */
  document: unknown;
  /** Heading level of the section title (groups use the next level). Default 3. */
  headingLevel?: 2 | 3 | 4;
  /** Prefix of every `id` (deep links). Default `tx-ds-kit`. */
  idPrefix?: string;
  /** The current item (its group gets `aria-current`). */
  currentItem?: string;
};

let { document: doc, headingLevel = 3, idPrefix, currentItem }: Props = $props();

const model = $derived(voiceModel(doc));
const prefix = $derived(kitPrefix(idPrefix));
const h = $derived(`h${headingLevel}`);
const h2 = $derived(`h${Math.min(headingLevel + 1, 6)}`);
const msg = useMessages();
const shortened = msg('texuli.ds-kit.voice.shortened', '(shortened)');
const shown = (value: VoiceText) => (value.clipped ? `${value.text} ${shortened}` : value.text);
const gid = (item: string) => kitItemId(prefix, 'voice', item);
</script>

<section
  class="tx-ds-kit__section tx-ds-kit-voice"
  id={kitSectionId(prefix, 'voice')}
  aria-labelledby={`${kitSectionId(prefix, 'voice')}-title`}
  data-tx-ds-kit-section="voice"
>
  <svelte:element this={h} id={`${kitSectionId(prefix, 'voice')}-title`} class="tx-ds-kit__title">
    {msg('texuli.ds-kit.section.voice', 'Voice and rules')}
  </svelte:element>

  <section
    class="tx-ds-kit__group"
    id={gid('identity')}
    aria-labelledby={`${gid('identity')}-title`}
    aria-current={currentItem === 'identity' ? 'true' : undefined}
    data-tx-ds-kit-group="identity"
  >
    <svelte:element this={h2} id={`${gid('identity')}-title`} class="tx-ds-kit__subtitle">
      {voiceLabel(msg, 'identity')}
    </svelte:element>
    <dl class="tx-ds-kit-voice__fields">
      {#if model.name}
        <dt>{msg('texuli.ds-kit.voice.name', 'Name')}</dt>
        <dd>{shown(model.name)}</dd>
      {/if}
      {#if model.description}
        <dt>{msg('texuli.ds-kit.voice.description', 'Description')}</dt>
        <dd>{shown(model.description)}</dd>
      {/if}
      {#if model.owner}
        <dt>{msg('texuli.ds-kit.voice.owner', 'Owner')}</dt>
        <dd>{shown(model.owner)}</dd>
      {/if}
      {#if model.license}
        <dt>{msg('texuli.ds-kit.voice.license', 'License')}</dt>
        <dd>{shown(model.license)}</dd>
      {/if}
      {#if model.tags.length > 0}
        <dt>{msg('texuli.ds-kit.voice.tags', 'Tags')}</dt>
        <dd>{model.tags.map(shown).join(', ')}</dd>
      {/if}
    </dl>
  </section>

  {#if model.tone.length > 0}
    <section
      class="tx-ds-kit__group"
      id={gid('tone')}
      aria-labelledby={`${gid('tone')}-title`}
      aria-current={currentItem === 'tone' ? 'true' : undefined}
      data-tx-ds-kit-group="tone"
    >
      <svelte:element this={h2} id={`${gid('tone')}-title`} class="tx-ds-kit__subtitle">
        {voiceLabel(msg, 'tone')}
      </svelte:element>
      <ul class="tx-ds-kit__list">
        {#each model.tone as item, i (`${item.text}-${i}`)}
          <li>{shown(item)}</li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if model.lexicon.length > 0}
    {@const lid = gid('lexicon')}
    <section
      class="tx-ds-kit__group"
      id={lid}
      aria-labelledby={`${lid}-title`}
      aria-current={currentItem === 'lexicon' ? 'true' : undefined}
      data-tx-ds-kit-group="lexicon"
    >
      <svelte:element this={h2} id={`${lid}-title`} class="tx-ds-kit__subtitle">
        {voiceLabel(msg, 'lexicon')}
      </svelte:element>
      <div class="tx-ds-kit__table-wrap">
        <table class="tx-ds-kit__table">
          <thead>
            <tr>
              <th scope="col">{msg('texuli.ds-kit.voice.term', 'Term')}</th>
              <th scope="col">{msg('texuli.ds-kit.voice.preferred', 'Preferred')}</th>
            </tr>
          </thead>
          <tbody>
            {#each model.lexicon as row (row.id)}
              <tr id={kitItemId(prefix, 'voice', row.id)}>
                <th scope="row">{row.term}{row.clipped ? ` ${shortened}` : ''}</th>
                <td>{row.preferred}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  {#if model.guidelines.length > 0}
    <section
      class="tx-ds-kit__group"
      id={gid('guidelines')}
      aria-labelledby={`${gid('guidelines')}-title`}
      aria-current={currentItem === 'guidelines' ? 'true' : undefined}
      data-tx-ds-kit-group="guidelines"
    >
      <svelte:element this={h2} id={`${gid('guidelines')}-title`} class="tx-ds-kit__subtitle">
        {voiceLabel(msg, 'guidelines')}
      </svelte:element>
      <ol class="tx-ds-kit__list">
        {#each model.guidelines as item, i (`${item.text}-${i}`)}
          <li>{shown(item)}</li>
        {/each}
      </ol>
    </section>
  {/if}

  {#if model.accessibility}
    <section
      class="tx-ds-kit__group"
      id={gid('accessibility')}
      aria-labelledby={`${gid('accessibility')}-title`}
      aria-current={currentItem === 'accessibility' ? 'true' : undefined}
      data-tx-ds-kit-group="accessibility"
    >
      <svelte:element this={h2} id={`${gid('accessibility')}-title`} class="tx-ds-kit__subtitle">
        {voiceLabel(msg, 'accessibility')}
      </svelte:element>
      <dl class="tx-ds-kit-voice__fields">
        {#if model.accessibility.contrast}
          <dt>{msg('texuli.ds-kit.voice.contrast', 'Contrast')}</dt>
          <dd>{model.accessibility.contrast}</dd>
        {/if}
        {#if model.accessibility.targetMin}
          <dt>{msg('texuli.ds-kit.voice.target-min', 'Minimum target')}</dt>
          <dd>{model.accessibility.targetMin}</dd>
        {/if}
        {#if model.accessibility.focus}
          <dt>{msg('texuli.ds-kit.voice.focus', 'Focus')}</dt>
          <dd>{model.accessibility.focus}</dd>
        {/if}
      </dl>
    </section>
  {/if}

  <section
    class="tx-ds-kit__group"
    id={gid('rules')}
    aria-labelledby={`${gid('rules')}-title`}
    aria-current={currentItem === 'rules' ? 'true' : undefined}
    data-tx-ds-kit-group="rules"
  >
    <svelte:element this={h2} id={`${gid('rules')}-title`} class="tx-ds-kit__subtitle">
      {voiceLabel(msg, 'rules')}
    </svelte:element>
    <p>
      {#if model.rules.locked}
        {msg('texuli.ds-kit.voice.locked', 'Locked')}
        {' · '}
        {msg('texuli.ds-kit.voice.allowed-count', '{0} components allowed', {
          0: String(model.rules.allowedCount),
        })}
      {:else}
        {msg('texuli.ds-kit.voice.unlocked', 'Unlocked')}
      {/if}
    </p>
    {#if model.rules.approvalStatus}
      <p class="tx-ds-kit__muted">{model.rules.approvalStatus}</p>
    {/if}
    <p>
      {msg(
        'texuli.ds-kit.voice.layout-policy',
        'In locked mode, layout utilities only, on the token scale: display, flex, grid, gap, padding, margin, size, position and overflow. Color, typography, radius, shadow, opacity, filters, transforms, transitions and arbitrary values are not allowed. The checker owns the exact list.'
      )}
    </p>
  </section>
</section>

<style>
  .tx-ds-kit-voice__fields {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--tx-space-1) var(--tx-space-3);
    margin: 0;
  }
  .tx-ds-kit-voice__fields dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>

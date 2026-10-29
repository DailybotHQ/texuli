<script lang="ts">
// The accessible list of collaborators: who is here and which block their
// caret is in. The colored carets over the text are decorative
// (aria-hidden); this list is what assistive technology reads.
import { findNode, ownText } from '@texuli/document/model';
import { type CollabLabels, DEFAULT_COLLAB_LABELS } from './labels.ts';
import { type CollabSession, presenceColor } from './session.svelte.ts';

interface Props {
  session: CollabSession;
  labels?: CollabLabels;
}

let { session, labels = DEFAULT_COLLAB_LABELS }: Props = $props();

const uid = $props.id();
const people = $derived(
  session.collaborators.map((person) => {
    const node = person.focus ? findNode(session.document, person.focus.block)?.node : undefined;
    const where = node ? ownText(node).slice(0, 80) : null;
    return { ...person, where };
  })
);
</script>

<section class="tx-pages-collab__people" aria-labelledby={`${uid}-title`}>
  <h2 class="tx-pages-visually-hidden" id={`${uid}-title`}>{labels.collaborators}</h2>
  <ul class="tx-pages-collab__people-list">
    <li class="tx-pages-collab__person" data-replica={session.replica}>
      <span class="tx-pages-collab__swatch" aria-hidden="true" style:--tx-pages-caret-color={presenceColor(session.author.color)}></span>
      {labels.you(session.author.name)}
    </li>
    {#each people as person (person.replica)}
      <li class="tx-pages-collab__person" data-replica={person.replica}>
        <span class="tx-pages-collab__swatch" aria-hidden="true" style:--tx-pages-caret-color={presenceColor(person.color)}></span>
        {labels.collaborator(person.name, person.where)}
      </li>
    {/each}
  </ul>
</section>

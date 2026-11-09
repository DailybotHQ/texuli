<script lang="ts">
/**
 * KitLibrary (kit API §5.3 and §11.3, §11.5): the design system's own components. Each entry
 * is a card with its metadata as text, the catalog ids it composes (allowed, not allowed or
 * unknown), its approval badge with the content-hash check, and the live preview the host
 * supplies as a snippet keyed by library id — `library[id]({ id, entry, variant, mode })`,
 * once per visible mode. Without a snippet the card says the code lives with the consumer.
 * Every entry has a stable `id` for deep links. No raw HTML, no network.
 */
import { useMessages } from '../../i18n/use-messages.ts';
import { kitItemId, kitPrefix, kitSectionId } from '../shared/navigation.ts';
import type {
  KitAllowManifest,
  KitCatalog,
  KitLibrarySnippet,
  KitMode,
  KitModeView,
} from '../shared/types.ts';
import '../shared/ds-kit.css';
import './library.css';
import ApprovalBadge from './ApprovalBadge.svelte';
import { type KitComposeState, libraryModel } from './model.ts';

type Props = {
  /** The source document (its `library` and `allow`). Untrusted data. */
  document: unknown;
  /** The resolved allow manifest; omitted: the document's own `allow` applies. */
  allow?: KitAllowManifest;
  /** The catalog, to mark composed ids the catalog does not know. */
  catalog?: KitCatalog;
  /** Live previews, keyed by library id. */
  library?: Readonly<Record<string, KitLibrarySnippet>>;
  /** The design-system variant the previews show (passed to each snippet). */
  variant?: string;
  /** Light and dark side by side, or one mode. Default `both`. */
  modeView?: KitModeView;
  /** Heading level of the section title (entries use the next level). Default 3. */
  headingLevel?: 2 | 3 | 4;
  /** Prefix of every `id` (deep links). Default `tx-ds-kit`. */
  idPrefix?: string;
  /** The current item (a library id): its card gets `aria-current`. */
  currentItem?: string;
};

let {
  document: doc,
  allow,
  catalog,
  library,
  variant,
  modeView = 'both',
  headingLevel = 3,
  idPrefix,
  currentItem,
}: Props = $props();

const model = $derived(libraryModel(doc, allow, catalog));
const prefix = $derived(kitPrefix(idPrefix));
const sid = $derived(kitSectionId(prefix, 'library'));
const modes = $derived<KitMode[]>(modeView === 'both' ? ['light', 'dark'] : [modeView]);
const h = $derived(`h${headingLevel}`);
const h2 = $derived(`h${Math.min(headingLevel + 1, 6)}`);
const msg = useMessages();
const modeLabel = (mode: KitMode) =>
  mode === 'light'
    ? msg('texuli.ds-kit.mode-light', 'Light')
    : msg('texuli.ds-kit.mode-dark', 'Dark');
const composeLabel = (state: KitComposeState) =>
  state === 'allowed'
    ? msg('texuli.ds-kit.library.allowed', 'allowed')
    : state === 'not-allowed'
      ? msg('texuli.ds-kit.library.not-allowed', 'not allowed')
      : msg('texuli.ds-kit.library.unknown-id', 'not in the catalog');
const snippetFor = (id: string): KitLibrarySnippet | undefined =>
  library && Object.hasOwn(library, id) ? library[id] : undefined;
</script>

<section
  class="tx-ds-kit__section tx-ds-kit-library"
  id={sid}
  aria-labelledby={`${sid}-title`}
  data-tx-ds-kit-section="library"
>
  <svelte:element this={h} id={`${sid}-title`} class="tx-ds-kit__title">
    {msg('texuli.ds-kit.section.library', 'Library')}
  </svelte:element>
  {#if model.items.length === 0}
    <p class="tx-ds-kit__note">
      {msg('texuli.ds-kit.library.empty', 'This design system declares no components of its own.')}
    </p>
  {/if}
  {#if model.clipped}
    <p class="tx-ds-kit__note" data-tx-ds-kit-clipped="">
      {msg('texuli.ds-kit.library.clipped', 'Only the first {0} entries are shown.', { 0: model.items.length })}
    </p>
  {/if}

  {#each model.items as item (item.id)}
    {@const iid = kitItemId(prefix, 'library', item.id)}
    {@const snippet = snippetFor(item.id)}
    <article
      class="tx-ds-kit__group tx-ds-kit__library-entry"
      id={iid}
      aria-labelledby={`${iid}-title`}
      aria-current={currentItem === item.id ? 'true' : undefined}
      data-tx-ds-kit-library={item.id}
    >
      <svelte:element this={h2} id={`${iid}-title`} class="tx-ds-kit__subtitle">
        {item.name}{#if item.version}<span class="tx-ds-kit__muted"> {item.version}</span>{/if}
      </svelte:element>
      <ApprovalBadge approval={item.approval} />
      <dl class="tx-ds-kit__library-meta">
        <dt>{msg('texuli.ds-kit.library.id', 'Id')}</dt>
        <dd><code>{item.id}</code></dd>
        {#if item.purpose}
          <dt>{msg('texuli.ds-kit.library.purpose', 'Purpose')}</dt>
          <dd>{item.purpose}</dd>
        {/if}
        <dt>{msg('texuli.ds-kit.library.status', 'Status')}</dt>
        <dd data-tx-ds-kit-entry-status={item.status}>{item.status}</dd>
        <dt>{msg('texuli.ds-kit.library.composes', 'Composes')}</dt>
        <dd>
          <ul class="tx-ds-kit__library-composes">
            {#each item.composes as part (part.id)}
              <li data-tx-ds-kit-compose={part.state}><code>{part.id}</code> ({composeLabel(part.state)})</li>
            {/each}
          </ul>
        </dd>
      </dl>
      {#if snippet}
        <div class="tx-ds-kit__library-previews">
          {#each modes as mode (mode)}
            <figure class="tx-ds-kit__library-preview" data-tx-ds-kit-preview={mode}>
              <figcaption>{modeLabel(mode)}</figcaption>
              {@render snippet({ id: item.id, entry: item.entry, variant, mode })}
            </figure>
          {/each}
        </div>
      {:else}
        <p class="tx-ds-kit__note" data-tx-ds-kit-preview="none">
          {msg(
            'texuli.ds-kit.library.no-preview',
            'Preview supplied by the consumer: the code lives in the consumer design-systems folder.'
          )}
        </p>
      {/if}
    </article>
  {/each}
</section>

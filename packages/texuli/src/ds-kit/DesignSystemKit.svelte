<script lang="ts">
/**
 * DesignSystemKit (`texuli/ds-kit`, ADR-032, kit API `decisions/kit-api.md`): a whole design
 * system on one page, from data. The header names the system and shows its approval record
 * with the content-hash check (§11.3); the navigation lists the sections and their items,
 * controlled by `currentSection`/`currentItem`/`onNavigate` or uncontrolled (§11.1); the mode
 * switch shows light and dark side by side or one at a time (§4). Every section and item has
 * a stable `id` for deep links. No network, no HTML sinks: document text is rendered as text.
 *
 * Sections (T4): Foundations (with
 * `compiled`), Voice, Components (with `catalog`), Library (when the document declares
 * entries) and Changes (when `previous` is given).
 */
import { useMessages } from '../i18n/use-messages.ts';
import KitFoundations, { foundationLabel } from './foundations/KitFoundations.svelte';
import { foundationItems, foundationsModel } from './foundations/model.ts';
import KitChanges from './library/KitChanges.svelte';
import KitLibrary from './library/KitLibrary.svelte';
import { libraryModel } from './library/model.ts';
import KitMatrix from './matrix/KitMatrix.svelte';
import { matrixModel } from './matrix/model.ts';
import { kitApproval } from './shared/approval.ts';
import KitApproval from './shared/KitApproval.svelte';
import KitModeSwitch from './shared/KitModeSwitch.svelte';
import { kitText } from './shared/limits.ts';
import { kitItemId, kitPrefix, kitSectionId, kitVisibleSections } from './shared/navigation.ts';
import type { DesignSystemKitProps, KitSectionId } from './shared/types.ts';
import KitVoice, { voiceLabel } from './voice/KitVoice.svelte';
import { voiceItems, voiceModel } from './voice/model.ts';
import './shared/ds-kit.css';

let {
  document: doc,
  compiled,
  allow,
  catalog,
  previous,
  library,
  samples,
  matrix = 'grid',
  showDisallowed = true,
  sections,
  modeView = $bindable('both'),
  currentSection,
  currentItem,
  onNavigate,
  idPrefix,
  headingLevel = 2,
  label,
  class: className,
}: DesignSystemKitProps = $props();

const prefix = $derived(kitPrefix(idPrefix));
const msg = useMessages();
const name = $derived(
  kitText((doc as { name?: unknown })?.name, 200)?.text ??
    msg('texuli.ds-kit.untitled', 'Design system')
);
const version = $derived(kitText((doc as { version?: unknown })?.version, 64)?.text);
const approval = $derived(kitApproval(doc));
const foundations = $derived(compiled ? foundationsModel(compiled) : undefined);
const voice = $derived(voiceModel(doc));

/** The sections this build of the kit can show for the data it has. */
const libraryItems = $derived(libraryModel(doc, allow, catalog).items);
const matrixItems = $derived(catalog ? matrixModel(catalog, allow).enabled : []);
const available = $derived<KitSectionId[]>([
  ...(compiled ? (['foundations'] as const) : []),
  'voice',
  ...(catalog ? (['matrix'] as const) : []),
  ...(libraryItems.length > 0 ? (['library'] as const) : []),
  ...(previous ? (['changes'] as const) : []),
]);
const visible = $derived(kitVisibleSections(sections, available));

const items = (section: KitSectionId): { id: string; label: string }[] =>
  section === 'foundations' && foundations
    ? foundationItems(foundations).map((item) => ({
        ...item,
        label: foundationLabel(msg, item.id),
      }))
    : section === 'voice'
      ? voiceItems(voice).map((item) => ({ ...item, label: voiceLabel(msg, item.id) }))
      : section === 'library'
        ? libraryItems.map((item) => ({ id: item.id, label: item.name }))
        : section === 'matrix'
          ? matrixItems.map((item) => ({ id: item.id, label: item.label }))
          : [];

// Uncontrolled navigation keeps its own place; controlled navigation reads the props.
let ownSection = $state<KitSectionId | undefined>(undefined);
let ownItem = $state<string | undefined>(undefined);
const activeSection = $derived(currentSection ?? ownSection ?? visible[0]?.id);
const activeItem = $derived(currentSection !== undefined ? currentItem : ownItem);

function navigate(event: MouseEvent, section: KitSectionId, item?: string) {
  if (onNavigate) {
    // The host owns the URL (a hash router): it sets currentSection and currentItem.
    event.preventDefault();
    onNavigate(section, item);
    return;
  }
  ownSection = section;
  ownItem = item;
}

// A controlled position brings its target into view (a deep link or the host's router).
$effect(() => {
  if (currentSection === undefined || typeof window === 'undefined') return;
  const id =
    currentItem !== undefined
      ? kitItemId(prefix, currentSection, currentItem)
      : kitSectionId(prefix, currentSection);
  const target = window.document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
  target.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
});

/** A section's label in the active locale (ADR-016). */
function sectionLabel(id: KitSectionId): string {
  switch (id) {
    case 'foundations':
      return msg('texuli.ds-kit.section.foundations', 'Foundations');
    case 'voice':
      return msg('texuli.ds-kit.section.voice', 'Voice and rules');
    case 'matrix':
      return msg('texuli.ds-kit.section.matrix', 'Components');
    case 'library':
      return msg('texuli.ds-kit.section.library', 'Library');
    case 'changes':
      return msg('texuli.ds-kit.section.changes', 'Changes');
  }
}

const h = $derived(`h${headingLevel}`);
const sectionLevel = $derived((headingLevel + 1) as 3 | 4);
</script>

<div
  class={['tx-ds-kit', className]}
  id={prefix}
  role="region"
  aria-label={label ?? msg('texuli.ds-kit.label', '{0} design system kit', { 0: name })}
  data-tx-ds-kit=""
  data-tx-ds-kit-mode-view={modeView}
>
  <header class="tx-ds-kit__header">
    <svelte:element this={h} class="tx-ds-kit__title">
      {name}{#if version}<span class="tx-ds-kit__muted"> {version}</span>{/if}
    </svelte:element>
    <KitApproval {approval} label={msg('texuli.ds-kit.approval.kit-label', 'Design system approval')} />
    <KitModeSwitch bind:value={modeView} name={`${prefix}-mode`} />
    {#if visible.length > 0}
      <nav class="tx-ds-kit__nav" aria-label={msg('texuli.ds-kit.nav-label', 'Design system kit sections')}>
        <ol>
          {#each visible as section (section.id)}
            <li>
              <a
                href={`#${kitSectionId(prefix, section.id)}`}
                aria-current={activeSection === section.id && activeItem === undefined ? 'true' : undefined}
                data-tx-ds-kit-nav={section.id}
                onclick={(event) => navigate(event, section.id)}>{sectionLabel(section.id)}</a
              >
              {#if activeSection === section.id && items(section.id).length > 0}
                <ol aria-label={msg('texuli.ds-kit.nav-items-label', '{0} items', { 0: sectionLabel(section.id) })}>
                  {#each items(section.id) as item (item.id)}
                    <li>
                      <a
                        href={`#${kitItemId(prefix, section.id, item.id)}`}
                        aria-current={activeItem === item.id ? 'true' : undefined}
                        data-tx-ds-kit-nav-item={item.id}
                        onclick={(event) => navigate(event, section.id, item.id)}>{item.label}</a
                      >
                    </li>
                  {/each}
                </ol>
              {/if}
            </li>
          {/each}
        </ol>
      </nav>
    {/if}
  </header>

  {#each visible as section (section.id)}
    {#if section.id === 'foundations' && compiled}
      <KitFoundations
        {compiled}
        {modeView}
        headingLevel={sectionLevel}
        idPrefix={prefix}
        currentItem={activeSection === 'foundations' ? activeItem : undefined}
      />
    {:else if section.id === 'voice'}
      <KitVoice
        document={doc}
        headingLevel={sectionLevel}
        idPrefix={prefix}
        currentItem={activeSection === 'voice' ? activeItem : undefined}
      />
    {:else if section.id === 'matrix' && catalog}
      <KitMatrix
        {catalog}
        {allow}
        {samples}
        {matrix}
        {showDisallowed}
        {modeView}
        headingLevel={sectionLevel}
        idPrefix={prefix}
        currentItem={activeSection === 'matrix' ? activeItem : undefined}
      />
    {:else if section.id === 'library'}
      <KitLibrary
        document={doc}
        {allow}
        {catalog}
        {library}
        variant={compiled?.variant}
        {modeView}
        headingLevel={sectionLevel}
        idPrefix={prefix}
        currentItem={activeSection === 'library' ? activeItem : undefined}
      />
    {:else if section.id === 'changes' && previous}
      <KitChanges
        {previous}
        document={doc}
        {compiled}
        headingLevel={sectionLevel}
        idPrefix={prefix}
        currentItem={activeSection === 'changes' ? activeItem : undefined}
      />
    {/if}
  {/each}
</div>

<script lang="ts">
import type { CompiledDesignSystem } from '@texuli/tokens/design-system/compile';
import type { DesignSystem } from '@texuli/tokens/design-system/validate';
import { checkDesignSystem } from '@texuli/tools/ds-check';
import { DesignSystemProvider } from 'texuli/design-system';
import { DesignSystemKit, type KitCatalog } from 'texuli/ds-kit';

const CATALOG_RAW = import.meta.glob<string>(
  '../../../../../packages/spec/catalog/components.json',
  { query: '?raw', import: 'default', eager: true }
);
const catalogText = Object.values(CATALOG_RAW)[0];
if (catalogText === undefined) throw new Error('Design-system studio catalog data is missing.');

type AllowEntry = NonNullable<DesignSystem['allow']>[string];
type LibraryEntry = NonNullable<DesignSystem['library']>[number];
type DraftDocument = DesignSystem & Record<string, unknown>;

let { onclose }: { onclose: () => void } = $props();
const catalog = JSON.parse(catalogText) as KitCatalog;
const catalogComponents = [...catalog.components].sort((a, b) => a.label.localeCompare(b.label));
let document = $state<DraftDocument>({
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'example-brand',
  version: '1.0.0',
  name: 'Example brand',
  color: { brand: { seed: '#2b6ce0' } },
  allow: {},
  library: [],
  approval: { status: 'draft', version: '1.0.0' },
});
let componentId = $state(
  catalogComponents.find((component) => component.id === 'button')?.id ??
    catalogComponents[0]?.id ??
    ''
);
let compiled = $state<CompiledDesignSystem | null>(null);
let issues = $state<string[]>([]);
let message = $state('Choose catalog components, then validate the draft.');
let exportText = $state('');
let contentHash = $state('');
let busy = $state(false);

const allowed = $derived((document.allow ?? {}) as Record<string, AllowEntry>);
const entries = $derived(Object.entries(allowed));
const library = $derived(
  (Array.isArray(document.library) ? document.library : []) as LibraryEntry[]
);
const selectedComponent = $derived(
  catalogComponents.find((component) => component.id === componentId)
);

function draftCopy(source: DraftDocument): DraftDocument {
  const sourceLibrary = Array.isArray(source.library) ? (source.library as LibraryEntry[]) : [];
  const libraryDrafts = sourceLibrary.map((entry) => {
    const { approval: _approval, ...withoutApproval } = entry;
    return { ...withoutApproval, status: 'draft' as const };
  });
  return {
    ...source,
    approval: { status: 'draft', version: source.version },
    library: libraryDrafts,
  };
}

function invalidatePreview(): void {
  compiled = null;
  exportText = '';
  contentHash = '';
}

function updateIdentity(key: 'id' | 'version' | 'name', value: string): void {
  document = { ...document, [key]: value };
  invalidatePreview();
}

function updateSeed(value: string): void {
  const color = document.color && typeof document.color === 'object' ? document.color : {};
  const brand = color.brand && typeof color.brand === 'object' ? color.brand : {};
  document = { ...document, color: { ...color, brand: { ...brand, seed: value } } };
  invalidatePreview();
}

function addComponent(): void {
  const component = selectedComponent;
  if (!component || Object.hasOwn(allowed, component.id)) return;
  const entry: Record<string, readonly string[]> = {};
  for (const axis of ['variant', 'size', 'tone', 'density'] as const) {
    const values = component.axes?.[axis]?.values;
    const field = {
      variant: 'variants',
      size: 'sizes',
      tone: 'tones',
      density: 'densities',
    }[axis];
    if (values?.length) entry[field] = [...values];
  }
  if (component.states?.length) entry.states = [...component.states];
  document = { ...document, allow: { ...allowed, [component.id]: entry } };
  invalidatePreview();
}

function removeComponent(id: string): void {
  const next = { ...allowed };
  delete next[id];
  document = {
    ...document,
    allow: next,
    library: library.map((entry) => ({
      ...entry,
      composes: entry.composes.filter((component) => component !== id),
    })),
  };
  invalidatePreview();
}

function toggleValue(id: string, field: keyof AllowEntry, value: string, checked: boolean): void {
  const current = allowed[id] ?? {};
  const list = [...((current[field] as readonly string[] | undefined) ?? [])];
  const next = checked ? [...new Set([...list, value])] : list.filter((item) => item !== value);
  document = { ...document, allow: { ...allowed, [id]: { ...current, [field]: next } } };
  invalidatePreview();
}

function addLibraryEntry(): void {
  const composed = entries[0]?.[0];
  if (!composed) return;
  const index = library.length + 1;
  document = {
    ...document,
    library: [
      ...library,
      {
        id: `example-card-${index}`,
        name: `Example card ${index}`,
        purpose: 'A reusable example component.',
        version: '1.0.0',
        status: 'draft',
        composes: [composed],
      },
    ],
  };
  invalidatePreview();
}

function updateLibrary(index: number, field: keyof LibraryEntry, value: string): void {
  document = {
    ...document,
    library: library.map((entry, item) => (item === index ? { ...entry, [field]: value } : entry)),
  };
  invalidatePreview();
}

function toggleComposed(index: number, id: string, checked: boolean): void {
  document = {
    ...document,
    library: library.map((entry, item) => {
      if (item !== index) return entry;
      const composes = checked
        ? [...new Set([...entry.composes, id])]
        : entry.composes.filter((component) => component !== id);
      return { ...entry, composes };
    }),
  };
  invalidatePreview();
}

function removeLibraryEntry(index: number): void {
  document = { ...document, library: library.filter((_, item) => item !== index) };
  invalidatePreview();
}

function preparedDocument(): DraftDocument {
  return draftCopy(document);
}

async function validateDraft(): Promise<void> {
  busy = true;
  issues = [];
  const draft = preparedDocument();
  const report = await checkDesignSystem(draft, { trust: 'untrusted', catalog });
  if (!report.ok) {
    issues = report.errors.map((issue) => `${issue.code} at ${issue.path}: ${issue.message}`);
    message = `Draft refused with ${issues.length} issue${issues.length === 1 ? '' : 's'}.`;
    compiled = null;
    busy = false;
    return;
  }
  busy = false;
  const result = report.runs.find((run) => run.variant === null)?.compiled;
  if (!result) {
    message = 'Draft could not be compiled for the kit preview.';
    compiled = null;
    return;
  }
  document = draft;
  compiled = result;
  contentHash = report.locked.approval.contentHash;
  message = 'Draft validates locally. Approval remains with its human owner.';
}

async function exportDocument(): Promise<void> {
  const draft = preparedDocument();
  const report = await checkDesignSystem(draft, { trust: 'untrusted', catalog });
  if (!report.ok) {
    issues = report.errors.map((issue) => `${issue.code} at ${issue.path}: ${issue.message}`);
    message = `Export refused with ${issues.length} validation issue${issues.length === 1 ? '' : 's'}.`;
    return;
  }
  const exported: DraftDocument = {
    ...draft,
    approval: { ...draft.approval, contentHash: report.locked.approval.contentHash },
  };
  const text = `${JSON.stringify(exported, null, 2)}\n`;
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = `${exported.id}.design-system.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  document = exported;
  exportText = text;
  contentHash = report.locked.approval.contentHash;
  message = `Draft exported with contentHash ${contentHash}.`;
}

async function importDocument(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 1_048_576) {
    issues = ['input-limit at $: Choose a JSON file no larger than 1 MiB.'];
    message = 'Import refused: file limit exceeded.';
    input.value = '';
    return;
  }
  try {
    const parsed: unknown = JSON.parse(await file.text());
    const report = await checkDesignSystem(parsed, { trust: 'untrusted', catalog });
    if (!report.ok) {
      issues = report.errors.map((issue) => `${issue.code} at ${issue.path}: ${issue.message}`);
      message = `Import refused with ${issues.length} issue${issues.length === 1 ? '' : 's'}.`;
      return;
    }
    document = draftCopy(parsed as DraftDocument);
    if (!document.allow) document = { ...document, allow: {} };
    if (!Array.isArray(document.library)) document = { ...document, library: [] };
    compiled = null;
    issues = [];
    exportText = '';
    contentHash = '';
    message = 'Validated design-system JSON imported locally. Validate the draft to preview it.';
  } catch {
    issues = ['invalid-input at $: The selected file is not valid JSON.'];
    message = 'Import refused: invalid JSON.';
  } finally {
    input.value = '';
  }
}
</script>

<section class="locked" data-tx-locked-studio="" aria-labelledby="locked-title">
  <header class="locked__header">
    <div>
      <p class="eyebrow">Locked design system</p>
      <h2 id="locked-title">Build a component contract</h2>
      <p class="intro">Choose components from Texuli's catalog, limit their axes and states, and define your own draft library entries.</p>
    </div>
    <button type="button" class="button button--outline" onclick={onclose}>Back to design system editor</button>
  </header>

  <p class="status" role="status" aria-live="polite" data-tx-locked-status="">{message}</p>

  <div class="form-grid">
    <section class="panel" aria-labelledby="identity-title">
      <h3 id="identity-title">Identity and approval</h3>
      <div class="fields">
        <label for="locked-id">Document id</label>
        <input id="locked-id" value={document.id} oninput={(event) => updateIdentity('id', event.currentTarget.value)} />
        <label for="locked-name">Name</label>
        <input id="locked-name" value={document.name} oninput={(event) => updateIdentity('name', event.currentTarget.value)} />
        <label for="locked-version">Version</label>
        <input id="locked-version" value={document.version} oninput={(event) => updateIdentity('version', event.currentTarget.value)} />
        <label for="locked-seed">Brand seed color</label>
        <input id="locked-seed" type="color" value={(document.color as { brand?: { seed?: string } }).brand?.seed ?? '#2b6ce0'} oninput={(event) => updateSeed(event.currentTarget.value)} />
      </div>
      <p class="hint" data-tx-locked-approval="">Approval status: <strong>Draft</strong>. Only the human owner can approve a design system.</p>
      <label class="file-label" for="locked-import">Import design-system JSON (local file, max 1 MiB)</label>
      <input id="locked-import" type="file" accept="application/json,.json" onchange={importDocument} />
    </section>

    <section class="panel" aria-labelledby="allow-title">
      <h3 id="allow-title">Allowed Texuli components</h3>
      <p class="hint">An empty axis list allows no values; clear a list to narrow the component. Components omitted from the set are not allowed.</p>
      <div class="add-row">
        <label for="locked-component">Catalog component</label>
        <select id="locked-component" bind:value={componentId}>
          {#each catalogComponents as component (component.id)}
            <option value={component.id}>{component.label} · {component.id}</option>
          {/each}
        </select>
        <button type="button" class="button" onclick={addComponent} disabled={!selectedComponent || Object.hasOwn(allowed, componentId)} data-tx-locked-add-component="">Add component</button>
      </div>
      {#if entries.length === 0}<p class="empty">No components allowed yet.</p>{/if}
      <div class="components">
        {#each entries as [id, entry] (id)}
          {@const component = catalogComponents.find((item) => item.id === id)}
          <details class="component" open>
            <summary>{component?.label ?? id} <code>{id}</code></summary>
            <button type="button" class="button button--outline" onclick={() => removeComponent(id)}>Remove {id}</button>
            {#if component?.axes}
              {#each Object.entries(component.axes) as [axis, definition] (axis)}
                {@const field = { variant: 'variants', size: 'sizes', tone: 'tones', density: 'densities' }[axis]}
                <fieldset>
                  <legend>{axis} values</legend>
                  <div class="checks">
                    {#each definition.values as value (value)}
                      <label><input type="checkbox" checked={((entry[field as keyof AllowEntry] ?? []) as readonly string[]).includes(value)} onchange={(event) => toggleValue(id, field as keyof AllowEntry, value, event.currentTarget.checked)} />{value}</label>
                    {/each}
                  </div>
                </fieldset>
              {/each}
            {/if}
            {#if component?.states?.length}
              <fieldset>
                <legend>States</legend>
                <div class="checks">
                  {#each component.states as state (state)}
                    <label><input type="checkbox" checked={(entry.states ?? []).includes(state)} onchange={(event) => toggleValue(id, 'states', state, event.currentTarget.checked)} />{state}</label>
                  {/each}
                </div>
              </fieldset>
            {/if}
          </details>
        {/each}
      </div>
    </section>
  </div>

  <section class="panel" aria-labelledby="library-title">
    <div class="panel__heading"><div><h3 id="library-title">Your library components</h3><p class="hint">Entries stay drafts and can compose only allowed Texuli component ids.</p></div>
      <button type="button" class="button button--outline" onclick={addLibraryEntry} disabled={entries.length === 0} data-tx-locked-add-library="">Add library entry</button>
    </div>
    {#each library as entry, index (entry.id)}
      <fieldset class="library-entry">
        <legend>{entry.name} · draft</legend>
        <label for={`library-id-${index}`}>Library id</label><input id={`library-id-${index}`} value={entry.id} oninput={(event) => updateLibrary(index, 'id', event.currentTarget.value)} />
        <label for={`library-name-${index}`}>Name</label><input id={`library-name-${index}`} value={entry.name} oninput={(event) => updateLibrary(index, 'name', event.currentTarget.value)} />
        <label for={`library-purpose-${index}`}>Purpose</label><textarea id={`library-purpose-${index}`} value={entry.purpose} oninput={(event) => updateLibrary(index, 'purpose', event.currentTarget.value)}></textarea>
        <label for={`library-version-${index}`}>Version</label><input id={`library-version-${index}`} value={entry.version} oninput={(event) => updateLibrary(index, 'version', event.currentTarget.value)} />
        <span>Composes allowed components</span>
        <div class="checks">
          {#each entries as [allowedId] (allowedId)}
            <label><input type="checkbox" checked={entry.composes.includes(allowedId)} onchange={(event) => toggleComposed(index, allowedId, event.currentTarget.checked)} />{allowedId}</label>
          {/each}
        </div>
        <button type="button" class="button button--outline" onclick={() => removeLibraryEntry(index)}>Remove {entry.name}</button>
      </fieldset>
    {/each}
  </section>

  <div class="actions">
    <button type="button" class="button" onclick={validateDraft} disabled={busy} data-tx-locked-validate="">{busy ? 'Validating…' : 'Validate and preview'}</button>
    <button type="button" class="button button--outline" onclick={exportDocument} disabled={busy} data-tx-locked-export="">Export draft JSON</button>
  </div>
  {#if issues.length > 0}
    <div class="issues" role="alert" data-tx-locked-issues=""><h3>Fix these issues</h3><ul>{#each issues as issue (issue)}<li><code>{issue}</code></li>{/each}</ul></div>
  {/if}
  {#if contentHash}
    <p class="hash">Draft contentHash: <code data-tx-locked-hash="">{contentHash}</code></p>
  {/if}
  {#if exportText}
    <label for="locked-export-text">Exported design-system JSON</label>
    <textarea id="locked-export-text" class="export" readonly data-tx-locked-export-text="">{exportText}</textarea>
  {/if}
  {#if compiled}
    <section class="preview panel" aria-labelledby="kit-title" data-tx-locked-kit-preview="">
      <h3 id="kit-title">Preview in the design-system kit</h3>
      <DesignSystemProvider {compiled} mode="light">
        <DesignSystemKit
          document={document as DesignSystem}
          {compiled}
          allow={compiled.allowManifest}
          {catalog}
          sections={['matrix', 'library']}
          label="Locked design system preview"
        />
      </DesignSystemProvider>
    </section>
  {/if}
</section>

<style>
  .locked { display: grid; gap: 1rem; }
  .locked__header, .panel__heading, .add-row, .actions { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 0.75rem; }
  .locked__header { align-items: start; }
  h2, h3, p { margin-block: 0; }
  h2 { font-size: 1.5rem; }
  h3 { font-size: 1.1rem; }
  .eyebrow { margin-block-end: 0.35rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .intro, .hint, .empty { color: var(--tx-muted-foreground); font-size: 0.9rem; }
  .intro { max-inline-size: 48rem; margin-block-start: 0.4rem; }
  .status { padding: 0.7rem 0.85rem; border: 1px solid var(--tx-border); border-radius: var(--tx-radius, 0.5rem); }
  .form-grid { display: grid; gap: 1rem; }
  .panel, .component, .library-entry { display: grid; gap: 0.75rem; padding: 1rem; border: 1px solid var(--tx-border); border-radius: var(--tx-radius, 0.5rem); min-inline-size: 0; }
  .fields, .library-entry { display: grid; grid-template-columns: minmax(8rem, 0.4fr) minmax(0, 1fr); gap: 0.55rem 0.75rem; align-items: center; }
  input:not([type=checkbox]):not([type=color]):not([type=file]), select, textarea { inline-size: 100%; min-block-size: 2.5rem; box-sizing: border-box; padding: 0.45rem 0.6rem; border: 1px solid var(--tx-border); border-radius: var(--tx-radius, 0.4rem); background: var(--tx-background); color: var(--tx-foreground); font: inherit; }
  input[type=color] { inline-size: 3rem; min-block-size: 2.5rem; }
  textarea { min-block-size: 4rem; resize: vertical; }
  .file-label { margin-block-start: 0.5rem; }
  .add-row { justify-content: start; }
  .add-row select { flex: 1 1 16rem; }
  .button { min-block-size: 2.5rem; padding: 0.45rem 0.8rem; border: 1px solid var(--tx-primary); border-radius: var(--tx-radius, 0.4rem); background: var(--tx-primary); color: var(--tx-primary-foreground); font: inherit; cursor: pointer; }
  .button--outline { border-color: var(--tx-border); background: var(--tx-background); color: var(--tx-foreground); }
  .button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible { outline: 2px solid var(--tx-ring); outline-offset: 2px; }
  .components { display: grid; gap: 0.6rem; }
  .component summary { display: flex; justify-content: space-between; gap: 0.5rem; cursor: pointer; font-weight: 650; }
  fieldset { min-inline-size: 0; margin: 0; padding: 0.65rem; border: 1px solid var(--tx-border); border-radius: var(--tx-radius, 0.4rem); }
  legend { padding-inline: 0.3rem; font-weight: 600; }
  .checks { display: flex; flex-wrap: wrap; gap: 0.55rem 0.9rem; }
  .checks label { display: inline-flex; align-items: center; gap: 0.35rem; }
  .library-entry { grid-template-columns: minmax(8rem, 0.35fr) minmax(0, 1fr); }
  .actions { justify-content: start; }
  .issues { padding: 0.8rem; border-inline-start: 3px solid var(--tx-destructive); }
  .issues ul { display: grid; gap: 0.3rem; padding-inline-start: 1.2rem; }
  .hash code { overflow-wrap: anywhere; }
  .export { min-block-size: 16rem; font-family: var(--tx-font-mono, ui-monospace, monospace); }
  .preview { overflow: clip; }
  @media (min-width: 60rem) { .form-grid { grid-template-columns: minmax(18rem, 0.8fr) minmax(0, 1.2fr); align-items: start; } }
  @media (forced-colors: active) { .panel, .component, .library-entry, fieldset, .status, .button { border-color: CanvasText; } }
</style>

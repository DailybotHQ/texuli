<script lang="ts">
/**
 * Design System Studio (PLAN_011 T-ds-studio), the island of /theme-studio/.
 *
 * Start from a seed, a logo (pixels read locally through a canvas), a
 * library theme, mood words, a brand one-liner, or a DTCG, Tokens Studio or
 * design-system JSON file; edit every section of the document with inline
 * validation; preview it on five surfaces; read the contrast report and the
 * diff from the starting point; export every format as a download; share
 * the document in the URL fragment. Everything runs in this page: nothing
 * is uploaded and nothing is stored but the link.
 *
 * Performance: the first paint uses a design system compiled at build time
 * (`/theme-studio/default-design-system.json`). The compiler and diff
 * (`ds-engine.ts`) load on the first interaction inside the studio, or at
 * once for a shared link; importers, emitters, the report and the email
 * renderer load only when used.
 */

import type { CompiledDesignSystem } from '@texuli/tokens/design-system/compile';
import { untrack } from 'svelte';
import { Alert } from 'texuli/alert';
import { Button } from 'texuli/button';
import { DesignSystemProvider } from 'texuli/design-system';
import { Input, Textarea } from 'texuli/input';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
import { withBase } from '../foundation/site.ts';
import { runToolShortcut, type ToolShortcutMap } from '../tool-keys.ts';
import ComponentsEditor from './ComponentsEditor.svelte';
import { decodeShareHash, encodeShareHash, isShareHash, SHARE_LIMITS } from './ds-share.ts';
import {
  contrastSummary,
  EXPORT_FORMATS,
  type ExportFormat,
  explainCode,
  exportFileName,
  type FieldSpec,
  getAt,
  IMPORT_KIND_LABELS,
  issuesAt,
  libraryDocument,
  MAX_IMPORT_BYTES,
  type PairRow,
  ROLES,
  rolePinField,
  SECTIONS,
  type StudioDocument,
  type StudioIssue,
  seedDocument,
  setAt,
  TYPE_ROLES,
  typeRoleFields,
} from './ds-studio.ts';
import { FEATURED_LIBRARY_THEMES, humanizeThemeId, STUDIO_SEED_PRESETS } from './presets.ts';
import StudioField from './StudioField.svelte';

type Engine = typeof import('./ds-engine.ts');
type Previews = typeof import('./StudioPreviews.svelte').default;
type Report = typeof import('./StudioReport.svelte').default;
type Diff = ReturnType<Engine['diffStudio']>;
type Mode = 'light' | 'dark';

let { base = '/' }: { base?: string } = $props();

let doc = $state<StudioDocument>(seedDocument());
let compiled = $state<CompiledDesignSystem | null>(null);
let baseCompiled = $state<CompiledDesignSystem | null>(null);
let baseLabel = $state('the default seed #2b6ce0');
let issues = $state<StudioIssue[]>([]);
let warnings = $state<StudioIssue[]>([]);
let refusal = $state<{ title: string; issues: StudioIssue[] } | null>(null);
let diff = $state<Diff | null>(null);
let status = $state('Loading the starting design system…');
let contrastNote = $state('');
let mode = $state<Mode>('light');
let variant = $state('');
let previewTab = $state('sheet');
let busy = $state(false);
let keysOpen = $state(false);
let open = $state<Record<string, boolean>>({ color: true });
let toolRoot = $state<HTMLElement>();
// The preview surfaces and the report load after mount, with the default
// design system they paint (neither is useful before it arrives).
let PreviewsView = $state<Previews | null>(null);
let ReportView = $state<Report | null>(null);

// Start inputs.
let seedInput = $state('#2b6ce0');
let libraryInput = $state('');
let moodInput = $state('calm ocean');
let brandInput = $state('brand #0f766e, font Inter, rounded, compact');
let logoPalette = $state<string[]>([]);

// Editors with their own state.
let pinMode = $state<Mode>('light');
let pinRole = $state('primary');
let typeRole = $state('body');
let jsonText = $state('');
let jsonDirty = $state(false);
let variantName = $state('');
let variantEdit = $state('');
let variantText = $state('');

// Export and share.
let exportFormat = $state<ExportFormat>('document');
let exportText = $state('');
let exportNote = $state('');
let shareUrl = $state('');
let shareNote = $state('');

const galleryHref = withBase(base, 'gallery-themes/');
const variants = $derived(Object.keys((getAt(doc, ['variants']) ?? {}) as Record<string, unknown>));
const pinnedRoles = $derived(
  (['light', 'dark'] as const).flatMap((pinMode) =>
    Object.keys((getAt(doc, ['color', 'roles', pinMode]) ?? {}) as Record<string, unknown>).map(
      (role) => ({ mode: pinMode, role })
    )
  )
);
const unplacedIssues = $derived(
  issues.filter((issue) => {
    if (issue.source) return true;
    const path = issue.path;
    return !/^\$\.(?:id|version|name|description|owner|license|tags|extends|color|typography|space|shape|elevation|surface|motion|layout|icons|components|assets|voice|accessibility)\b/.test(
      path
    );
  })
);

/* ── Engine (lazy) ─────────────────────────────────────────────────────── */

let enginePromise: Promise<Engine> | null = null;

function loadEngine(): Promise<Engine> {
  enginePromise ??= import('./ds-engine.ts').catch((cause) => {
    enginePromise = null;
    throw cause;
  });
  return enginePromise;
}

/** The first sign of intent inside the studio starts loading the compiler. */
function warm(): void {
  void loadEngine().catch(() => undefined);
}

let sequence = 0;

function announceContrast(next: CompiledDesignSystem): void {
  const parts = contrastSummary(next.report.contrast as Partial<Record<Mode, PairRow[]>>).map(
    (entry) => `${entry.mode} ${entry.total - entry.failing} of ${entry.total} pairs pass`
  );
  contrastNote = `Contrast: ${parts.join('; ')}. ${next.report.adjustments.length} solver adjustments.`;
}

/**
 * Compile `next` and, when it compiles, show it. A refused document stays in
 * the editor with its issues; the preview keeps the last design system that
 * compiled. Stale results (an older edit finishing late) are dropped.
 */
async function apply(next: StudioDocument, note: string): Promise<boolean> {
  doc = next;
  if (!jsonDirty) jsonText = `${JSON.stringify(next, null, 2)}\n`;
  const ticket = ++sequence;
  busy = true;
  let engine: Engine;
  try {
    engine = await loadEngine();
  } catch {
    busy = false;
    issues = [{ code: 'engine-failed', path: '$', message: 'Reload the page to try again.' }];
    status = explainCode('engine-failed');
    return false;
  }
  const result = await engine.compileStudio(next, variant || undefined);
  if (ticket !== sequence) return false;
  busy = false;
  if (!result.ok) {
    issues = result.issues;
    status = `Not applied: ${result.issues.length} issue${result.issues.length === 1 ? '' : 's'} (${[
      ...new Set(result.issues.map((issue) => issue.code)),
    ].join(', ')}). The preview shows the last design system that compiled.`;
    return false;
  }
  issues = [];
  compiled = result.compiled;
  diff = baseCompiled ? engine.diffStudio(baseCompiled, result.compiled) : null;
  status = note;
  announceContrast(result.compiled);
  return true;
}

/**
 * Start from a new document: compile it first, and only replace the current
 * design system when it compiles. A refused start shows its codes and keeps
 * what was on screen.
 */
async function startFrom(
  next: StudioDocument,
  label: string,
  extraWarnings: StudioIssue[] = []
): Promise<boolean> {
  busy = true;
  let engine: Engine;
  try {
    engine = await loadEngine();
  } catch {
    busy = false;
    refusal = {
      title: 'The compiler could not load',
      issues: [{ code: 'engine-failed', path: '$', message: 'Reload the page to try again.' }],
    };
    return false;
  }
  const ticket = ++sequence;
  const result = await engine.compileStudio(next, undefined);
  if (ticket !== sequence) return false;
  busy = false;
  if (!result.ok) {
    refusal = { title: `Refused: ${label} does not compile`, issues: result.issues };
    status = `Refused ${label}: ${result.issues.length} issue${result.issues.length === 1 ? '' : 's'}. The studio kept the previous design system.`;
    return false;
  }
  refusal = null;
  warnings = extraWarnings;
  variant = '';
  issues = [];
  doc = next;
  jsonDirty = false;
  jsonText = `${JSON.stringify(next, null, 2)}\n`;
  compiled = result.compiled;
  baseCompiled = result.compiled;
  baseLabel = label;
  diff = engine.diffStudio(result.compiled, result.compiled);
  status = `Started from ${label}.${extraWarnings.length > 0 ? ` ${extraWarnings.length} import warning${extraWarnings.length === 1 ? '' : 's'}.` : ''}`;
  announceContrast(result.compiled);
  return true;
}

function refuse(title: string, list: StudioIssue[]): void {
  refusal = { title, issues: list };
  status = `${title}: ${list.map((issue) => issue.code).join(', ')}.`;
}

/* ── First paint, shared links ─────────────────────────────────────────── */

async function loadDefault(): Promise<void> {
  try {
    const response = await fetch(withBase(base, 'theme-studio/default-design-system.json'));
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as {
      document: StudioDocument;
      compiled: CompiledDesignSystem;
    };
    // A shared link or an early start may have won the race: keep it.
    if (compiled) return;
    if (sequence === 0) {
      doc = data.document;
      jsonText = `${JSON.stringify(data.document, null, 2)}\n`;
    }
    compiled = data.compiled;
    baseCompiled = data.compiled;
    if (sequence === 0)
      status = 'Default seed loaded. Start from something else, or edit any section.';
    announceContrast(data.compiled);
  } catch {
    if (!compiled) void startFrom(seedDocument(), 'the default seed #2b6ce0');
  }
}

async function openHash(hash: string): Promise<void> {
  if (isShareHash(hash)) {
    status = 'Opening the shared link…';
    const decoded = await decodeShareHash(hash);
    if (!decoded.ok) {
      refuse('Refused: the shared link cannot be opened', [
        { code: decoded.code, path: '$', message: decoded.message },
      ]);
      return;
    }
    await startFrom(decoded.value, 'the shared link');
    return;
  }
  if (hash.startsWith('#theme=')) {
    status = 'Opening a theme studio link…';
    const engine = await loadEngine();
    const opened = await engine.documentFromLegacyHash(hash);
    if (!opened.ok) {
      refuse('Refused: the theme studio link cannot be opened', opened.issues);
      return;
    }
    await startFrom(opened.document, 'a theme studio link');
  }
}

$effect(() => {
  untrack(() => {
    void import('./StudioPreviews.svelte').then((module) => {
      PreviewsView = module.default;
    });
    void import('./StudioReport.svelte').then((module) => {
      ReportView = module.default;
    });
    const hash = window.location.hash;
    if (isShareHash(hash) || hash.startsWith('#theme=')) {
      // A link opens straight away: the default paints meanwhile.
      void loadDefault();
      void openHash(hash);
    } else {
      void loadDefault();
    }
  });
});

function onHashChange(): void {
  const hash = window.location.hash;
  if (hash !== shareHash && (isShareHash(hash) || hash.startsWith('#theme='))) void openHash(hash);
}

/* ── Starting points ───────────────────────────────────────────────────── */

function startSeed(hex: string, label: string): void {
  void startFrom(seedDocument(hex.trim()), label);
}

function startLibrary(id: string): void {
  const trimmed = id.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed) || trimmed.length > 64) {
    refuse('Refused: that is not a library theme id', [
      {
        code: 'invalid-value',
        path: '$.extends',
        message:
          'A library theme id is lowercase words joined by hyphens, as in the theme gallery.',
      },
    ]);
    return;
  }
  void startFrom(
    libraryDocument(trimmed, humanizeThemeId(trimmed)),
    `the ${trimmed} library theme`
  );
}

async function startMood(): Promise<void> {
  const engine = await loadEngine();
  const result = await engine.documentFromMood(moodInput);
  if (!result.ok) return refuse('Refused: no design system for those words', result.issues);
  await startFrom(result.document, `the mood words “${moodInput.trim()}”`);
}

async function startBrand(): Promise<void> {
  const engine = await loadEngine();
  const result = await engine.importBrandLine(brandInput);
  if (!result.ok) return refuse('Refused: the brand line cannot be read', result.issues);
  await startFrom(result.document, 'the brand line', result.warnings);
}

/** Read a logo's pixels locally: an object URL, a canvas, no request leaves the page. */
async function onLogo(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    refuse('Refused: that file is not an image', [
      { code: 'invalid-input', path: '$', message: 'Choose a PNG, JPEG, WebP or SVG logo.' },
    ]);
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The image could not be decoded.'));
      image.src = url;
    });
    const scale = Math.min(1, 256 / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const width = Math.max(1, Math.round((image.naturalWidth || 64) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || 64) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser cannot read image pixels.');
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const engine = await loadEngine();
    const result = await engine.importLogo(pixels);
    if (!result.ok) return refuse('Refused: no palette in that image', result.issues);
    logoPalette = result.palette;
    await startFrom(result.document, `the logo ${file.name.slice(0, 60)}`, result.warnings);
  } catch (cause) {
    refuse('Refused: the image could not be read', [
      {
        code: 'invalid-input',
        path: '$',
        message: cause instanceof Error ? cause.message : 'The image could not be read.',
      },
    ]);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Import a DTCG, Tokens Studio, role palette or design-system JSON file. */
async function onTokenFile(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    refuse('Refused: the file is too large', [
      { code: 'input-limit', path: '$', message: 'The studio reads files up to 1 MiB.' },
    ]);
    return;
  }
  const text = await file.text();
  const engine = await loadEngine();
  const result = await engine.importText(text);
  if (!result.ok) {
    refuse(
      `Refused: ${file.name.slice(0, 60)} cannot be imported${result.kind ? ` as a ${IMPORT_KIND_LABELS[result.kind]}` : ''}`,
      result.issues
    );
    return;
  }
  await startFrom(
    result.document,
    `${file.name.slice(0, 60)} (${IMPORT_KIND_LABELS[result.kind]})`,
    result.warnings
  );
}

/* ── Editing ───────────────────────────────────────────────────────────── */

function commit(spec: FieldSpec, value: unknown): void {
  void apply(setAt(doc, spec.path, value), `Updated ${spec.label.toLowerCase()}.`);
}

function removeAt(path: readonly string[], label: string): void {
  void apply(setAt(doc, path, undefined), `Removed ${label}.`);
}

function applyJson(): void {
  let value: unknown;
  try {
    value = JSON.parse(jsonText);
  } catch (cause) {
    issues = [
      {
        code: 'invalid-input',
        path: '$',
        message: cause instanceof Error ? cause.message : 'The JSON does not parse.',
      },
    ];
    status = 'Not applied: the JSON does not parse.';
    return;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issues = [{ code: 'invalid-type', path: '$', message: 'The document is a JSON object.' }];
    status = 'Not applied: the document is not a JSON object.';
    return;
  }
  jsonDirty = false;
  void apply(value as StudioDocument, 'Applied the document JSON.');
}

function addVariant(): void {
  const name = variantName.trim();
  if (!name) return;
  variantName = '';
  variantEdit = name;
  variantText = '{}';
  void apply(setAt(doc, ['variants', name], {}), `Added the ${name} variant.`);
}

function selectVariantToEdit(name: string): void {
  variantEdit = name;
  variantText = `${JSON.stringify(getAt(doc, ['variants', name]) ?? {}, null, 2)}\n`;
}

function applyVariant(): void {
  let value: unknown;
  try {
    value = JSON.parse(variantText);
  } catch {
    issues = [
      {
        code: 'invalid-input',
        path: `$.variants.${variantEdit}`,
        message: 'The variant JSON does not parse.',
      },
    ];
    return;
  }
  void apply(setAt(doc, ['variants', variantEdit], value), `Updated the ${variantEdit} variant.`);
}

function removeVariant(name: string): void {
  if (variant === name) variant = '';
  if (variantEdit === name) variantEdit = '';
  void apply(setAt(doc, ['variants', name], undefined), `Removed the ${name} variant.`);
}

function onPreviewVariant(event: Event): void {
  variant = (event.currentTarget as HTMLSelectElement).value;
  void apply(
    doc,
    variant ? `Previewing the ${variant} variant.` : 'Previewing the base design system.'
  );
}

function setMode(next: string | string[]): void {
  if (next === 'light' || next === 'dark') mode = next;
}

/* ── Export and share ──────────────────────────────────────────────────── */

async function exportContent(format: ExportFormat): Promise<string | null> {
  if (!compiled) return null;
  const engine = await loadEngine();
  return engine.buildExport(format, doc, compiled);
}

async function showExport(format: ExportFormat): Promise<void> {
  exportFormat = format;
  exportText = 'Building…';
  const text = await exportContent(format);
  if (exportFormat === format) exportText = text ?? 'This format could not be built.';
}

async function download(format: ExportFormat): Promise<void> {
  if (issues.length > 0) {
    exportNote = 'Fix the issues first: exports follow the document that compiled.';
    return;
  }
  const text = await exportContent(format);
  const spec = EXPORT_FORMATS.find((entry) => entry.id === format);
  if (text === null || !spec) {
    exportNote = 'This format could not be built.';
    return;
  }
  const blob = new Blob([text], { type: `${spec.mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = exportFileName(getAt(doc, ['id']), format);
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  exportNote = `Downloaded ${anchor.download} (${blob.size.toLocaleString('en-US')} bytes).`;
}

let shareHash = '';

async function share(): Promise<void> {
  const result = await encodeShareHash(doc);
  if (!result.ok) {
    shareNote = `${result.message} (${result.code})`;
    return;
  }
  shareHash = result.hash;
  window.history.replaceState(window.history.state, '', result.hash);
  shareUrl = window.location.href;
  let copied = false;
  try {
    await navigator.clipboard?.writeText(shareUrl);
    copied = Boolean(navigator.clipboard);
  } catch {
    copied = false;
  }
  shareNote = `${copied ? 'Link copied' : 'Link ready in the address bar and below'}: ${result.chars.toLocaleString('en-US')} of ${SHARE_LIMITS.hashChars.toLocaleString('en-US')} characters. The document is in the link itself; nothing was uploaded.`;
}

/* ── Keyboard ──────────────────────────────────────────────────────────── */

const STUDIO_KEYS: ToolShortcutMap = { d: 'mode', s: 'share', '?': 'keys' };

function onStudioAction(action: string): void {
  if (action === 'keys') keysOpen = !keysOpen;
  else if (action === 'mode') mode = mode === 'light' ? 'dark' : 'light';
  else if (action === 'share') void share();
}

function onStudioKey(event: KeyboardEvent): void {
  runToolShortcut(event, toolRoot, STUDIO_KEYS, onStudioAction);
}

function toggle(id: string, event: Event): void {
  open = { ...open, [id]: (event.currentTarget as HTMLDetailsElement).open };
}
</script>

<svelte:window onkeydown={onStudioKey} onhashchange={onHashChange} />

<div
  class="studio"
  data-tx-theme-studio=""
  data-tx-ds-studio=""
  data-busy={busy ? '' : undefined}
  bind:this={toolRoot}
  onfocusin={warm}
  onpointerdown={warm}
>
  <p class="status" role="status" data-tx-ds-status="">{status}</p>
  <p class="visually-hidden" role="status" data-tx-ds-contrast-live="">{contrastNote}</p>

  {#if refusal}
    <div class="refusal" role="alert" data-tx-ds-refusal="">
      <Alert tone="error" title={refusal.title} text="Nothing was changed. The codes below say why." />
      <ul class="issues">
        {#each refusal.issues.slice(0, 12) as issue, index (index)}
          <li>
            <strong>{explainCode(issue.code)}</strong>
            <span><code>{issue.code}</code> at <code>{issue.path}</code>{issue.source ? ` (${issue.source})` : ''}</span>
            {#if issue.message}<span class="detail">{issue.message}</span>{/if}
            {#if issue.hint}<span class="detail">{issue.hint}</span>{/if}
          </li>
        {/each}
      </ul>
      <Button type="button" variant="outline" size="sm" onclick={() => (refusal = null)}>Dismiss</Button>
    </div>
  {/if}

  <div class="studio__grid">
    <div class="studio__controls">
      <section class="panel" aria-labelledby="ds-start-title">
        <h2 id="ds-start-title">Start from</h2>
        <p class="hint">
          Each start replaces the design system and becomes the baseline of the diff. Files and
          images are read in this page; nothing is uploaded.
        </p>

        <h3 class="sub">A seed color</h3>
        <div class="presets" role="group" aria-label="Preset seeds">
          {#each STUDIO_SEED_PRESETS as preset (preset.id)}
            <button
              type="button"
              class="chip"
              data-tx-ds-seed-preset={preset.id}
              onclick={() => startSeed(preset.hex, `${preset.label} (${preset.hex})`)}
            >
              <span class="chip__swatch" style:background={preset.hex} aria-hidden="true"></span>
              {preset.label}
            </button>
          {/each}
        </div>
        <div class="inline-form">
          <label class="label" for="ds-start-seed">Brand color</label>
          <div class="row">
            <Input id="ds-start-seed" bind:value={seedInput} placeholder="#2b6ce0" spellcheck="false" />
            <Button type="button" onclick={() => startSeed(seedInput, `the seed ${seedInput.trim()}`)}>
              Start from color
            </Button>
          </div>
        </div>

        <h3 class="sub">A library theme</h3>
        <div class="presets" role="group" aria-label="Featured library themes">
          {#each FEATURED_LIBRARY_THEMES as item (item.id)}
            <button
              type="button"
              class="chip"
              data-tx-ds-library={item.id}
              onclick={() => startLibrary(item.id)}
            >
              {humanizeThemeId(item.id)}
            </button>
          {/each}
        </div>
        <div class="inline-form">
          <label class="label" for="ds-start-library">Any library theme id</label>
          <div class="row">
            <Input id="ds-start-library" bind:value={libraryInput} placeholder="ocean-calm" spellcheck="false" />
            <Button type="button" variant="outline" onclick={() => startLibrary(libraryInput)}>
              Extend theme
            </Button>
          </div>
          <p class="hint">
            The document extends <code>texuli:&lt;id&gt;</code>; browse ids in the
            <a href={galleryHref}>theme gallery</a>.
          </p>
        </div>

        <h3 class="sub">A logo</h3>
        <div class="inline-form">
          <label class="label" for="ds-start-logo">Logo image</label>
          <input
            id="ds-start-logo"
            class="file"
            type="file"
            accept="image/*"
            data-tx-ds-logo=""
            onchange={onLogo}
          />
          {#if logoPalette.length > 0}
            <p class="hint" data-tx-ds-logo-palette="">
              Dominant colors: {logoPalette.join(', ')}
            </p>
          {/if}
        </div>

        <h3 class="sub">A tokens or design-system file</h3>
        <div class="inline-form">
          <label class="label" for="ds-start-file">JSON file (DTCG, Tokens Studio, role palette or design system)</label>
          <input
            id="ds-start-file"
            class="file"
            type="file"
            accept=".json,application/json"
            data-tx-ds-file=""
            onchange={onTokenFile}
          />
        </div>

        <h3 class="sub">Words</h3>
        <div class="inline-form">
          <label class="label" for="ds-start-mood">Mood words</label>
          <div class="row">
            <Input id="ds-start-mood" bind:value={moodInput} placeholder="calm ocean" />
            <Button type="button" variant="outline" onclick={() => void startMood()}>Start from words</Button>
          </div>
        </div>
        <div class="inline-form">
          <label class="label" for="ds-start-brand">Brand line</label>
          <div class="row">
            <Input id="ds-start-brand" bind:value={brandInput} placeholder="brand #4f46e5, font Inter, rounded" />
            <Button type="button" variant="outline" onclick={() => void startBrand()}>Start from line</Button>
          </div>
        </div>
      </section>

      <section class="panel" aria-labelledby="ds-edit-title">
        <h2 id="ds-edit-title">Edit the design system</h2>
        <p class="issues-summary" role="status" data-tx-ds-issues="">
          {#if issues.length === 0}
            No issues: the document compiles.
          {:else}
            {issues.length} issue{issues.length === 1 ? '' : 's'}; the preview shows the last version
            that compiled. Each issue is shown under its field.
          {/if}
        </p>
        {#if unplacedIssues.length > 0}
          <ul class="issues" data-tx-ds-issue-list="">
            {#each unplacedIssues as issue, index (index)}
              <li>
                <strong>{explainCode(issue.code)}</strong>
                <span><code>{issue.code}</code> at <code>{issue.path}</code>{issue.source ? ` (${issue.source})` : ''}</span>
                {#if issue.message}<span class="detail">{issue.message}</span>{/if}
              </li>
            {/each}
          </ul>
        {/if}
        {#if warnings.length > 0}
          <details class="section">
            <summary>Import warnings ({warnings.length})</summary>
            <ul class="issues issues--warn">
              {#each warnings.slice(0, 40) as issue, index (index)}
                <li><code>{issue.code}</code> at <code>{issue.path}</code>: {issue.message}</li>
              {/each}
            </ul>
          </details>
        {/if}

        {#each SECTIONS as section (section.id)}
          <details
            class="section"
            data-tx-ds-section={section.id}
            open={open[section.id] ?? false}
            ontoggle={(event) => toggle(section.id, event)}
          >
            <summary>
              {section.title}
              {#if issuesAt(issues, [section.id]).length > 0 || (section.id === 'elevation' && issuesAt(issues, ['surface']).length > 0) || (section.id === 'layout' && issuesAt(issues, ['icons']).length > 0)}
                <span class="badge">issues</span>
              {/if}
            </summary>
            {#if open[section.id]}
              <div class="section__body">
                <p class="hint">{section.summary}</p>
                {#each section.fields as spec (spec.path.join('.'))}
                  <StudioField
                    {spec}
                    value={getAt(doc, spec.path)}
                    issues={issuesAt(issues, spec.path)}
                    oncommit={commit}
                  />
                {/each}
                {#if section.id === 'color'}
                  <fieldset class="group" data-tx-ds-role-pins="">
                    <legend>Role pins</legend>
                    <p class="hint">
                      Pin any of the 50 semantic roles per mode. Pins never move: a pin that
                      breaks the contrast target is refused with <code>aa-text</code>.
                    </p>
                    <div class="row row--split">
                      <label class="label" for="ds-pin-mode">Mode</label>
                      <select id="ds-pin-mode" class="select" bind:value={pinMode}>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                      <label class="label" for="ds-pin-role">Role</label>
                      <select id="ds-pin-role" class="select" bind:value={pinRole}>
                        {#each ROLES as role (role)}
                          <option value={role}>{role}</option>
                        {/each}
                      </select>
                    </div>
                    {#key `${pinMode}.${pinRole}`}
                      <StudioField
                        spec={rolePinField(pinMode, pinRole)}
                        value={getAt(doc, ['color', 'roles', pinMode, pinRole])}
                        issues={issuesAt(issues, ['color', 'roles', pinMode, pinRole])}
                        inherited={compiled?.vars[pinMode]?.[`--tx-${pinRole.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`] ?? ''}
                        oncommit={commit}
                      />
                    {/key}
                    {#if pinnedRoles.length > 0}
                      <ul class="pins">
                        {#each pinnedRoles as pin (`${pin.mode}.${pin.role}`)}
                          <li>
                            {pin.role} ({pin.mode}): <code>{String(getAt(doc, ['color', 'roles', pin.mode, pin.role]))}</code>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={`Remove the ${pin.role} pin (${pin.mode})`}
                              onclick={() => removeAt(['color', 'roles', pin.mode, pin.role], `the ${pin.role} pin`)}
                            >Remove</Button>
                          </li>
                        {/each}
                      </ul>
                    {/if}
                  </fieldset>
                {:else if section.id === 'typography'}
                  <fieldset class="group">
                    <legend>Type roles</legend>
                    <label class="label" for="ds-type-role">Role</label>
                    <select id="ds-type-role" class="select" bind:value={typeRole}>
                      {#each TYPE_ROLES as role (role)}
                        <option value={role}>{role}</option>
                      {/each}
                    </select>
                    {#each typeRoleFields(typeRole) as spec (spec.path.join('.'))}
                      <StudioField
                        {spec}
                        value={getAt(doc, spec.path)}
                        issues={issuesAt(issues, spec.path)}
                        oncommit={commit}
                      />
                    {/each}
                  </fieldset>
                {/if}
              </div>
            {/if}
          </details>
        {/each}

        <details
          class="section"
          data-tx-ds-section="components"
          open={open.components ?? false}
          ontoggle={(event) => toggle('components', event)}
        >
          <summary>
            Components
            {#if issuesAt(issues, ['components']).length > 0}<span class="badge">issues</span>{/if}
          </summary>
          {#if open.components}
            <div class="section__body">
              <ComponentsEditor {doc} {issues} oncommit={commit} />
            </div>
          {/if}
        </details>

        <details
          class="section"
          data-tx-ds-section="variants"
          open={open.variants ?? false}
          ontoggle={(event) => toggle('variants', event)}
        >
          <summary>
            Variants
            {#if issues.some((issue) => issue.path.startsWith('$.variants') || issue.source?.startsWith('variant:'))}<span class="badge">issues</span>{/if}
          </summary>
          {#if open.variants}
            <div class="section__body">
              <p class="hint">
                Named partial documents (high contrast, compact, seasonal), orthogonal to light and
                dark. Preview one with the variant menu above the preview.
              </p>
              <div class="inline-form">
                <label class="label" for="ds-variant-name">New variant name</label>
                <div class="row">
                  <Input id="ds-variant-name" bind:value={variantName} placeholder="high-contrast" spellcheck="false" />
                  <Button type="button" variant="outline" onclick={addVariant}>Add variant</Button>
                </div>
              </div>
              {#if variants.length > 0}
                <ul class="pins">
                  {#each variants as name (name)}
                    <li>
                      <code>{name}</code>
                      <Button type="button" size="sm" variant="ghost" onclick={() => selectVariantToEdit(name)} aria-label={`Edit the ${name} variant`}>Edit</Button>
                      <Button type="button" size="sm" variant="ghost" onclick={() => removeVariant(name)} aria-label={`Remove the ${name} variant`}>Remove</Button>
                    </li>
                  {/each}
                </ul>
              {/if}
              {#if variantEdit}
                <label class="label" for="ds-variant-json">The {variantEdit} variant (JSON sections)</label>
                <Textarea id="ds-variant-json" rows={6} bind:value={variantText} spellcheck="false" />
                <Button type="button" variant="outline" onclick={applyVariant}>Apply variant</Button>
              {/if}
            </div>
          {/if}
        </details>

        <details
          class="section"
          data-tx-ds-section="json"
          open={open.json ?? false}
          ontoggle={(event) => toggle('json', event)}
        >
          <summary>Document JSON</summary>
          {#if open.json}
            <div class="section__body">
              <p class="hint">
                The whole document. Paste or edit, then apply: it is validated like any document
                from outside this page, and refused fields show their codes.
              </p>
              <label class="label" for="ds-json">Design-system document</label>
              <Textarea
                id="ds-json"
                rows={14}
                bind:value={jsonText}
                spellcheck="false"
                class="mono"
                data-tx-ds-json=""
                oninput={() => (jsonDirty = true)}
              />
              <Button type="button" onclick={applyJson}>Apply JSON</Button>
            </div>
          {/if}
        </details>
      </section>

      <details class="keys" data-tx-studio-keys="" bind:open={keysOpen}>
        <summary>Keyboard</summary>
        <p class="hint">
          Tab moves through the controls; each section opens with Enter or Space. A text field
          applies on Enter or when it loses focus. The shortcuts below work only
          while the focus is inside the studio, and they do not fire while you type in a field.
        </p>
        <ul class="keys__list">
          <li><kbd>D</kbd> switch the preview between light and dark</li>
          <li><kbd>S</kbd> make a share link</li>
          <li><kbd>?</kbd> show or hide this list</li>
        </ul>
      </details>
    </div>

    <div class="studio__preview">
      <section class="panel" aria-labelledby="ds-preview-title">
        <div class="preview-head">
          <h2 id="ds-preview-title">Preview</h2>
          <ToggleGroup type="single" value={mode} onValueChange={setMode} aria-label="Preview mode">
            <ToggleGroupItem value="light">Light</ToggleGroupItem>
            <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
          </ToggleGroup>
          {#if variants.length > 0}
            <label class="inline">
              <span>Variant</span>
              <select class="select" value={variant} onchange={onPreviewVariant} data-tx-ds-variant="">
                <option value="">Base</option>
                {#each variants as name (name)}
                  <option value={name}>{name}</option>
                {/each}
              </select>
            </label>
          {/if}
        </div>
        {#if compiled && PreviewsView}
          <DesignSystemProvider {compiled} {mode} scope="ds-studio" class="preview-host" data-tx-ds-scope="">
            <PreviewsView bind:value={previewTab} />
          </DesignSystemProvider>
        {:else}
          <div class="preview-host preview-host--empty" aria-busy="true">
            <p class="hint">Loading the starting design system…</p>
          </div>
        {/if}
      </section>

      {#if ReportView}
        <ReportView {compiled} {diff} {baseLabel} />
      {:else}
        <section class="panel" aria-labelledby="ds-contrast-title">
          <h2 id="ds-contrast-title">Contrast report</h2>
          <p class="hint">Loading the report…</p>
        </section>
      {/if}

      <section class="panel" aria-labelledby="ds-export-title" data-tx-ds-export="">
        <h2 id="ds-export-title">Export</h2>
        <p class="hint">
          Every file is built in this page and saved as a download. Design systems ship with
          release 0.10.0, which is in development and unreleased.
        </p>
        <ul class="exports">
          {#each EXPORT_FORMATS as format (format.id)}
            <li class="export">
              <div>
                <strong>{format.label}</strong>
                <span class="hint">{format.description}</span>
              </div>
              <div class="export__actions">
                <Button
                  type="button"
                  size="sm"
                  disabled={!compiled}
                  data-tx-ds-download={format.id}
                  aria-label={`Download ${format.label}`}
                  onclick={() => void download(format.id)}
                >Download</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!compiled}
                  aria-label={`Show ${format.label}`}
                  onclick={() => void showExport(format.id)}
                >Show</Button>
              </div>
            </li>
          {/each}
        </ul>
        {#if exportNote}
          <p class="hint" role="status" data-tx-ds-export-note="">{exportNote}</p>
        {/if}
        {#if exportText}
          <pre
            class="export-text"
            role="region"
            aria-label={`${EXPORT_FORMATS.find((entry) => entry.id === exportFormat)?.label ?? 'Export'} output`}
            tabindex="0"
            data-tx-ds-export-text="">{exportText.length > 60_000 ? `${exportText.slice(0, 60_000)}\n… (truncated here; the download is complete)` : exportText}</pre>
        {/if}
      </section>

      <section class="panel" aria-labelledby="ds-share-title">
        <h2 id="ds-share-title">Share</h2>
        <p class="hint">
          The link carries the whole document, compressed, after the <code>#</code>: browsers never
          send that part to a server. Opening a link validates it like any outside document; a
          damaged or hostile link is refused with a code.
        </p>
        <Button type="button" variant="outline" disabled={!compiled} onclick={() => void share()} data-tx-ds-share="">
          Make a share link
        </Button>
        {#if shareNote}
          <p class="hint" role="status" data-tx-ds-share-note="">{shareNote}</p>
        {/if}
        {#if shareUrl}
          <label class="label" for="ds-share-url">Share link</label>
          <Input id="ds-share-url" value={shareUrl} readonly data-tx-ds-share-url="" />
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .studio {
    display: grid;
    gap: 1rem;
  }
  .studio__grid {
    display: grid;
    gap: 1.5rem;
  }
  @media (min-width: 72rem) {
    .studio__grid {
      grid-template-columns: minmax(0, 24rem) minmax(0, 1fr);
      align-items: start;
    }
  }
  .studio__controls,
  .studio__preview {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    min-inline-size: 0;
  }
  .panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, var(--tx-background));
    color: var(--tx-foreground);
  }
  h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  .sub {
    margin: 0.5rem 0 0;
    font-size: 0.9375rem;
  }
  .hint,
  .status,
  .issues-summary {
    margin: 0;
    font-size: 0.875rem;
  }
  .status {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, var(--tx-background));
  }
  .label {
    font-size: 0.875rem;
    font-weight: 600;
  }
  .inline-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.35rem;
    min-inline-size: 0;
  }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.5rem;
    align-items: center;
  }
  .row--split {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .chip {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    min-block-size: 2.25rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--tx-border);
    border-radius: 999px;
    background: var(--tx-background);
    color: var(--tx-foreground);
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
  }
  .chip:hover {
    background: var(--tx-muted, var(--tx-background));
  }
  .chip__swatch {
    inline-size: 1rem;
    block-size: 1rem;
    border-radius: 50%;
    border: 1px solid var(--tx-border);
  }
  .file,
  .select {
    min-block-size: 2.5rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    font: inherit;
    max-inline-size: 100%;
    min-inline-size: 0;
    box-sizing: border-box;
  }
  .file {
    inline-size: 100%;
  }
  .chip:focus-visible,
  .file:focus-visible,
  .select:focus-visible,
  .section > summary:focus-visible,
  .keys summary:focus-visible,
  .export-text:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .section {
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
  }
  .section > summary {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.6rem 0.75rem;
    font-weight: 600;
    cursor: pointer;
    min-block-size: 2.75rem;
    box-sizing: border-box;
  }
  .section__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    padding: 0 0.75rem 0.75rem;
  }
  .badge {
    padding: 0.05rem 0.45rem;
    border-radius: 999px;
    background: var(--tx-destructive);
    color: var(--tx-destructive-foreground);
    font-size: 0.75rem;
    font-weight: 600;
  }
  .group {
    display: grid;
    gap: 0.6rem;
    margin: 0;
    padding: 0.75rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
  }
  .group legend {
    font-weight: 600;
    padding-inline: 0.25rem;
  }
  .pins {
    margin: 0;
    padding-inline-start: 1.1rem;
    display: grid;
    gap: 0.25rem;
    font-size: 0.875rem;
  }
  .issues {
    margin: 0;
    padding: 0.5rem 0.75rem;
    list-style: none;
    display: grid;
    gap: 0.4rem;
    border-inline-start: 3px solid var(--tx-destructive);
    background: var(--tx-destructive-soft, var(--tx-muted));
    color: var(--tx-destructive-soft-foreground, var(--tx-foreground));
    font-size: 0.8125rem;
  }
  .issues--warn {
    border-inline-start-color: var(--tx-warning);
    background: var(--tx-muted);
    color: var(--tx-foreground);
  }
  .issues li {
    display: grid;
    gap: 0.1rem;
    overflow-wrap: anywhere;
  }
  .detail {
    overflow-wrap: anywhere;
  }
  .refusal {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
  }
  .refusal .issues {
    justify-self: stretch;
  }
  .preview-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .inline {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.875rem;
  }
  :global(.preview-host) {
    container-type: inline-size;
    padding: 1rem;
    border: 1px dashed var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    font-family: var(--tx-font-sans, inherit);
    min-block-size: 24rem;
  }
  .preview-host--empty {
    display: grid;
    place-items: center;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.preview-host *) {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
    }
  }
  .exports {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.5rem;
  }
  .export {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.75rem;
    align-items: center;
    padding-block-end: 0.5rem;
    border-block-end: 1px solid var(--tx-border);
  }
  .export > div:first-child {
    display: grid;
    gap: 0.1rem;
  }
  .export__actions {
    display: flex;
    gap: 0.4rem;
  }
  .export-text {
    margin: 0;
    max-block-size: 20rem;
    padding: 0.75rem;
    overflow: auto;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.75rem;
    line-height: 1.4;
  }
  :global(.mono) {
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.8125rem;
  }
  .keys {
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    padding: 0.65rem 0.75rem;
  }
  .keys summary {
    cursor: pointer;
    font-weight: 600;
  }
  .keys__list {
    margin: 0.5rem 0 0;
    padding-inline-start: 1.25rem;
    display: grid;
    gap: 0.3rem;
    font-size: 0.875rem;
  }
  .keys kbd {
    padding: 0.05rem 0.35rem;
    border: 1px solid var(--tx-border);
    border-radius: 0.25rem;
    font-family: var(--tx-font-mono, ui-monospace, monospace);
  }
  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (forced-colors: active) {
    .panel,
    .status,
    .chip,
    .chip__swatch,
    .file,
    .select,
    .section,
    .group,
    .keys,
    .export-text {
      border-color: CanvasText;
    }
    .issues {
      border-inline-start-color: CanvasText;
    }
    .badge {
      border: 1px solid CanvasText;
    }
  }
</style>

<script lang="ts">
/**
 * Theme studio island: generate from color / words / image, tune roles,
 * live component preview, AA gate, export CSS and JSON. No runtime network.
 */

import type { SemanticRole, Theme } from '@texuli/tokens';
import { applyTheme, clearTheme } from '@texuli/tokens';
import {
  dominantColors,
  generateThemeFromImage,
  readImagePixels,
  seedsFromColors,
} from '@texuli/tokens/generator';
import { Button } from 'texuli/button';
import { Input } from 'texuli/input';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
import PreviewKit from './PreviewKit.svelte';
import {
  aaSummary,
  buildStudioExport,
  generateStudioTheme,
  roleDefault,
  STUDIO_MOOD_WORDS,
  STUDIO_NEUTRALS,
  type StudioContrast,
  type StudioExportFormat,
  type StudioMode,
  type StudioSource,
  setRoleDefault,
  TUNABLE_ROLES,
} from './studio.ts';

function initialTheme(): Theme | null {
  const result = generateStudioTheme({
    source: 'color',
    seed: '#2b6ce0',
    neutral: 'zinc',
    contrast: 'AA',
    id: 'theme-studio',
    name: 'Theme studio',
  });
  return result.ok ? result.theme : null;
}

const boot = initialTheme();

let source = $state<StudioSource>('color');
let seed = $state('#2b6ce0');
let secondary = $state('');
let words = $state('calm ocean');
let neutral = $state<string>('zinc');
let contrast = $state<StudioContrast>('AA');
let mode = $state<StudioMode>('light');
let theme = $state<Theme | null>(boot);
let error = $state<string | null>(null);
let status = $state(
  boot ? `Default seed loaded. ${aaSummary(boot, 'AA').passLabel}` : 'Generate a theme to begin.'
);
let tuneRole = $state<SemanticRole>('primary');
let tuneHex = $state(boot ? roleDefault(boot, 'light', 'primary') : '#2b6ce0');
let exportFormat = $state<StudioExportFormat>('css');
let copyStatus = $state('');
let imageNote = $state('');
let previewEl = $state<HTMLElement | null>(null);

const summary = $derived(theme ? aaSummary(theme, contrast) : null);
const exportText = $derived(theme ? buildStudioExport(exportFormat, theme) : '');

$effect(() => {
  if (!previewEl || !theme) {
    if (previewEl) clearTheme(previewEl);
    return;
  }
  applyTheme(previewEl, { theme, mode, reducedMotion: true });
});

function setSource(next: string | string[]): void {
  if (next === 'color' || next === 'words' || next === 'image') source = next;
}

function setContrast(next: string | string[]): void {
  if (next === 'AA' || next === 'AAA') contrast = next;
}

function setMode(next: string | string[]): void {
  if (next === 'light' || next === 'dark') mode = next;
}

function setFormat(next: string | string[]): void {
  if (next === 'css' || next === 'json') exportFormat = next;
}

function onNeutralChange(event: Event): void {
  neutral = (event.currentTarget as HTMLSelectElement).value;
}

function onRoleChange(event: Event): void {
  const role = (event.currentTarget as HTMLSelectElement).value as SemanticRole;
  tuneRole = role;
  if (theme) tuneHex = roleDefault(theme, mode, role) || tuneHex;
}

function applyResult(result: ReturnType<typeof generateStudioTheme>, okMessage: string): void {
  if (!result.ok) {
    error = result.message;
    status = 'Generation failed.';
    return;
  }
  error = null;
  theme = result.theme;
  tuneHex = roleDefault(result.theme, mode, tuneRole) || tuneHex;
  const aa = aaSummary(result.theme, contrast);
  status = `${okMessage} ${aa.passLabel}`;
}

function generate(): void {
  applyResult(
    generateStudioTheme({
      source,
      seed,
      secondary: secondary || undefined,
      words,
      neutral: neutral as 'zinc',
      contrast,
      id: 'theme-studio',
      name: 'Theme studio',
    }),
    'Theme ready.'
  );
}

function applyRole(): void {
  if (!theme) {
    error = 'Generate a theme before tuning roles.';
    return;
  }
  const result = setRoleDefault(theme, tuneRole, tuneHex, [mode]);
  if (!result.ok) {
    error = result.message;
    return;
  }
  error = null;
  theme = result.theme;
  const aa = aaSummary(result.theme, contrast);
  status = `Updated ${tuneRole} (${mode}). ${aa.passLabel}`;
}

async function onImageChange(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  imageNote = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    error = 'Choose an image file (PNG, JPEG, WebP, …).';
    return;
  }
  // Local file only — object URL, no network.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not decode the image.'));
      img.src = url;
    });
    const pixels = readImagePixels(img, document);
    const colors = dominantColors(pixels);
    const seeds = seedsFromColors(colors);
    imageNote = `Dominant seed ${seeds.seed}${seeds.secondary ? ` · secondary ${seeds.secondary}` : ''}`;
    try {
      const generated = generateThemeFromImage(pixels, {
        id: 'theme-studio',
        name: 'Theme studio',
        contrast,
        neutral: neutral as 'zinc',
      });
      applyResult({ ok: true, theme: generated }, 'Theme from image ready.');
    } catch (cause) {
      // Fall back to seed path if image generator throws on edge images.
      applyResult(
        generateStudioTheme({
          source: 'image',
          imageSeed: seeds.seed,
          secondary: seeds.secondary,
          neutral: neutral as 'zinc',
          contrast,
        }),
        'Theme from image seed ready.'
      );
      if (!theme) {
        error = cause instanceof Error ? cause.message : 'Image theme failed.';
      }
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Could not read image pixels.';
    status = 'Image failed.';
  } finally {
    URL.revokeObjectURL(url);
    input.value = '';
  }
}

async function copyExport(): Promise<void> {
  if (!exportText || typeof navigator === 'undefined' || !navigator.clipboard) {
    copyStatus = 'Clipboard unavailable';
    return;
  }
  try {
    await navigator.clipboard.writeText(exportText);
    copyStatus = 'Copied';
  } catch {
    copyStatus = 'Copy failed';
  }
  window.setTimeout(() => {
    copyStatus = '';
  }, 2000);
}
</script>

<div class="studio" data-tx-theme-studio="">
  <div class="studio__controls">
    <section class="panel" aria-labelledby="studio-source-title">
      <h2 id="studio-source-title">Source</h2>
      <ToggleGroup type="single" value={source} onValueChange={setSource} aria-label="Theme source">
        <ToggleGroupItem value="color">Color</ToggleGroupItem>
        <ToggleGroupItem value="words">Words</ToggleGroupItem>
        <ToggleGroupItem value="image">Image</ToggleGroupItem>
      </ToggleGroup>

      {#if source === 'color'}
        <label class="field">
          <span class="field__label">Brand color</span>
          <Input
            type="text"
            bind:value={seed}
            aria-label="Brand color"
            data-tx-studio-seed=""
            placeholder="#2b6ce0"
          />
        </label>
        <label class="field">
          <span class="field__label">Secondary (optional)</span>
          <Input
            type="text"
            bind:value={secondary}
            aria-label="Secondary color"
            placeholder="#e11d48"
          />
        </label>
      {:else if source === 'words'}
        <label class="field">
          <span class="field__label">Mood words</span>
          <Input
            type="text"
            bind:value={words}
            aria-label="Mood words"
            placeholder="calm ocean"
          />
        </label>
        <p class="hint">
          Try {STUDIO_MOOD_WORDS.slice(0, 8).join(', ')}…
        </p>
      {:else}
        <label class="field">
          <span class="field__label">Local image</span>
          <input
            class="file"
            type="file"
            accept="image/*"
            aria-label="Local image file"
            data-tx-studio-image=""
            onchange={onImageChange}
          />
        </label>
        {#if imageNote}
          <p class="hint" data-tx-studio-image-note="">{imageNote}</p>
        {/if}
      {/if}

      <label class="field">
        <span class="field__label">Neutral family</span>
        <select class="select" aria-label="Neutral family" value={neutral} onchange={onNeutralChange}>
          {#each STUDIO_NEUTRALS as family (family)}
            <option value={family}>{family}</option>
          {/each}
        </select>
      </label>

      <div class="field">
        <span class="field__label" id="studio-contrast-label">Contrast target</span>
        <ToggleGroup
          type="single"
          value={contrast}
          onValueChange={setContrast}
          aria-labelledby="studio-contrast-label"
        >
          <ToggleGroupItem value="AA">AA 4.5:1</ToggleGroupItem>
          <ToggleGroupItem value="AAA">AAA 7:1</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {#if source !== 'image'}
        <Button type="button" variant="default" onclick={generate}>Generate theme</Button>
      {/if}
    </section>

    <section class="panel" aria-labelledby="studio-tune-title">
      <h2 id="studio-tune-title">Tune roles</h2>
      <label class="field">
        <span class="field__label">Role</span>
        <select class="select" aria-label="Role to tune" value={tuneRole} onchange={onRoleChange}>
          {#each TUNABLE_ROLES as role (role)}
            <option value={role}>{role}</option>
          {/each}
        </select>
      </label>
      <label class="field">
        <span class="field__label">Color for {mode} mode</span>
        <Input type="text" bind:value={tuneHex} aria-label="Role color" placeholder="#rrggbb" />
      </label>
      <Button type="button" variant="outline" onclick={applyRole}>Apply role</Button>
    </section>

    <section class="panel" aria-labelledby="studio-aa-title">
      <h2 id="studio-aa-title">AA check</h2>
      <p class="status" data-tx-studio-status="" role="status">{status}</p>
      {#if error}
        <p class="error" role="alert" data-tx-studio-error="">{error}</p>
      {/if}
      {#if summary}
        <p class="meta" data-tx-studio-aa="">
          Failing pairs: {summary.failCount} · floor {summary.textMinimum}:1
        </p>
        {#if summary.failing.length > 0}
          <ul class="fail" data-tx-studio-aa-fail="">
            {#each summary.failing.slice(0, 12) as row, i (i)}
              <li>
                {row.foreground} on {row.background} ({row.mode}/{row.state}): {row.ratio} &lt;
                {row.required}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="ok" data-tx-studio-aa-ok="">No failures under the selected floor.</p>
        {/if}
      {/if}
    </section>
  </div>

  <div class="studio__preview">
    <section class="panel" aria-labelledby="studio-preview-title">
      <div class="preview-head">
        <h2 id="studio-preview-title">Live components</h2>
        <ToggleGroup type="single" value={mode} onValueChange={setMode} aria-label="Preview mode">
          <ToggleGroupItem value="light">Light</ToggleGroupItem>
          <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div
        class="preview-host"
        data-tx-studio-preview=""
        bind:this={previewEl}
      >
        <PreviewKit />
      </div>
    </section>

    <section class="panel" id="studio-export" aria-labelledby="studio-export-title">
      <h2 id="studio-export-title">Export</h2>
      <ToggleGroup
        type="single"
        value={exportFormat}
        onValueChange={setFormat}
        aria-label="Export format"
      >
        <ToggleGroupItem value="css">CSS</ToggleGroupItem>
        <ToggleGroupItem value="json">JSON</ToggleGroupItem>
      </ToggleGroup>
      <div class="field field--export">
        <span class="field__label" id="studio-export-label">Output</span>
        <pre
          class="export"
          role="region"
          aria-labelledby="studio-export-label"
          tabindex="0"
          data-tx-studio-export=""
        >{exportText || 'Generate a theme to see CSS or JSON output.'}</pre>
      </div>
      <div class="export-actions">
        <Button type="button" variant="default" onclick={copyExport} disabled={!exportText}>
          Copy {exportFormat.toUpperCase()}
        </Button>
        {#if copyStatus}
          <span class="copy" role="status">{copyStatus}</span>
        {/if}
      </div>
    </section>
  </div>
</div>

<style>
  .studio {
    display: grid;
    gap: 1.5rem;
  }
  @media (min-width: 64rem) {
    .studio {
      grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
      align-items: start;
    }
  }
  .studio__controls,
  .studio__preview {
    display: grid;
    /* Columns may shrink below their widest child, so the studio fits beside the site sidebar. */
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
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
  .field {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.35rem;
  }
  .field__label {
    font-size: 0.875rem;
    font-weight: 600;
  }
  .select,
  .file,
  .export {
    min-block-size: 2.5rem;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    font: inherit;
  }
  .select:focus-visible,
  .file:focus-visible,
  .export:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .export {
    min-block-size: 14rem;
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.75rem;
    line-height: 1.4;
    resize: vertical;
    width: 100%;
    box-sizing: border-box;
    /* Long lines scroll inside the output; it is focusable for keyboard scrolling. */
    overflow: auto;
  }
  .hint,
  .status,
  .meta,
  .ok,
  .copy {
    margin: 0;
    font-size: 0.875rem;
  }
  .error {
    margin: 0;
    padding: 0.5rem 0.65rem;
    border: 2px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    font-weight: 600;
  }
  .ok {
    font-weight: 600;
  }
  .fail {
    margin: 0;
    padding-inline-start: 1.25rem;
    font-size: 0.8125rem;
    display: grid;
    gap: 0.25rem;
  }
  .preview-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .preview-host {
    padding: 1rem;
    border: 1px dashed var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
  }
  .export-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  @media (forced-colors: active) {
    .panel,
    .select,
    .export,
    .preview-host,
    .error {
      border-color: CanvasText;
    }
  }
</style>

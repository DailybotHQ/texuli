/**
 * `@texuli/tokens/design-system/report` (T-ds-io): a static HTML review page
 * for a compiled design system: identity, swatches per mode, the type ramp,
 * a component sheet, the contrast table, the solver's adjustments and the
 * warnings. For pull requests and design reviews; deterministic (no time,
 * no random ids), self-contained, no script.
 *
 * **Escaping by construction.** Markup is only ever produced by the `html`
 * tag below: every interpolated value is escaped unless it is itself the
 * result of `html`, and invisible characters become U+FFFD. Inline style
 * values are colors that pass the CSS safety rules or constant `var()`
 * references; the one stylesheet is constant text plus `emitCss`, whose
 * values refuse `<`. There is no other way to write markup in this module.
 *
 * A lazy entry: the `@texuli/tokens` root never imports it.
 */

import { semanticTokenToCssVar } from '../contract/prefix.ts';
import { SEMANTIC_ROLES } from '../contract/semantic.ts';
import type { CompiledDesignSystem } from './compiler.ts';
import { emitCss, isSafeCompiledValue } from './emit.ts';
import type { DesignSystemMode } from './guarantees.ts';

/** Markup made by {@link html}; nothing else creates it. */
class SafeHtml {
  readonly text: string;
  constructor(text: string) {
    this.text = text;
  }
}

const HIDDEN =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the report replaces these characters
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
const ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Text as HTML: the five markup characters escaped, invisible characters replaced. */
export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(HIDDEN, '\ufffd')
    .replace(/[&<>"']/g, (c) => ENTITIES[c] as string);
}

const fragment = (value: unknown): string => {
  if (value instanceof SafeHtml) return value.text;
  if (Array.isArray(value)) return value.map(fragment).join('');
  if (value === undefined || value === null || value === false) return '';
  return escapeHtml(value);
};

function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0] as string;
  values.forEach((value, i) => {
    out += fragment(value) + (strings[i + 1] as string);
  });
  return new SafeHtml(out);
}

/** A stylesheet as markup: only CSS this module builds, and `<` never reaches it. */
const stylesheet = (css: string) => new SafeHtml(`<style>${css.replace(/</g, '')}</style>`);

const COLOR = /^(?:#[0-9a-f]{3,8}|(?:oklch|rgba?|hsla?)\([\d\s.,%/+-]+\))$/i;
const swatchStyle = (value: unknown) =>
  isSafeCompiledValue(value) && COLOR.test(value) ? `background: ${value}` : undefined;

const BASE_CSS = `
:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
body { margin: 0; background: #f8fafc; color: #0f172a; }
main { max-inline-size: 72rem; margin-inline: auto; padding: 2rem 1.5rem; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; }
dt { font-weight: 600; }
dd { margin: 0; }
ul.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); gap: 0.5rem; padding: 0; list-style: none; }
ul.swatches li { display: flex; gap: 0.5rem; align-items: center; font-size: 0.8rem; }
span.sw { inline-size: 2rem; block-size: 2rem; border-radius: 0.375rem; border: 1px solid #94a3b8; flex: none; }
span.refused { background: repeating-linear-gradient(45deg, #fee2e2 0 4px, #fff 4px 8px); }
table { border-collapse: collapse; inline-size: 100%; font-size: 0.85rem; }
th, td { text-align: start; padding: 0.25rem 0.5rem; border-block-end: 1px solid #e2e8f0; }
td.fail { color: #b91c1c; font-weight: 600; }
.tx-ds-pane { background: var(--tx-background); color: var(--tx-foreground); font-family: var(--tx-font-sans); padding: 1.5rem; border-radius: 0.75rem; margin-block: 1rem; }
.tx-ds-pane h3 { font-family: var(--tx-font-heading); margin-block-start: 0; }
.tx-ds-pane .row { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-block: 0.75rem; }
.tx-ds-pane button { font: inherit; min-block-size: var(--tx-size-control-md); padding-inline: var(--tx-space-4); border-radius: var(--tx-radius); border: var(--tx-border-width) solid transparent; }
.tx-ds-pane .primary { background: var(--tx-primary); color: var(--tx-primary-foreground); }
.tx-ds-pane .secondary { background: var(--tx-secondary); color: var(--tx-secondary-foreground); }
.tx-ds-pane .outline { background: transparent; color: var(--tx-foreground); border-color: var(--tx-border-strong); }
.tx-ds-pane .destructive { background: var(--tx-destructive); color: var(--tx-destructive-foreground); }
.tx-ds-pane input { font: inherit; min-block-size: var(--tx-size-control-md); padding-inline: var(--tx-space-3); border-radius: var(--tx-radius); border: var(--tx-border-width) solid var(--tx-input); background: var(--tx-background); color: var(--tx-foreground); }
.tx-ds-pane .card { background: var(--tx-surface); color: var(--tx-surface-foreground); border: var(--tx-border-width) solid var(--tx-border); border-radius: var(--tx-radius); padding: var(--tx-space-4); box-shadow: var(--tx-elevation-1); }
.tx-ds-pane .muted { color: var(--tx-muted-foreground); }
.tx-ds-pane .badge { padding: 0.125rem 0.5rem; border-radius: 999px; font-size: 0.8rem; }
.tx-ds-pane .link { color: var(--tx-link); text-decoration: underline; }
`;

const TYPE_ROLES = ['display', 'title', 'heading', 'body', 'label', 'caption', 'code'] as const;
const STATUSES = ['success', 'warning', 'danger', 'info', 'neutral'] as const;

export interface EmitReportOptions {
  /** The page title; defaults to `<name> <version> design system report`. */
  title?: string;
}

const str = (value: unknown) => (typeof value === 'string' ? value : '');

/** The static report page as an HTML string. Deterministic for the same compiled input. */
export function emitReportHtml(
  compiled: CompiledDesignSystem,
  options: EmitReportOptions = {}
): string {
  const name = str(compiled?.name) || str(compiled?.id) || 'Design system';
  const version = str(compiled?.version);
  const heading = version ? `${name} ${version}` : name;
  const modes = (['light', 'dark'] as const).filter((mode) => compiled?.vars?.[mode]);
  const vars = (mode: DesignSystemMode) =>
    (compiled.vars[mode] ?? {}) as Readonly<Record<string, unknown>>;
  const report = compiled?.report;
  let css = '';
  try {
    css = emitCss(compiled, { selector: '.tx-ds-pane' });
  } catch {
    css = '';
  }

  const swatches = (mode: DesignSystemMode) => html`<h3>${mode}</h3>
<ul class="swatches">${SEMANTIC_ROLES.map((role) => {
    const variable = semanticTokenToCssVar(role);
    const value = vars(mode)[variable];
    const style = swatchStyle(value);
    return html`<li><span class="${style ? 'sw' : 'sw refused'}"${style ? html` style="${style}"` : ''}></span><code>${variable}</code> <code>${style ? value : 'refused'}</code></li>`;
  })}</ul>`;

  const pane = (
    mode: DesignSystemMode
  ) => html`<section class="${mode === 'dark' ? 'tx-ds-pane dark' : 'tx-ds-pane'}">
<h3>${mode}</h3>
<div class="row"><button type="button" class="primary">Primary</button><button type="button" class="secondary">Secondary</button><button type="button" class="outline">Outline</button><button type="button" class="destructive">Delete</button></div>
<div class="row"><input type="text" value="Input" aria-label="Sample input" readonly> <span class="link">A link</span></div>
<div class="row">${STATUSES.map((status) => html`<span class="badge" style="${`background: var(--tx-status-${status}-soft); color: var(--tx-status-${status}-soft-foreground)`}">${status}</span>`)}</div>
<div class="card"><p>A card on the surface.</p><p class="muted">Muted text on the surface.</p></div>
${TYPE_ROLES.map((role) => html`<p style="${`font-family: var(--tx-type-${role}-family, var(--tx-font-sans)); font-size: var(--tx-type-${role}-size); font-weight: var(--tx-type-${role}-weight); line-height: var(--tx-type-${role}-line); letter-spacing: var(--tx-type-${role}-tracking)`}">${role}: ${str(vars(mode)[`--tx-type-${role}-size`])}</p>`)}
</section>`;

  const contrast = (mode: DesignSystemMode) => {
    const pairs = Array.isArray(report?.contrast?.[mode]) ? (report.contrast[mode] ?? []) : [];
    return html`<h3>${mode}</h3>
<table><thead><tr><th>Foreground</th><th>Background</th><th>Kind</th><th>Ratio</th><th>Required</th><th>Result</th></tr></thead><tbody>${pairs.map(
      (pair) =>
        html`<tr><td><code>${pair.foreground}</code></td><td><code>${pair.background}</code></td><td>${pair.kind}</td><td>${pair.ratio}</td><td>${pair.required}</td><td${pair.pass ? '' : html` class="fail"`}>${pair.pass ? 'pass' : 'fail'}</td></tr>`
    )}</tbody></table>`;
  };

  const adjustments = Array.isArray(report?.adjustments) ? report.adjustments : [];
  const warnings = Array.isArray(report?.warnings) ? report.warnings : [];
  const attrs = Object.keys(compiled?.attrs ?? {})
    .sort()
    .map((key) => `${key}="${str((compiled.attrs as Record<string, unknown>)[key])}"`)
    .join(' ');

  const page = html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${options.title ?? `${heading} design system report`}</title>
${stylesheet(`${BASE_CSS}\n${css}`)}
</head>
<body>
<main>
<h1>${heading}</h1>
<dl>
<dt>Id</dt><dd><code>${str(compiled?.id)}</code></dd>
<dt>Variant</dt><dd>${str(compiled?.variant) || 'none'}</dd>
<dt>Modes</dt><dd>${modes.join(', ')}</dd>
<dt>Contrast target</dt><dd>${str(compiled?.accessibility?.contrast)}</dd>
<dt>Minimum target</dt><dd>${String(compiled?.accessibility?.targetMin ?? '')} px</dd>
<dt>Attributes</dt><dd><code>${attrs}</code></dd>
<dt>Hash</dt><dd><code>${str(compiled?.hash)}</code></dd>
</dl>
<h2>Swatches</h2>
${modes.map(swatches)}
<h2>Type ramp</h2>
<table><thead><tr><th>Role</th><th>Size</th><th>Weight</th><th>Line</th><th>Tracking</th></tr></thead><tbody>${TYPE_ROLES.map(
    (role) => {
      const v = (key: string) => str(vars(modes[0] ?? 'light')[`--tx-type-${role}-${key}`]);
      return html`<tr><td>${role}</td><td>${v('size')}</td><td>${v('weight')}</td><td>${v('line')}</td><td>${v('tracking')}</td></tr>`;
    }
  )}</tbody></table>
<h2>Components</h2>
${modes.map(pane)}
<h2>Contrast</h2>
${modes.map(contrast)}
<h2>Adjustments</h2>
${
  adjustments.length === 0
    ? html`<p>None: every generated color held its pairs.</p>`
    : html`<table><thead><tr><th>Mode</th><th>Variable</th><th>From</th><th>To</th><th>Field</th><th>Why</th></tr></thead><tbody>${adjustments.map(
        (a) =>
          html`<tr><td>${a.mode}</td><td><code>${a.variable}</code></td><td><code>${a.from}</code></td><td><code>${a.to}</code></td><td><code>${a.path}</code></td><td>${a.reason}</td></tr>`
      )}</tbody></table>`
}
<h2>Warnings</h2>
${
  warnings.length === 0
    ? html`<p>None.</p>`
    : html`<ul>${warnings.map((w) => html`<li><code>${w.path}</code> ${w.message}</li>`)}</ul>`
}
</main>
</body>
</html>
`;
  return page.text;
}

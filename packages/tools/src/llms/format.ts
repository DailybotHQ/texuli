import type { CatalogEntry } from '@texuli/catalog/build';
import type { CatalogExample, CatalogManifest, CatalogPropSchema } from '@texuli/catalog/manifest';

/** Stable path for a component doc: `components/<id>.md`. */
export function componentDocPath(id: string): string {
  return `components/${id}.md`;
}

/** Link href for llms.txt (relative or absolute). */
export function componentHref(id: string, baseUrl = ''): string {
  const rel = componentDocPath(id);
  if (!baseUrl) return rel;
  return `${baseUrl.replace(/\/$/, '')}/${rel}`;
}

function escapeMd(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r\n/g, '\n');
}

function listBlock(title: string, items: readonly string[]): string {
  if (items.length === 0) return '';
  const lines = items.map((item) => `- ${escapeMd(item)}`);
  return `### ${title}\n\n${lines.join('\n')}\n`;
}

function propRow(prop: CatalogPropSchema): string {
  const req = prop.required ? 'yes' : 'no';
  const kind =
    prop.kind === 'enum' && prop.enumValues?.length
      ? `enum(${prop.enumValues.join(' | ')})`
      : prop.kind;
  const trust = prop.trust ? prop.trust : '—';
  const def =
    prop.default === undefined ? '—' : `\`${JSON.stringify(prop.default)}\``.replace(/\|/g, '\\|');
  const desc = prop.description ? escapeMd(prop.description) : '—';
  return `| \`${prop.name}\` | ${kind} | ${req} | ${trust} | ${def} | ${desc} |`;
}

function exampleBlock(example: CatalogExample): string {
  const props = JSON.stringify(example.props, null, 2);
  const desc = example.description ? `\n\n${escapeMd(example.description)}` : '';
  return `#### ${escapeMd(example.title)} (\`${example.id}\`)${desc}\n\n\`\`\`json\n${props}\n\`\`\`\n`;
}

/**
 * Full Markdown page for one catalog entry (agent-facing).
 * No HTML; plain Markdown only.
 */
export function formatComponentMarkdown(
  entry: CatalogManifest | CatalogEntry,
  options: { baseUrl?: string; relatedLinks?: boolean; fromComponents?: boolean } = {}
): string {
  const emit =
    'emit' in entry && Array.isArray(entry.emit)
      ? entry.emit.join(', ')
      : entry.agentEmittable
        ? 'developer (agent-emittable)'
        : 'not agent-emittable';
  const group = 'group' in entry && typeof entry.group === 'string' ? entry.group : undefined;
  const a11y = Array.isArray(entry.a11y) ? entry.a11y : entry.a11y ? [entry.a11y] : [];

  const parts: string[] = [
    `# ${escapeMd(entry.label)}\n`,
    `> ${escapeMd(entry.summary)}\n`,
    `- **id:** \`${entry.id}\``,
    `- **package:** \`${entry.package}\``,
    `- **tier:** \`${entry.tier}\``,
    `- **agent emittable:** ${entry.agentEmittable === true ? 'yes' : 'no'}`,
    `- **emit:** ${emit}`,
  ];
  if (group) parts.push(`- **group:** \`${group}\``);
  parts.push('');

  parts.push(listBlock('Use when', entry.useWhen));
  parts.push(listBlock("Don't use when", entry.dontUseWhen));
  parts.push(listBlock('Accessibility', a11y));

  if (entry.props.length > 0) {
    parts.push('### Props\n');
    parts.push('| Name | Kind | Required | Trust | Default | Description |');
    parts.push('| --- | --- | --- | --- | --- | --- |');
    for (const prop of entry.props) parts.push(propRow(prop));
    parts.push('');
  }

  if (entry.examples.length > 0) {
    parts.push('### Examples\n');
    for (const example of entry.examples) parts.push(exampleBlock(example));
  }

  if (entry.related?.length) {
    parts.push('### Related\n');
    for (const id of entry.related) {
      // A page under `components/` links its siblings directly; `llms-full.txt`
      // sits at the root, beside `components/`.
      const href =
        options.fromComponents && !options.baseUrl
          ? `${id}.md`
          : componentHref(id, options.baseUrl);
      parts.push(`- [\`${id}\`](${href})`);
    }
    parts.push('');
  }

  parts.push(
    '---\n',
    '_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._\n'
  );

  return parts.filter((p, i, arr) => !(p === '' && arr[i - 1] === '')).join('\n');
}

/** One llms.txt link line. */
export function formatLlmsLink(entry: CatalogManifest | CatalogEntry, baseUrl = ''): string {
  const href = componentHref(entry.id, baseUrl);
  return `- [${entry.label}](${href}): ${entry.summary}`;
}

/**
 * Compact `llms.txt` index (llmstxt.org-style).
 * Sections: overview, agent-emittable (Tier U + developer), app chrome.
 */
export function formatLlmsTxt(
  entries: readonly (CatalogManifest | CatalogEntry)[],
  options: {
    title?: string;
    summary?: string;
    intro?: readonly string[];
    baseUrl?: string;
    splitTiers?: boolean;
  } = {}
): string {
  const title = options.title ?? 'Texuli';
  const summary =
    options.summary ??
    'Texuli is a Svelte 5 component system with a closed agent catalog and a sink-free renderer.';
  const baseUrl = options.baseUrl ?? '';
  const split = options.splitTiers !== false;

  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const emittable = sorted.filter((e) => e.agentEmittable === true);
  const chrome = sorted.filter((e) => e.agentEmittable !== true);

  const lines: string[] = [`# ${title}\n`, `> ${summary}\n`];
  if (options.intro?.length) {
    for (const para of options.intro) lines.push(`${para}\n`);
  }
  lines.push(
    'This file is generated from catalog manifests. Prefer component pages under `components/` for props and examples.\n'
  );

  if (split) {
    lines.push('## Agent-emittable components\n');
    lines.push(
      'Ids agents may emit into a catalog tree (subject to tier rules). Untrusted model output is limited further by the catalog build tiers.\n'
    );
    if (emittable.length === 0) lines.push('_None in this catalog._\n');
    else for (const entry of emittable) lines.push(formatLlmsLink(entry, baseUrl));
    lines.push('');

    lines.push('## App and chrome components\n');
    lines.push(
      'Developer-authored UI. Not agent-emittable by default (overlays, forms, display chrome).\n'
    );
    if (chrome.length === 0) lines.push('_None in this catalog._\n');
    else for (const entry of chrome) lines.push(formatLlmsLink(entry, baseUrl));
    lines.push('');
  } else {
    lines.push('## Components\n');
    for (const entry of sorted) lines.push(formatLlmsLink(entry, baseUrl));
    lines.push('');
  }

  lines.push(...envelopeSection(), '');

  lines.push('## Optional\n');
  lines.push(
    `- [Full catalog docs](${baseUrl ? `${baseUrl.replace(/\/$/, '')}/` : ''}llms-full.txt)`
  );
  lines.push('');

  return `${lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

/**
 * What agents need to know about the blueprint envelope beyond the
 * components: the fields that change how a whole tree paints. Printed in
 * `llms.txt` and `llms-full.txt`.
 */
export const LLMS_ENVELOPE_NOTES: readonly string[] = Object.freeze([
  'A tree may travel in a blueprint envelope (`"format": "texuli-blueprint"`, `"version": 1`, `"spec"`, `"catalog"`, `"status": "draft"`, `"tree"`). Hosts validate it with `validateDraft` from `@texuli/catalog/validate` and paint it with `@texuli/player`.',
  'Design system (spec 0.10.0, in development, not on npm): the envelope may carry `"designSystem"`, exactly one of `{"ref": "acme@2.1.0"}` (an exact `id@x.y.z` the host resolves, or `"texuli:<theme>"` for a library theme) and `{"inline": {"format": "texuli/design-system", "formatVersion": 1, "id", "version", "name", …}}` (a whole design-system document: colors, typography, shape, space and the other closed sections; never CSS). Never a version range, a URL, a path or a `data:` URL. The player applies it to its root; when it cannot (nothing resolves it, or the compiler refuses it for contrast, targets or URLs), the content paints in the default theme with a notice. Validation reports `check: "design-system"` with codes such as `extends-range`, `url-refused` and `unknown-key` and paths under `$.designSystem`.',
]);

function envelopeSection(): string[] {
  return ['## Blueprint envelope\n', ...LLMS_ENVELOPE_NOTES.map((note) => `${note}\n`)];
}

/**
 * `llms-full.txt`: every component Markdown page concatenated with clear separators.
 */
export function formatLlmsFullTxt(
  entries: readonly (CatalogManifest | CatalogEntry)[],
  options: { baseUrl?: string; title?: string } = {}
): string {
  const title = options.title ?? 'Texuli';
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const parts: string[] = [
    `# ${title} — full agent docs\n`,
    `> Complete catalog documentation generated from manifests (${sorted.length} components).\n`,
    ...envelopeSection(),
    '---\n',
  ];
  for (const entry of sorted) {
    parts.push(formatComponentMarkdown(entry, { baseUrl: options.baseUrl }));
    parts.push('\n---\n');
  }
  return `${parts
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

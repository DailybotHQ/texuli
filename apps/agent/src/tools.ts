import type { Catalog, CatalogEntry } from '@texuli/catalog/build';

/**
 * The model's tool schema and system prompt, generated from the built
 * catalog (agent-service design §4): only Tier U ids, per-id props from the
 * manifests, slot and event props omitted (host concerns, never model
 * output), CSS hooks omitted. Plain JSON Schema; a provider adapter wraps it.
 */

export const TOOL_NAME = 'emit_blueprint';

/** Props a model never sets: host callbacks, slots and CSS hooks. */
const OMITTED_KINDS = new Set(['slot', 'event']);
const OMITTED_NAMES = new Set(['class', 'className', 'style']);

function propSchema(prop: CatalogEntry['props'][number]): Record<string, unknown> {
  switch (prop.kind) {
    case 'string':
      return { type: 'string' };
    case 'number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'enum':
      return { type: 'string', enum: [...(prop.enumValues ?? [])] };
    case 'array':
      return { type: 'array' };
    case 'object':
      return { type: 'object' };
    default:
      return {};
  }
}

/** The Tier U entries, sorted by id. */
export function tierUEntries(catalog: Catalog): CatalogEntry[] {
  const ids = new Set(catalog.tiers.untrusted);
  return catalog.entries.filter((e) => ids.has(e.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** The `emit_blueprint` tool: one tree whose nodes are Tier U ids with their props. */
export function blueprintTool(catalog: Catalog): {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
} {
  const variants = tierUEntries(catalog).map((entry) => {
    const props = entry.props.filter(
      (p) => !OMITTED_KINDS.has(p.kind) && !OMITTED_NAMES.has(p.name)
    );
    return {
      type: 'object',
      properties: {
        id: { const: entry.id },
        props: {
          type: 'object',
          properties: Object.fromEntries(props.map((p) => [p.name, propSchema(p)])),
          required: props.filter((p) => p.required).map((p) => p.name),
          additionalProperties: false,
        },
        children: { type: 'array', items: { $ref: '#/$defs/node' } },
      },
      required: ['id'],
      additionalProperties: false,
    };
  });
  return {
    name: TOOL_NAME,
    description:
      'Emit the whole interface as one catalog tree. The root must be layout-page, layout-doc or layout-deck.',
    inputSchema: {
      type: 'object',
      properties: { tree: { $ref: '#/$defs/node' } },
      required: ['tree'],
      additionalProperties: false,
      $defs: { node: { oneOf: variants } },
    },
  };
}

/**
 * The system prompt: closed text built only from the catalog (no request
 * data), so every provider adapter sends the same instructions. The rules
 * teach the grammar the gate checks (the frame root, headings, nesting) and
 * the streaming canonical order (ADR-014: `children` last, so each node's
 * shell can be checked and painted as soon as its children start), then
 * each Tier U component's guidance.
 */
export function systemPrompt(catalog: Catalog): string {
  const lines = [
    'You build interfaces for texuli.com from the Texuli catalog.',
    `Reply by calling ${TOOL_NAME} with the complete tree; you may add one short plain-text note.`,
    'Rules:',
    '- Use only the component ids in the tool schema. The root is layout-page, layout-doc or layout-deck.',
    '- Use fictional data only (example.com). Never write HTML, scripts, styles or event handlers.',
    '- Links must be https URLs. Leave navigation, sign-in and purchases to the host app.',
    '- Keep one h1 (the frame title) and do not skip heading levels.',
    '- Never put a heading, a link or a button inside a link or a button.',
    'Structure:',
    '- Every node is { "id", "props", "children" } with members in that order: children last.',
    '- props holds only the props the tool schema lists for that id; leave out what you do not need.',
    '- children is a list of nodes; leave it out for a node without children.',
    '',
    'Components:',
  ];
  for (const entry of tierUEntries(catalog)) {
    lines.push(`- ${entry.id}: ${entry.summary}`);
    if (entry.useWhen?.length) lines.push(`  Use when: ${entry.useWhen.join(' ')}`);
    if (entry.dontUseWhen?.length) lines.push(`  Not for: ${entry.dontUseWhen.join(' ')}`);
  }
  return lines.join('\n');
}

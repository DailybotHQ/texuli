/**
 * Build and update interactive prop state from a catalog prop schema + example.
 */
export type LivePropKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'array'
  | 'object'
  | 'slot'
  | 'event'
  | 'unknown';

export type LivePropSchema = {
  name: string;
  kind: LivePropKind;
  required?: boolean;
  description?: string;
  enumValues?: readonly string[];
  default?: unknown;
};

export type LiveExampleSeed = {
  id: string;
  title: string;
  props: Readonly<Record<string, unknown>>;
};

/** Controls the props panel can edit (skip slots/events). */
export function editableProps(schema: readonly LivePropSchema[]): LivePropSchema[] {
  return schema.filter(
    (p) => p.kind === 'string' || p.kind === 'number' || p.kind === 'boolean' || p.kind === 'enum'
  );
}

/** Initial values: example props → defaults → kind fallbacks. */
export function initialProps(
  schema: readonly LivePropSchema[],
  example?: LiveExampleSeed
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const seed = example?.props ?? {};
  for (const prop of editableProps(schema)) {
    if (seed[prop.name] !== undefined) {
      out[prop.name] = seed[prop.name];
      continue;
    }
    if (prop.default !== undefined) {
      out[prop.name] = prop.default;
      continue;
    }
    switch (prop.kind) {
      case 'boolean':
        out[prop.name] = false;
        break;
      case 'number':
        out[prop.name] = 0;
        break;
      case 'enum':
        out[prop.name] = prop.enumValues?.[0] ?? '';
        break;
      default:
        out[prop.name] = prop.name === 'label' || prop.name === 'title' ? 'Harbor Notes' : '';
    }
  }
  // Keep non-editable seeds (arrays/objects) for stage fixtures when present.
  for (const [key, value] of Object.entries(seed)) {
    if (out[key] === undefined && value !== undefined && typeof value !== 'function') {
      out[key] = value;
    }
  }
  return out;
}

export function formatLiveCode(
  importPath: string,
  componentName: string,
  props: Readonly<Record<string, unknown>>
): string {
  const entries = Object.entries(props).filter(([, v]) => v !== undefined && v !== '');
  const lines = entries.map(([k, v]) => {
    if (typeof v === 'string') return `  ${k}={${JSON.stringify(v)}}`;
    if (typeof v === 'boolean') return v ? `  ${k}` : `  ${k}={false}`;
    if (typeof v === 'number') return `  ${k}={${v}}`;
    return `  ${k}={${JSON.stringify(v)}}`;
  });
  return `import { ${componentName} } from '${importPath}';\n\n<${componentName}\n${lines.join('\n')}\n/>`;
}

export function importPathFor(pkg: string, id: string): string {
  if (pkg === 'texuli') return `texuli/${id.replace(/^layout-/, 'layouts/')}`;
  return `${pkg}`;
}

export function exportNameHint(id: string): string {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** What the code sample needs from a stage-map entry. */
export type CodeTarget = {
  from: string;
  name: string;
  tag?: string;
  children?: string;
};

function attribute(name: string, value: string | number | boolean): string {
  if (typeof value === 'boolean') return value ? name : `${name}={false}`;
  if (typeof value === 'number') return `${name}={${value}}`;
  return /["{}\n]/.test(value) ? `${name}={${JSON.stringify(value)}}` : `${name}="${value}"`;
}

/**
 * A code sample with the exact public import and element: only primitive
 * props that differ from their documented default are printed.
 */
export function formatStageCode(
  target: CodeTarget,
  values: Readonly<Record<string, unknown>>,
  schema: readonly LivePropSchema[] = []
): string {
  const defaults = new Map(schema.map((prop) => [prop.name, prop.default]));
  const attrs: string[] = [];
  for (const [name, value] of Object.entries(values)) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
      continue;
    if (value === '' || defaults.get(name) === value) continue;
    attrs.push(attribute(name, value));
  }
  const tag = target.tag ?? target.name;
  const head =
    attrs.length > 2 ? `<${tag}\n  ${attrs.join('\n  ')}\n` : `<${[tag, ...attrs].join(' ')}`;
  const body = target.children
    ? `${head}>\n  ${target.children}\n</${tag}>`
    : `${head}${attrs.length > 2 ? '' : ' '}/>`;
  const load = target.name.startsWith('load')
    ? `\nconst { default: ${tag} } = await ${target.name}();`
    : '';
  return `import { ${target.name} } from '${target.from}';${load}\n\n${body}`;
}

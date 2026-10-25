/**
 * Framework-free model for object and array props that have no sub-field
 * editor yet: a JSON text, checked as it is typed against the renderer's
 * kind rule and, where the component publishes one, the same schema check
 * it runs before painting (`schemaCheck`): the content block families'
 * checks and the composition validator (at the untrusted tier, the tier the
 * player always paints compositions with).
 */
import { checkCodeBlock } from '@texuli/blocks/code';
import { checkDataBlock } from '@texuli/blocks/data';
import { parseDiagram } from '@texuli/blocks/diagram';
import { checkEmbedBlock } from '@texuli/blocks/embed';
import { checkInteractiveBlock } from '@texuli/blocks/interactive';
import { checkMapBlock } from '@texuli/blocks/map';
import { checkStructureBlock } from '@texuli/blocks/structure';
import type { CatalogManifest, CatalogPropSchema } from '@texuli/catalog';
import { sanitizeProps } from '@texuli/catalog/render/renderer';
import { validateComposition } from '@texuli/media/composition-model';

export interface JsonIssue {
  /** Where in the value (`$` is the whole value). */
  at: string;
  message: string;
}

export interface SchemaCheck {
  check: (value: unknown) => JsonIssue[];
  /** Where the rules come from, for the field's hint. */
  source: string;
}

export type JsonDraft = { ok: true; value: unknown } | { ok: false; message: string };

/** A JSON text → its value, or why it does not parse. Empty text clears the prop. */
export function parseJsonDraft(text: string): JsonDraft {
  if (text.trim() === '') return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, message: `Not valid JSON: ${(error as Error).message}` };
  }
}

const at = (path: readonly (string | number)[]) =>
  path.length === 0 ? '$' : `$.${path.map(String).join('.')}`;

type FamilyCheck = (
  value: unknown
) => { ok: true } | { ok: false; issues: { path: (string | number)[]; message: string }[] };

const family = (check: FamilyCheck, name: string): SchemaCheck => ({
  check: (value) => {
    const result = check(value);
    return result.ok
      ? []
      : result.issues.map((issue) => ({ at: at(issue.path), message: issue.message }));
  },
  source: `the ${name} block family's own check`,
});

const BLOCK_CHECKS: Readonly<Record<string, SchemaCheck>> = Object.freeze({
  'blocks-code': family(checkCodeBlock, 'code'),
  'blocks-data': family(checkDataBlock, 'data'),
  'blocks-embed': family(checkEmbedBlock, 'embed'),
  'blocks-interactive': family(checkInteractiveBlock, 'interactive'),
  'blocks-map': family(checkMapBlock, 'map'),
  'blocks-structure': family(checkStructureBlock, 'structure'),
  'blocks-diagram': {
    check: (value) => {
      const result = parseDiagram(value);
      return result.success
        ? []
        : result.issues.map((issue) => ({ at: issue.jsonPath, message: issue.message }));
    },
    source: 'the diagram block family’s own check',
  },
});

const compositionCheck: SchemaCheck = {
  check: (value) => {
    const result = validateComposition(value, { trust: 'untrusted' });
    return result.ok
      ? []
      : result.errors.map((issue) => ({
          at: issue.path === '' ? '$' : `$.${issue.path}`,
          message: issue.message,
        }));
  },
  source: 'the composition validator, at the untrusted tier',
};

/** The schema check for one prop, when its component publishes one. */
export function schemaCheck(id: string, name: string): SchemaCheck | undefined {
  if (name === 'block') return BLOCK_CHECKS[id];
  if (name === 'composition' && id.startsWith('media-composition-')) return compositionCheck;
  return undefined;
}

/** The renderer's verdict (object or list) and then the schema's issues. */
export function jsonIssues(
  prop: CatalogPropSchema,
  value: unknown,
  check?: SchemaCheck
): JsonIssue[] {
  if (value === undefined) {
    return prop.required === true ? [{ at: '$', message: 'Required: enter a value.' }] : [];
  }
  const result = sanitizeProps({ [prop.name]: value }, [prop], '', 'inspector');
  if (!result.props || !Object.hasOwn(result.props, prop.name)) {
    const reason = result.diagnostics.find((diagnostic) => diagnostic.message)?.message;
    return [
      {
        at: '$',
        message: `${reason ?? `Prop "${prop.name}" was refused.`} It will be refused at paint.`,
      },
    ];
  }
  return check?.check(value) ?? [];
}

/** The manifest's own examples for one prop: valid starting values. */
export function propExamples(
  manifest: Pick<CatalogManifest, 'examples'>,
  name: string
): { title: string; value: unknown }[] {
  return (manifest.examples ?? []).flatMap((example) =>
    Object.hasOwn(example.props, name) ? [{ title: example.title, value: example.props[name] }] : []
  );
}

export function prettyJson(value: unknown): string {
  return value === undefined ? '' : JSON.stringify(value, null, 2);
}

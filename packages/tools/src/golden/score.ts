import { checkCodeBlock } from '@texuli/blocks/code/engine';
import { checkDataBlock } from '@texuli/blocks/data/engine';
import { checkEmbedBlock } from '@texuli/blocks/embed/engine';
import { checkInteractiveBlock } from '@texuli/blocks/interactive/engine';
import { checkMapBlock } from '@texuli/blocks/map/engine';
import { checkMediaBlock } from '@texuli/blocks/media/engine';
import { checkStructureBlock } from '@texuli/blocks/structure/engine';
import { checkTextBlock } from '@texuli/blocks/text/engine';
import type { CatalogTreeInput, RenderCatalog, RenderNode } from '@texuli/catalog/render/renderer';
import { type DraftDiagnostic, validateDraft } from '@texuli/catalog/validate';
import { createFamilyBlockCheck, diagramFamilyCheck } from '@texuli/catalog/validate/blocks';
import type { ElementComponentLoader } from '../elements/content.ts';
import { GOLDEN_FRAME_IDS, goldenRenderCatalog } from './catalog.ts';
import { checkGuidance } from './guidance.ts';
import { paintGoldenTree } from './paint.ts';
import { checkSinks } from './sinks.ts';
import {
  GOLDEN_CHECKS,
  type GoldenAxeRunner,
  type GoldenCheckId,
  type GoldenCheckResult,
  type GoldenScore,
  type GoldenTask,
} from './types.ts';

/**
 * The family parsers injected per `blocks-*` id, assembled once for every
 * golden draft check. Keeping the assembly here (not in the catalog) keeps
 * the `@texuli/catalog/validate/blocks` entry under its 8 KiB budget.
 */
let familyEngines: ReturnType<typeof createFamilyBlockCheck> | undefined;
// The factory runs on first use instead of at module init: an init-time
// call made loading order-sensitive under transformed module graphs.
function checkFamilyBlock(block: unknown, id: string) {
  familyEngines ??= createFamilyBlockCheck({
    'blocks-code': checkCodeBlock,
    'blocks-data': checkDataBlock,
    'blocks-diagram': diagramFamilyCheck,
    'blocks-embed': checkEmbedBlock,
    'blocks-interactive': checkInteractiveBlock,
    'blocks-map': checkMapBlock,
    'blocks-media': checkMediaBlock,
    'blocks-structure': checkStructureBlock,
    'blocks-text': checkTextBlock,
  });
  return familyEngines(block, id);
}

export interface GoldenScoreOptions {
  /** Defaults to the golden render catalog (the agent surface). */
  catalog?: RenderCatalog;
  /**
   * Runs axe on the painted tree. Without it (or without `document`), the axe
   * check is `skipped`: offline scoring needs a DOM and an axe-core instance.
   */
  axe?: GoldenAxeRunner;
  document?: Document;
  loaders?: Readonly<Record<string, ElementComponentLoader>>;
}

function result(check: GoldenCheckId, issues: readonly string[]): GoldenCheckResult {
  return { check, status: issues.length === 0 ? 'pass' : 'fail', issues };
}

function isTreeInput(value: unknown): value is CatalogTreeInput {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function componentIds(roots: readonly RenderNode[], out = new Set<string>()): Set<string> {
  for (const node of roots) {
    if (node.kind !== 'component') continue;
    out.add(node.id);
    componentIds(node.children, out);
  }
  return out;
}

function line(d: DraftDiagnostic): string {
  return `${d.path} ${d.id ?? ''}: ${d.code} (${d.message})`;
}

/**
 * Schema and grammar verdicts from the shared `validateDraft`: input,
 * structure, limits, the sink-free renderer, deep block schemas and the
 * frame root are `schema`; the composition grammar is `grammar`. The raw
 * sink scan is its own golden check (`checkSinks`, the same scan).
 */
function checkDraft(
  tree: unknown,
  task: GoldenTask,
  catalog: RenderCatalog
): { issues: string[]; grammar: string[]; roots: readonly RenderNode[] } {
  if (!isTreeInput(tree)) {
    return { issues: ['the output is not a catalog tree object'], grammar: [], roots: [] };
  }
  const validation = validateDraft(tree, {
    catalog,
    tier: task.tier,
    frameRoots: GOLDEN_FRAME_IDS,
    checkBlock: checkFamilyBlock,
  });
  const of = (check: DraftDiagnostic['check']) =>
    validation.diagnostics.filter((d) => d.check === check).map(line);
  return {
    issues: [
      ...of('input'),
      ...of('structure'),
      ...of('limits'),
      ...of('render'),
      ...of('root'),
      ...of('blocks'),
    ],
    grammar: of('grammar'),
    roots: validation.roots,
  };
}

/** Scores one tree against one golden task. Never throws on a bad tree. */
export async function scoreGoldenTree(
  task: GoldenTask,
  tree: unknown,
  options: GoldenScoreOptions = {}
): Promise<GoldenScore> {
  const catalog = options.catalog ?? goldenRenderCatalog();
  const schema = checkDraft(tree, task, catalog);
  const checks: GoldenCheckResult[] = [result('schema', schema.issues)];

  const skipped = (check: GoldenCheckId, why: string): GoldenCheckResult => ({
    check,
    status: 'skipped',
    issues: [why],
  });
  if (!isTreeInput(tree)) {
    // Nothing to inspect: only the schema (and coverage) verdicts mean anything.
    checks.push(skipped('dontUseWhen', 'not a tree'), skipped('sinks', 'not a tree'));
  } else {
    checks.push(result('dontUseWhen', checkGuidance(tree)), result('sinks', checkSinks(tree)));
  }

  if (schema.roots.length === 0) {
    checks.push(skipped('grammar', 'nothing rendered'));
  } else {
    checks.push(result('grammar', schema.grammar));
  }

  if (!options.axe || !options.document) {
    checks.push({ check: 'axe', status: 'skipped', issues: ['no DOM axe runner given'] });
  } else if (schema.issues.length > 0) {
    checks.push({
      check: 'axe',
      status: 'skipped',
      issues: ['not painted: the schema check failed'],
    });
  } else {
    const paint = await paintGoldenTree(schema.roots, options.document, {
      loaders: options.loaders,
      title: task.title,
    });
    try {
      const violations = await options.axe(options.document);
      checks.push(
        result('axe', [
          ...paint.issues,
          ...violations.map(
            (v) =>
              `${v.id} (${v.impact ?? 'n/a'}, ${v.nodes} node${v.nodes === 1 ? '' : 's'}): ${v.sample ?? ''}`
          ),
        ])
      );
    } finally {
      paint.destroy();
    }
  }

  const present = componentIds(schema.roots);
  checks.push(
    result(
      'coverage',
      task.mustInclude.filter((id) => !present.has(id)).map((id) => `missing a ${id} component`)
    )
  );

  const ordered = GOLDEN_CHECKS.map(
    (id) => checks.find((check) => check.check === id) as GoldenCheckResult
  );
  const ran = ordered.filter((check) => check.status !== 'skipped');
  const passedCount = ran.filter((check) => check.status === 'pass').length;
  return {
    taskId: task.id,
    passed: ran.every((check) => check.status === 'pass'),
    score: ran.length === 0 ? 0 : passedCount / ran.length,
    checks: ordered,
  };
}

/**
 * The check the JSON live preview runs before it paints. It mirrors what
 * `<Player>` runs at the `untrusted` tier: the local-state declarations
 * (`splitStatefulBlueprint`), the player's own binding checks (controls,
 * flows, action forms, host-bound writers), then `validateDraft` with the
 * player catalog, the player's grammar roles, the block family parsers and
 * the `when` condition runtime. A draft with any error is not painted. The
 * player re-validates on paint anyway, and its diagnostics join the list.
 *
 * Imported lazily by the island: it pulls in the validator and catalog.
 */
import { checkCodeBlock } from '@texuli/blocks/code/engine';
import { checkDataBlock } from '@texuli/blocks/data/engine';
import { checkEmbedBlock } from '@texuli/blocks/embed/engine';
import { checkInteractiveBlock } from '@texuli/blocks/interactive/engine';
import { checkMapBlock } from '@texuli/blocks/map/engine';
import { checkMediaBlock } from '@texuli/blocks/media/engine';
import { checkStructureBlock } from '@texuli/blocks/structure/engine';
import { checkTextBlock } from '@texuli/blocks/text/engine';
import { formulaConditions } from '@texuli/catalog/render/conditions';
import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { type DraftBlockCheck, validateDraft } from '@texuli/catalog/validate';
import { createFamilyBlockCheck, diagramFamilyCheck } from '@texuli/catalog/validate/blocks';
import {
  checkActionNodes,
  checkControlBindings,
  checkFlowNodes,
  checkHostBoundWriters,
  createPlayerCatalog,
  PLAYER_GRAMMAR_ROLES,
  splitStatefulBlueprint,
} from '@texuli/player';
import {
  type DraftRootKind,
  dedupe,
  diagnosticKey,
  errorCount,
  type PreviewDiagnostic,
  parseJsonText,
  rootKindOf,
  toJsonPath,
} from './model.ts';

/** The host's tier for everything typed into the editor. */
export const PREVIEW_TIER = 'untrusted' as const;

export interface BlueprintCheck {
  /** True only with zero error diagnostics: the island paints only then. */
  ok: boolean;
  /** The parsed document, or `undefined` when the text is not JSON. */
  value: unknown;
  root: DraftRootKind | null;
  diagnostics: readonly PreviewDiagnostic[];
}

let catalog: RenderCatalog | undefined;
let blockCheck: ((block: unknown, id: string) => DraftBlockCheck) | undefined;

/** The player's catalog, built once. */
export function previewCatalog(): RenderCatalog {
  catalog ??= createPlayerCatalog();
  return catalog;
}

// The same family parsers the player injects for every `blocks-*` node.
function checkBlock(block: unknown, id: string): DraftBlockCheck {
  blockCheck ??= createFamilyBlockCheck({
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
  return blockCheck(block, id);
}

/** Validate editor text. Never throws: anything unexpected is an error row. */
export function checkBlueprintText(text: string): BlueprintCheck {
  const parsed = parseJsonText(text);
  if (!parsed.ok) {
    return { ok: false, value: undefined, root: null, diagnostics: [parsed.diagnostic] };
  }
  const value = parsed.value;
  const root = rootKindOf(value);
  const out: PreviewDiagnostic[] = [];
  const push = (
    source: PreviewDiagnostic['source'],
    severity: PreviewDiagnostic['severity'],
    code: string,
    rawPath: string,
    message: string
  ) => {
    const path = toJsonPath(rawPath, root);
    out.push({ key: diagnosticKey(source, code, path), source, severity, code, message, path });
  };

  try {
    // Local state first: a refused declaration refuses the whole blueprint in the player.
    const split = splitStatefulBlueprint(value);
    if (split.kind === 'invalid') {
      for (const issue of split.issues)
        push('state', 'error', issue.code, issue.path, issue.message);
    } else {
      const declarations = split.kind === 'stateful' ? split.declarations : null;
      const flow = split.kind === 'stateful' ? split.flow : null;
      const issues = [
        ...checkControlBindings(split.blueprint, declarations),
        ...checkFlowNodes(split.blueprint, flow),
        ...checkActionNodes(split.blueprint, declarations),
        ...(declarations ? checkHostBoundWriters(split.blueprint, declarations) : []),
      ];
      for (const issue of issues) push('state', 'error', issue.code, issue.path, issue.message);
    }

    const result = validateDraft(value, {
      catalog: previewCatalog(),
      tier: PREVIEW_TIER,
      checkBlock,
      conditions: formulaConditions,
      roles: PLAYER_GRAMMAR_ROLES,
    });
    for (const d of result.diagnostics) {
      push('validator', d.severity, d.code, d.path, d.message);
    }
  } catch {
    push('validator', 'error', 'check-failed', '', 'The blueprint could not be checked.');
  }

  const diagnostics = dedupe(out);
  return { ok: errorCount(diagnostics) === 0, value, root, diagnostics };
}

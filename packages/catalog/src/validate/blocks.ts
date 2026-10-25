/**
 * `@texuli/catalog/validate/blocks` — the family block-check runtime for
 * `validateDraft`: a `checkBlock` that checks each `blocks-*` node with its
 * own family's parser, the same parser the family component runs before it
 * paints (audit G05).
 *
 * The nine family parsers live in the `@texuli/blocks` family engines, so
 * they are injected instead of imported here: hosts assemble
 * `checkFamilyBlock` with `createFamilyBlockCheck` (recipe in
 * `docs/validate.md`), which keeps
 * this entry under its 8 KiB budget. Runtime-neutral: every family engine
 * is Svelte-free.
 */
import { parseDiagram } from '@texuli/blocks/diagram/engine';
import { BLOCK_FAMILY_TYPES } from '../render/renderer/block-families.ts';
import type { DraftBlockCheck } from './draft.ts';

/** One family-engine issue; `path` addresses the block's props. */
export type FamilyIssue = { path?: readonly (string | number)[]; message: string };

/** What a family engine answers for one block. */
export type FamilyCheck = (
  block: unknown
) => { ok: true } | { ok: false; issues: readonly FamilyIssue[] };

/**
 * The engines a host injects, keyed by `blocks-*` id. Absent engines fail
 * closed: blocks of that family are refused, never skipped.
 */
export type FamilyBlockEngines = Partial<Record<string, FamilyCheck>>;

/** `$["nodes"][0].label` → `['nodes', 0, 'label']` (the diagram parser reports JSON paths). */
function fromJsonPath(jsonPath: string): (string | number)[] {
  const out: (string | number)[] = [];
  for (const match of jsonPath.matchAll(/\["((?:[^"\\]|\\.)*)"\]|\[(\d+)\]|\.([^.[\]]+)/g)) {
    if (match[2] !== undefined) out.push(Number(match[2]));
    else out.push(match[1] ?? match[3] ?? '');
  }
  return out;
}

/**
 * The diagram family's engine reports JSON paths; this adapter turns them
 * into the prop paths the draft checks use.
 */
export const diagramFamilyCheck: FamilyCheck = (block) => {
  const result = parseDiagram(block);
  if (result.success) return { ok: true };
  return {
    ok: false,
    issues: result.issues.map((issue) => ({
      path: fromJsonPath(issue.jsonPath),
      message: issue.message,
    })),
  };
};

/**
 * Build the `checkBlock` for `validateDraft` from the injected family
 * engines (recipe in `docs/validate.md`). Fails closed: an id with no known
 * block family or no injected engine, a block another family renders, a
 * block with no `type`, and a parser that throws are all refused. The
 * returned checker never throws.
 */
export function createFamilyBlockCheck(
  engines: FamilyBlockEngines
): (block: unknown, id: string) => DraftBlockCheck {
  return (block, id) => {
    const check = engines[id];
    if (check === undefined || !Object.hasOwn(BLOCK_FAMILY_TYPES, id)) {
      return {
        success: false,
        issues: [{ path: [], message: `"${id}" has no known block family.` }],
      };
    }
    const type =
      block !== null && typeof block === 'object' && !Array.isArray(block)
        ? (block as Record<string, unknown>).type
        : undefined;
    const types = BLOCK_FAMILY_TYPES[id] ?? [];
    if (typeof type !== 'string' || !types.includes(type)) {
      return {
        success: false,
        issues: [
          { path: ['type'], message: `"${String(type)}" is not a block type "${id}" renders.` },
        ],
      };
    }
    try {
      const result = check(block);
      return result.ok ? { success: true } : { success: false, issues: result.issues };
    } catch {
      return {
        success: false,
        issues: [{ path: [], message: 'The family parser stopped on this block.' }],
      };
    }
  };
}

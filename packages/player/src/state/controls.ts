import { ENVELOPE_FORMAT } from '@texuli/catalog/envelope';
import { CONTROL_STATE_TYPES } from '../control-manifests.ts';
import type { StateDeclarations, StateIssue } from './schema.ts';

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check every state-only control in a tree against the declared state: its
 * `state` prop must name a declared variable of the type the control writes
 * (toggle boolean, choice enum, slider number, filter string). A control in
 * a blueprint without declared state has nothing to write and is refused.
 * Never throws; shape problems are `validateDraft`'s to report.
 */
export function checkControlBindings(
  blueprint: unknown,
  declarations: StateDeclarations | null
): StateIssue[] {
  const issues: StateIssue[] = [];
  const tree =
    isBag(blueprint) && blueprint.format === ENVELOPE_FORMAT ? blueprint.tree : blueprint;

  function visit(node: unknown, path: string, depth: number): void {
    if (!isBag(node) || depth > 64) return;
    const id = typeof node.id === 'string' ? node.id : '';
    if (Object.hasOwn(CONTROL_STATE_TYPES, id)) {
      const props = isBag(node.props) ? node.props : {};
      const name = props.state;
      const wanted = CONTROL_STATE_TYPES[id];
      const declaration =
        typeof name === 'string' && declarations && Object.hasOwn(declarations, name)
          ? declarations[name]
          : undefined;
      if (!declarations) {
        issues.push({
          code: 'control-binding',
          path,
          message: `"${id}" needs declared local state; this blueprint declares none.`,
        });
      } else if (typeof name !== 'string' || !declaration) {
        issues.push({
          code: 'control-binding',
          path,
          message: `"${id}" names no declared state variable.`,
        });
      } else if (declaration.type !== wanted) {
        issues.push({
          code: 'control-binding',
          path,
          message: `"${id}" writes a ${wanted}, but "${name}" is a ${declaration.type}.`,
        });
      }
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child, index) => {
        visit(child, `${path}.children.${index}`, depth + 1);
      });
    }
  }

  if (Array.isArray(tree)) {
    for (const [index, node] of tree.entries()) visit(node, String(index), 0);
  } else visit(tree, '0', 0);
  return issues;
}

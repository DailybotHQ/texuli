/** Check every catalog node against a compiled design-system allow manifest. */
import type { DesignSystemIssue } from '../../generated/typescript/design-system.ts';
import { isRecord } from '../dialect.ts';
import { DS_LOCKED_LIMITS } from './types-locked.ts';
import { DESIGN_SYSTEM_LIMITS } from './vocabulary.ts';

const AXES = [
  ['variant', 'variants', 'unknown-variant'],
  ['size', 'sizes', 'unknown-size'],
  ['tone', 'tones', 'unknown-tone'],
  ['density', 'densities', 'unknown-density'],
] as const;
const STATE_PROPS = [
  ['hover', 'hover'],
  ['focus-visible', 'focus-visible'],
  ['active', 'active'],
  ['disabled', 'disabled'],
  ['loading', 'loading'],
  ['invalid', 'invalid'],
  ['selected', 'selected'],
  ['expanded', 'expanded'],
  ['checked', 'checked'],
  ['open', 'open'],
  ['readonly', 'readonly'],
  ['readonly', 'readOnly'],
] as const;
const MAX_BLUEPRINT_NODES = 10_000;
const MAX_BLUEPRINT_DEPTH = 64;

const at = (path: string, key: string | number): string =>
  typeof key === 'number'
    ? `${path}[${key}]`
    : /^[A-Za-z_$][\w$]*$/.test(key)
      ? `${path}.${key}`
      : `${path}[${JSON.stringify(key)}]`;

/**
 * Report blueprint nodes that violate a locked design-system allow manifest.
 * A missing `allow` means the design system is not locked. Traversal and
 * diagnostics are bounded; malformed or hostile JSON never throws.
 */
export function checkBlueprintAllow(
  blueprint: unknown,
  allowManifest: unknown
): { ok: boolean; errors: readonly DesignSystemIssue[] } {
  const manifest = isRecord(allowManifest) ? allowManifest : undefined;
  const allow = manifest && isRecord(manifest.allow) ? manifest.allow : undefined;
  const errors: DesignSystemIssue[] = [];
  if (!allow) return { ok: true, errors };

  const add = (code: DesignSystemIssue['code'], path: string, message: string) => {
    if (errors.length < DESIGN_SYSTEM_LIMITS.errors) errors.push({ code, path, message });
  };
  let visited = 0;

  const visit = (value: unknown, path: string, depth: number): void => {
    if (errors.length >= DESIGN_SYSTEM_LIMITS.errors) return;
    if (++visited > MAX_BLUEPRINT_NODES || depth > MAX_BLUEPRINT_DEPTH) {
      add('invalid-value', path, 'The blueprint is too large or too deep to check.');
      return;
    }
    if (Array.isArray(value)) {
      const count = Math.min(value.length, MAX_BLUEPRINT_NODES - visited + 1);
      for (let i = 0; i < count && errors.length < DESIGN_SYSTEM_LIMITS.errors; i++)
        visit(value[i], at(path, i), depth + 1);
      return;
    }
    if (!isRecord(value)) return;

    if (typeof value.id === 'string') {
      const nodePath = path;
      const componentAllow = Object.hasOwn(allow, value.id) ? allow[value.id] : undefined;
      if (!isRecord(componentAllow)) {
        add(
          'unknown-component',
          at(nodePath, 'id'),
          'Component is not allowed by the design system.'
        );
      } else {
        const props = isRecord(value.props) ? value.props : {};
        for (const [prop, field, code] of AXES) {
          const enabled = componentAllow[field];
          const actual = props[prop];
          if (
            Array.isArray(enabled) &&
            actual !== undefined &&
            (typeof actual !== 'string' ||
              !enabled.slice(0, DS_LOCKED_LIMITS.axisValues).includes(actual))
          )
            add(
              code,
              at(at(nodePath, 'props'), prop),
              `${prop} is not allowed by the design system.`
            );
        }
        const enabledStates = componentAllow.states;
        if (Array.isArray(enabledStates)) {
          const states = new Set(enabledStates.slice(0, DS_LOCKED_LIMITS.axisValues));
          for (const [state, prop] of STATE_PROPS) {
            if (props[prop] !== undefined && props[prop] !== false && !states.has(state))
              add(
                'unknown-state',
                at(at(nodePath, 'props'), prop),
                'State is not allowed by the design system.'
              );
          }
        }
      }
    }

    if (Array.isArray(value.children)) {
      const count = Math.min(value.children.length, MAX_BLUEPRINT_NODES - visited + 1);
      for (let i = 0; i < count && errors.length < DESIGN_SYSTEM_LIMITS.errors; i++)
        visit(value.children[i], at(at(path, 'children'), i), depth + 1);
    }
  };

  if (isRecord(blueprint) && Object.hasOwn(blueprint, 'tree')) visit(blueprint.tree, '$.tree', 0);
  else visit(blueprint, '$', 0);
  return { ok: errors.length === 0, errors };
}

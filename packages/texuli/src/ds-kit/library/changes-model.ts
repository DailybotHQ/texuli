/**
 * The changes model of the kit (kit API §5.4, owner answer 6, T-017-kit): document diffs
 * live in `@texuli/spec/design-system` (`changesModel`); this wrapper adds the compiled
 * token diff from `@texuli/tokens/design-system/diff`. `texuli/ds-kit` still exports
 * `changesModel` with the same signature.
 */

import {
  type KitChangesModel as DocumentChangesModel,
  changesModel as documentChangesModel,
  type KitVersion as SpecKitVersion,
} from '@texuli/spec/design-system';
import type { CompiledDesignSystem } from '@texuli/tokens/design-system/compile-core';
import { type DesignSystemDiff, diffDesignSystems } from '@texuli/tokens/design-system/diff';
import type { KitCompiled } from '../shared/types.ts';

export {
  KIT_ALLOW_LISTS,
  type KitAllowChange,
  type KitAllowList,
  type KitApprovalChange,
  type KitChangeKind,
  type KitLibraryChange,
} from '@texuli/spec/design-system';

/** One version of the design system to compare. */
export interface KitVersion extends SpecKitVersion {
  readonly compiled?: KitCompiled;
}

export type KitChangesModel = DocumentChangesModel & {
  /** `undefined` when either compiled output is missing ("compile both versions to compare tokens"). */
  readonly tokens?: DesignSystemDiff;
};

/** What changed from `previous` to `current`. */
export function changesModel(previous: KitVersion, current: KitVersion): KitChangesModel {
  const base = documentChangesModel(previous, current);
  const tokens =
    previous.compiled && current.compiled
      ? diffDesignSystems(
          previous.compiled as unknown as CompiledDesignSystem,
          current.compiled as unknown as CompiledDesignSystem
        )
      : undefined;
  return {
    ...base,
    ...(tokens ? { tokens } : {}),
    identical: base.identical && (tokens?.identical ?? true),
  };
}

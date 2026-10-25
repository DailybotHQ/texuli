/**
 * `@texuli/catalog/render/grammar` — composition grammar for sink-free trees.
 *
 * Enforces heading outline, interactive nesting, one primary action per
 * container, landmarks, and DOM order equals visual order.
 */

export { checkCompositionGrammar, grammarIssueSeverity } from './check.ts';
export {
  DECK_GRAMMAR_IDS,
  DEFAULT_GRAMMAR_ROLES,
  defaultGrammarRoles,
  grammarRolesFromList,
  isContainerRole,
  isInteractiveRole,
  resolveMeta,
  resolveNestedRole,
} from './roles.ts';
export type {
  GrammarComponentMeta,
  GrammarIssue,
  GrammarIssueCode,
  GrammarLandmark,
  GrammarMode,
  GrammarNestedRole,
  GrammarOptions,
  GrammarResult,
  GrammarRole,
  GrammarRoleCatalog,
} from './types.ts';

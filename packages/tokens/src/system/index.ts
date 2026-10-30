/** `@texuli/tokens/system`: the token contract v2 system families (ADR-020). */
export {
  SYSTEM_TOKEN_FAMILIES,
  SYSTEM_TOKENS,
  type SystemToken,
  type SystemTokenFamily,
  type SystemTokenFamilyId,
} from './families.ts';
export {
  BASE_SYSTEM_TOKEN_NAMES,
  DATA_VIZ_TOKEN_NAMES,
  isSystemTokenName,
  STATUS_NAMES,
  SYSTEM_TOKEN_NAMES,
  TYPE_ROLE_PROPERTIES,
  TYPE_ROLES,
  type TypeRole,
} from './names.ts';
export {
  GENERATED_END,
  GENERATED_START,
  renderDeclarations,
  renderSystemTokenDeclarations,
  TOKEN_SCOPE_SELECTOR,
} from './render.ts';

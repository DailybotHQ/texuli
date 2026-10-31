/** Email-safe static HTML from validated blueprints (ADR-016). */
export {
  DESIGN_COLOR_ROLES,
  type DesignColorRole,
  type DesignValues,
  type DesignVarsSource,
  designValues,
} from '../internal/design-values.ts';
export { emailRenderCatalog } from './catalog.ts';
export { emailDarkMode } from './dark.ts';
export {
  EMAIL_BLOCK_TYPES,
  EMAIL_COMPONENT_IDS,
  type EmailDiagnostic,
  type EmailOptions,
  type EmailResult,
  emailImage,
  emailLink,
  renderEmail,
} from './render.ts';
export {
  DEFAULT_EMAIL_PALETTE,
  designEmailPalette,
  EMAIL_MONO_FONT,
  EMAIL_PALETTE_DESIGN_ROLES,
  EMAIL_STYLE_PROPERTIES,
  EMAIL_SYSTEM_FONT,
  type EmailPalette,
  type EmailStyle,
  type EmailStyleProperty,
  emailFontFamily,
  emailFontStack,
  resolveEmailPalette,
  serializeEmailStyle,
  toSrgbHex,
} from './styles.ts';

/** Email-safe static HTML from validated blueprints (ADR-016). */
export { emailRenderCatalog } from './catalog.ts';
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
  EMAIL_STYLE_PROPERTIES,
  type EmailPalette,
  type EmailStyle,
  type EmailStyleProperty,
  emailFontFamily,
  resolveEmailPalette,
  serializeEmailStyle,
  toSrgbHex,
} from './styles.ts';

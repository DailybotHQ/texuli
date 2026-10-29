/**
 * @texuli/core/markup: escaped XML and HTML builders (ADR-016). Typed nodes
 * only, no raw-markup API; URL attributes go through the URL policy.
 */
export {
  el,
  escapeMarkupAttribute,
  escapeMarkupText,
  HTML_ELEMENTS,
  HTML_URL_ATTRIBUTES,
  type HtmlSerializeOptions,
  imageUrl,
  isMarkupUrl,
  linkUrl,
  type MarkupAttribute,
  type MarkupAttributeValue,
  type MarkupChild,
  type MarkupElement,
  type MarkupNode,
  type MarkupText,
  type MarkupUrl,
  sanitizeMarkupChars,
  serializeHtml,
  serializeXml,
  text,
  type XmlSerializeOptions,
} from './markup.ts';

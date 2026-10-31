/**
 * Email-safe static HTML from a validated blueprint (ADR-016). The draft is
 * validated first (`validateDraft` at the `untrusted` tier, with the deep
 * block schemas); only the sink-free render tree it returns is mapped.
 * Output is built with `@texuli/core/markup`, so every text and attribute
 * value is escaped by construction and there is no raw-markup path: no
 * scripts, forms, frames, event handlers or remote fonts. Layout is tables
 * with typed inline styles (`styles.ts`) resolved to sRGB. Links pass
 * `safeHref` and images `safeImageSrc` at the `untrusted` tier and must be
 * absolute `https` (`mailto:` for links); relative ones need `baseUrl`.
 */
import { type Block, blockText } from '@texuli/blocks/core';
import {
  type MdBlock,
  type MdInline,
  parseInline,
  parseMarkdown,
} from '@texuli/blocks/text/markdown';
import type { RenderCatalog, RenderNode } from '@texuli/catalog/render/renderer';
import {
  el,
  imageUrl,
  linkUrl,
  type MarkupChild,
  type MarkupElement,
  type MarkupUrl,
  serializeHtml,
} from '@texuli/core/markup';
import { safeHref } from '@texuli/core/url-policy';
import type { Theme } from '@texuli/tokens/build';
import { type DesignVarsSource, designValues } from '../internal/design-values.ts';
import { type StaticDiagnostic, validateStaticDraft } from '../internal/static-draft.ts';
import { emailRenderCatalog } from './catalog.ts';
import { emailDarkMode } from './dark.ts';
import {
  designEmailPalette,
  EMAIL_MONO_FONT,
  EMAIL_SYSTEM_FONT,
  type EmailPalette,
  type EmailStyle,
  emailFontFamily,
  emailFontStack,
  resolveEmailPalette,
  serializeEmailStyle,
} from './styles.ts';

/** The ids the email mapping paints; any other id falls back to its text or is dropped. */
export const EMAIL_COMPONENT_IDS: readonly string[] = Object.freeze([
  'layout-page',
  'layout-doc',
  'layout-card',
  'layout-grid',
  'layout-deck',
  'deck-slide',
  'layout-stack',
  'layout-row',
  'layout-split',
  'layout-tile',
  'blocks-text',
  'blocks-structure',
  'blocks-data',
  'blocks-media',
  'blocks-code',
  'media-image',
]);

/** The block types inside `blocks-*` nodes that paint (others fall back to their text). */
export const EMAIL_BLOCK_TYPES: readonly string[] = Object.freeze([
  'heading',
  'text',
  'list',
  'quote',
  'callout',
  'divider',
  'code',
  'cta',
  'columns',
  'cards',
  'image',
  'figure',
  'gallery',
  'table',
  'stat',
  'kpi',
]);

export interface EmailOptions {
  /** The catalog to validate against. Default: content families, content and composition layouts. */
  catalog?: RenderCatalog;
  /** The document title (`<title>`). Default: the first heading, else `Message`. */
  title?: string;
  /** Hidden preview text most clients show after the subject. */
  preheader?: string;
  /** `lang` of the document (a BCP 47 tag). Default `en`. */
  lang?: string;
  /** Writing direction; text alignment follows it. Default `ltr`. */
  dir?: 'ltr' | 'rtl';
  /** An absolute `https` URL that relative links and images resolve against. */
  baseUrl?: string;
  /** The theme whose `--tx-*` colors and font resolve to sRGB inline styles. Default: a neutral palette. */
  theme?: Theme | null;
  /**
   * A compiled design system (`compileDesignSystem(…)` with `ok: true`, or
   * anything with its `vars`): colors, fonts, the radius and the spacing
   * step of `mode` become the inline styles (over `theme`), and when `mode`
   * is `light` and the dark mode was compiled, the head carries a typed
   * `prefers-color-scheme: dark` rule. Default: none (the output is
   * unchanged).
   */
  designSystem?: DesignVarsSource | null;
  /** Which theme or design-system mode to inline. Default `light`. */
  mode?: 'light' | 'dark';
  /** Content width in pixels (320 to 800). Default 600. */
  width?: number;
}

/** `email-unsupported`, `email-link-refused`, `email-image-refused`, `email-columns-stacked`, `email-base-refused`, or a `validateDraft` code. */
export type EmailDiagnostic = StaticDiagnostic;

export interface EmailResult {
  /** True when the draft validated (warnings allowed). */
  ok: boolean;
  /** The HTML document, or `''` when the draft was refused. */
  html: string;
  /** The plain-text alternative (`text/plain` part), or `''` when refused. */
  text: string;
  diagnostics: readonly EmailDiagnostic[];
}

type Ctx = {
  palette: EmailPalette;
  font: string;
  /** Heading and code stacks. */
  heading: string;
  mono: string;
  /** The card radius and the spacing step, in pixels. */
  radius: number;
  space: number;
  start: 'left' | 'right';
  end: 'left' | 'right';
  base: string | null;
  width: number;
  diagnostics: EmailDiagnostic[];
  text: string[];
  firstHeading: string | null;
};

const style = (value: EmailStyle) => serializeEmailStyle(value);
/** `steps` spacing steps in pixels. */
const px = (ctx: Ctx, steps: number) => `${Math.round(steps * ctx.space * 100) / 100}px`;
/** The radius of inner controls (buttons, code): three quarters of the card's. */
const innerRadius = (ctx: Ctx) => `${Math.round(ctx.radius * 75) / 100}px`;
/** The bottom margin between blocks. */
const gap = (ctx: Ctx) => `0 0 ${px(ctx, 4)} 0`;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

function warn(ctx: Ctx, code: string, path: string, message: string, id?: string): void {
  if (ctx.diagnostics.length >= 200) return;
  ctx.diagnostics.push({ code, severity: 'warning', path, message, ...(id ? { id } : {}) });
}

/** An absolute candidate URL: relative values resolve against the base; protocol-relative ones are refused. */
function absolute(raw: string, ctx: Ctx): string | null {
  const value = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (value === '' || value.startsWith('#') || /^[/\\]{2}|^\\|^\/\\/.test(value) || !ctx.base) {
    return null;
  }
  try {
    return new URL(value, ctx.base).href;
  } catch {
    return null;
  }
}

/** A link through `safeHref` (untrusted): absolute `https:` or `mailto:` only. */
export function emailLink(raw: unknown, ctx: Pick<Ctx, 'base'>): MarkupUrl | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  const candidate = absolute(raw, ctx as Ctx);
  const url = candidate ? linkUrl(candidate, 'untrusted') : null;
  return url && /^(?:https:\/\/|mailto:)/i.test(url.value) ? url : null;
}

/** An image through `safeImageSrc` (untrusted): absolute `https:` only. */
export function emailImage(raw: unknown, ctx: Pick<Ctx, 'base'>): MarkupUrl | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  const candidate = absolute(raw, ctx as Ctx);
  const url = candidate ? imageUrl(candidate, 'untrusted') : null;
  return url && /^https:\/\//i.test(url.value) ? url : null;
}

// ── Inline text ───────────────────────────────────────────────────────────

function inlineNodes(nodes: readonly MdInline[], ctx: Ctx, path: string): MarkupChild[] {
  return nodes.map((node): MarkupChild => {
    switch (node.type) {
      case 'text':
        return node.text;
      case 'break':
        return el('br');
      case 'code':
        return el(
          'code',
          { style: style({ 'font-family': ctx.mono, 'font-size': 13 }) },
          node.text
        );
      case 'strong':
        return el('strong', {}, inlineNodes(node.children, ctx, path));
      case 'em':
        return el('em', {}, inlineNodes(node.children, ctx, path));
      case 'del':
        return el('del', {}, inlineNodes(node.children, ctx, path));
      case 'link': {
        const href = emailLink(node.href, ctx);
        if (!href) {
          if (node.href !== undefined)
            warn(
              ctx,
              'email-link-refused',
              path,
              'A link is not absolute https or mailto; its text stays.'
            );
          return inlineNodes(node.children, ctx, path);
        }
        return el(
          'a',
          { href, style: style({ color: ctx.palette.link, 'text-decoration': 'underline' }) },
          inlineNodes(node.children, ctx, path)
        );
      }
      default:
        return null;
    }
  });
}

function inlineText(nodes: readonly MdInline[], ctx: Ctx): string {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text' || node.type === 'code') out += node.text;
    else if (node.type === 'break') out += '\n';
    else if (node.type === 'link') {
      const label = inlineText(node.children, ctx);
      const href = emailLink(node.href, ctx);
      out += href && href.value !== label ? `${label} (${href.value})` : label;
    } else out += inlineText(node.children, ctx);
  }
  return out;
}

// ── Building blocks ───────────────────────────────────────────────────────

/** Padding on the inline-start side (mail clients lack logical properties, so the side follows `dir`). */
function indent(ctx: Ctx, steps = 6): string {
  const size = px(ctx, steps);
  return ctx.start === 'left' ? `0 0 0 ${size}` : `0 ${size} 0 0`;
}

function quoteStyle(ctx: Ctx): string {
  return style({
    margin: gap(ctx),
    padding: indent(ctx, 4),
    [ctx.start === 'left' ? 'border-left' : 'border-right']: `4px solid ${ctx.palette.border}`,
  });
}

function paragraphStyle(ctx: Ctx, extra: EmailStyle = {}): string {
  return style({
    margin: gap(ctx),
    color: ctx.palette.foreground,
    'font-family': ctx.font,
    'font-size': 16,
    'line-height': 1.5,
    'text-align': ctx.start,
    ...extra,
  });
}

const HEADING_SIZES = [28, 22, 18, 16, 15, 14] as const;

function heading(level: number, content: MarkupChild, ctx: Ctx, plain: string): MarkupElement {
  const rank = Math.min(Math.max(Math.round(level), 1), 6);
  if (!ctx.firstHeading && plain.trim()) ctx.firstHeading = plain.trim().slice(0, 200);
  ctx.text.push(rank <= 2 ? `${plain}\n${'='.repeat(Math.min(plain.length, 60))}` : plain);
  return el(
    `h${rank}`,
    {
      style: style({
        margin: '0 0 12px 0',
        color: ctx.palette.foreground,
        'font-family': ctx.heading,
        'font-size': HEADING_SIZES[rank - 1],
        'font-weight': 700,
        'line-height': 1.25,
        'text-align': ctx.start,
      }),
    },
    content
  );
}

function paragraph(
  nodes: readonly MdInline[],
  ctx: Ctx,
  path: string,
  extra?: EmailStyle
): MarkupElement {
  ctx.text.push(inlineText(nodes, ctx));
  return el('p', { style: paragraphStyle(ctx, extra) }, inlineNodes(nodes, ctx, path));
}

function plainParagraph(value: string, ctx: Ctx, extra?: EmailStyle): MarkupElement {
  ctx.text.push(value);
  return el('p', { style: paragraphStyle(ctx, extra) }, value);
}

function markdown(source: string, ctx: Ctx, path: string): MarkupChild[] {
  return parseMarkdown(source).blocks.map((block) => mdBlock(block, ctx, path, 0));
}

function mdBlock(block: MdBlock, ctx: Ctx, path: string, depth: number): MarkupChild {
  switch (block.type) {
    case 'paragraph':
      return paragraph(block.children, ctx, path);
    case 'heading':
      return heading(
        block.level,
        inlineNodes(block.children, ctx, path),
        ctx,
        inlineText(block.children, ctx)
      );
    case 'code':
      return codeBlock(block.text, ctx);
    case 'rule':
      ctx.text.push('---');
      return el('hr', {
        style: style({
          border: '0',
          'border-top': `1px solid ${ctx.palette.border}`,
          margin: '24px 0',
        }),
      });
    case 'quote':
      return el(
        'blockquote',
        { style: quoteStyle(ctx) },
        block.children.map((child) => mdBlock(child, ctx, path, depth + 1))
      );
    case 'list': {
      const items = block.items.map((item, index) => {
        const marker =
          item.checked === null
            ? block.ordered
              ? `${block.start + index}.`
              : '-'
            : item.checked
              ? '[x]'
              : '[ ]';
        const before = ctx.text.length;
        const children = item.children.map((child) => mdBlock(child, ctx, path, depth + 1));
        const itemText = ctx.text.splice(before).join(' ');
        ctx.text.push(`${'  '.repeat(depth)}${marker} ${itemText}`);
        return el(
          'li',
          { style: style({ margin: '0 0 4px 0' }) },
          item.checked === null ? null : item.checked ? '☑ ' : '☐ ',
          children
        );
      });
      return el(
        block.ordered ? 'ol' : 'ul',
        { style: paragraphStyle(ctx, { padding: indent(ctx) }) },
        items
      );
    }
    default:
      return null;
  }
}

function codeBlock(code: string, ctx: Ctx): MarkupElement {
  ctx.text.push(code);
  return el(
    'pre',
    {
      style: style({
        margin: gap(ctx),
        padding: px(ctx, 3),
        'background-color': ctx.palette.background,
        color: ctx.palette.foreground,
        'font-family': ctx.mono,
        'font-size': 13,
        'line-height': 1.45,
        'white-space': 'pre-wrap',
        'word-break': 'break-word',
        'border-radius': innerRadius(ctx),
      }),
    },
    el('code', {}, code)
  );
}

/** A presentation table: one row, cells side by side. */
function columnsTable(cells: readonly MarkupChild[][], ctx: Ctx, steps = 4): MarkupElement {
  const space = px(ctx, steps);
  const share = `${Math.floor(100 / Math.max(cells.length, 1))}%`;
  return el(
    'table',
    {
      role: 'presentation',
      width: '100%',
      cellpadding: '0',
      cellspacing: '0',
      border: '0',
      style: style({ 'border-collapse': 'collapse', margin: gap(ctx) }),
    },
    el(
      'tbody',
      {},
      el(
        'tr',
        {},
        cells.map((cell, index) =>
          el(
            'td',
            {
              width: share,
              valign: 'top',
              style: style({
                width: share,
                'vertical-align': 'top',
                padding:
                  index === 0 ? '0' : ctx.start === 'left' ? `0 0 0 ${space}` : `0 ${space} 0 0`,
              }),
            },
            cell
          )
        )
      )
    )
  );
}

function boxed(
  children: MarkupChild[],
  ctx: Ctx,
  background: string,
  color: string
): MarkupElement {
  return el(
    'table',
    {
      role: 'presentation',
      width: '100%',
      cellpadding: '0',
      cellspacing: '0',
      border: '0',
      style: style({ 'border-collapse': 'separate', margin: gap(ctx) }),
    },
    el(
      'tbody',
      {},
      el(
        'tr',
        {},
        el(
          'td',
          {
            bgcolor: background,
            style: style({
              padding: px(ctx, 4),
              'background-color': background,
              color,
              border: `1px solid ${ctx.palette.border}`,
              'border-radius': `${ctx.radius}px`,
            }),
          },
          children
        )
      )
    )
  );
}

function button(label: string, href: MarkupUrl, ctx: Ctx): MarkupElement {
  ctx.text.push(`${label}: ${href.value}`);
  return el(
    'a',
    {
      href,
      style: style({
        display: 'inline-block',
        padding: `${px(ctx, 3)} ${px(ctx, 5)}`,
        'background-color': ctx.palette.primary,
        color: ctx.palette.primaryForeground,
        'font-family': ctx.font,
        'font-size': 16,
        'font-weight': 600,
        'text-decoration': 'none',
        'border-radius': innerRadius(ctx),
      }),
    },
    label
  );
}

function image(
  source: Record<string, unknown>,
  ctx: Ctx,
  path: string,
  id?: string
): MarkupChild[] {
  const alt = str(source.alt) ?? '';
  const src = emailImage(source.src, ctx);
  const caption = str(source.caption);
  const out: MarkupChild[] = [];
  if (!src) {
    warn(
      ctx,
      'email-image-refused',
      path,
      'An image is not absolute https; its alt text stays.',
      id
    );
    if (alt) out.push(plainParagraph(`[${alt}]`, ctx, { color: ctx.palette.muted }));
  } else {
    const naturalWidth = num(source.width) ?? ctx.width;
    const naturalHeight = num(source.height);
    const width = Math.max(1, Math.min(Math.round(naturalWidth), ctx.width));
    const height = naturalHeight
      ? Math.max(1, Math.round((naturalHeight * width) / naturalWidth))
      : undefined;
    ctx.text.push(alt ? `[${alt}]` : '');
    out.push(
      el('img', {
        src,
        alt: source.decorative === true ? '' : alt,
        width: String(width),
        ...(height ? { height: String(height) } : {}),
        style: style({ display: 'block', 'max-width': '100%', border: '0', margin: '0 0 8px 0' }),
      })
    );
  }
  if (caption)
    out.push(plainParagraph(caption, ctx, { 'font-size': 14, color: ctx.palette.muted }));
  return out;
}

const TONES: Readonly<Record<string, readonly [keyof EmailPalette, keyof EmailPalette]>> = {
  info: ['infoSoft', 'infoSoftForeground'],
  success: ['successSoft', 'successSoftForeground'],
  warning: ['warningSoft', 'warningSoftForeground'],
  danger: ['destructiveSoft', 'destructiveSoftForeground'],
  destructive: ['destructiveSoft', 'destructiveSoftForeground'],
};

function dataTable(block: Record<string, unknown>, ctx: Ctx): MarkupChild[] {
  const columns = (Array.isArray(block.columns) ? block.columns : []).filter(isRecord);
  const rows = (Array.isArray(block.rows) ? block.rows : []).filter(isRecord);
  const caption = str(block.caption);
  const cell = (value: unknown) =>
    typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  if (caption) ctx.text.push(caption);
  ctx.text.push(columns.map((column) => cell(column.label)).join(' | '));
  for (const row of rows)
    ctx.text.push(columns.map((column) => cell(row[String(column.id)])).join(' | '));
  const border = `1px solid ${ctx.palette.border}`;
  const cellStyle = (head: boolean) =>
    style({
      padding: px(ctx, 2),
      border,
      'text-align': ctx.start,
      'font-family': ctx.font,
      'font-size': 14,
      color: ctx.palette.foreground,
      ...(head ? { 'font-weight': 700, 'background-color': ctx.palette.background } : {}),
    });
  return [
    el(
      'table',
      {
        width: '100%',
        cellpadding: '0',
        cellspacing: '0',
        border: '0',
        style: style({ 'border-collapse': 'collapse', margin: gap(ctx) }),
      },
      caption
        ? el(
            'caption',
            {
              style: style({
                'text-align': ctx.start,
                padding: '0 0 8px 0',
                'font-weight': 700,
                'font-family': ctx.font,
              }),
            },
            caption
          )
        : null,
      el(
        'thead',
        {},
        el(
          'tr',
          {},
          columns.map((column) =>
            el('th', { scope: 'col', style: cellStyle(true) }, cell(column.label))
          )
        )
      ),
      el(
        'tbody',
        {},
        rows.map((row) =>
          el(
            'tr',
            {},
            columns.map((column) =>
              el('td', { style: cellStyle(false) }, cell(row[String(column.id)]))
            )
          )
        )
      )
    ),
  ];
}

function stats(block: Record<string, unknown>, ctx: Ctx): MarkupChild[] {
  const items = (Array.isArray(block.items) ? block.items : []).filter(isRecord).slice(0, 12);
  const title = str(block.title);
  const out: MarkupChild[] = [];
  if (title) out.push(heading(3, title, ctx, title));
  const cells = items.map((item) => {
    const label = str(item.label) ?? '';
    const value = typeof item.value === 'number' ? String(item.value) : (str(item.value) ?? '');
    const delta = str(item.delta);
    const hint = str(item.hint);
    ctx.text.push(`${label}: ${value}${delta ? ` (${delta})` : ''}${hint ? ` - ${hint}` : ''}`);
    return [
      el(
        'p',
        { style: paragraphStyle(ctx, { margin: '0', 'font-size': 13, color: ctx.palette.muted }) },
        label
      ),
      el(
        'p',
        { style: paragraphStyle(ctx, { margin: '0', 'font-size': 24, 'font-weight': 700 }) },
        value
      ),
      delta
        ? el('p', { style: paragraphStyle(ctx, { margin: '0', 'font-size': 13 }) }, delta)
        : null,
      hint
        ? el(
            'p',
            {
              style: paragraphStyle(ctx, {
                margin: '0',
                'font-size': 13,
                color: ctx.palette.muted,
              }),
            },
            hint
          )
        : null,
    ];
  });
  // Two stats per row keeps them readable on narrow clients.
  for (let index = 0; index < cells.length; index += 2)
    out.push(columnsTable(cells.slice(index, index + 2), ctx));
  return out;
}

function fallback(text: string, ctx: Ctx, path: string, id: string, what: string): MarkupChild[] {
  warn(
    ctx,
    'email-unsupported',
    path,
    `${what} has no email form; ${text.trim() ? 'its text stays' : 'it is dropped'}.`,
    id
  );
  return text.trim() ? [plainParagraph(text.trim(), ctx)] : [];
}

function block(value: unknown, ctx: Ctx, path: string, id: string, depth = 0): MarkupChild[] {
  if (!isRecord(value)) return [];
  const type = typeof value.type === 'string' ? value.type : '';
  switch (type) {
    case 'heading': {
      const text = str(value.text) ?? '';
      const out: MarkupChild[] = [];
      const eyebrow = str(value.eyebrow);
      if (eyebrow)
        out.push(
          plainParagraph(eyebrow, ctx, {
            margin: '0 0 4px 0',
            'font-size': 13,
            color: ctx.palette.muted,
          })
        );
      out.push(heading(num(value.level) ?? 2, text, ctx, text));
      const subtitle = str(value.subtitle);
      if (subtitle) out.push(plainParagraph(subtitle, ctx, { color: ctx.palette.muted }));
      return out;
    }
    case 'text':
      return markdown(str(value.markdown) ?? '', ctx, path);
    case 'list': {
      const items = (Array.isArray(value.items) ? value.items : []).filter(isRecord);
      const ordered = value.ordered === true || value.style === 'number';
      const check = value.style === 'check';
      const nodes = items.map((item, index) => {
        const inline = parseInline(str(item.text) ?? '', 0);
        const marker = check
          ? item.done === true
            ? '[x]'
            : '[ ]'
          : ordered
            ? `${index + 1}.`
            : '-';
        ctx.text.push(`${marker} ${inlineText(inline, ctx)}`);
        return el(
          'li',
          { style: style({ margin: '0 0 4px 0' }) },
          check ? (item.done === true ? '☑ ' : '☐ ') : null,
          inlineNodes(inline, ctx, path)
        );
      });
      return [
        el(ordered ? 'ol' : 'ul', { style: paragraphStyle(ctx, { padding: indent(ctx) }) }, nodes),
      ];
    }
    case 'quote': {
      const cite = [str(value.cite), str(value.role)].filter(Boolean).join(', ');
      const quote = parseInline(str(value.quote) ?? '', 0);
      ctx.text.push(`> ${inlineText(quote, ctx)}`);
      if (cite) ctx.text.push(`- ${cite}`);
      return [
        el(
          'blockquote',
          { style: quoteStyle(ctx) },
          el(
            'p',
            { style: paragraphStyle(ctx, { 'font-style': 'italic', margin: '0 0 8px 0' }) },
            inlineNodes(quote, ctx, path)
          ),
          cite
            ? el(
                'p',
                {
                  style: paragraphStyle(ctx, {
                    'font-size': 14,
                    color: ctx.palette.muted,
                    margin: '0',
                  }),
                },
                cite
              )
            : null
        ),
      ];
    }
    case 'callout': {
      const [background, color] = TONES[String(value.tone)] ??
        TONES.info ?? ['infoSoft', 'infoSoftForeground'];
      const title = str(value.title);
      if (title) ctx.text.push(title);
      return [
        boxed(
          [
            title
              ? el(
                  'p',
                  {
                    style: paragraphStyle(ctx, {
                      margin: '0 0 8px 0',
                      'font-weight': 700,
                      color: ctx.palette[color],
                    }),
                  },
                  title
                )
              : null,
            parseMarkdown(str(value.body) ?? '').blocks.map((child) =>
              mdBlock(child, ctx, path, 1)
            ),
          ],
          ctx,
          ctx.palette[background],
          ctx.palette[color]
        ),
      ];
    }
    case 'divider': {
      if (value.variant === 'space')
        return [el('div', { style: style({ height: 24, 'line-height': '24px' }) }, ' ')];
      const label = str(value.label);
      if (label)
        return [
          plainParagraph(label, ctx, {
            'text-align': 'center',
            color: ctx.palette.muted,
            'font-size': 13,
          }),
        ];
      ctx.text.push('---');
      return [
        el('hr', {
          style: style({
            border: '0',
            'border-top': `1px solid ${ctx.palette.border}`,
            margin: '24px 0',
          }),
        }),
      ];
    }
    case 'code': {
      const out: MarkupChild[] = [];
      const filename = str(value.filename);
      if (filename)
        out.push(
          plainParagraph(filename, ctx, {
            'font-size': 13,
            color: ctx.palette.muted,
            margin: '0 0 4px 0',
          })
        );
      out.push(codeBlock(typeof value.code === 'string' ? value.code : '', ctx));
      const caption = str(value.caption);
      if (caption)
        out.push(plainParagraph(caption, ctx, { 'font-size': 14, color: ctx.palette.muted }));
      return out;
    }
    case 'cta': {
      const actions = (Array.isArray(value.actions) ? value.actions : [])
        .filter(isRecord)
        .slice(0, 4);
      const cells: MarkupChild[][] = [];
      for (const action of actions) {
        const label = str(action.label) ?? '';
        const href = emailLink(action.href, ctx);
        if (!href) {
          warn(
            ctx,
            'email-link-refused',
            path,
            'A call to action is not absolute https or mailto; its label stays as text.',
            id
          );
          cells.push([plainParagraph(label, ctx, { margin: '0' })]);
        } else cells.push([button(label, href, ctx)]);
      }
      return cells.length === 0 ? [] : [columnsTable(cells, ctx, 3)];
    }
    case 'columns': {
      const columns = (Array.isArray(value.columns) ? value.columns : []).filter(Array.isArray);
      const render = (column: unknown[]) =>
        column.flatMap((child, index) => block(child, ctx, `${path}.${index}`, id, depth + 1));
      if (columns.length <= 2 && depth === 0) return [columnsTable(columns.map(render), ctx)];
      warn(
        ctx,
        'email-columns-stacked',
        path,
        'Email shows at most two columns, one level deep; the columns stack.',
        id
      );
      return columns.flatMap(render);
    }
    case 'cards': {
      const out: MarkupChild[] = [];
      const title = str(value.title);
      if (title) out.push(heading(3, title, ctx, title));
      for (const card of (Array.isArray(value.items) ? value.items : [])
        .filter(isRecord)
        .slice(0, 24)) {
        const cardTitle = str(card.title) ?? '';
        const body = str(card.body);
        const href = card.href !== undefined ? emailLink(card.href, ctx) : null;
        ctx.text.push(cardTitle);
        out.push(
          boxed(
            [
              el(
                'p',
                { style: paragraphStyle(ctx, { margin: '0 0 4px 0', 'font-weight': 700 }) },
                href
                  ? el('a', { href, style: style({ color: ctx.palette.link }) }, cardTitle)
                  : cardTitle
              ),
              body ? plainParagraph(body, ctx, { margin: '0' }) : null,
            ],
            ctx,
            ctx.palette.surface,
            ctx.palette.foreground
          )
        );
      }
      return out;
    }
    case 'image':
    case 'figure':
      return image(value, ctx, path, id);
    case 'gallery': {
      const out: MarkupChild[] = [];
      const title = str(value.title);
      if (title) out.push(heading(3, title, ctx, title));
      for (const item of (Array.isArray(value.items) ? value.items : [])
        .filter(isRecord)
        .slice(0, 24)) {
        out.push(...image(item, ctx, path, id));
      }
      return out;
    }
    case 'table':
      return dataTable(value, ctx);
    case 'stat':
    case 'kpi':
      return stats(value, ctx);
    default: {
      let text = '';
      try {
        text = blockText(value as unknown as Block);
      } catch {
        text = '';
      }
      if (type === 'chart')
        text = [str(value.title), str(value.description)].filter(Boolean).join('. ');
      return fallback(text, ctx, path, id, `The \`${type}\` block`);
    }
  }
}

const TEXT_PROPS = ['title', 'label', 'description', 'caption', 'text'] as const;

function container(
  node: Extract<RenderNode, { kind: 'component' }>,
  ctx: Ctx,
  path: string,
  depth: number
): MarkupChild[] {
  const title = str(node.props.title);
  const children = node.children;
  const out: MarkupChild[] = [];
  if (title) {
    const level =
      node.id === 'layout-page' || node.id === 'layout-doc' ? 1 : node.id === 'deck-slide' ? 2 : 3;
    out.push(heading(level, title, ctx, title));
  }
  const description = str(node.props.description);
  if (description) out.push(plainParagraph(description, ctx, { color: ctx.palette.muted }));
  const twoUp =
    (node.id === 'layout-split' || node.id === 'layout-row' || node.id === 'layout-grid') &&
    children.length === 2 &&
    depth < 2;
  if (twoUp) {
    out.push(
      columnsTable(
        children.map((child, index) => paint(child, ctx, `${path}.children.${index}`, depth + 1)),
        ctx
      )
    );
    return out;
  }
  children.forEach((child, index) => {
    out.push(...paint(child, ctx, `${path}.children.${index}`, depth + 1));
  });
  if (node.id === 'layout-card' || node.id === 'layout-tile') {
    return [boxed(out, ctx, ctx.palette.surface, ctx.palette.foreground)];
  }
  return out;
}

const CONTAINERS = new Set(
  EMAIL_COMPONENT_IDS.filter((id) => id.startsWith('layout-') || id === 'deck-slide')
);

function paint(node: RenderNode, ctx: Ctx, path: string, depth: number): MarkupChild[] {
  if (node.kind === 'placeholder') {
    warn(
      ctx,
      'email-unsupported',
      path,
      `\`${node.id}\` was refused by validation; it is dropped.`,
      node.id
    );
    return [];
  }
  if (depth > 32) return [];
  if (CONTAINERS.has(node.id)) return container(node, ctx, path, depth);
  if (node.id.startsWith('blocks-')) return block(node.props.block, ctx, path, node.id);
  if (node.id === 'media-image') return image(node.props, ctx, path, node.id);
  const text = TEXT_PROPS.map((prop) => str(node.props[prop]))
    .filter(Boolean)
    .join('. ');
  const out = fallback(text, ctx, path, node.id, `\`${node.id}\``);
  node.children.forEach((child, index) => {
    out.push(...paint(child, ctx, `${path}.children.${index}`, depth + 1));
  });
  return out;
}

function checkedBase(value: string | undefined, diagnostics: EmailDiagnostic[]): string | null {
  if (value === undefined) return null;
  const safe = safeHref(value, 'developer');
  if (safe && /^https:\/\/[^/]/i.test(safe)) {
    try {
      return new URL(safe).href;
    } catch {
      // Refused below.
    }
  }
  diagnostics.push({
    code: 'email-base-refused',
    severity: 'warning',
    path: '',
    message: '`baseUrl` must be an absolute https URL; relative links and images are refused.',
  });
  return null;
}

/**
 * Render a blueprint draft (an envelope, a node, an array of nodes or JSON
 * text) to an email: `{ ok, html, text, diagnostics }`. Validation runs
 * first at the `untrusted` tier; a refused draft renders nothing. Never
 * throws on any input.
 */
export function renderEmail(input: unknown, options: EmailOptions = {}): EmailResult {
  const { validation, diagnostics } = validateStaticDraft(
    input,
    options.catalog ?? emailRenderCatalog()
  );
  if (!validation?.ok) return { ok: false, html: '', text: '', diagnostics };

  const dir = options.dir === 'rtl' ? 'rtl' : 'ltr';
  const mode = options.mode === 'dark' ? 'dark' : 'light';
  const themed = resolveEmailPalette(options.theme, mode);
  const design = designValues(options.designSystem, mode);
  const palette = design ? designEmailPalette(design.colors, themed) : themed;
  const width = Math.round(Math.min(Math.max(num(options.width) ?? 600, 320), 800));
  const font = design?.fonts.sans
    ? emailFontStack(design.fonts.sans, EMAIL_SYSTEM_FONT)
    : emailFontFamily(options.theme);
  const ctx: Ctx = {
    palette,
    font,
    heading: design?.fonts.heading ? emailFontStack(design.fonts.heading, EMAIL_SYSTEM_FONT) : font,
    mono: emailFontStack(design?.fonts.mono, EMAIL_MONO_FONT),
    radius: clamp(design?.radius ?? 8, 0, 32),
    space: clamp(design?.space ?? 4, 2, 8),
    start: dir === 'rtl' ? 'right' : 'left',
    end: dir === 'rtl' ? 'left' : 'right',
    base: checkedBase(options.baseUrl, diagnostics),
    width: width - 48,
    diagnostics,
    text: [],
    firstHeading: null,
  };
  let content: MarkupChild[] = [];
  try {
    content = validation.roots.flatMap((root, index) => paint(root, ctx, String(index), 0));
  } catch {
    return {
      ok: false,
      html: '',
      text: '',
      diagnostics: [
        ...diagnostics,
        {
          code: 'email-failed',
          severity: 'error',
          path: '',
          message: 'The draft could not be rendered as email.',
        },
      ],
    };
  }
  const lang =
    typeof options.lang === 'string' &&
    /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8}){0,4}$/.test(options.lang)
      ? options.lang
      : 'en';
  const title = (str(options.title) ?? ctx.firstHeading ?? 'Message').slice(0, 200);
  const preheader = str(options.preheader)?.slice(0, 200);
  // The compiled dark mode, when the light mode is inlined.
  const darkValues = design && mode === 'light' ? designValues(options.designSystem, 'dark') : null;
  const darkPalette = darkValues ? designEmailPalette(darkValues.colors, palette) : null;
  const schemes = darkPalette ? 'light dark' : 'light';
  const tree = el(
    'html',
    { lang, dir },
    el(
      'head',
      {},
      el('meta', { charset: 'utf-8' }),
      el('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      el('meta', { name: 'color-scheme', content: schemes }),
      darkPalette ? el('meta', { name: 'supported-color-schemes', content: schemes }) : null,
      el('meta', { name: 'x-apple-disable-message-reformatting', content: '' }),
      el('title', {}, title)
    ),
    el(
      'body',
      { style: style({ margin: '0', padding: '0', 'background-color': palette.background }) },
      preheader
        ? el(
            'div',
            {
              style: style({
                display: 'none',
                'mso-hide': 'all',
                'font-size': 1,
                'line-height': 1,
                'max-width': '0',
                opacity: 0,
                overflow: 'hidden',
                color: palette.background,
              }),
            },
            preheader
          )
        : null,
      el(
        'table',
        {
          role: 'presentation',
          width: '100%',
          cellpadding: '0',
          cellspacing: '0',
          border: '0',
          bgcolor: palette.background,
          style: style({ 'background-color': palette.background, 'border-collapse': 'collapse' }),
        },
        el(
          'tbody',
          {},
          el(
            'tr',
            {},
            el(
              'td',
              { align: 'center', style: style({ padding: `${px(ctx, 6)} ${px(ctx, 3)}` }) },
              el(
                'table',
                {
                  role: 'presentation',
                  width: String(width),
                  cellpadding: '0',
                  cellspacing: '0',
                  border: '0',
                  bgcolor: palette.surface,
                  style: style({
                    width: '100%',
                    'max-width': width,
                    'background-color': palette.surface,
                    'border-collapse': 'separate',
                    'border-radius': `${ctx.radius}px`,
                  }),
                },
                el(
                  'tbody',
                  {},
                  el(
                    'tr',
                    {},
                    el(
                      'td',
                      {
                        dir,
                        style: style({
                          padding: px(ctx, 6),
                          'font-family': ctx.font,
                          color: palette.foreground,
                          'text-align': ctx.start,
                        }),
                      },
                      content
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  );
  const dark = darkPalette ? emailDarkMode(tree, palette, darkPalette) : null;
  let html = serializeHtml(dark ? dark.root : tree, { doctype: true });
  if (dark?.css) {
    // The head's only rule set: checked against its closed grammar in `emailDarkMode`.
    const head = html.indexOf('</head>');
    html = `${html.slice(0, head)}<style>${dark.css}</style>${html.slice(head)}`;
  }
  const text = [preheader, ...ctx.text]
    .filter((line) => line !== undefined && line.trim() !== '')
    .join('\n\n');
  return { ok: true, html, text, diagnostics };
}

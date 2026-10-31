/**
 * Print and PDF of blueprints (ADR-016). In the browser, the player's
 * print mode and the browser's "Save as PDF" print a painted blueprint. A
 * headless PDF goes through the document path: the validated render tree
 * (`validateDraft` at the `untrusted` tier) maps to `@texuli/document`
 * blocks, the document is validated at the `untrusted` tier, and the owned
 * PDF writer (`@texuli/document/pdf`, loaded on use) draws it. Nothing is
 * HTML: text stays text, links and images pass the URL policy again in the
 * writer, and ids the document model has no form for become plain text or
 * are dropped with a `print-unsupported` warning.
 */
import type { RenderCatalog, RenderNode } from '@texuli/catalog/render/renderer';
import type { EditorInline } from '@texuli/core/editor-model';
import { documentFromMarkdown } from '@texuli/document/markdown';
import {
  createDocument,
  createIdSource,
  type DocumentBlock,
  type DocumentIdSource,
  type DocumentJsonObject,
  type PageSettings,
  type TexuliDocument,
} from '@texuli/document/model';
import type { PdfOptions } from '@texuli/document/pdf';
import { validateDocument } from '@texuli/document/schema';
import { emailRenderCatalog } from '../email/catalog.ts';
import { type DesignVarsSource, designValues } from '../internal/design-values.ts';
import { type StaticDiagnostic, validateStaticDraft } from '../internal/static-draft.ts';

export {
  DESIGN_COLOR_ROLES,
  type DesignColorRole,
  type DesignValues,
  type DesignVarsSource,
  designValues,
} from '../internal/design-values.ts';

export type PrintDiagnostic = StaticDiagnostic;

export interface BlueprintDocumentOptions {
  /** The catalog to validate against. Default: content families, content and composition layouts. */
  catalog?: RenderCatalog;
  /** The document title. Default: the first heading, else `Blueprint`. */
  title?: string;
  /** Page settings for the PDF (size, orientation, margins, header and footer). */
  page?: PageSettings;
  /** `meta.locale` of the document. */
  locale?: string;
}

export type BlueprintDocumentResult =
  | { ok: true; document: TexuliDocument; diagnostics: readonly PrintDiagnostic[] }
  | { ok: false; document: null; diagnostics: readonly PrintDiagnostic[] };

export interface BlueprintPdfOptions extends BlueprintDocumentOptions {
  /** Passed to `writePdf` (fonts, image bytes, page numbers…). `trust` is always `untrusted`. */
  pdf?: Omit<PdfOptions, 'trust'>;
  /**
   * A compiled design system (or anything with its `vars`): `mode`'s
   * values become the PDF's `design` (colors, rules, the body family),
   * unless `pdf.design` is set. Default: none (the output is unchanged).
   */
  designSystem?: DesignVarsSource | null;
  /** Which design-system mode to print. Default `light`. */
  mode?: 'light' | 'dark';
}

export type BlueprintPdfResult =
  | {
      ok: true;
      bytes: Uint8Array;
      pageCount: number;
      mime: 'application/pdf';
      diagnostics: readonly PrintDiagnostic[];
    }
  | {
      ok: false;
      bytes: null;
      pageCount: 0;
      mime: 'application/pdf';
      diagnostics: readonly PrintDiagnostic[];
    };

type Ctx = { newId: DocumentIdSource; diagnostics: PrintDiagnostic[]; title: string | null };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

function warn(ctx: Ctx, path: string, message: string, id?: string): void {
  if (ctx.diagnostics.length >= 200) return;
  ctx.diagnostics.push({
    code: 'print-unsupported',
    severity: 'warning',
    path,
    message,
    ...(id ? { id } : {}),
  });
}

const run = (text: string): EditorInline[] => (text ? [{ type: 'text', text, marks: [] }] : []);

function heading(level: number, text: string, ctx: Ctx): DocumentBlock {
  if (!ctx.title) ctx.title = text.slice(0, 200);
  const rank = Math.min(Math.max(Math.round(level), 1), 4) as 1 | 2 | 3 | 4;
  return { id: ctx.newId(), type: 'heading', level: rank, content: run(text) };
}

function paragraph(text: string, ctx: Ctx): DocumentBlock {
  return { id: ctx.newId(), type: 'paragraph', content: run(text) };
}

/** Markdown through the document codec (untrusted links refused there), sharing the id source. */
function markdown(source: string, ctx: Ctx): DocumentBlock[] {
  const read = documentFromMarkdown(source, {
    trust: 'untrusted',
    newId: ctx.newId,
    maxSource: 8_000,
  });
  return read.ok ? read.document.blocks : [];
}

/** Backslash-escape what Markdown would read as syntax in a plain label. */
function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_[\]()<>#!~|{}+-]/g, (char) => `\\${char}`);
}

function wrapped(
  family: 'data' | 'structure',
  block: string,
  props: DocumentJsonObject,
  ctx: Ctx
): DocumentBlock {
  return { id: ctx.newId(), type: 'block', family, block, props };
}

function fromBlock(value: unknown, ctx: Ctx, path: string, id: string, depth = 0): DocumentBlock[] {
  if (!isRecord(value)) return [];
  switch (value.type) {
    case 'heading': {
      const out = [
        heading(typeof value.level === 'number' ? value.level : 2, str(value.text) ?? '', ctx),
      ];
      const subtitle = str(value.subtitle);
      if (subtitle) out.push(paragraph(subtitle, ctx));
      return out;
    }
    case 'text':
      return markdown(str(value.markdown) ?? '', ctx);
    case 'list': {
      const ordered = value.ordered === true || value.style === 'number';
      const check = value.style === 'check';
      const items = (Array.isArray(value.items) ? value.items : []).filter(isRecord);
      const lines = items.map((item, index) => {
        const marker = ordered ? `${index + 1}.` : '-';
        const box = check ? (item.done === true ? '[x] ' : '[ ] ') : '';
        return `${marker} ${box}${(str(item.text) ?? '').replace(/\s+/g, ' ')}`;
      });
      return markdown(lines.join('\n'), ctx);
    }
    case 'quote': {
      const cite = [str(value.cite), str(value.role)].filter(Boolean).join(', ');
      const blocks = markdown(str(value.quote) ?? '', ctx);
      if (cite) blocks.push(paragraph(`- ${cite}`, ctx));
      return [{ id: ctx.newId(), type: 'quote', blocks }];
    }
    case 'callout': {
      const title = str(value.title);
      return [
        {
          id: ctx.newId(),
          type: 'callout',
          tone: 'info',
          ...(title ? { title: title.slice(0, 200) } : {}),
          blocks: markdown(str(value.body) ?? '', ctx),
        },
      ];
    }
    case 'divider':
      return value.variant === 'space' ? [] : [{ id: ctx.newId(), type: 'divider' }];
    case 'code':
      return [
        {
          id: ctx.newId(),
          type: 'code',
          ...(str(value.lang) ? { lang: str(value.lang) } : {}),
          text: typeof value.code === 'string' ? value.code : '',
        },
      ];
    case 'cta': {
      const actions = (Array.isArray(value.actions) ? value.actions : []).filter(isRecord);
      const links = actions.map((action) => {
        const label = escapeMarkdown(str(action.label) ?? '');
        const href = str(action.href);
        return href && /^(?:https:\/\/|mailto:)/i.test(href)
          ? `[${label}](<${href.replace(/[<>\s]/g, '')}>)`
          : label;
      });
      return markdown(links.join(' · '), ctx);
    }
    case 'columns': {
      const columns = (Array.isArray(value.columns) ? value.columns : []).filter(Array.isArray);
      const painted = columns.map((column, index) =>
        column.flatMap((child, childIndex) =>
          fromBlock(child, ctx, `${path}.${index}.${childIndex}`, id, depth + 1)
        )
      );
      if (depth > 0 || columns.length < 2 || columns.length > 4) return painted.flat();
      return [
        {
          id: ctx.newId(),
          type: 'columns',
          columns: painted.map((blocks) => ({
            id: ctx.newId(),
            type: 'column',
            blocks: blocks.length > 0 ? blocks : [paragraph('', ctx)],
          })),
        },
      ];
    }
    case 'image':
    case 'figure': {
      const src = str(value.src);
      const out: DocumentBlock[] = src
        ? [{ id: ctx.newId(), type: 'media', ref: src, alt: str(value.alt) ?? '' }]
        : [];
      const caption = str(value.caption);
      if (caption) out.push(paragraph(caption, ctx));
      return out;
    }
    case 'gallery':
      return (Array.isArray(value.items) ? value.items : []).flatMap((item) =>
        fromBlock({ ...(isRecord(item) ? item : {}), type: 'image' }, ctx, path, id, depth)
      );
    case 'table':
      return [
        wrapped(
          'data',
          'table',
          JSON.parse(JSON.stringify({ ...value, type: undefined })) as DocumentJsonObject,
          ctx
        ),
      ];
    case 'stat':
    case 'kpi': {
      const items = (Array.isArray(value.items) ? value.items : []).filter(isRecord);
      const cell = (item: Record<string, unknown>, key: string) =>
        typeof item[key] === 'string' || typeof item[key] === 'number' ? item[key] : '';
      const out: DocumentBlock[] = [];
      const title = str(value.title);
      if (title) out.push(heading(3, title, ctx));
      out.push(
        wrapped(
          'data',
          'table',
          {
            columns: [
              { id: 'label', label: 'Metric' },
              { id: 'value', label: 'Value' },
              { id: 'delta', label: 'Change' },
            ],
            rows: items.map((item) => ({
              label: cell(item, 'label'),
              value: cell(item, 'value'),
              delta: cell(item, 'delta'),
            })),
          } as DocumentJsonObject,
          ctx
        )
      );
      return out;
    }
    default: {
      const text = [str(value.title), str(value.label), str(value.description)]
        .filter(Boolean)
        .join('. ');
      warn(
        ctx,
        path,
        `The \`${String(value.type)}\` block has no document form; ${text ? 'its text stays' : 'it is dropped'}.`,
        id
      );
      return text ? [paragraph(text, ctx)] : [];
    }
  }
}

const CONTAINERS = new Set([
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
]);

function fromNode(node: RenderNode, ctx: Ctx, path: string, depth: number): DocumentBlock[] {
  if (node.kind === 'placeholder' || depth > 32) return [];
  const out: DocumentBlock[] = [];
  if (CONTAINERS.has(node.id)) {
    const title = str(node.props.title);
    if (title)
      out.push(heading(node.id === 'layout-page' || node.id === 'layout-doc' ? 1 : 2, title, ctx));
    const description = str(node.props.description);
    if (description) out.push(paragraph(description, ctx));
  } else if (node.id.startsWith('blocks-')) {
    out.push(...fromBlock(node.props.block, ctx, path, node.id));
  } else if (node.id === 'media-image') {
    const src = str(node.props.src);
    if (src) out.push({ id: ctx.newId(), type: 'media', ref: src, alt: str(node.props.alt) ?? '' });
  } else {
    const text = ['title', 'label', 'description', 'caption']
      .map((key) => str(node.props[key]))
      .filter(Boolean)
      .join('. ');
    warn(
      ctx,
      path,
      `\`${node.id}\` has no document form; ${text ? 'its text stays' : 'it is dropped'}.`,
      node.id
    );
    if (text) out.push(paragraph(text, ctx));
  }
  node.children.forEach((child, index) => {
    out.push(...fromNode(child, ctx, `${path}.children.${index}`, depth + 1));
  });
  return out;
}

/**
 * Map a blueprint draft to a `@texuli/document` document for print and
 * PDF. The draft is validated first (untrusted tier) and the document after
 * (untrusted tier); either refusal returns `ok: false`. Never throws.
 */
export function blueprintToDocument(
  input: unknown,
  options: BlueprintDocumentOptions = {}
): BlueprintDocumentResult {
  const { validation, diagnostics } = validateStaticDraft(
    input,
    options.catalog ?? emailRenderCatalog()
  );
  if (!validation?.ok) return { ok: false, document: null, diagnostics };
  const ctx: Ctx = { newId: createIdSource('p'), diagnostics, title: null };
  let blocks: DocumentBlock[];
  try {
    blocks = validation.roots.flatMap((root, index) => fromNode(root, ctx, String(index), 0));
  } catch {
    diagnostics.push({
      code: 'print-failed',
      severity: 'error',
      path: '',
      message: 'The draft could not be mapped to a document.',
    });
    return { ok: false, document: null, diagnostics };
  }
  const locale =
    options.locale && /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8}){0,4}$/.test(options.locale)
      ? options.locale
      : undefined;
  const created = createDocument({
    meta: {
      title: (str(options.title) ?? ctx.title ?? 'Blueprint').slice(0, 200),
      ...(locale ? { locale } : {}),
    },
    blocks,
  });
  if (options.page) created.page = options.page;
  const checked = validateDocument(created, { trust: 'untrusted' });
  if (!checked.ok) {
    for (const issue of checked.issues.slice(0, 20)) {
      diagnostics.push({
        code: `document-${issue.code}`,
        severity: 'error',
        path: issue.path.join('.'),
        message: issue.message,
      });
    }
    return { ok: false, document: null, diagnostics };
  }
  return { ok: true, document: checked.document, diagnostics };
}

/** A headless PDF of a blueprint through `blueprintToDocument` and the owned PDF writer (loaded on use). */
export async function renderBlueprintPdf(
  input: unknown,
  options: BlueprintPdfOptions = {}
): Promise<BlueprintPdfResult> {
  const mapped = blueprintToDocument(input, options);
  if (!mapped.ok)
    return {
      ok: false,
      bytes: null,
      pageCount: 0,
      mime: 'application/pdf',
      diagnostics: mapped.diagnostics,
    };
  const diagnostics = [...mapped.diagnostics];
  try {
    const { writePdf } = await import('@texuli/document/pdf');
    const design =
      options.pdf?.design ??
      designValues(options.designSystem, options.mode === 'dark' ? 'dark' : 'light');
    const written = await writePdf(mapped.document, {
      ...options.pdf,
      ...(design ? { design } : {}),
      trust: 'untrusted',
    });
    for (const d of written.diagnostics.slice(0, 50)) {
      diagnostics.push({
        code: `pdf-${d.code}`,
        severity: 'warning',
        path: '',
        message: d.message,
      });
    }
    return {
      ok: true,
      bytes: written.bytes,
      pageCount: written.pageCount,
      mime: 'application/pdf',
      diagnostics,
    };
  } catch {
    diagnostics.push({
      code: 'print-failed',
      severity: 'error',
      path: '',
      message: 'The PDF could not be written.',
    });
    return { ok: false, bytes: null, pageCount: 0, mime: 'application/pdf', diagnostics };
  }
}

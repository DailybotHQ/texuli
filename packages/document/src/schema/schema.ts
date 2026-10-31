/**
 * The document schema, written with the `@texuli/deck/schema` kit (ADR-011):
 * the same data drives validation, the JSON Schema export and the types.
 * One schema is built per URL tier, because link hrefs and media refs pass
 * the URL policy (`safeHref`, `safeImageSrc` from `@texuli/core/url-policy`)
 * at that tier.
 */
import { type HrefTrust, safeHref, safeImageSrc } from '@texuli/core/url-policy';
import { parseDeck } from '@texuli/deck/model';
import { type RefineContext, type Schema, t } from '@texuli/deck/schema';
import { childrenOf, ownText, walkDocument } from '../model/document.ts';
import {
  BLOCK_FAMILIES,
  BLOCK_TYPE_PATTERN,
  CALLOUT_TONES,
  COMPONENT_ID_PATTERN,
  DOCUMENT_FORMAT,
  DOCUMENT_FORMAT_VERSION,
  DOCUMENT_ID_PATTERN,
  DOCUMENT_REF_PATTERN,
  EMBED_KINDS,
  DOCUMENT_LIMITS as L,
  LANG_PATTERN,
  PAGE_SIZES,
} from '../model/limits.ts';
import type {
  DocumentBlock,
  DocumentInline,
  DocumentJson,
  DocumentNode,
  EmbedBlock,
  TexuliDocument,
} from '../model/types.ts';

/** The document's own diagnostic codes, besides the schema kit's (`SCHEMA_CODES`). */
export const DOCUMENT_CODES = Object.freeze({
  unsupportedFormat: 'unsupported-format',
  unsupportedVersion: 'unsupported-version',
  unknownBlock: 'unknown-block',
  unknownMark: 'unknown-mark',
  duplicateMark: 'duplicate-mark',
  duplicateId: 'duplicate-id',
  tooManyBlocks: 'too-many-blocks',
  tooMuchText: 'too-much-text',
  unsafeUrl: 'unsafe-url',
  listItemStart: 'list-item-start',
  embedSource: 'embed-source',
  payloadTooLarge: 'payload-too-large',
  invalidComponent: 'invalid-component',
  invalidDeck: 'invalid-deck',
  unknownAnchor: 'unknown-anchor',
  anchorRange: 'anchor-range',
  invalidInput: 'invalid-input',
  pageSize: 'page-size',
} as const);

export type DocumentCode = (typeof DOCUMENT_CODES)[keyof typeof DOCUMENT_CODES];

const C = DOCUMENT_CODES;

/**
 * A design-system reference (spec 0.10.0, ADR-024): an exact `id@x.y.z`
 * or `texuli:<theme>`; the same grammar as the blueprint's
 * `$defs.designSystemReference.ref`. Never a range, a URL or a path.
 */
export const DESIGN_SYSTEM_REF_PATTERN =
  /^(?:texuli:[a-z][a-z0-9]*(?:-[a-z0-9]+)*|[a-z][a-z0-9]*(?:-[a-z0-9]+)*@(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/;


/** UTF-8 bytes of a JSON value's serialization, stopping once past `cap`. */
export function jsonBytes(value: unknown, cap = Number.POSITIVE_INFINITY): number {
  let text: string;
  try {
    text = JSON.stringify(value) ?? '';
  } catch {
    return Number.POSITIVE_INFINITY;
  }
  let bytes = 0;
  for (let i = 0; i < text.length && bytes <= cap; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

function build(trust: HrefTrust): Schema {
  const id = t.string({
    min: 1,
    max: L.id,
    pattern: DOCUMENT_ID_PATTERN,
    description: 'A persisted id, unique in the document.',
  });
  const ref = t.string({
    min: 1,
    max: 256,
    pattern: DOCUMENT_REF_PATTERN,
    description: 'A host reference (never rendered as a URL).',
  });
  const line = (max: number) => t.string({ max, text: 'line' });

  const href = t.refine(t.string({ min: 1, max: L.href, text: 'line' }), {
    code: C.unsafeUrl,
    description: `Passes safeHref at the ${trust} tier.`,
    check(value, context) {
      if (safeHref(value, trust) === undefined)
        context.issue({
          message: `The link is refused by the URL policy (${trust} tier).`,
          fix: trust === 'untrusted' ? 'Use an https:, mailto: or #fragment link.' : undefined,
        });
    },
  });
  const mediaRef = t.refine(t.string({ min: 1, max: L.href, text: 'line' }), {
    code: C.unsafeUrl,
    description: `Passes safeImageSrc at the ${trust} tier.`,
    check(value, context) {
      if (safeImageSrc(value, trust) === undefined)
        context.issue({
          message: `The media ref is refused by the URL policy (${trust} tier).`,
          fix: 'Use an https: URL or a relative asset path.',
        });
    },
  });

  const mark = t.union(
    [
      t.object({ type: t.literal('strong') }),
      t.object({ type: t.literal('em') }),
      t.object({ type: t.literal('strike') }),
      t.object({ type: t.literal('code') }),
      t.object({ type: t.literal('link'), href }),
    ],
    { discriminator: 'type', code: C.unknownMark }
  );
  const marks = t.refine(t.array(mark, { max: 5 }), {
    code: C.duplicateMark,
    description: 'Each mark type at most once per run.',
    check(value, context) {
      const seen = new Set<string>();
      for (const [index, item] of value.entries()) {
        if (seen.has(item.type))
          context.issue({ message: `The mark "${item.type}" is repeated.`, path: [index] });
        seen.add(item.type);
      }
    },
  });
  const inline = t.union(
    [
      t.object({ type: t.literal('text'), text: line(L.run), marks }),
      t.object({ type: t.literal('break') }),
    ],
    { discriminator: 'type', code: C.unknownBlock }
  );
  const content = t.array(inline, { max: L.runs });

  const block: Schema<DocumentBlock> = t.lazy(() => blockUnion as Schema<DocumentBlock>, {
    name: 'block',
    maxDepth: L.depth,
  });
  const blocks = t.array(block, { max: L.blocks });

  const listItem = t.refine(
    t.object({
      id,
      checked: t.optional(t.boolean()),
      blocks: t.array(block, { min: 1, max: L.blocks }),
    }),
    {
      code: C.listItemStart,
      description: 'A list item starts with a paragraph.',
      check(value, context) {
        if ((value.blocks[0] as DocumentBlock | undefined)?.type !== 'paragraph')
          context.issue({
            message: 'A list item starts with a paragraph.',
            path: ['blocks', 0],
          });
      },
    }
  );

  const props = t.refine(t.json({ depth: 6, maxKeys: 100, maxItems: 500, maxString: 10_000 }), {
    code: C.payloadTooLarge,
    description: `At most ${L.inlineBytes} UTF-8 bytes.`,
    check(value, context) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        context.issue({ code: 'invalid-type', message: 'Expected an object.' });
        return;
      }
      if (jsonBytes(value, L.inlineBytes) > L.inlineBytes)
        context.issue({ message: `The payload is larger than ${L.inlineBytes} bytes.` });
    },
  });
  const inlinePayload = t.refine(
    t.json({ depth: 10, maxKeys: 200, maxItems: 1_000, maxString: 20_000 }),
    {
      code: C.payloadTooLarge,
      description: `An object of at most ${L.inlineBytes} UTF-8 bytes.`,
      check(value, context) {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          context.issue({ code: 'invalid-type', message: 'Expected an object.' });
          return;
        }
        if (jsonBytes(value, L.inlineBytes) > L.inlineBytes)
          context.issue({ message: `The inline payload is larger than ${L.inlineBytes} bytes.` });
      },
    }
  );

  const embed = t.refine(
    t.object({
      id,
      type: t.literal('embed'),
      kind: t.enum(EMBED_KINDS as [string, ...string[]]),
      ref: t.optional(ref),
      inline: t.optional(inlinePayload),
      title: t.optional(line(L.title)),
    }),
    {
      code: C.embedSource,
      description:
        'Exactly one of ref and inline; inline components are one catalog node, inline decks are deck model v2.',
      check(value, context) {
        checkEmbed(value as unknown as EmbedBlock, context);
      },
    }
  );

  const blockUnion = t.union(
    [
      t.object({ id, type: t.literal('paragraph'), content }),
      t.object({ id, type: t.literal('heading'), level: t.int({ min: 1, max: 4 }), content }),
      t.object({
        id,
        type: t.literal('code'),
        lang: t.optional(t.string({ pattern: LANG_PATTERN })),
        text: t.string({ max: L.code, text: 'multiline' }),
      }),
      t.object({
        id,
        type: t.literal('list'),
        kind: t.enum(['bullet', 'ordered', 'todo']),
        start: t.optional(t.int({ min: 0, max: 999_999_999 })),
        items: t.array(listItem, { min: 1, max: L.blocks }),
      }),
      t.object({ id, type: t.literal('quote'), blocks }),
      t.object({ id, type: t.literal('divider') }),
      t.object({ id, type: t.literal('media'), ref: mediaRef, alt: line(L.title) }),
      t.object({
        id,
        type: t.literal('callout'),
        tone: t.enum(CALLOUT_TONES as [string, ...string[]]),
        title: t.optional(line(L.title)),
        blocks,
      }),
      t.object({
        id,
        type: t.literal('toggle'),
        summary: content,
        open: t.optional(t.boolean()),
        blocks,
      }),
      t.object({
        id,
        type: t.literal('columns'),
        columns: t.array(
          t.object({
            id,
            type: t.literal('column'),
            width: t.optional(t.int({ min: 1, max: 12 })),
            blocks,
          }),
          { min: 2, max: 4 }
        ),
      }),
      t.object({ id, type: t.literal('page-link'), ref, title: line(L.title) }),
      t.object({
        id,
        type: t.literal('block'),
        family: t.enum(BLOCK_FAMILIES as [string, ...string[]]),
        block: t.string({ min: 1, max: 64, pattern: BLOCK_TYPE_PATTERN }),
        props,
      }),
      embed,
    ],
    { discriminator: 'type', code: C.unknownBlock }
  );

  const isoTime = t.string({
    max: 40,
    pattern: /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/,
  });
  const meta = t.object({
    title: line(L.title),
    description: t.optional(line(2_000)),
    locale: t.optional(t.string({ max: 35, pattern: /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8}){0,4}$/ })),
    dir: t.optional(t.enum(['ltr', 'rtl', 'auto'])),
    authors: t.optional(t.array(t.string({ min: 1, max: 200, text: 'line' }), { max: 50 })),
    tags: t.optional(t.array(t.string({ min: 1, max: 64, text: 'line' }), { max: 50 })),
    created: t.optional(isoTime),
    updated: t.optional(isoTime),
  });
  const margin = t.number({ min: 0, max: 100 });
  const pageSide = t.number({ min: 50, max: 1_000 });
  const band = t.object({
    start: t.optional(line(L.title)),
    center: t.optional(line(L.title)),
    end: t.optional(line(L.title)),
  });
  const page = t.refine(
    t.object({
      size: t.enum(PAGE_SIZES as [string, ...string[]]),
      orientation: t.enum(['portrait', 'landscape']),
      width: t.optional(pageSide),
      height: t.optional(pageSide),
      margins: t.optional(
        t.object({ top: margin, bottom: margin, inlineStart: margin, inlineEnd: margin })
      ),
      header: t.optional(band),
      footer: t.optional(band),
      breaks: t.optional(t.array(id, { max: L.blocks })),
    }),
    {
      code: C.pageSize,
      description: 'A custom page has a width and a height; a preset size has neither.',
      check(value, context) {
        const custom = value.size === 'custom';
        const some = value.width !== undefined || value.height !== undefined;
        if (custom ? value.width === undefined || value.height === undefined : some) {
          context.issue({
            message: custom
              ? 'A custom page needs both width and height (millimetres).'
              : 'Only a custom page has width and height.',
            fix: custom ? 'Add width and height, from 50 to 1,000 mm.' : "Set size to 'custom'.",
          });
        }
      },
    }
  );
  const offset = t.int({ min: 0, max: L.chars });
  const thread = t.object({
    id,
    anchor: t.object({ block: id, start: t.optional(offset), end: t.optional(offset) }),
    quote: t.optional(t.string({ max: 2_000, text: 'multiline' })),
    status: t.enum(['open', 'resolved']),
    messages: t.array(
      t.object({
        id,
        author: t.string({ min: 1, max: 200, text: 'line' }),
        body: t.string({ min: 1, max: L.message, text: 'multiline' }),
        created: t.optional(isoTime),
      }),
      { min: 1, max: L.messages }
    ),
  });

  // Spec 0.10.0 (ADR-024): the design system the document follows.
  const designSystem = t.refine(
    t.object({
      ref: t.optional(
        t.string({
          min: 1,
          max: 200,
          pattern: DESIGN_SYSTEM_REF_PATTERN,
        })
      ),
      inline: t.optional(
        t.refine(
          t.json({ depth: 16, maxKeys: 200, maxItems: 64, maxString: 360_000, text: 'line' }),
          {
            code: 'invalid-type',
            check(value, context) {
              if (value === null || typeof value !== 'object' || Array.isArray(value))
                context.issue({ message: 'An inline design system is an object.' });
            },
          }
        )
      ),
    }),
    {
      code: 'invalid-value',
      description: 'Exactly one of ref and inline.',
      check(value, context) {
        if ((value.ref === undefined) === (value.inline === undefined))
          context.issue({ message: 'Set exactly one of ref and inline.' });
      },
    }
  );

  const documentShape = t.object({
    format: t.literal(DOCUMENT_FORMAT, { code: C.unsupportedFormat }),
    formatVersion: t.literal(DOCUMENT_FORMAT_VERSION, { code: C.unsupportedVersion }),
    meta,
    page: t.optional(page),
    blocks,
    annotations: t.optional(
      t.object({ comments: t.optional(t.array(thread, { max: L.comments })) })
    ),
    designSystem: t.optional(designSystem),
  });

  return t.refine(documentShape, {
    code: C.duplicateId,
    description: `Ids are unique; at most ${L.blocks} nodes and ${L.chars} characters; comment anchors that name no node (or fall outside its text) are orphaned, reported as warnings.`,
    check(value, context) {
      checkDocument(value as unknown as TexuliDocument, context);
    },
  });
}

function checkEmbed(value: EmbedBlock, context: RefineContext): void {
  const hasRef = value.ref !== undefined;
  const hasInline = value.inline !== undefined;
  if (hasRef === hasInline) {
    context.issue({
      message: 'An embed has exactly one of ref and inline.',
      fix: 'Keep the host ref, or the inline payload, not both.',
    });
    return;
  }
  const payload = value.inline as Record<string, DocumentJson> | undefined;
  if (!payload) return;
  if (value.kind === 'component') {
    const keys = Object.keys(payload);
    const component = payload.id;
    if (
      typeof component !== 'string' ||
      !COMPONENT_ID_PATTERN.test(component) ||
      component.length > 64 ||
      keys.some((key) => key !== 'id' && key !== 'props') ||
      (payload.props !== undefined &&
        (payload.props === null ||
          typeof payload.props !== 'object' ||
          Array.isArray(payload.props)))
    )
      context.issue({
        code: C.invalidComponent,
        message: 'An inline component is one catalog node: { id, props }.',
        path: ['inline'],
        fix: 'Use a kebab-case catalog id and an optional props object; children are not allowed.',
      });
  } else if (value.kind === 'deck') {
    const result = parseDeck(payload);
    if (!result.ok) {
      for (const issue of result.issues.filter((entry) => entry.severity === 'error').slice(0, 20))
        context.issue({
          code: C.invalidDeck,
          message: `${issue.code}: ${issue.message}`,
          path: ['inline', ...issue.path],
          fix: issue.fix,
        });
    }
  }
}

function textLength(content: readonly DocumentInline[]): number {
  let length = 0;
  for (const node of content) length += node.type === 'break' ? 1 : node.text.length;
  return length;
}

function checkDocument(doc: TexuliDocument, context: RefineContext): void {
  const seen = new Map<string, DocumentNode>();
  let nodes = 0;
  let chars = doc.meta.title.length;
  let reportedSize = false;
  const paths = new Map<DocumentNode, (string | number)[]>();
  walkDocument(doc, ({ node, parent, index }) => {
    nodes += 1;
    chars += ownText(node).length;
    const parentNode = parent === null ? undefined : seen.get(parent);
    const parentPath = parentNode ? (paths.get(parentNode) ?? []) : [];
    const key = parentNode ? childKeyOf(parentNode) : 'blocks';
    const path = [...parentPath, key, index];
    // Paths are only kept for nodes that have children, so the walk stays linear.
    if (childrenOf(node).length > 0) paths.set(node, path);
    if (seen.has(node.id)) {
      context.issue({
        code: C.duplicateId,
        message: `The id "${node.id}" is used more than once.`,
        path: [...path, 'id'],
        fix: 'Give every block, column and list item its own id.',
      });
    } else seen.set(node.id, node);
    if (nodes > L.blocks && !reportedSize) {
      reportedSize = true;
      context.issue({
        code: C.tooManyBlocks,
        message: `A document holds at most ${L.blocks} blocks, columns and list items.`,
        fix: 'Split the document into nested pages.',
      });
    }
  });
  if (chars > L.chars)
    context.issue({
      code: C.tooMuchText,
      message: `A document holds at most ${L.chars} characters of text.`,
      fix: 'Split the document into nested pages.',
    });
  const comments = doc.annotations?.comments ?? [];
  for (const [index, thread] of comments.entries()) {
    const target = seen.get(thread.anchor.block);
    const path = ['annotations', 'comments', index, 'anchor'];
    if (!target) {
      context.issue({
        code: C.unknownAnchor,
        severity: 'warning',
        message: `The comment anchor names no node ("${thread.anchor.block}").`,
        path: [...path, 'block'],
      });
      continue;
    }
    const { start, end } = thread.anchor;
    if (start === undefined && end === undefined) continue;
    const length =
      'type' in target && (target.type === 'paragraph' || target.type === 'heading')
        ? textLength(target.content)
        : 'type' in target && target.type === 'code'
          ? target.text.length
          : -1;
    if (start === undefined || end === undefined || start > end || end > length)
      context.issue({
        code: C.anchorRange,
        severity: 'warning',
        message: 'A comment range needs start ≤ end within a text block’s text.',
        path,
      });
  }
}

function childKeyOf(node: DocumentNode): string {
  if (!('type' in node)) return 'blocks';
  if (node.type === 'list') return 'items';
  if (node.type === 'columns') return 'columns';
  return 'blocks';
}

const cache = new Map<HrefTrust, Schema>();

/** The document schema for a URL tier (`untrusted` by default). Built once per tier. */
export function documentSchema(trust: HrefTrust = 'untrusted'): Schema<TexuliDocument> {
  const tier: HrefTrust = trust === 'developer' ? 'developer' : 'untrusted';
  let schema = cache.get(tier);
  if (!schema) {
    schema = build(tier);
    cache.set(tier, schema);
  }
  return schema as Schema<TexuliDocument>;
}

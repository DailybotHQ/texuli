/**
 * The closed vocabularies and caps of the document format. Hostile input
 * fails validation against these caps; it never grows past them.
 */
import type { BlockFamily, CalloutTone, DocumentBlockType, EmbedKind, PageSize } from './types.ts';

export const DOCUMENT_FORMAT = 'texuli-document';
export const DOCUMENT_FORMAT_VERSION = 1;

export const DOCUMENT_LIMITS = Object.freeze({
  /** Blocks, columns and list items in a document (the ADR-003 editor target). */
  blocks: 2_000,
  /** Characters of text (runs, code, titles and summaries). */
  chars: 200_000,
  /** Nested block lists along one path (columns, items, quotes, callouts, toggles). */
  depth: 8,
  /** Code points in a persisted id. */
  id: 64,
  /** Code points in a link href, a media ref or a host ref. */
  href: 2_048,
  /** Runs in one text block. */
  runs: 2_000,
  /** Code points in one text run (bounded by `chars` as a whole). */
  run: 200_000,
  /** Code points in a code block (bounded by `chars` as a whole). */
  code: 200_000,
  /** Code points in a title, a summary line or alt text. */
  title: 500,
  /** UTF-8 bytes of an inline embed payload, or of a wrapped block's props. */
  inlineBytes: 65_536,
  /** Comment threads, and messages per thread. */
  comments: 500,
  messages: 200,
  /** Code points in a comment message body. */
  message: 4_000,
  /** Serialized bytes the untrusted loader reads before parsing. */
  bytes: 4_000_000,
});

export const DOCUMENT_BLOCK_TYPES: readonly DocumentBlockType[] = Object.freeze([
  'paragraph',
  'heading',
  'code',
  'list',
  'quote',
  'divider',
  'media',
  'callout',
  'toggle',
  'columns',
  'page-link',
  'block',
  'embed',
]);

/** Block types whose children are a block list. */
export const CONTAINER_TYPES = Object.freeze(['quote', 'callout', 'toggle', 'column'] as const);

export const CALLOUT_TONES: readonly CalloutTone[] = Object.freeze([
  'neutral',
  'accent',
  'info',
  'success',
  'warning',
  'danger',
]);

export const EMBED_KINDS: readonly EmbedKind[] = Object.freeze([
  'component',
  'deck',
  'sheet',
  'canvas',
]);

/** Mirrors `BLOCK_FAMILIES` in `@texuli/blocks` (L5, which this L1 engine cannot import). */
export const BLOCK_FAMILIES: readonly BlockFamily[] = Object.freeze([
  'text',
  'media',
  'data',
  'structure',
  'code',
  'diagram',
  'interactive',
  'map',
  'embed',
]);

export const PAGE_SIZES: readonly PageSize[] = Object.freeze([
  'a4',
  'a5',
  'letter',
  'legal',
  'custom',
]);

/** Persisted ids: a letter or digit, then letters, digits, `_` and `-`. */
export const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
/** Host refs (nested pages, embeds): an opaque key the host resolves, never rendered as a URL. */
export const DOCUMENT_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
/** Catalog component ids (kebab-case, as in the blueprint spec). */
export const COMPONENT_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
/** `@texuli/blocks` block types (kebab-case). */
export const BLOCK_TYPE_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
/** Code block languages (the core editor's pattern). */
export const LANG_PATTERN = /^[a-z][a-z0-9+-]{0,31}$/;

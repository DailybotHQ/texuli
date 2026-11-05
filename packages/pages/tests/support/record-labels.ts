/**
 * Records every `(id, english)` pair the pages label factories resolve
 * (ADR-026): each factory runs with a recording lookup, and every sentence
 * function is called once per block type, embed kind, list kind and change
 * kind. The drift test keeps `PAGES_MESSAGES_EN` equal to the result.
 */

import { BLOCK_CATALOG } from '@texuli/blocks/core';
import type { MessageLookup } from '@texuli/core/i18n';
import { type CollabLabels, collabLabelsFor } from '../../src/collab/labels.ts';
import { EXTRA_BLOCK_SAMPLES } from '../../src/editor/slash.ts';
import { pagedLabelsFor } from '../../src/paged/labels.ts';
import { pagesLabelsFor } from '../../src/shared/labels.ts';

const BLOCK_TYPES = [
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
] as const;
const EMBED_KINDS = ['component', 'deck', 'sheet', 'canvas'] as const;

export function recordPagesMessages(): Map<string, string> {
  const seen = new Map<string, string>();
  const lookup: MessageLookup = (id, english) => {
    const text = typeof english === 'string' ? english : english.other;
    const previous = seen.get(id);
    if (previous !== undefined && previous !== text) throw new Error(`${id}: two defaults`);
    seen.set(id, text);
    return text;
  };
  const pages = pagesLabelsFor(lookup);
  for (const type of BLOCK_TYPES) {
    pages.blockType(type);
    pages.blockType(type, '2');
  }
  for (const kind of EMBED_KINDS) {
    pages.embed(kind, '');
    pages.embed(kind, 'Title');
    pages.embedUnavailable(kind);
    pages.embedOff(kind);
  }
  for (const kind of ['bullet', 'ordered', 'todo'] as const) pages.listKind(kind);
  for (const entry of [...BLOCK_CATALOG, ...EXTRA_BLOCK_SAMPLES]) {
    pages.contentBlock(entry.type, entry.label);
  }
  pages.handle('Paragraph', 'x');
  pages.columnsResize(1);
  pages.column(1, 2);
  pages.openPage('x');
  pages.mediaFallback('');
  pages.mediaFallback('x');
  pages.inserted('x');
  pages.removed('x');
  pages.moved('x', 1, 2);
  pages.cannotMove('x');
  pages.resized(1, 6);
  pages.editRefused('x');
  pagedLabelsFor(lookup).pageOf(1, 2);
  const collab: CollabLabels = collabLabelsFor(lookup);
  collab.landmark('x', 'y');
  collab.collaborator('x', 'y');
  collab.you('x');
  collab.newComment('x');
  collab.replyLabel('x');
  collab.threadName('x', 'y');
  collab.threadName('x', '');
  collab.suggestionName('');
  collab.inserted('x');
  collab.deleted('x');
  collab.restore('x');
  collab.versionBy('x');
  collab.versionSaved('x');
  collab.versionRestored('x');
  for (const change of [
    { kind: 'meta', fields: ['title'] },
    { kind: 'page' },
    { kind: 'added', type: 'paragraph', text: '' },
    { kind: 'added', type: 'paragraph', text: 'x' },
    { kind: 'removed', type: 'paragraph', text: '' },
    { kind: 'removed', type: 'paragraph', text: 'x' },
    { kind: 'moved', type: 'paragraph', text: '' },
    { kind: 'moved', type: 'paragraph', text: 'x' },
    { kind: 'text', before: 'a', after: 'b' },
    { kind: 'formatting', text: 'x' },
    { kind: 'attributes', keys: ['level'], type: 'heading' },
  ]) {
    collab.change(change as Parameters<CollabLabels['change']>[0]);
  }
  return new Map([...seen].sort(([a], [b]) => (a < b ? -1 : 1)));
}

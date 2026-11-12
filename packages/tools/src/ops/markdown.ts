/**
 * `md.convert` and `md.render`: untrusted Markdown, HTML and chat-dialect
 * conversions through `@texuli/core` (ADR-034). URLs always use the
 * `untrusted` tier. GFM and a CommonMark text writer are planned (T-md-gfm).
 */
import { htmlToMarkdownTree } from '@texuli/core/html';
import { MARKDOWN_LIMITS, type MarkdownDiagnostic, parseMarkdown } from '@texuli/core/markdown';
import {
  convertMarkdownDialect,
  MARKDOWN_DIALECTS,
  type MarkdownDialect,
  readMarkdownDialect,
  writeMarkdownDialect,
} from '@texuli/core/markdown-dialects';
import { markdownTreeToHtml } from '@texuli/core/markdown-html';
import { defineOperation } from './registry.ts';
import type { JsonSchema } from './schema.ts';
import type { Operation } from './types.ts';

const SOURCE_MAX = MARKDOWN_LIMITS.source;
const INPUT_BYTES = SOURCE_MAX + 100_000;
const DIAGNOSTIC_MAX = 200;

export const MARKDOWN_FORMATS = ['commonmark', 'html', ...MARKDOWN_DIALECTS] as const;
export type MarkdownFormat = (typeof MARKDOWN_FORMATS)[number];

const formatSchema: JsonSchema = {
  type: 'string',
  enum: MARKDOWN_FORMATS,
  description:
    'commonmark (parser today; text writer planned), html, or a chat dialect (slack, discord, whatsapp, telegram-markdown-v2, telegram-html, teams, google-chat, mattermost, plain-text). GFM is planned.',
};

const diagnosticItem: JsonSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', maxLength: 64, description: 'A stable diagnostic code.' },
    message: { type: 'string', maxLength: 2_000, description: 'What was dropped or rewritten.' },
  },
  required: ['code', 'message'],
  additionalProperties: false,
};

const diagnosticsSchema: JsonSchema = {
  type: 'array',
  maxItems: DIAGNOSTIC_MAX,
  items: diagnosticItem,
  description: 'What the reader or writer dropped, refused or approximated.',
};

function isDialect(value: string): value is MarkdownDialect {
  return (MARKDOWN_DIALECTS as readonly string[]).includes(value);
}

function isFormat(value: unknown): value is MarkdownFormat {
  return typeof value === 'string' && (MARKDOWN_FORMATS as readonly string[]).includes(value);
}

function publicDiagnostics(
  list: readonly MarkdownDiagnostic[]
): { code: string; message: string }[] {
  return list.slice(0, DIAGNOSTIC_MAX).map((item) => ({ code: item.code, message: item.message }));
}

const PLANNED_WRITER: MarkdownDiagnostic = {
  code: 'unsupported-construct',
  message:
    'The CommonMark text writer is planned (T-md-gfm). GFM is planned. Convert to html or a chat dialect instead.',
};

function readTree(source: string, from: MarkdownFormat) {
  if (from === 'commonmark') return parseMarkdown(source);
  if (from === 'html') return htmlToMarkdownTree(source, { trust: 'untrusted' });
  return readMarkdownDialect(source, from);
}

function convert(source: string, from: MarkdownFormat, to: MarkdownFormat) {
  if (isDialect(from) && isDialect(to)) {
    const result = convertMarkdownDialect(source, from, to, { trust: 'untrusted' });
    return { value: result.value, diagnostics: publicDiagnostics(result.diagnostics) };
  }
  const read = readTree(source, from);
  if (to === 'commonmark') {
    return { value: '', diagnostics: publicDiagnostics([...read.diagnostics, PLANNED_WRITER]) };
  }
  if (to === 'html') {
    const written = markdownTreeToHtml(read.tree, { trust: 'untrusted', rawHtml: 'drop' });
    return {
      value: written.html,
      diagnostics: publicDiagnostics([...read.diagnostics, ...written.diagnostics]),
    };
  }
  const written = writeMarkdownDialect(read.tree, to, { trust: 'untrusted' });
  return {
    value: written.value,
    diagnostics: publicDiagnostics([...read.diagnostics, ...written.diagnostics]),
  };
}

export const mdConvert: Operation = defineOperation({
  name: 'md.convert',
  title: 'Convert Markdown, HTML or a chat dialect',
  summary:
    'Convert untrusted Markdown, HTML or a chat dialect (Slack, Discord, WhatsApp, Telegram MarkdownV2 and HTML, Teams, Google Chat, Mattermost, plain text) through the texuli-md/v1 AST. URLs use the untrusted policy. Returns { value, diagnostics }. CommonMark text output and GFM are planned.',
  input: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        maxLength: SOURCE_MAX,
        description: 'The untrusted source text to convert (at most 1000000 characters).',
      },
      from: formatSchema,
      to: formatSchema,
    },
    required: ['source', 'from', 'to'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      value: { type: 'string', description: 'The converted text.' },
      diagnostics: diagnosticsSchema,
    },
    required: ['value', 'diagnostics'],
    additionalProperties: false,
  },
  annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
  runtime: 'edge',
  limits: { inputBytes: INPUT_BYTES, items: DIAGNOSTIC_MAX, timeMs: 10_000 },
  examples: [
    {
      title: 'Slack mrkdwn to Discord',
      input: { source: '*hello*', from: 'slack', to: 'discord' },
    },
    {
      title: 'HTML to plain text',
      input: {
        source: '<p>See <a href="https://example.com">docs</a>.</p>',
        from: 'html',
        to: 'plain-text',
      },
    },
  ],
  handler(input) {
    const source = typeof input.source === 'string' ? input.source : '';
    const from = isFormat(input.from) ? input.from : 'commonmark';
    const to = isFormat(input.to) ? input.to : 'plain-text';
    return convert(source, from, to);
  },
});

export const mdRender: Operation = defineOperation({
  name: 'md.render',
  title: 'Render CommonMark to safe HTML',
  summary:
    'Parse untrusted CommonMark 0.31.2 and write a safe HTML fragment through the markup allowlist. Every href and src uses the untrusted URL policy; raw HTML is dropped. Returns { html, diagnostics }. GFM is planned.',
  input: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        maxLength: SOURCE_MAX,
        description: 'Untrusted CommonMark source (at most 1000000 characters).',
      },
    },
    required: ['source'],
    additionalProperties: false,
  },
  output: {
    type: 'object',
    properties: {
      html: { type: 'string', description: 'The safe HTML fragment.' },
      diagnostics: diagnosticsSchema,
    },
    required: ['html', 'diagnostics'],
    additionalProperties: false,
  },
  annotations: { readOnly: true, destructive: false, idempotent: true, openWorld: false },
  runtime: 'edge',
  limits: { inputBytes: INPUT_BYTES, items: DIAGNOSTIC_MAX, timeMs: 10_000 },
  examples: [
    {
      title: 'Bold text and a refused script link',
      input: { source: 'See **docs** at [x](javascript:alert(1)).' },
    },
  ],
  handler(input) {
    const source = typeof input.source === 'string' ? input.source : '';
    const read = parseMarkdown(source);
    const written = markdownTreeToHtml(read.tree, { trust: 'untrusted', rawHtml: 'drop' });
    return {
      html: written.html,
      diagnostics: publicDiagnostics([...read.diagnostics, ...written.diagnostics]),
    };
  },
});

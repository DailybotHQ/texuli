import { documentFromMarkdown, documentToMarkdown } from '@texuli/document/markdown';
import {
  BLOCK_FAMILIES,
  countNodes,
  DOCUMENT_BLOCK_TYPES,
  DOCUMENT_FORMAT,
  DOCUMENT_FORMAT_VERSION,
  DOCUMENT_LIMITS,
  documentPlainText,
  EMBED_KINDS,
  type TexuliDocument,
  walkDocument,
} from '@texuli/document/model';
import { applyDocumentPatch, type DocumentPatch, MAX_PATCH_OPERATIONS } from '@texuli/document/ops';
import { documentJsonSchema, validateDocument } from '@texuli/document/schema';

/**
 * Agent and developer commands for Texuli documents (spec 0.7.0, ADR-011),
 * on `@texuli/document`: read what the format supports, validate a
 * document at a tier, summarize it, apply a bounded RFC 6902 patch,
 * convert from and to Markdown, wrap it as a `document` blueprint, and
 * export DOCX or PDF bytes. Every command takes data and returns data; it
 * reads and writes no files (the CLI does, only for `--file` and `--out`).
 */
export const DOCUMENT_COMMANDS = [
  'capabilities',
  'schema',
  'validate',
  'inspect',
  'patch',
  'from-markdown',
  'to-markdown',
  'to-blueprint',
  'to-docx',
  'to-pdf',
] as const;
export type DocumentCommandName = (typeof DOCUMENT_COMMANDS)[number];

/** The URL tier a command checks links and media with: never higher than the caller asks. */
export type DocumentTier = 'developer' | 'untrusted';

export interface DocumentCommandInput {
  document?: unknown;
  markdown?: string;
  /** For `patch`: the RFC 6902 operations (at most 1,000). */
  patch?: unknown;
  /** Default `untrusted`. */
  tier?: DocumentTier;
  /** For `to-blueprint`: the node key (default `document`) and the envelope id. */
  key?: string;
  id?: string;
}

/** The spec version a `to-blueprint` envelope is written for. */
export const DOCUMENT_BLUEPRINT_SPEC = '0.7.0';
const NODE_KEY = /^[A-Za-z0-9._:-]{1,64}$/;
const ENVELOPE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

type Issue = { code: string; path: string; message: string };
const issuesOf = (
  issues: readonly { code: string; jsonPath: string; message: string; severity: string }[]
) =>
  issues.slice(0, 50).map((issue): Issue & { severity: string } => ({
    code: issue.code,
    path: issue.jsonPath,
    message: issue.message,
    severity: issue.severity,
  }));

/** The document, validated at the tier, or the refusal. */
function load(
  input: DocumentCommandInput
): { ok: true; document: TexuliDocument; tier: DocumentTier } | { ok: false; issues: Issue[] } {
  const tier: DocumentTier = input.tier === 'developer' ? 'developer' : 'untrusted';
  if (input.document === undefined)
    return {
      ok: false,
      issues: [{ code: 'invalid-input', path: '$', message: 'Provide a document.' }],
    };
  const result = validateDocument(input.document, { trust: tier });
  return result.ok
    ? { ok: true, document: result.document, tier }
    : { ok: false, issues: issuesOf(result.issues) };
}

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

/** Pure command adapter shared by the CLI and the MCP tool. Never throws. */
export async function runDocumentCommand(
  command: DocumentCommandName,
  input: DocumentCommandInput = {}
): Promise<unknown> {
  try {
    return await run(command, input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function run(command: DocumentCommandName, input: DocumentCommandInput): Promise<unknown> {
  if (command === 'capabilities')
    return {
      format: DOCUMENT_FORMAT,
      formatVersion: DOCUMENT_FORMAT_VERSION,
      spec: DOCUMENT_BLUEPRINT_SPEC,
      catalogId: 'document',
      commands: DOCUMENT_COMMANDS,
      blockTypes: DOCUMENT_BLOCK_TYPES,
      blockFamilies: BLOCK_FAMILIES,
      embedKinds: EMBED_KINDS,
      patch: {
        operations: ['add', 'remove', 'replace', 'move', 'copy', 'test'],
        max: MAX_PATCH_OPERATIONS,
      },
      limits: DOCUMENT_LIMITS,
      sources: ['json', 'markdown'],
      exports: ['markdown', 'docx', 'pdf'],
    };
  if (command === 'schema') return documentJsonSchema();
  if (command === 'from-markdown') {
    if (typeof input.markdown !== 'string') return { ok: false, error: 'Provide markdown text.' };
    const tier: DocumentTier = input.tier === 'developer' ? 'developer' : 'untrusted';
    const imported = documentFromMarkdown(input.markdown, { trust: tier });
    return imported.ok
      ? { ok: true, document: imported.document, diagnostics: imported.diagnostics }
      : { ok: false, issues: issuesOf(imported.issues), diagnostics: imported.diagnostics };
  }

  const loaded = load(input);
  if (command === 'validate')
    return loaded.ok
      ? { ok: true, tier: loaded.tier, issues: [] }
      : { ok: false, issues: loaded.issues };
  if (!loaded.ok) return { ok: false, issues: loaded.issues };
  const doc = loaded.document;

  if (command === 'inspect') {
    const types: Record<string, number> = {};
    const outline: { id: string; level: number; text: string }[] = [];
    walkDocument(doc, ({ node }) => {
      const type = 'type' in node ? node.type : 'list-item';
      types[type] = (types[type] ?? 0) + 1;
      if ('type' in node && node.type === 'heading') {
        const text = node.content
          .map((run) => (run.type === 'text' ? run.text : ''))
          .join('')
          .slice(0, 200);
        outline.push({ id: node.id, level: node.level, text });
      }
    });
    return {
      ok: true,
      meta: doc.meta,
      blocks: doc.blocks.length,
      nodes: countNodes(doc),
      types,
      outline,
      characters: documentPlainText(doc).length,
      annotations: {
        threads: doc.annotations?.comments?.length ?? 0,
      },
    };
  }
  if (command === 'patch') {
    if (!Array.isArray(input.patch))
      return { ok: false, error: 'Provide a patch: an array of RFC 6902 operations.' };
    const result = applyDocumentPatch(doc, input.patch as DocumentPatch, { validate: loaded.tier });
    return result.ok
      ? { ok: true, document: result.document, inverse: result.inverse }
      : { ok: false, index: result.index, reason: result.reason, issues: issuesOf(result.issues) };
  }
  if (command === 'to-markdown')
    return { ok: true, markdown: documentToMarkdown(doc, { title: false }) };
  if (command === 'to-blueprint') {
    const key = input.key ?? 'document';
    const id = input.id ?? 'document';
    if (!NODE_KEY.test(key))
      return { ok: false, error: 'The key is 1–64 letters, digits or . _ : -.' };
    if (!ENVELOPE_ID.test(id))
      return { ok: false, error: 'The id is 1–128 letters, digits or . _ : -.' };
    return {
      ok: true,
      blueprint: {
        format: 'texuli-blueprint',
        version: 1,
        id,
        status: 'draft',
        spec: DOCUMENT_BLUEPRINT_SPEC,
        tree: { key, id: 'document', props: { doc } },
      },
    };
  }
  if (command === 'to-docx') {
    const { DOCX_MIME, writeDocx } = await import('@texuli/document/docx');
    const { bytes, diagnostics } = await writeDocx(doc, { trust: loaded.tier });
    return {
      ok: true,
      mime: DOCX_MIME,
      byteLength: bytes.byteLength,
      base64: toBase64(bytes),
      diagnostics,
    };
  }
  if (command === 'to-pdf') {
    const { PDF_MIME, writePdf } = await import('@texuli/document/pdf');
    const { bytes, pageCount, diagnostics } = await writePdf(doc, { trust: loaded.tier });
    return {
      ok: true,
      mime: PDF_MIME,
      byteLength: bytes.byteLength,
      pageCount,
      base64: toBase64(bytes),
      diagnostics,
    };
  }
  return { ok: false, error: `Unknown document command: ${String(command)}` };
}

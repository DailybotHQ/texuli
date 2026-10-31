// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseDocumentCliArgs, runDocumentCli } from '../src/cli/document.ts';
import { runTexuliCli } from '../src/cli/texuli.ts';
import {
  DOCUMENT_BLUEPRINT_SPEC,
  DOCUMENT_COMMANDS,
  runDocumentCommand,
} from '../src/document/index.ts';
import { createTexuliMcpServer, MCP_PROTOCOL_VERSION } from '../src/mcp/index.ts';
import { RUN_COMMANDS } from '../src/ops/index.ts';

/**
 * Document commands for agents and developers (spec 0.7.0, ADR-011): one
 * pure adapter on `@texuli/document` behind the `texuli document` CLI and
 * the read-only `document` MCP tool.
 */

const fixture = {
  format: 'texuli-document',
  formatVersion: 1,
  meta: { title: 'Fictional brief', locale: 'en' },
  blocks: [
    {
      id: 'h1',
      type: 'heading',
      level: 1,
      content: [{ type: 'text', text: 'Fictional brief', marks: [] }],
    },
    {
      id: 'p1',
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Read the ', marks: [] },
        {
          type: 'text',
          text: 'plan',
          marks: [{ type: 'link', href: 'https://example.com/plan' }],
        },
        { type: 'text', text: '.', marks: [] },
      ],
    },
  ],
};
const scriptLink = {
  ...fixture,
  blocks: [
    {
      id: 'p1',
      type: 'paragraph',
      content: [
        { type: 'text', text: 'x', marks: [{ type: 'link', href: 'javascript:alert(1)' }] },
      ],
    },
  ],
};

type Result = Record<string, unknown> & { ok?: boolean };
const run = async (command: (typeof DOCUMENT_COMMANDS)[number], input = {}) =>
  (await runDocumentCommand(command, input)) as Result;

describe('document commands', () => {
  it('describe the format, create from Markdown, validate, inspect and round-trip', async () => {
    expect(DOCUMENT_COMMANDS).toEqual([
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
    ]);
    expect(await run('capabilities')).toMatchObject({
      format: 'texuli-document',
      formatVersion: 1,
      spec: DOCUMENT_BLUEPRINT_SPEC,
      catalogId: 'document',
      patch: { max: 1000 },
    });
    expect(await run('schema')).toMatchObject({ $id: expect.stringContaining('document') });
    expect(await run('validate', { document: fixture })).toEqual({
      ok: true,
      tier: 'untrusted',
      issues: [],
    });
    expect(await run('inspect', { document: fixture })).toMatchObject({
      ok: true,
      blocks: 2,
      outline: [{ id: 'h1', level: 1, text: 'Fictional brief' }],
    });
    const created = await run('from-markdown', {
      markdown:
        '# Weekly notes\n\nShipped **on time**. See [the plan](https://example.com/plan).\n\n- One\n- Two\n',
    });
    expect(created.ok).toBe(true);
    expect(created.document).toMatchObject({ meta: { title: 'Weekly notes' } });
    const markdown = await run('to-markdown', { document: created.document });
    expect(markdown.markdown).toContain('**on time**');
    expect(markdown.markdown).toContain('[the plan](https://example.com/plan)');
  });

  it('refuses hostile documents and Markdown at the untrusted tier', async () => {
    expect(await run('validate', { document: scriptLink })).toMatchObject({ ok: false });
    for (const command of [
      'inspect',
      'patch',
      'to-markdown',
      'to-blueprint',
      'to-docx',
      'to-pdf',
    ] as const) {
      expect((await run(command, { document: scriptLink, patch: [] })).ok, command).toBe(false);
    }
    expect(await run('validate', { document: { ...fixture, format: 'html' } })).toMatchObject({
      ok: false,
    });
    expect(await run('validate')).toMatchObject({ ok: false });
    const proto = JSON.parse(
      '{"format":"texuli-document","formatVersion":1,"meta":{"title":"x"},"blocks":[],"__proto__":{"polluted":true}}'
    );
    expect((await run('validate', { document: proto })).ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // Markdown links outside the policy never become links.
    const imported = await run('from-markdown', {
      markdown: '[x](javascript:alert(1)) <script>alert(1)</script>',
    });
    expect(JSON.stringify(imported)).not.toContain('javascript:');
    // Raw HTML stays inert text in a text run: never markup, never a node of its own.
    expect(imported.document).toMatchObject({
      blocks: [
        { type: 'paragraph', content: [{ type: 'text', text: 'x <script>alert(1)</script>' }] },
      ],
    });
    // A relative link is a developer-tier choice only.
    const relative = {
      ...fixture,
      blocks: [
        {
          ...fixture.blocks[1],
          content: [{ type: 'text', text: 'x', marks: [{ type: 'link', href: '/docs' }] }],
        },
      ],
    };
    expect((await run('validate', { document: relative })).ok).toBe(false);
    expect((await run('validate', { document: relative, tier: 'developer' })).ok).toBe(true);
  });

  it('applies bounded RFC 6902 patches all or none, with an exact inverse', async () => {
    const patch = [
      { op: 'test', path: '/meta/title', value: 'Fictional brief' },
      { op: 'replace', path: '/meta/title', value: 'Fictional brief, revised' },
      {
        op: 'add',
        path: '/blocks/-',
        value: {
          id: 'p2',
          type: 'paragraph',
          content: [{ type: 'text', text: 'Added.', marks: [] }],
        },
      },
    ];
    const patched = await run('patch', { document: fixture, patch });
    expect(patched.ok).toBe(true);
    expect(patched.document).toMatchObject({ meta: { title: 'Fictional brief, revised' } });
    const back = await run('patch', { document: patched.document, patch: patched.inverse });
    expect(back.document).toEqual(fixture);
    for (const [label, bad] of [
      ['a failed test', [{ op: 'test', path: '/meta/title', value: 'Other' }]],
      ['a prototype path', [{ op: 'add', path: '/__proto__/x', value: 1 }]],
      ['an unsafe result', [{ op: 'add', path: '/blocks/-', value: scriptLink.blocks[0] }]],
      ['over 1,000 operations', Array.from({ length: 1001 }, () => patch[0])],
      ['an unknown op', [{ op: 'eval', path: '/' }]],
    ] as const) {
      expect((await run('patch', { document: fixture, patch: bad })).ok, label).toBe(false);
    }
    expect((await run('patch', { document: fixture })).ok).toBe(false);
  });

  it('wraps a document as a spec 0.7.0 blueprint and exports DOCX and PDF bytes', async () => {
    expect(await run('to-blueprint', { document: fixture, key: 'brief' })).toMatchObject({
      ok: true,
      blueprint: {
        format: 'texuli-blueprint',
        spec: '0.7.0',
        status: 'draft',
        tree: { key: 'brief', id: 'document', props: { doc: fixture } },
      },
    });
    expect((await run('to-blueprint', { document: fixture, key: 'a b' })).ok).toBe(false);
    const docx = await run('to-docx', { document: fixture });
    expect(docx).toMatchObject({ ok: true, mime: expect.stringContaining('wordprocessingml') });
    const zip = Buffer.from(String(docx.base64), 'base64');
    expect(zip.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(zip.byteLength).toBe(docx.byteLength);
    const pdf = await run('to-pdf', { document: fixture });
    expect(pdf).toMatchObject({ ok: true, mime: 'application/pdf', pageCount: 1 });
    expect(Buffer.from(String(pdf.base64), 'base64').subarray(0, 5).toString('latin1')).toBe(
      '%PDF-'
    );
  });
});

describe('the texuli document CLI', () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = undefined;
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('parses its surface strictly', () => {
    expect(
      parseDocumentCliArgs(['validate', '--file', 'doc.json', '--tier', 'developer'])
    ).toMatchObject({
      command: 'validate',
      file: 'doc.json',
      tier: 'developer',
    });
    expect(
      parseDocumentCliArgs(['patch', '--file', 'doc.json', '--patch', 'p.json'])
    ).toMatchObject({
      patch: 'p.json',
    });
    expect(parseDocumentCliArgs(['to-pdf', '--text', '{}', '--out', 'x.pdf'])).toMatchObject({
      out: 'x.pdf',
    });
    for (const [args, message] of [
      [['print'], /Unknown document command/u],
      [['validate', '--unknown'], /Unknown document flag/u],
      [['validate', '--tier', 'admin'], /--tier/u],
      [['patch', '--file', 'doc.json'], /needs --patch/u],
      [['validate', '--patch', 'p.json'], /only for the patch/u],
      [['validate', '--out', 'x'], /only for to-markdown/u],
      [['validate', '--text', 'x', '--file', 'y'], /either --file or --text/u],
      [['validate', '--file'], /needs a value/u],
    ] as const) {
      expect(() => parseDocumentCliArgs(args), args.join(' ')).toThrow(message);
    }
  });

  it('writes an export to a new file and never overwrites one', async () => {
    dir = await mkdtemp(join(tmpdir(), 'texuli-document-'));
    const out = join(dir, 'brief.pdf');
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const error = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const text = JSON.stringify(fixture);
    expect(await runTexuliCli(['document', 'to-pdf', '--text', text, '--out', out])).toEqual({
      ok: true,
    });
    expect((await readFile(out)).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const summary = JSON.parse(String(write.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
    expect(summary).toMatchObject({ ok: true, out, mime: 'application/pdf' });
    expect(summary.base64).toBeUndefined();
    const again = await runDocumentCli(['to-pdf', '--text', text, '--out', out]);
    expect(again.ok).toBe(false);
    expect(String(error.mock.calls.at(-1)?.[0])).toMatch(/EEXIST|exists/u);
    const refused = await runDocumentCli(['validate', '--text', JSON.stringify(scriptLink)]);
    expect(refused.ok).toBe(false);
    expect(process.exitCode).toBe(1);
  });
});

describe('the document MCP tool', () => {
  it('is closed, read-only and in parity with the CLI commands', async () => {
    const handle = createTexuliMcpServer();
    await handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: MCP_PROTOCOL_VERSION },
    });
    await handle({ jsonrpc: '2.0', method: 'notifications/initialized' });
    const listed = (await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })) as unknown as {
      result: {
        tools: {
          name: string;
          inputSchema: {
            additionalProperties: boolean;
            properties: { command: { enum: string[] } };
          };
          annotations: { readOnlyHint: boolean };
        }[];
      };
    };
    const tool = listed.result.tools.find((item) => item.name === 'document.run');
    expect(tool?.inputSchema.additionalProperties).toBe(false);
    expect(tool?.inputSchema.properties.command.enum).toEqual(RUN_COMMANDS);
    expect(tool?.annotations.readOnlyHint).toBe(true);
    const call = async (args: Record<string, unknown>) =>
      (await handle({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'document.run', arguments: args },
      })) as unknown as { result: { isError?: boolean; content: { text: string }[] } };
    const patched = await call({
      command: 'patch',
      document: fixture,
      patch: [{ op: 'replace', path: '/meta/title', value: 'Renamed' }],
    });
    expect(JSON.parse(patched.result.content[0]?.text ?? '{}')).toMatchObject({
      result: { ok: true, document: { meta: { title: 'Renamed' } } },
    });
    expect(
      (await call({ command: 'validate', document: fixture, path: '/tmp/x' })).result.isError
    ).toBe(true);
    expect(
      (await call({ command: 'validate', document: fixture, tier: 'root' })).result.isError
    ).toBe(true);
    expect((await call({ command: 'patch', document: fixture, patch: {} })).result.isError).toBe(
      true
    );
  });
});

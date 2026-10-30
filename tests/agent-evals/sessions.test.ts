// @vitest-environment node
/**
 * Agent evaluations over the MCP (T-agent-evals, architecture A.7): every
 * scripted job runs on the local stdio handler and on the remote Pages
 * Function, and every edge operation answers identically on both. No model,
 * no network: the sessions are the agent.
 */
import { describe, expect, it } from 'vitest';
import { onRequest } from '../../functions/mcp.ts';
import { texuliOps } from '../../packages/tools/src/ops/index.ts';
import {
  assertEdgeParity,
  isEdgeTool,
  type Json,
  REMOTE_RUNTIMES,
  runSession,
  STDIO_RUNTIMES,
  type Step,
} from './harness.ts';
import { SESSIONS } from './sessions.ts';

const BRIEF = {
  format: 'texuli-document',
  formatVersion: 1,
  meta: { title: 'Fictional brief', locale: 'en' },
  blocks: [
    {
      id: 'p1',
      type: 'paragraph',
      content: [{ type: 'text', text: 'A fictional paragraph.', marks: [] }],
    },
  ],
};

describe('scripted agent sessions on the stdio and remote doors', () => {
  for (const session of SESSIONS) {
    if (session.skip) {
      it.skip(`${session.name} (skipped: ${session.skip})`, () => {});
      continue;
    }
    it(session.name, async () => {
      const stdio = await runSession(session, 'stdio');
      const remote = await runSession(session, 'remote');
      const compared = assertEdgeParity(session.name, stdio, remote);
      const toolCalls = stdio.filter((item) => item.method === 'tools/call');
      // Every tool call of these jobs is an edge operation, so all of them were compared.
      expect(toolCalls.length).toBeGreaterThan(0);
      expect(compared).toBe(toolCalls.length);
      // Resources, prompts and completions are door-independent too.
      stdio.forEach((local, index) => {
        if (local.method === 'tools/call' || local.method === 'tools/list') return;
        expect(remote[index]?.response, `${session.name} · ${local.label}`).toEqual(local.response);
      });
    });
  }
});

describe('what differs between the doors, and only that', () => {
  it('serves every runtime locally and only edge operations remotely', async () => {
    // "Every runtime": no operation is site-only yet, so edge + node is all of them.
    expect(texuliOps.list({ runtimes: ['site'] })).toEqual([]);
    expect(texuliOps.list({ runtimes: STDIO_RUNTIMES })).toEqual(texuliOps.list());
    const nodeOnly = texuliOps.list({ runtimes: ['node'] }).map((operation) => operation.name);
    expect(nodeOnly).toEqual(['document.export']);

    const exportStep = (check: Pick<Step, 'expect' | 'toolError'>): Step => ({
      label: 'export',
      method: 'tools/call',
      params: { name: 'document.export', arguments: { format: 'pdf', document: BRIEF } },
      ...check,
    });
    // Locally the PDF writer runs; remotely the call is refused with a stable code.
    await runSession(
      {
        name: 'node operation (stdio)',
        steps: [
          exportStep({
            expect: (result) =>
              expect(result.structuredContent.result).toMatchObject({
                ok: true,
                mime: 'application/pdf',
              }),
          }),
        ],
        final() {},
      },
      'stdio'
    );
    await runSession(
      {
        name: 'node operation (remote)',
        steps: [
          exportStep({
            toolError(failure) {
              expect(failure.code).toBe('runtime-unavailable');
              expect(failure.error).toMatch(/needs the node runtime/u);
            },
          }),
        ],
        final() {},
      },
      'remote'
    );
    expect(REMOTE_RUNTIMES).toEqual(['edge']);
    expect(isEdgeTool('document')).toBe(false);
    expect(isEdgeTool('theme')).toBe(true);
  });

  it('returns identical refusals for edge operations on both doors', async () => {
    const hostile = {
      name: 'refusals',
      steps: [
        {
          label: 'unknown component',
          method: 'tools/call',
          params: { name: 'component.get', arguments: { id: 'no-such-component' } },
          toolError: (failure: Json) => expect(failure.code).toBe('not-found'),
        },
        {
          label: 'open schema',
          method: 'tools/call',
          params: { name: 'catalog.search', arguments: { query: 'card', extra: true } },
          toolError: (failure: Json) => expect(failure.code).toBe('invalid-input'),
        },
        {
          label: 'over the input cap',
          method: 'tools/call',
          params: { name: 'component.get', arguments: { id: 'a'.repeat(2000) } },
          toolError: (failure: Json) => {
            expect(failure.code).toBe('input-too-large');
            expect(failure.error).toMatch(/at most 1024/u);
          },
        },
        {
          label: 'over the item cap',
          method: 'tools/call',
          params: { name: 'catalog.search', arguments: { limit: 101 } },
          toolError: (failure: Json) => expect(failure.code).toBe('invalid-input'),
        },
      ],
      final() {},
    };
    const stdio = await runSession(hostile, 'stdio');
    const remote = await runSession(hostile, 'remote');
    expect(assertEdgeParity(hostile.name, stdio, remote)).toBe(4);
  });

  it('holds the remote envelope limits an agent can hit (body, batch) with actionable answers', async () => {
    const post = (body: string) =>
      onRequest({
        request: new Request('https://texuli.com/mcp', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'cf-connecting-ip': '192.0.2.77',
            'mcp-protocol-version': '2025-11-25',
          },
          body,
        }),
        env: {},
      });
    const tooLarge = await post(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'deck.run',
          arguments: { command: 'lint', deck: { pad: 'x'.repeat(300_000) } },
        },
      })
    );
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.headers.get('content-type')).toBe('application/problem+json');
    expect((await tooLarge.json()).detail).toMatch(/262144 bytes/u);

    const ping = (id: number) => ({ jsonrpc: '2.0', id, method: 'tools/list' });
    const batch = await post(JSON.stringify(Array.from({ length: 11 }, (_, index) => ping(index))));
    expect(batch.status).toBe(400);
    expect((await batch.json()).error.message).toMatch(/at most 10 messages/u);

    // A batch within the cap answers every message, as the single calls would.
    const ok = await post(JSON.stringify([ping(1), ping(2)]));
    expect(ok.status).toBe(200);
    const answers = await ok.json();
    expect(answers.map((answer: Json) => answer.id)).toEqual([1, 2]);
    expect(answers[0].result).toEqual(answers[1].result);
  });
});

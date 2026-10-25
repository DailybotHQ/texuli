import { describe, expect, it } from 'vitest';
import { DEMO_PROMPTS } from '../src/demo.ts';
import { issueSession } from '../src/limits.ts';
import worker from '../src/worker.ts';
import { HASH } from './helpers.ts';

describe('worker chat-to-draft path', () => {
  it('accepts a chat turn, validates it and stores its untrusted lifecycle record', async () => {
    const sessionSecret = 'fictional-worker-session-secret-0001';
    const sessionToken = await issueSession(sessionSecret, Date.now());
    const records = new Map<string, string>();
    const kv = {
      async put(key: string, value: string) {
        records.set(key, value);
      },
      async get(key: string) {
        return records.get(key) ?? null;
      },
      async list({ prefix }: { prefix: string }) {
        return {
          keys: [...records.keys()]
            .filter((name) => name.startsWith(prefix))
            .map((name) => ({ name })),
        };
      },
    };
    const response = await worker.fetch(
      new Request('https://agent.example/v1/draft', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ prompt: DEMO_PROMPTS.report, catalogHash: HASH }),
      }),
      {
        AGENT_ENABLED: '1',
        AGENT_SESSION_SECRET: sessionSecret,
        AGENT_DRAFTS: kv,
      }
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      status: string;
      envelope?: { id: string; status: string; activatedBy?: unknown };
      receipt?: { id: string; catalogHash: string };
    };
    expect(result).toMatchObject({
      status: 'valid',
      receipt: { catalogHash: HASH },
    });
    expect(result.envelope?.id).toBe(`draft-${result.receipt?.id}`);
    expect(result.envelope?.status).toBe('validated');
    expect(result.envelope?.activatedBy).toBeUndefined();
    expect(JSON.parse(records.get(result.envelope?.id ?? '') ?? 'null')).toMatchObject({
      envelope: { status: 'validated', catalog: HASH },
      validationReceipt: { ok: true, tier: 'untrusted' },
    });

    const receiptsResponse = await worker.fetch(
      new Request('https://agent.example/v1/receipts', {
        headers: { authorization: `Bearer ${sessionToken}` },
      }),
      {
        AGENT_ENABLED: '1',
        AGENT_SESSION_SECRET: sessionSecret,
        AGENT_DRAFTS: kv,
      }
    );
    expect(receiptsResponse.status).toBe(200);
    const receiptsText = await receiptsResponse.text();
    expect(receiptsText).not.toContain('ip:unknown');
    expect(receiptsText).not.toContain(DEMO_PROMPTS.report);
    expect(JSON.parse(receiptsText)).toMatchObject({
      receipts: [
        {
          id: result.receipt?.id,
          artifactKind: 'blueprint-draft',
          catalogHash: HASH,
          tiers: { providerOutput: 'untrusted', validation: 'untrusted' },
        },
      ],
    });
    const otherToken = await issueSession(sessionSecret, Date.now());
    const otherSession = await worker.fetch(
      new Request('https://agent.example/v1/receipts', {
        headers: { 'cf-connecting-ip': '203.0.113.9', authorization: `Bearer ${otherToken}` },
      }),
      { AGENT_ENABLED: '1', AGENT_SESSION_SECRET: sessionSecret, AGENT_DRAFTS: kv }
    );
    expect(await otherSession.json()).toEqual({ receipts: [] });
  });

  it('fails closed when enabled without a session signing secret', async () => {
    for (const sessionSecret of [undefined, 'short-secret']) {
      const response = await worker.fetch(
        new Request('https://agent.example/v1/draft', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: DEMO_PROMPTS.report, catalogHash: HASH }),
        }),
        { AGENT_ENABLED: '1', AGENT_SESSION_SECRET: sessionSecret }
      );

      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: 'unavailable' });
    }
  });
});

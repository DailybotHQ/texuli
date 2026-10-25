// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import AgentChat from '../../website/src/components/agent-chat/AgentChat.svelte';
import {
  agentEndpoint,
  connect,
  readEvents,
} from '../../website/src/components/agent-chat/client.ts';
import type { AgentEvent } from '../src/contract.ts';
import { DEMO_PROMPTS } from '../src/demo.ts';
import { handleRequest, sseFrame } from '../src/http.ts';
import { HASH, service } from './helpers.ts';

/**
 * The website's chat island against this service, in-process: the island's
 * fetch goes straight to the HTTP handler, so client and server are tested
 * together without a network or a key.
 */

const ENDPOINT = 'https://agent.example';
let mounted: ReturnType<typeof mount> | undefined;
afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

function wire(options: Parameters<typeof service>[0] = {}): typeof fetch {
  const s = service(options);
  return (async (input: RequestInfo | URL, init?: RequestInit) =>
    handleRequest(new Request(String(input), init), {
      service: s,
      ipOf: () => 'island',
    })) as typeof fetch;
}

async function until(check: () => boolean, ms = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
    flushSync();
  }
}

const text = () => document.body.textContent ?? '';

describe('client', () => {
  it('accepts only https endpoints (or localhost)', () => {
    expect(agentEndpoint('https://agent.example/')).toBe('https://agent.example');
    expect(agentEndpoint('http://localhost:8787')).toBe('http://localhost:8787');
    for (const bad of [
      undefined,
      '',
      'http://agent.example',
      'javascript:alert(1)',
      'https://u:p@agent.example',
    ]) {
      expect(agentEndpoint(bad), String(bad)).toBeNull();
    }
  });

  it('parses the service event stream, frame by frame, skipping unknown events', async () => {
    const events: AgentEvent[] = [
      { type: 'accepted', requestId: 'r' },
      { type: 'validating', attempt: 1 },
      { type: 'done' },
    ];
    const raw = `${events.map(sseFrame).join('')}event: x\ndata: {"type":"evil"}\n\n`;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(sink) {
        // Split mid-frame to prove the parser buffers.
        sink.enqueue(encoder.encode(raw.slice(0, 17)));
        sink.enqueue(encoder.encode(raw.slice(17)));
        sink.close();
      },
    });
    const seen = [];
    for await (const event of readEvents(body)) seen.push(event);
    expect(seen).toEqual(events);
  });

  it('refuses a disabled service and one built from another catalog', async () => {
    expect(await connect(ENDPOINT, HASH, wire({ enabled: () => false }))).toEqual({
      ok: false,
      reason: 'disabled',
    });
    expect(await connect(ENDPOINT, 'f'.repeat(64), wire())).toEqual({
      ok: false,
      reason: 'catalog-mismatch',
    });
    expect(await connect(null, HASH)).toEqual({ ok: false, reason: 'not-configured' });
    const down = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    expect(await connect(ENDPOINT, HASH, down)).toEqual({ ok: false, reason: 'offline' });
  });
});

describe('chat island', () => {
  it('shows the honest unavailable state when the site has no agent endpoint', async () => {
    mounted = mount(AgentChat, {
      target: document.body,
      props: { endpoint: null, catalogHash: HASH },
    });
    await until(() => text().includes('not running on texuli.com yet'));
    expect(document.querySelector('[data-tx-agent-unavailable="not-configured"]')).not.toBeNull();
    const presets = [
      ...document.querySelectorAll<HTMLButtonElement>('[aria-label="Example prompts"] button'),
    ];
    expect(presets).toHaveLength(3);
    expect(presets.every((b) => b.disabled)).toBe(true);
  });

  it('sends a preset, shows the agent note and paints the validated draft with its receipt', async () => {
    mounted = mount(AgentChat, {
      target: document.body,
      props: { endpoint: ENDPOINT, catalogHash: HASH, fetcher: wire() },
    });
    await until(
      () =>
        !document.querySelector<HTMLButtonElement>('[aria-label="Example prompts"] button')
          ?.disabled
    );
    document.querySelector<HTMLButtonElement>('[aria-label="Example prompts"] button')?.click();
    await until(
      () =>
        text().includes('Validation receipt') ||
        document.querySelector('dl[aria-label="Validation receipt"]') !== null
    );
    expect(text()).toContain(DEMO_PROMPTS.report);
    expect(text()).toContain('Here is a weekly report');
    const receipt = document.querySelector('dl[aria-label="Validation receipt"]');
    expect(receipt?.textContent).toContain('replay/fake');
    expect(receipt?.textContent).toMatch(/Checks passed\s*\d+ of \d+/);
    expect(document.querySelector('[aria-label="Agent draft preview"]')).not.toBeNull();
    // No HTML sink anywhere: the agent text is text.
    expect(document.querySelector('script')).toBeNull();
  });

  it('shows the turned-off state when the kill switch is on', async () => {
    mounted = mount(AgentChat, {
      target: document.body,
      props: { endpoint: ENDPOINT, catalogHash: HASH, fetcher: wire({ enabled: () => false }) },
    });
    await until(() => text().includes('turned off right now'));
    expect(document.querySelector('[data-tx-agent-unavailable="disabled"]')).not.toBeNull();
  });
});

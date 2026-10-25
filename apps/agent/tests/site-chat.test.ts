// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import AgentChat from '../../website/src/components/agent-chat/AgentChat.svelte';
import type { AgentStreamEvent } from '../../website/src/components/agent-chat/client.ts';
import {
  applyStreamEvent,
  draftLifecycle,
  envelopeStatus,
  type StreamStep,
} from '../../website/src/components/agent-chat/lifecycle.ts';
import { agentConnectSources, pagePolicy } from '../../website/src/components/security/csp.ts';
import { DEMO_PROMPTS, DEMO_RECORDINGS } from '../src/demo.ts';
import { handleRequest } from '../src/http.ts';
import type { Recording } from '../src/provider.ts';
import { HASH, service, toolCall } from './helpers.ts';

/*
 * Task 93: the texuli.com chat surface. The island runs in-process against
 * the agent service with the replay provider (no network, no key), so the
 * streamed steps and the draft lifecycle are tested end to end.
 */

const ENDPOINT = 'http://localhost:8787';
let mounted: ReturnType<typeof mount> | undefined;
afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

function wire(recordings: readonly Recording[] = DEMO_RECORDINGS): typeof fetch {
  const s = service({ recordings });
  return (async (input: RequestInfo | URL, init?: RequestInit) =>
    handleRequest(new Request(String(input), init), {
      service: s,
      ipOf: () => 'site',
    })) as typeof fetch;
}

async function until(check: () => boolean, ms = 4000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
    flushSync();
  }
}

const steps = () =>
  [...document.querySelectorAll('[data-tx-agent-steps] li')].map((li) => [
    li.querySelector('span:nth-child(2)')?.textContent?.trim(),
    li.getAttribute('data-state'),
  ]);
const lifecycle = () =>
  Object.fromEntries(
    [...document.querySelectorAll('[data-tx-agent-lifecycle] li')].map((li) => [
      li.getAttribute('data-stage'),
      li.getAttribute('data-state'),
    ])
  );

async function sendReport(fetcher: typeof fetch) {
  mounted = mount(AgentChat, {
    target: document.body,
    props: { endpoint: ENDPOINT, catalogHash: HASH, fetcher },
  });
  const preset = () =>
    document.querySelector<HTMLButtonElement>('[aria-label="Example prompts"] button');
  await until(() => preset()?.disabled === false);
  preset()?.click();
}

describe('stream steps and lifecycle (pure)', () => {
  it('folds streamed events into ordered steps, settling earlier ones', () => {
    const events: AgentStreamEvent[] = [
      { type: 'accepted', requestId: 'r' },
      { type: 'generating', text: 'a' },
      { type: 'generating', text: 'b' },
      { type: 'validating', attempt: 1 },
      { type: 'repairing', attempt: 1, codes: ['tier-denied'] },
      { type: 'validating', attempt: 2 },
      { type: 'done' },
    ];
    const folded = events.reduce<StreamStep[]>(applyStreamEvent, []);
    expect(folded.map((step) => [step.key, step.state])).toEqual([
      ['accepted', 'done'],
      ['generating', 'done'],
      ['validating-1', 'failed'],
      ['repairing-1', 'done'],
      ['validating-2', 'done'],
    ]);
  });

  it('never moves the lifecycle past "draft" and stops where a request failed', () => {
    expect(draftLifecycle({ phase: 'idle' }).every((step) => step.state === 'upcoming')).toBe(true);
    expect(draftLifecycle({ phase: 'working', drafted: true }).map((s) => s.state)).toEqual([
      'done',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(draftLifecycle({ phase: 'error', message: 'x' }).map((s) => s.state)).toEqual([
      'done',
      'failed',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(envelopeStatus(null)).toBeNull();
    expect(envelopeStatus({ envelope: { status: '<b>active</b>' } } as never)).toBeNull();
  });
});

describe('site CSP for the agent chat page', () => {
  it('adds the configured agent origin to connect-src on the agent page only', () => {
    const page = '<div data-tx-agent-page></div>';
    expect(agentConnectSources(page, 'http://localhost:8787/')).toEqual(['http://localhost:8787']);
    expect(agentConnectSources('<main></main>', 'http://localhost:8787')).toEqual([]);
    expect(agentConnectSources(page, undefined)).toEqual([]);
    expect(agentConnectSources(page, 'http://agent.example')).toEqual([]);
    expect(pagePolicy(page, { connect: ['http://localhost:8787'] })).toContain(
      "connect-src 'self' http://localhost:8787;"
    );
    // A production build (no endpoint) keeps the strict default.
    expect(pagePolicy(page)).toContain("connect-src 'self';");
  });
});

describe('chat island against the local agent service', () => {
  it('shows the honest not-deployed status without an endpoint', async () => {
    mounted = mount(AgentChat, {
      target: document.body,
      props: { endpoint: null, catalogHash: HASH },
    });
    await until(() => document.querySelector('[data-tx-agent-unavailable]') !== null);
    const status = document.querySelector('[data-tx-agent-deployment]');
    expect(status?.getAttribute('data-tx-agent-deployment')).toBe('not-deployed');
    expect(status?.textContent).toContain('texuli.com does not run the agent service');
    expect(Object.values(lifecycle())).toEqual(Array(5).fill('upcoming'));
    expect(document.querySelector('[data-tx-agent-steps]')).toBeNull();
  });

  it('streams the steps and walks the lifecycle to an unactivated, validated draft', async () => {
    await sendReport(wire());
    await until(() => lifecycle().draft === 'done');
    expect(
      document.querySelector('[data-tx-agent-deployment]')?.getAttribute('data-tx-agent-deployment')
    ).toBe('connected');
    expect(steps()).toEqual([
      ['Request accepted', 'done'],
      ['Writing the draft', 'done'],
      ['Validating the draft', 'done'],
      ['Draft validated by the service', 'done'],
    ]);
    expect(lifecycle()).toEqual({
      requested: 'done',
      drafted: 'done',
      validated: 'done',
      checked: 'done',
      draft: 'done',
    });
    const receipt =
      document.querySelector('dl[aria-label="Validation receipt"]')?.textContent ?? '';
    expect(receipt).toContain('replay/fake');
    expect(receipt).toMatch(/Envelope\s*validated/);
    expect(document.body.textContent).not.toMatch(/\bactivated by\b/i);
  });

  it('shows a repair step when the first draft fails validation', async () => {
    const report = DEMO_RECORDINGS.find((recording) => recording.prompt === DEMO_PROMPTS.report);
    if (!report) throw new Error('missing report recording');
    const repaired: Recording = {
      prompt: DEMO_PROMPTS.report,
      calls: [[toolCall({ id: 'dialog', props: { title: 'Nope' } })], ...report.calls],
    };
    await sendReport(wire([repaired]));
    await until(() => lifecycle().draft === 'done');
    const labels = steps().map(([label, state]) => `${label}:${state}`);
    expect(labels).toContain('Validating the draft:failed');
    expect(labels.some((label) => label.startsWith('Repairing tier-denied'))).toBe(true);
    expect(labels).toContain('Validating the repaired draft (attempt 2):done');
  });

  it('shows the rejection and stops the lifecycle at validation when every attempt fails', async () => {
    const bad: Recording = {
      prompt: DEMO_PROMPTS.report,
      calls: [[toolCall({ id: 'dialog', props: { title: 'Nope' } })]],
    };
    await sendReport(wire([bad]));
    await until(() => document.querySelector('[data-tx-agent-rejected]') !== null);
    expect(document.querySelector('[data-tx-agent-rejected]')?.textContent).toContain(
      'tier-denied'
    );
    expect(lifecycle()).toMatchObject({
      validated: 'failed',
      checked: 'upcoming',
      draft: 'upcoming',
    });
    expect(steps().at(-1)).toEqual(['The service rejected the draft', 'failed']);
    expect(document.querySelector('[aria-label="Agent draft preview"]')).toBeNull();
  });
});

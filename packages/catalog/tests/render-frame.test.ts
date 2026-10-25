// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import {
  artifactChrome,
  confirmIntent,
  createArtifactFrame,
  MAX_INTENT_STRING_LENGTH,
  MAX_INTENT_SUMMARY_LENGTH,
  pendingIntents,
  proposeIntent,
  rejectIntent,
  resetArtifactFrameIds,
  sanitizeIntentPayload,
  scrubDisplayText,
} from '../src/render/frame/index.ts';
import { type RenderComponentSpec, renderCatalogFromSpecs } from '../src/render/renderer/index.ts';

const card: RenderComponentSpec = {
  id: 'card',
  label: 'Card',
  agentEmittable: true,
  emit: ['developer', 'untrusted'],
  props: [
    {
      name: 'variant',
      kind: 'enum',
      enumValues: ['elevated', 'flat'],
      default: 'elevated',
    },
    { name: 'title', kind: 'string' },
  ],
};

const dialog: RenderComponentSpec = {
  id: 'dialog',
  label: 'Dialog',
  agentEmittable: false,
  emit: ['developer'],
  props: [{ name: 'title', kind: 'string', required: true }],
};

const catalog = renderCatalogFromSpecs([card, dialog]);

afterEach(() => {
  resetArtifactFrameIds();
});

describe('createArtifactFrame', () => {
  it('requires a plain non-empty label and always sets visible chrome', () => {
    const empty = createArtifactFrame({ label: '   ', catalog, tree: [] });
    expect(empty.label).toBe('');
    expect(empty.roots).toEqual([]);
    expect(empty.diagnostics.some((d) => d.code === 'missing-label')).toBe(true);
    expect(empty.requiresVisibleChrome).toBe(true);
    expect(artifactChrome(empty).ok).toBe(false);

    const html = createArtifactFrame({
      label: '<script>x</script>',
      catalog,
      tree: [],
    });
    expect(html.diagnostics.some((d) => d.code === 'html-label')).toBe(true);
    expect(html.roots).toEqual([]);

    const ok = createArtifactFrame({
      label: '  Assistant reply  ',
      source: 'demo-model',
      catalog,
      tree: {
        id: 'card',
        props: { variant: 'elevated', title: 'Hello', class: 'evil' },
      },
    });
    expect(ok.label).toBe('Assistant reply');
    expect(ok.source).toBe('demo-model');
    expect(ok.badge).toBe('Untrusted content');
    expect(ok.requiresVisibleChrome).toBe(true);
    expect(artifactChrome(ok).ok).toBe(true);
    expect(ok.roots).toHaveLength(1);
    expect(ok.roots[0]).toMatchObject({
      kind: 'component',
      id: 'card',
      props: { variant: 'elevated', title: 'Hello' },
    });
    // class stripped by renderer
    expect((ok.roots[0] as { props: Record<string, unknown> }).props.class).toBeUndefined();
  });

  it('defaults to untrusted tier and blocks non-emittable overlays', () => {
    const frame = createArtifactFrame({
      label: 'Reply',
      catalog,
      tree: { id: 'dialog', props: { title: 'Nope' } },
    });
    expect(frame.roots[0]).toMatchObject({
      kind: 'placeholder',
      reason: 'tier-denied',
    });
  });

  it('requires allowDeveloperTier for developer tier', () => {
    const denied = createArtifactFrame({
      label: 'Dev',
      catalog,
      tier: 'developer',
      tree: { id: 'dialog', props: { title: 'Host only' } },
    });
    expect(denied.diagnostics.some((d) => d.path === 'frame.tier')).toBe(true);
    expect(denied.roots[0]).toMatchObject({ kind: 'placeholder' });

    const allowed = createArtifactFrame({
      label: 'Dev',
      catalog,
      tier: 'developer',
      allowDeveloperTier: true,
      tree: { id: 'dialog', props: { title: 'Host only' } },
    });
    expect(allowed.roots[0]).toMatchObject({ kind: 'component', id: 'dialog' });
  });
});

describe('sanitizeIntentPayload / proposeIntent', () => {
  it('refuses HTML, functions, and style/class keys in payloads', () => {
    expect(sanitizeIntentPayload({ text: '<b>x</b>' }).ok).toBe(false);
    expect(sanitizeIntentPayload({ class: 'x' }).ok).toBe(false);
    expect(sanitizeIntentPayload({ fn: () => undefined } as never).ok).toBe(false);
    expect(sanitizeIntentPayload({ href: 'https://example.com' }, 'navigate').ok).toBe(true);
  });

  it('refuses unsafe navigate/media URLs before they become pending intents', () => {
    const frame = createArtifactFrame({ label: 'Reply', catalog, tree: [] });

    const attacks: {
      kind: 'navigate' | 'activate' | 'custom';
      payload: Record<string, unknown>;
    }[] = [
      { kind: 'navigate', payload: { href: 'javascript:alert(1)' } },
      { kind: 'navigate', payload: { href: 'JaVaScRiPt:alert(1)' } },
      { kind: 'navigate', payload: { href: '  javascript:alert(1)' } },
      { kind: 'navigate', payload: { href: 'data:text/html,<b>x</b>' } },
      { kind: 'navigate', payload: { href: 'vbscript:msgbox(1)' } },
      { kind: 'navigate', payload: { href: 'java\tscript:alert(1)' } },
      // Bidi override smuggled into the scheme region
      { kind: 'navigate', payload: { href: 'java\u202Escript:alert(1)' } },
      { kind: 'activate', payload: { src: 'javascript:alert(1)' } },
      { kind: 'custom', payload: { url: 'data:text/html,hi' } },
    ];

    for (const attack of attacks) {
      const result = proposeIntent(frame, {
        kind: attack.kind,
        path: '0',
        payload: attack.payload,
      });
      expect(result.ok, JSON.stringify(attack.payload)).toBe(false);
      if (result.ok) throw new Error('expected failure');
      expect(result.reason).toBe('unsafe-url');
      // Never echo the attack string into the reason message or frame intents.
      expect(result.message).not.toMatch(/javascript:|vbscript:|data:text/i);
      expect(JSON.stringify(result.frame.intents)).not.toMatch(/javascript:|vbscript:/i);
      expect(pendingIntents(result.frame)).toHaveLength(0);
    }

    // Explicit unsafe-url cases with reason check
    for (const href of [
      'javascript:alert(1)',
      ' JaVaScRiPt:alert(1)',
      'data:text/html,<h1>x</h1>',
      'vbscript:msgbox(1)',
      '\u202Ejavascript:alert(1)',
    ]) {
      const result = proposeIntent(frame, {
        kind: 'navigate',
        path: '0',
        payload: { href },
        summary: `Open ${href}`,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('unsafe-url');
        expect(JSON.stringify(result)).not.toContain('javascript:');
      }
      expect(pendingIntents(frame)).toHaveLength(0);
    }

    // Over-long URL-bearing fields are refused (never truncated to a different destination).
    const longHref = `https://example.com/${'a'.repeat(MAX_INTENT_STRING_LENGTH + 100)}`;
    const long = proposeIntent(frame, {
      kind: 'navigate',
      path: '0',
      payload: { href: longHref },
    });
    expect(long.ok).toBe(false);
    if (!long.ok) {
      expect(long.reason).toBe('unsafe-url');
      expect(long.message).not.toMatch(/https:\/\/example\.com/);
    }
    expect(pendingIntents(long.frame)).toHaveLength(0);
    expect(pendingIntents(frame)).toHaveLength(0);
  });

  it('scrubs bidi and control characters from summaries and caps length', () => {
    const frame = createArtifactFrame({ label: 'Reply', catalog, tree: [] });
    const bidi = proposeIntent(frame, {
      kind: 'copy',
      path: '0',
      summary: `Copy\u202E\u0000 text ${'x'.repeat(500)}`,
      payload: { text: 'ok' },
    });
    expect(bidi.ok).toBe(true);
    if (bidi.ok) {
      expect(bidi.intent.summary.includes('\u202e')).toBe(false);
      expect(bidi.intent.summary.includes('\u0000')).toBe(false);
      expect(bidi.intent.summary.length).toBeLessThanOrEqual(MAX_INTENT_SUMMARY_LENGTH);
    }
    expect(scrubDisplayText('a\u202Eb', 10)).toBe('ab');
  });

  it('queues pending intents and settles only once', () => {
    let frame = createArtifactFrame({
      label: 'Reply',
      catalog,
      tree: { id: 'card', props: { title: 'Go' } },
    });

    const bad = proposeIntent(frame, {
      kind: 'navigate',
      path: '',
      payload: { href: 'https://example.com' },
    });
    expect(bad.ok).toBe(false);

    const denied = proposeIntent(
      frame,
      { kind: 'navigate', path: '0', payload: { href: 'https://example.com' } },
      { allowIntentKinds: ['copy'] }
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe('intent-kind-denied');

    const proposed = proposeIntent(frame, {
      kind: 'navigate',
      path: '0',
      componentId: 'card',
      payload: { href: 'https://example.com/docs' },
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) throw new Error('expected ok');
    frame = proposed.frame;
    expect(pendingIntents(frame)).toHaveLength(1);
    expect(proposed.intent.status).toBe('pending');
    expect(proposed.intent.summary).toMatch(/Open https:\/\/example.com\/docs/);

    const confirmed = confirmIntent(frame, proposed.intent.id);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) throw new Error('expected ok');
    expect(confirmed.intent.status).toBe('confirmed');
    frame = confirmed.frame;
    expect(pendingIntents(frame)).toHaveLength(0);

    const again = confirmIntent(frame, proposed.intent.id);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe('intent-not-pending');

    const unknown = rejectIntent(frame, 'intent-missing');
    expect(unknown.ok).toBe(false);
  });

  it('rejects intents with HTML summaries or payloads', () => {
    const frame = createArtifactFrame({ label: 'Reply', catalog, tree: [] });
    const htmlSummary = proposeIntent(frame, {
      kind: 'custom',
      path: '0',
      summary: '<img src=x>',
      payload: { name: 'x' },
    });
    expect(htmlSummary.ok).toBe(false);

    const htmlPayload = proposeIntent(frame, {
      kind: 'copy',
      path: '0',
      payload: { text: '<script>' },
    });
    expect(htmlPayload.ok).toBe(false);
  });
});

describe('artifact frame contract', () => {
  it('never executes navigation — confirmed intent stays data-only', () => {
    const frame = createArtifactFrame({
      label: 'Reply',
      badge: 'Agent output',
      catalog,
      tree: { id: 'card', props: { title: 'Link card' } },
    });
    const proposed = proposeIntent(frame, {
      kind: 'navigate',
      path: '0',
      payload: { href: 'https://example.com' },
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) throw new Error('expected ok');
    const settled = confirmIntent(proposed.frame, proposed.intent.id);
    expect(settled.ok).toBe(true);
    if (!settled.ok) throw new Error('expected ok');
    // No location mutation API exists on the frame — host must read payload.
    expect(settled.intent.payload).toEqual({ href: 'https://example.com' });
    expect(settled.frame.requiresVisibleChrome).toBe(true);
    expect(settled.frame.badge).toBe('Agent output');
  });
});

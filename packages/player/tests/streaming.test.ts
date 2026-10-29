import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createBlueprintStream } from '@texuli/spec/stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Player from '../src/Player.svelte';

/**
 * `<Player stream>` (ADR-014): validated nodes paint as they arrive under
 * an accessible busy state, the tree stays inert and disarmed until the
 * complete draft passes `validateDraft`, the final paint equals the
 * non-streamed one, an interruption keeps the painted nodes with a
 * recoverable error, and a refused final draft replaces the painted prefix
 * with the refusal notice.
 */

const SPEC = join(import.meta.dirname, '../../spec/fixtures');
const golden = (name: string) => readFileSync(join(SPEC, 'golden', `${name}.json`), 'utf8');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const surfaceOf = (container: HTMLElement) =>
  container.querySelector('[data-tx-player-surface]') as HTMLElement | null;
const rootOf = (container: HTMLElement) =>
  container.querySelector('[data-tx-player]') as HTMLElement;
const politeOf = (container: HTMLElement) =>
  container.querySelector('[data-tx-player-announcer]')?.textContent?.trim() ?? '';

/** The surface markup without generated ids, so two players compare equal. */
function normalized(container: HTMLElement): string {
  const surface = surfaceOf(container);
  if (!surface) return '';
  return surface.innerHTML
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /\s(id|for|aria-labelledby|aria-describedby|aria-controls|aria-owns|aria-activedescendant|href|name|data-tx-player-anchor-for)="[^"]*"/g,
      ' $1=""'
    )
    .replace(/url\(#[^)]*\)/g, 'url(#)');
}

async function settled(container: HTMLElement) {
  await expect
    .poll(() => container.querySelector('[data-tx-player-skeleton]'), { timeout: 20_000 })
    .toBeNull();
}

describe('<Player stream>', () => {
  it('paints validated nodes progressively, busy and inert, then arms and matches the whole paint', {
    timeout: 60_000,
  }, async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const text = golden('report-on-demand');
    const stream = createBlueprintStream();
    const progress = vi.fn();
    const diagnostics = vi.fn();
    const { container } = render(Player, {
      props: { stream, label: 'Golden', onStreamProgress: progress, onDiagnostics: diagnostics },
    });
    // Before anything arrives: one busy skeleton, the streaming status, the start announcement.
    await waitFor(() => expect(rootOf(container).dataset.status).toBe('streaming'));
    expect(screen.getByText('Generating')).toBeTruthy();
    stream.write(text.slice(0, Math.floor(text.length * 0.55)));
    expect(
      await screen.findByRole('heading', { name: 'Summary' }, { timeout: 20_000 })
    ).toBeTruthy();
    const surface = surfaceOf(container) as HTMLElement;
    expect(surface.getAttribute('aria-busy')).toBe('true');
    expect(surface.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('[data-tx-player-stream-node="pending"]')).not.toBeNull();
    expect(politeOf(container)).toBe('Generating content.');
    // Progress is announced on a slow schedule, never once per node.
    vi.advanceTimersByTime(4000);
    await waitFor(() => expect(politeOf(container)).toMatch(/^\d+ parts shown so far\.$/));
    // Partial drafts report no diagnostics: the verdict comes at the end.
    expect(diagnostics).not.toHaveBeenCalled();
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'streaming' }));

    stream.write(text.slice(Math.floor(text.length * 0.55)));
    stream.end();
    await waitFor(() => expect(rootOf(container).dataset.status).toBe('draft'), {
      timeout: 20_000,
    });
    await settled(container);
    expect(surfaceOf(container)?.hasAttribute('aria-busy')).toBe(false);
    expect(surfaceOf(container)?.hasAttribute('inert')).toBe(false);
    expect(container.querySelector('[data-tx-player-stream-node]')).toBeNull();
    expect(progress).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: 'complete', held: 0 })
    );
    await waitFor(() => expect(diagnostics).toHaveBeenCalled());
    expect(diagnostics.mock.lastCall?.[0]).toMatchObject({ status: 'draft', diagnostics: [] });
    await waitFor(() => expect(politeOf(container)).toMatch(/^Content ready/));

    // The final paint is the paint of the same blueprint passed whole.
    const whole = render(Player, { props: { blueprint: JSON.parse(text), label: 'Golden' } });
    await settled(whole.container);
    await waitFor(() => expect(normalized(container)).toBe(normalized(whole.container)));
    expect(normalized(container).length).toBeGreaterThan(1000);
  });

  it('keeps actions disarmed until the draft is complete, and recovers from an interruption', {
    timeout: 60_000,
  }, async () => {
    const text = golden('app-dashboard');
    const onAction = vi.fn((_intent: unknown) => 'confirmed' as const);
    const onStateChange = vi.fn();
    const onStreamRetry = vi.fn();
    const first = createBlueprintStream();
    const { container, rerender } = render(Player, {
      props: { stream: first, label: 'Golden', onAction, onStateChange, onStreamRetry },
    });
    first.write(text.slice(0, text.length - 40));
    const toggle = await screen.findByRole(
      'switch',
      { name: 'Renewals only' },
      { timeout: 20_000 }
    );
    first.abort('The fictional agent stopped.');
    // Interrupted: the painted nodes stay, marked incomplete, with a recoverable error.
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Generation stopped/);
    expect(alert.getAttribute('data-tx-player-stream-error')).toBe('aborted');
    expect(rootOf(container).dataset.status).toBe('interrupted');
    expect(screen.getByRole('switch', { name: 'Renewals only' })).toBe(toggle);
    // Not inert (the content stays readable), but nothing is armed.
    expect(surfaceOf(container)?.hasAttribute('inert')).toBe(false);
    expect(surfaceOf(container)?.hasAttribute('aria-busy')).toBe(false);
    await fireEvent.click(toggle);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onAction).not.toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onStreamRetry).toHaveBeenCalledTimes(1);

    // A retry is a new stream: the old paint stays until the new one paints, then it completes.
    const retry = createBlueprintStream();
    await rerender({ stream: retry, label: 'Golden', onAction, onStateChange, onStreamRetry });
    await waitFor(() => expect(rootOf(container).dataset.status).toBe('streaming'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('switch', { name: 'Renewals only' })).toBeTruthy();
    retry.write(text);
    retry.end();
    await waitFor(() => expect(rootOf(container).dataset.status).toBe('draft'), {
      timeout: 20_000,
    });
    await settled(container);
    await fireEvent.click(screen.getByRole('switch', { name: 'Renewals only' }));
    await waitFor(() => expect(onAction).toHaveBeenCalled());
    expect(onAction.mock.calls[0]?.[0]).toMatchObject({ action: 'filter-accounts' });
  });

  it('replaces the painted prefix with the refusal notice when the final draft is refused', {
    timeout: 60_000,
  }, async () => {
    const fixture = JSON.parse(readFileSync(join(SPEC, 'invalid', 'unknown-prop.json'), 'utf8'));
    const text = JSON.stringify(fixture.blueprint);
    const stream = createBlueprintStream();
    const { container } = render(Player, { props: { stream, label: 'Golden' } });
    // The root's own props are refused: the shell never paints, its child waits with it.
    stream.write(text.slice(0, text.lastIndexOf('}') - 2));
    await waitFor(() => expect(rootOf(container).dataset.status).toBe('streaming'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByText('Shipped on time.')).toBeNull();
    stream.write(text.slice(text.lastIndexOf('}') - 2));
    stream.end();
    const notice = await screen.findByRole('alert', {}, { timeout: 20_000 });
    expect(notice.textContent).toMatch(/could not be validated/);
    expect(rootOf(container).dataset.status).toBe('invalid');
    expect(surfaceOf(container)).toBeNull();
  });

  it('holds a node whose member arrives after children, then judges the whole draft', {
    timeout: 60_000,
  }, async () => {
    const tree = {
      id: 'layout-doc',
      props: { title: 'Fictional week' },
      children: [
        {
          id: 'layout-card',
          children: [{ id: 'blocks-text', props: { block: { type: 'text', markdown: 'Held.' } } }],
          props: { title: 'Late props' },
        },
      ],
    };
    const text = JSON.stringify(tree);
    const stream = createBlueprintStream();
    const { container } = render(Player, { props: { stream, label: 'Golden' } });
    stream.write(text.slice(0, -2));
    await waitFor(() =>
      expect(container.querySelector('[data-tx-player-stream-node="held"]')).not.toBeNull()
    );
    expect(screen.getByText('Waiting for the complete draft.')).toBeTruthy();
    expect(screen.queryByText('Held.')).toBeNull();
    stream.write(text.slice(-2));
    stream.end();
    // The order is a streaming rule, not a schema rule: the whole draft is valid and paints.
    await waitFor(() => expect(rootOf(container).dataset.status).toBe('draft'), {
      timeout: 20_000,
    });
    expect(await screen.findByText('Held.', {}, { timeout: 20_000 })).toBeTruthy();
  });
});

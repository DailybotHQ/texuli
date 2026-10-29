/**
 * /live-generation/ (PLAN_010 T-site-070): honest copy, no network and no
 * HTML sinks, a lazy island that loads the player only on Start, recorded
 * drafts that are valid blueprints (and one refused at exactly its foreign
 * node), chunks that rejoin to the recorded text, and the replay stream:
 * play, pause, one step, a speed read before every chunk, a scheduled drop
 * and an interrupt that the reader sees as an error.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LIVE_DOCS,
  LIVE_STEPS,
  STREAMING_RELEASE,
} from '../src/components/live-generation/page.ts';
import {
  CHUNK_PATTERN,
  chunk,
  delayFor,
  SCENARIOS,
  SPEEDS,
  scenario,
} from '../src/components/live-generation/recording.ts';
import { DROPPED_MESSAGE, Replay } from '../src/components/live-generation/replay.ts';
import { checkBlueprintText } from '../src/components/workflows-site/json/validate.ts';

const read = (path: string) => readFileSync(resolve('apps/website/src', path), 'utf8');
const PAGE = read('pages/live-generation/index.astro');
const SOURCES = [
  'components/live-generation/LiveGeneration.svelte',
  'components/live-generation/page.ts',
  'components/live-generation/recording.ts',
  'components/live-generation/replay.ts',
  'pages/live-generation/index.astro',
].map((path) => [path, read(path)] as const);

/** A manual clock: `flush()` runs the pending timer, recording each delay asked for. */
function manualClock() {
  let pending: (() => void) | null = null;
  const delays: number[] = [];
  return {
    delays,
    schedule: (run: () => void, ms: number) => {
      delays.push(ms);
      pending = run;
      return run;
    },
    cancel: () => {
      pending = null;
    },
    flush() {
      const run = pending;
      pending = null;
      run?.();
    },
    get pending() {
      return pending !== null;
    },
  };
}

async function drain(replay: Replay): Promise<{ text: string; error: string | null }> {
  let text = '';
  try {
    for await (const piece of replay) text += piece;
    return { text, error: null };
  } catch (error) {
    return { text, error: (error as Error).message };
  }
}

describe('live generation page: copy and safety', () => {
  it('states what runs: a replay in the browser, the player on npm from 0.6.0, the agent service not deployed', () => {
    expect(STREAMING_RELEASE).toBe('0.6.0');
    const copy = PAGE.replace(/\s+/g, ' ');
    expect(copy).toContain('streaming mode · in development · on npm from {STREAMING_RELEASE}');
    expect(copy).toContain('no network request, no model and no key');
    expect(copy).toContain(
      'The agent service that streams real drafts is in the repository and is not deployed'
    );
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(/\{@html|set:html|innerHTML|production[- ]ready/i);
      expect(source, path).not.toMatch(/\bfetch\(|XMLHttpRequest|EventSource|WebSocket/);
      for (const [url] of source.matchAll(/https?:\/\/[^\s'"`)\\]+/g)) {
        expect(new URL(url).hostname, `${path}: ${url}`).toMatch(/(^|\.)example\.com$/);
      }
    }
  });

  it('mounts one island with client:visible that loads the player only when asked', () => {
    const islands = [...PAGE.matchAll(/<([A-Z]\w+) client:(\w+)/g)];
    expect(islands.map(([, name, directive]) => `${name} ${directive}`)).toEqual([
      'LiveGeneration visible',
    ]);
    const island = read('components/live-generation/LiveGeneration.svelte');
    expect(island).not.toMatch(/^import\s+(?!type\b)[^;]*from\s+'@texuli\/player'/m);
    expect(island).toContain("await import('@texuli/player')");
    // Reduced motion reaches the player.
    expect(island).toContain("motion={reduced ? 'reduce' : 'auto'}");
    expect(PAGE.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(LIVE_STEPS).toHaveLength(5);
    expect(LIVE_DOCS.map((doc) => doc.path)).toContain('packages/player/docs/streaming.md');
  });
});

describe('live generation page: recorded drafts', () => {
  it('cuts every draft into chunks that rejoin exactly, by the fixed pattern', () => {
    for (const entry of SCENARIOS) {
      const pieces = chunk(entry.text);
      expect(pieces.join('')).toBe(entry.text);
      expect(pieces.length).toBeGreaterThan(100);
      pieces.slice(0, CHUNK_PATTERN.length).forEach((piece, index) => {
        expect(piece.length).toBe(CHUNK_PATTERN[index]);
      });
    }
    expect(chunk('')).toEqual([]);
  });

  it('records a valid weekly report, and refuses the second draft at exactly its foreign node', () => {
    const report = checkBlueprintText(scenario('report').text);
    expect(report.diagnostics.filter((entry) => entry.severity === 'error')).toEqual([]);
    expect(report.ok).toBe(true);
    expect(scenario('interrupted').text).toBe(scenario('report').text);
    expect(scenario('interrupted').dropAt).toBeGreaterThan(0);
    const refused = checkBlueprintText(scenario('refused').text);
    expect(refused.ok).toBe(false);
    const errors = refused.diagnostics.filter((entry) => entry.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) expect(error.path).toMatch(/^\$\.tree\.children\[3\]/);
    expect(errors.map((entry) => entry.code)).toContain('unknown-id');
    // Streamed nodes put children last.
    const tree = (JSON.parse(scenario('report').text) as { tree: object }).tree;
    expect(Object.keys(tree).at(-1)).toBe('children');
  });

  it('offers three speeds, slowest first', () => {
    expect(SPEEDS.map((speed) => speed.id)).toEqual(['slow', 'normal', 'fast']);
    expect(delayFor('slow')).toBeGreaterThan(delayFor('normal'));
    expect(delayFor('normal')).toBeGreaterThan(delayFor('fast'));
  });
});

describe('live generation page: the replay stream', () => {
  it('plays every chunk in order, reading the speed before each one', async () => {
    const clock = manualClock();
    let delay = 90;
    const replay = new Replay(['a', 'b', 'c'], {
      delay: () => delay,
      schedule: clock.schedule,
      cancel: clock.cancel,
    });
    const reading = drain(replay);
    expect(replay.state).toBe('idle');
    replay.play();
    expect(replay.state).toBe('playing');
    clock.flush();
    delay = 8;
    clock.flush();
    clock.flush();
    expect(await reading).toEqual({ text: 'abc', error: null });
    expect(replay.state).toBe('done');
    expect(clock.delays.slice(0, 2)).toEqual([90, 90]);
    expect(clock.delays[2]).toBe(8);
    // A replay is read once.
    await expect(drain(replay)).resolves.toEqual({
      text: '',
      error: 'A replay is read once; start a new one.',
    });
  });

  it('pauses, steps one chunk at a time and resumes', async () => {
    const clock = manualClock();
    const changes: string[] = [];
    const replay = new Replay(['1', '2', '3', '4'], {
      delay: () => 30,
      schedule: clock.schedule,
      cancel: clock.cancel,
      onChange: (r) => changes.push(`${r.state}:${r.sent}`),
    });
    const reading = drain(replay);
    replay.play();
    clock.flush();
    replay.pause();
    expect(clock.pending).toBe(false);
    expect(replay.sent).toBe(1);
    replay.step();
    expect(replay.sent).toBe(2);
    expect(replay.state).toBe('paused');
    replay.play();
    clock.flush();
    clock.flush();
    expect(await reading).toEqual({ text: '1234', error: null });
    expect(changes.at(-1)).toBe('done:4');
  });

  it('drops the connection at the scheduled share, and the reader sees the error after what was sent', async () => {
    const clock = manualClock();
    const pieces = chunk(scenario('interrupted').text);
    const replay = new Replay(pieces, {
      delay: () => 1,
      dropAt: scenario('interrupted').dropAt,
      schedule: clock.schedule,
      cancel: clock.cancel,
    });
    const reading = drain(replay);
    replay.play();
    while (clock.pending) clock.flush();
    const result = await reading;
    expect(result.error).toBe(DROPPED_MESSAGE);
    expect(replay.state).toBe('interrupted');
    expect(replay.sent).toBe(Math.floor(pieces.length * (scenario('interrupted').dropAt ?? 0)));
    expect(result.text).toBe(pieces.slice(0, replay.sent).join(''));
  });

  it('stops on interrupt with the given message, and ignores controls afterwards', async () => {
    const clock = manualClock();
    const replay = new Replay(['x', 'y', 'z'], {
      delay: () => 1,
      schedule: clock.schedule,
      cancel: clock.cancel,
    });
    const reading = drain(replay);
    replay.step();
    replay.interrupt('You dropped the connection.');
    replay.play();
    replay.step();
    expect(await reading).toEqual({ text: 'x', error: 'You dropped the connection.' });
    expect(replay.sent).toBe(1);
  });
});

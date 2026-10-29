import '@texuli/tokens/base.css';
import { mountPlayer, type PlayerStreamProgress } from '@texuli/player';
import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';
// `@texuli/spec` is not a fixture-app dependency: the push handle by path.
import {
  type BlueprintStreamHandle,
  createBlueprintStream,
} from '../../../../packages/spec/src/stream/index.ts';
import '@texuli/player/styles.css';

/*
 * tests/e2e/player-streaming.spec.ts: one spec golden (`?fixture=<name>`,
 * default report-on-demand) streamed into `<Player stream>` in chunks of
 * `?chunk=<n>` characters (default 97) that the spec writes one step at a
 * time through `window.txStreaming`; `mountWhole()` paints the same golden
 * whole next to it.
 * `?mode=dark` paints the dark theme.
 */

const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'dark' ? 'dark' : 'light';
applyTheme(document.documentElement, {
  theme: await loadLibraryTheme('enterprise-neutral'),
  mode,
});

const goldens = import.meta.glob<string>('../../../../packages/spec/fixtures/golden/*.json', {
  query: '?raw',
  import: 'default',
});
const name = params.get('fixture') ?? 'report-on-demand';
const load = goldens[`../../../../packages/spec/fixtures/golden/${name}.json`];
if (!load) throw new Error(`no golden ${name}`);
const text = await load();
const size = Math.max(1, Number(params.get('chunk') ?? 97) || 97);
const chunks: string[] = [];
for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));

const status = document.getElementById('streaming-status');
const progress: PlayerStreamProgress[] = [];
let handle: BlueprintStreamHandle = createBlueprintStream();
let next = 0;
let retries = 0;

const streamed = mountPlayer(document.querySelector('[data-streaming="stream"]') as Element, {
  stream: handle,
  label: 'Streamed report',
  // The page has its own main landmark.
  landmarks: false,
  onStreamProgress: (event: PlayerStreamProgress) => {
    progress.push(event);
  },
  onStreamRetry: () => {
    retries += 1;
  },
});
// The same golden painted whole, mounted on demand (two players would repeat landmarks).
const mountWhole = () =>
  mountPlayer(document.querySelector('[data-streaming="whole"]') as Element, {
    blueprint: JSON.parse(text),
    label: 'Streamed report',
    landmarks: false,
  });

declare global {
  interface Window {
    txStreaming: {
      chunks: number;
      /** Write the next `count` chunks; returns how many are left. */
      write(count?: number): number;
      end(): void;
      abort(): void;
      /** Start a new stream (a retry) from the first chunk. */
      restart(): void;
      progress(): readonly PlayerStreamProgress[];
      /** Mount the same golden painted whole, for comparison. */
      mountWhole(): void;
      retries(): number;
    };
  }
}

window.txStreaming = {
  chunks: chunks.length,
  write(count = 1) {
    for (let i = 0; i < count && next < chunks.length; i += 1) {
      handle.write(chunks[next] as string);
      next += 1;
    }
    return chunks.length - next;
  },
  end() {
    handle.end();
  },
  abort() {
    handle.abort('The fictional agent stopped.');
  },
  restart() {
    handle = createBlueprintStream();
    next = 0;
    streamed.update({ stream: handle });
  },
  progress: () => progress,
  mountWhole() {
    mountWhole();
  },
  retries: () => retries,
};
if (status) status.textContent = 'Ready';

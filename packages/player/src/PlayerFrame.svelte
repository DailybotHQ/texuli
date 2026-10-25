<script lang="ts">
import { resolveEmbedFrameSrc } from '@texuli/blocks/embed';
import { createPlayerFrameHost, type PlayerFrameHost } from './embed/host.ts';
import {
  PLAYER_FRAME_MAX_SIZE,
  PLAYER_FRAME_REFERRER_POLICY,
  PLAYER_FRAME_SANDBOX,
  type PlayerFrameDiagnostics,
  type PlayerFrameOptions,
} from './embed/protocol.ts';

type Props = {
  /** The player-frame page. HTTPS, and its origin must be on `allowedOrigins`. */
  src: string;
  /** Exact HTTPS origins the frame page may be served from. */
  allowedOrigins: readonly string[];
  blueprint: unknown;
  options?: PlayerFrameOptions;
  /** Accessible name of the iframe. */
  title?: string;
  /** Block size before the frame reports its own, in CSS pixels. */
  initialBlockSize?: number;
  /** Largest block size the frame may grow to, in CSS pixels. */
  maxBlockSize?: number;
  onDiagnostics?: (diagnostics: PlayerFrameDiagnostics) => void;
};

let {
  src,
  allowedOrigins,
  blueprint,
  options = {},
  title = 'Blueprint preview',
  initialBlockSize = 320,
  maxBlockSize = PLAYER_FRAME_MAX_SIZE,
  onDiagnostics,
}: Props = $props();

let frame = $state<HTMLIFrameElement | null>(null);
let host = $state<PlayerFrameHost | null>(null);
// Bumped on every `ready`, so a reloaded frame gets the blueprint again.
let readyCount = $state(0);
let blockSize = $state<number | null>(null);
let safeSrc = $derived(resolveEmbedFrameSrc(src, { allowedOrigins }));
let height = $derived(Math.min(blockSize ?? initialBlockSize, maxBlockSize));

$effect(() => {
  const element = frame;
  if (!element) return;
  const handle = createPlayerFrameHost({
    frame: element,
    onReady: () => {
      readyCount += 1;
    },
    onResize: (size) => {
      blockSize = size.blockSize;
    },
    onDiagnostics: (diagnostics) => onDiagnostics?.(diagnostics),
  });
  host = handle;
  return () => {
    handle.dispose();
    host = null;
  };
});

// (Re)send the blueprint whenever the frame is ready or the host input changes.
$effect(() => {
  if (readyCount > 0)
    host?.init($state.snapshot(blueprint), $state.snapshot(options) as PlayerFrameOptions);
});
</script>

{#if safeSrc}
  <iframe
    bind:this={frame}
    class="tx-player-frame"
    src={safeSrc}
    {title}
    sandbox={PLAYER_FRAME_SANDBOX}
    referrerpolicy={PLAYER_FRAME_REFERRER_POLICY}
    loading="lazy"
    style={`block-size: ${height}px`}
  ></iframe>
{:else}
  <div class="tx-player__notice" role="alert" data-tx-player-frame-refused>
    The player frame address is not allowed.
  </div>
{/if}

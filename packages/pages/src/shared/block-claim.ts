/**
 * The host slot's decisions (G111): who paints a node, and the read-only
 * copy a host is handed. Imported only by the lazy `HostSlot`, so a reader
 * or an editor without a host never loads it.
 */
import type { EmbedBlock, WrappedBlock } from '@texuli/document/model';
import type { PagesBlockClaim, PagesBlockPainter, PagesHostNode } from './block-host.ts';

/** Who paints `node` under `painter`. Never throws. */
export function blockClaim(
  painter: PagesBlockPainter | null | undefined,
  node: PagesHostNode
): PagesBlockClaim {
  if (!painter) return 'library';
  const claim = painter.host?.claim;
  if (!claim) return 'fallback';
  try {
    const value = claim(node);
    return value === 'host' || value === 'library' ? value : 'fallback';
  } catch {
    return 'library';
  }
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) freeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

/** A deep-frozen copy of a node, so a host can neither change the document nor the next host's view of it. */
export function readonlyNode(node: WrappedBlock | EmbedBlock | PagesHostNode): PagesHostNode {
  return freeze(JSON.parse(JSON.stringify(node)) as PagesHostNode);
}

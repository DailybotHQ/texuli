import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

const CHAT_AXIS_STAMP: Readonly<Record<string, { readonly states?: readonly CatalogStateName[] }>> =
  {
    'chat-thread': { states: ['disabled'] },
    composer: { states: ['disabled', 'loading'] },
  };

export function stampChatAxes(manifest: CatalogManifest): CatalogManifest {
  const stamp = CHAT_AXIS_STAMP[manifest.id];
  return stamp ? manifestData({ ...manifest, ...stamp }) : manifest;
}

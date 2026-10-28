import type { CatalogManifest } from '@texuli/catalog/manifest';
import {
  CHAT_MESSAGE_ROLES,
  chatMessageManifest,
  chatThreadManifest,
} from '@texuli/catalog/manifests/chat';

/** The chat display ids (G10). The manifests live in the catalog's `chat` group; the composer stays host chrome. */
export { CHAT_MESSAGE_ROLES, chatMessageManifest, chatThreadManifest };

/** The display-only thread and message. */
export const CHAT_DISPLAY_MANIFESTS: readonly CatalogManifest[] = Object.freeze([
  chatThreadManifest,
  chatMessageManifest,
]);

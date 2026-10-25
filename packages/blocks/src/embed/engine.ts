/**
 * `@texuli/blocks/embed/engine` — Svelte-free embed sandbox helpers and parsers.
 */

import type { FieldIssue } from '../core/schema/primitives.ts';
import type { EmbedMountResult } from './sandbox.ts';
import type { EmbedAppBlock, LinkPreviewBlock } from './schema.ts';

export {
  type CreateSandboxedEmbedIframeOptions,
  createSandboxedEmbedIframe,
  createSandboxedEmbedMount,
  EMBED_IFRAME_REFERRER_POLICY,
  EMBED_IFRAME_SANDBOX,
  EMBED_IFRAME_SANDBOX_POPUPS_ESCAPE,
  type EmbedMountCleanup,
  type EmbedMountResult,
  embedIframeSandbox,
  type ResolveEmbedFrameSrcOptions,
  resolveEmbedFrameSrc,
  type SandboxedEmbedMountOptions,
} from './sandbox.ts';
export type {
  EmbedAppBlock,
  EmbedBlock,
  EmbedBlockCheck,
  EmbedParseResult,
  LinkPreviewBlock,
} from './schema.ts';
export { checkEmbedBlock, EMBED_APP_MAX_BYTES, safeParseEmbedBlock } from './schema.ts';

export const EMBED_BLOCK_TYPES = ['embed-app', 'link-preview'] as const;
export type EmbedFamilyBlockType = (typeof EMBED_BLOCK_TYPES)[number];
export type EmbedFamilyBlock = EmbedAppBlock | LinkPreviewBlock;

export interface EmbedBlockLabels {
  invalid: string;
  start: string;
  starting: string;
  close: string;
  unavailable: string;
  idle: string;
  startError: string;
  link: string;
  newWindow: string;
}

export const DEFAULT_EMBED_BLOCK_LABELS: EmbedBlockLabels = {
  invalid: 'This embed block is not valid.',
  start: 'Start the app',
  starting: 'Starting…',
  close: 'Close app',
  unavailable: 'This host cannot start embedded apps.',
  idle: 'Nothing loads until you start the app.',
  startError: 'The embedded app could not be started.',
  link: 'Open link',
  newWindow: 'Opens in a new tab',
};

export interface EmbedBlockViewProps {
  block: unknown;
  mountEmbed?: (
    target: HTMLElement,
    app: Record<string, unknown>
  ) => EmbedMountResult | Promise<EmbedMountResult>;
  labels?: Partial<EmbedBlockLabels>;
  oninvalid?: (issues: FieldIssue[]) => void;
}

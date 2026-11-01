import { type DeckPayloadValidator, validateDocument } from '@texuli/document/schema-core';
import type { DocumentPlayerHost, DraftDocumentCheck } from '@texuli/player';
import { mount, unmount } from 'svelte';
import type { PagesBlockHost, PagesBlockSnippet } from '../shared/block-host.ts';
import type { PagesLibraryBaseLoader } from '../shared/design-system-types.ts';
import type { EmbedResolver } from '../shared/embeds.ts';
import type { PagesLabels } from '../shared/labels.ts';
import type { MediaResolver } from '../shared/media.ts';
import type { PagesPlayerLoader } from '../shared/player-loader.ts';

/**
 * The document check `validateDraft` runs for every `document` node:
 * `validateDocument` from `@texuli/document/schema-core` at the draft's tier
 * (the host's, never the draft's), inline decks checked by `validateDeck` or,
 * without one, refused. Warnings (orphaned comment anchors) do not refuse;
 * every error does.
 */
export function createDocumentDraftCheck(
  validateDeck: DeckPayloadValidator | null = null
): DraftDocumentCheck {
  return (doc, tier) => {
    const result = validateDocument(doc, { trust: tier, validateDeck });
    const issues = result.issues.map((issue) => ({
      code: issue.code,
      path: issue.jsonPath,
      message: issue.message,
      severity: issue.severity === 'warning' ? ('warning' as const) : ('error' as const),
    }));
    return result.ok ? { ok: true, document: result.document, issues } : { ok: false, issues };
  };
}

/** The draft check without a deck validator: inline decks are refused (`0.12.0`, G136). */
export const checkDocumentDraft: DraftDocumentCheck = createDocumentDraftCheck();

/** What the reader takes besides the document (see `PageReader`). */
export interface DocumentPlayerHostOptions {
  labels?: Partial<PagesLabels>;
  /**
   * Checks inline deck payloads (G136). `createDocumentPlayerHost` defaults
   * to `checkDeckPayload`; `createDocumentPlayerHostCore` has none, so its
   * build has no `@texuli/deck/model` reference, and a document holding an
   * inline deck is refused. `null` refuses them on either.
   */
  validateDeck?: DeckPayloadValidator | null;
  /** Added to every heading level; default 1, so a level-1 heading sits under the player's label. */
  headingOffset?: number;
  /** Prefix for heading anchors, so two documents on one page never share an id. */
  anchorPrefix?: string;
  onNavigate?: (ref: string) => void;
  pageHref?: (ref: string) => string | null | undefined;
  resolveEmbed?: EmbedResolver;
  resolveMedia?: MediaResolver;
  /** Paint embeds without motion. */
  reducedMotion?: boolean;
  /** The host's own blocks: a snippet for the reader's `renderBlock` (G111). */
  renderBlock?: PagesBlockSnippet;
  /** The host's block renderer for the reader's `blockHost` (`claim`, `component`, `present`). */
  blockHost?: PagesBlockHost | null;
  /**
   * Loads `@texuli/player` for the reader's live embeds (G123).
   * `createDocumentPlayerHost` defaults to the package's loader;
   * `createDocumentPlayerHostCore` has none, so its build has no player
   * reference, and an embed that needs the player shows a notice. `null`
   * turns them off on either.
   */
  loadPlayer?: PagesPlayerLoader | null;
  /**
   * Loads a design system's `texuli:<theme>` base for the reader (G127).
   * `createDocumentPlayerHost` defaults to the theme library;
   * `createDocumentPlayerHostCore` has none, so its build has no theme
   * library reference, and such a design system is refused. `null` refuses
   * them on either.
   */
  loadLibraryBase?: PagesLibraryBaseLoader | null;
}

/**
 * A `documentHost` for `Player` on the core reader (G123): `checkDocument`
 * joins the player's validation, and `present` validates the document again
 * at the tier and mounts `PageReaderCore` into the player's surface (the
 * reader is imported on first use). Live embeds inside the document paint
 * only with `options.loadPlayer`. A document that does not validate paints
 * nothing. The cleanup unmounts the reader, or cancels a mount still
 * loading.
 */
export function createDocumentPlayerHostCore(
  options: DocumentPlayerHostOptions = {}
): DocumentPlayerHost {
  const validateDeck = options.validateDeck ?? null;
  return {
    checkDocument: createDocumentDraftCheck(validateDeck),
    present(request) {
      const target = request.target;
      if (!target) return undefined;
      const checked = validateDocument(request.doc, { trust: request.tier, validateDeck });
      if (!checked.ok) return undefined;
      let cancelled = false;
      let instance: Record<string, unknown> | null = null;
      void import('../reader/PageReaderCore.svelte').then(({ default: PageReaderCore }) => {
        if (cancelled) return;
        instance = mount(PageReaderCore, {
          target,
          props: {
            document: checked.document,
            outline: request.outline,
            headingOffset: options.headingOffset ?? 1,
            ...(options.labels ? { labels: options.labels } : {}),
            ...(options.anchorPrefix !== undefined
              ? { anchorPrefix: options.anchorPrefix }
              : request.key
                ? { anchorPrefix: `${request.key}-` }
                : {}),
            ...(options.onNavigate ? { onNavigate: options.onNavigate } : {}),
            ...(options.pageHref ? { pageHref: options.pageHref } : {}),
            ...(options.resolveEmbed ? { resolveEmbed: options.resolveEmbed } : {}),
            ...(options.resolveMedia ? { resolveMedia: options.resolveMedia } : {}),
            ...(options.reducedMotion !== undefined
              ? { reducedMotion: options.reducedMotion }
              : {}),
            ...(options.renderBlock ? { renderBlock: options.renderBlock } : {}),
            ...(options.blockHost ? { blockHost: options.blockHost } : {}),
            ...(options.loadPlayer ? { loadPlayer: options.loadPlayer } : {}),
            ...(options.loadLibraryBase ? { loadLibraryBase: options.loadLibraryBase } : {}),
          },
        });
      });
      return () => {
        cancelled = true;
        if (instance) void unmount(instance);
        instance = null;
      };
    },
  };
}

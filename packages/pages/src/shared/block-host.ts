/**
 * The host block seam (G111): a host paints its own wrapped blocks and
 * embeds (a form backed by its services, a chart on its own spec) in
 * `PageReader`, `PageEditor` and `PagedView`, through a `renderBlock`
 * snippet, a `blockHost` component or a `blockHost.present` mount.
 *
 * The host's code is developer-tier: it is the app's own. The node it is
 * handed may come from a user or an agent, so it is passed read-only (a
 * frozen copy) and painted with no HTML sink; a link or image in it must
 * pass `safeHref` or `safeImageSrc` at the `untrusted` tier.
 *
 * Which blocks the host paints is its `claim`: `'host'` paints the node
 * with the host (a library block too: the host overrides it), `'fallback'`
 * (the default) lets the library try first and hands the node to the host
 * only when the library would refuse it (an unknown family or block, props
 * that fail its renderer, an embed with no payload, a refused blueprint, a
 * sheet or canvas reference), and `'library'` keeps the host out. When no
 * host paints a node the library refuses, the refused notice shows.
 *
 * Unused, the seam costs the reader and the editor a few lines of wiring:
 * the slot that decides and paints loads with `import()` on the first
 * wrapped block or embed of a document that has a host.
 */
import type { EmbedBlock, WrappedBlock } from '@texuli/document/model';
import type { Component, Snippet } from 'svelte';

/** A value, read-only all the way down. */
export type PagesReadonly<T> = T extends (infer Item)[]
  ? readonly PagesReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: PagesReadonly<T[Key]> }
    : T;

/** What a host block renderer is handed: a frozen copy of a wrapped block or an embed. */
export type PagesHostNode = PagesReadonly<WrappedBlock> | PagesReadonly<EmbedBlock>;

/**
 * Who paints a node: `'host'` (the host, even for a library block),
 * `'fallback'` (the library first, the host when the library refuses it)
 * or `'library'` (never the host).
 */
export type PagesBlockClaim = 'host' | 'fallback' | 'library';

/** The props of a `blockHost.component`. */
export interface PagesBlockHostProps {
  node: PagesHostNode;
}

/** What `blockHost.present` is handed: the node and an empty element to mount into. */
export interface PagesBlockHostRequest {
  node: PagesHostNode;
  target: HTMLElement;
}

/**
 * The host's block renderer. Give a `component`, or `present` (mount into
 * `target`, return a cleanup: the pattern of the player's `deckHost` and
 * `documentHost`), or pass a `renderBlock` snippet next to it; the snippet
 * wins over the component, the component over `present`.
 */
export interface PagesBlockHost {
  /** Who paints `node` (default `'fallback'` for every node). A throw counts as `'library'`. */
  claim?: (node: PagesHostNode) => PagesBlockClaim | null | undefined;
  component?: Component<PagesBlockHostProps>;
  present?: (request: PagesBlockHostRequest) => undefined | (() => void);
}

/** A `renderBlock` snippet: it is handed the read-only node. */
export type PagesBlockSnippet = Snippet<[PagesHostNode]>;

/** The host painters a block list carries down (null when the host gave none). */
export interface PagesBlockPainter {
  host: PagesBlockHost | null;
  render: PagesBlockSnippet | null;
}

/** The painter for a reader or an editor, or `null` (no host: the library paints alone). */
export function blockPainter(
  host: PagesBlockHost | null | undefined,
  render: PagesBlockSnippet | null | undefined
): PagesBlockPainter | null {
  const painter = { host: host ?? null, render: render ?? null };
  return painter.render || painter.host?.component || painter.host?.present ? painter : null;
}

/**
 * Embeds and wrapped blocks: from a document node to what paints it.
 *
 * - A `component` embed is a one-node catalog blueprint; it is wrapped in a
 *   `layout-page` root and painted by `@texuli/player`, which validates it
 *   again at the host's tier (`untrusted` by default) and refuses it when it
 *   does not pass (two-phase validation, ADR-011).
 * - A `deck` embed (deck model v2) becomes a `layout-deck` blueprint: the
 *   player paints it as a document flow, or presents it on a stage when the
 *   host passes a `deckHost` (the player's seam; `@texuli/slides` is L8 too).
 * - `sheet` and `canvas` embeds are typed references kept as data; their
 *   views are planned with their packages.
 *
 * Framework-free: no DOM, no Svelte.
 */
import type {
  DocumentJson,
  DocumentJsonObject,
  EmbedBlock,
  EmbedKind,
  WrappedBlock,
} from '@texuli/document/model';

/** A host lookup for `ref` embeds: the payload, or `null` when it is unknown. */
export type EmbedResolver = (request: {
  kind: EmbedKind;
  ref: string;
}) => DocumentJsonObject | null | undefined | Promise<DocumentJsonObject | null | undefined>;

/** A catalog blueprint node (plain JSON). */
export interface BlueprintNode {
  id: string;
  props?: DocumentJsonObject;
  children?: BlueprintNode[];
}

export type EmbedPlan =
  | { kind: 'player'; blueprint: BlueprintNode }
  | { kind: 'reference'; embed: EmbedKind; ref: string | null }
  | { kind: 'refused'; reason: string };

const isObject = (value: unknown): value is DocumentJsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Plain strings on a deck slide that the document flow shows as text. */
const SLIDE_TEXT_PROPS = ['kicker', 'subtitle', 'body', 'text', 'quote', 'caption'] as const;

function slideChildren(props: DocumentJsonObject): BlueprintNode[] {
  const out: BlueprintNode[] = [];
  for (const key of SLIDE_TEXT_PROPS) {
    const value = props[key];
    if (typeof value === 'string' && value.trim())
      out.push({ id: 'blocks-text', props: { block: { type: 'text', markdown: value } } });
  }
  const bullets = props.bullets ?? props.items;
  if (Array.isArray(bullets)) {
    const items = bullets
      .map((item) =>
        typeof item === 'string'
          ? item
          : isObject(item) && typeof item.text === 'string'
            ? item.text
            : ''
      )
      .filter((text) => text.trim())
      .slice(0, 50)
      .map((text) => ({ text }));
    if (items.length > 0)
      out.push({ id: 'blocks-text', props: { block: { type: 'list', items } } });
  }
  return out;
}

/**
 * The `layout-deck` blueprint for a deck model v2 payload: the structured
 * `slides` for a deck host, and `deck-slide` children (title and plain
 * text) for the player's document flow. The player validates both.
 */
export function deckBlueprint(deck: DocumentJsonObject, title?: string): BlueprintNode {
  const meta = isObject(deck.meta) ? deck.meta : {};
  const slides = Array.isArray(deck.slides) ? deck.slides.filter(isObject).slice(0, 200) : [];
  const deckTitle = (typeof meta.title === 'string' && meta.title) || title || 'Deck';
  const props: DocumentJsonObject = { title: deckTitle };
  if (typeof meta.description === 'string') props.description = meta.description;
  if (typeof meta.locale === 'string') props.locale = meta.locale;
  return {
    id: 'layout-deck',
    props,
    children: slides.map((slide, index) => {
      const slideProps = isObject(slide.props) ? slide.props : {};
      const slideTitle =
        typeof slideProps.title === 'string' && slideProps.title
          ? slideProps.title
          : `Slide ${index + 1}`;
      const slideId = typeof slide.id === 'string' && slide.id ? slide.id : `slide-${index + 1}`;
      return {
        id: 'deck-slide',
        props: { slideId, title: slideTitle },
        children: slideChildren(slideProps),
      };
    }),
  };
}

/** The `layout-page` blueprint around one catalog component. */
export function componentBlueprint(payload: DocumentJsonObject): BlueprintNode | null {
  if (typeof payload.id !== 'string' || !payload.id) return null;
  const node: BlueprintNode = { id: payload.id };
  if (isObject(payload.props)) node.props = payload.props;
  return { id: 'layout-page', children: [node] };
}

/**
 * What paints an embed once its payload is known (`inline`, or what the
 * host's resolver returned for `ref`). Never throws.
 */
export function planEmbed(
  embed: Pick<EmbedBlock, 'kind' | 'ref' | 'title'>,
  payload: DocumentJson | null | undefined
): EmbedPlan {
  if (embed.kind === 'sheet' || embed.kind === 'canvas')
    return { kind: 'reference', embed: embed.kind, ref: embed.ref ?? null };
  if (!isObject(payload)) return { kind: 'refused', reason: 'missing-payload' };
  if (embed.kind === 'deck')
    return { kind: 'player', blueprint: deckBlueprint(payload, embed.title) };
  const blueprint = componentBlueprint(payload);
  return blueprint ? { kind: 'player', blueprint } : { kind: 'refused', reason: 'no-component-id' };
}

/** The object the `@texuli/blocks` renderers read: `{ type: block, ...props }`. */
export function wrappedBlockInput(node: Pick<WrappedBlock, 'block' | 'props'>): DocumentJsonObject {
  return { ...node.props, type: node.block };
}

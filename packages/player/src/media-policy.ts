/**
 * The player's media policy, applied to a node's props at paint, after the
 * URL policy. It only ever narrows what media may do; it never adds a URL.
 *
 * - **Trust is the host's, never the blueprint's.** `media-image` and the
 *   media compositions take a `trust` prop that widens their own image URL
 *   policy (HTTP, blob and data sources, `srcset`, placeholders) and drops
 *   `referrerpolicy="no-referrer"`. A blueprint value is overridden with
 *   `untrusted`.
 * - **No autoplay.** A `blocks-media` video never starts on its own, even
 *   when the block asks for muted autoplay.
 * - **Keyboard-operable video.** Its native controls stay on, so a keyboard
 *   user can always play, pause and seek it.
 * - **A text alternative is exposed.** `media-image` requires `alt` but
 *   accepts an empty string, and it has no decorative flag; a blank `alt`
 *   from a blueprint becomes the host's "no description" label, so the image
 *   is not silently hidden. Block images need no help: their schema refuses
 *   an image with neither `alt` nor `decorative: true`.
 */

/** Ids whose `trust` prop the policy pins to `untrusted`. */
export const TRUST_PINNED_IDS: readonly string[] = Object.freeze([
  'media-image',
  'media-composition-svg',
  'media-composition-canvas',
]);

export interface MediaPolicyLabels {
  /** Alt text for a `media-image` that arrived with a blank `alt`. */
  mediaNoAlt: string;
}

type Props = Readonly<Record<string, unknown>>;

function isBag(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The props a media node is painted with. Returns the same object when the
 * policy changes nothing, so non-media nodes are untouched.
 */
export function applyMediaPolicy(id: string, props: Props, labels: MediaPolicyLabels): Props {
  let next: Record<string, unknown> | null = null;
  const set = (key: string, value: unknown) => {
    next ??= { ...props };
    next[key] = value;
  };

  if (TRUST_PINNED_IDS.includes(id) && props.trust !== 'untrusted') {
    set('trust', 'untrusted');
  }
  if (id === 'media-image' && (typeof props.alt !== 'string' || props.alt.trim() === '')) {
    set('alt', labels.mediaNoAlt);
  }
  if (id === 'blocks-media' && isBag(props.block) && props.block.type === 'video') {
    const block = props.block;
    if (block.autoplay === true || block.controls === false) {
      set('block', Object.freeze({ ...block, autoplay: false, controls: true }));
    }
  }
  return next ?? props;
}

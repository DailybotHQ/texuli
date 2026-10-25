import type { Composition } from '../composition-model/index.ts';

export interface CompositionTextItem {
  layerId: string;
  kind: 'text' | 'image';
  /** The text layer's text, or the image's alt text. */
  text: string;
}

/**
 * What a canvas cannot tell assistive tech by itself: the scene's text layers
 * and the alt text of its images, in paint order (bottom first). Layers used
 * only as masks and images with empty alt (decorative) are left out. The
 * result is plain strings, rendered as text nodes, never as markup.
 */
export function describeComposition(composition: Composition): CompositionTextItem[] {
  const maskSources = new Set(
    composition.layers.flatMap((layer) => (layer.mask ? [layer.mask.layerId] : []))
  );
  const items: CompositionTextItem[] = [];
  for (const layer of composition.layers) {
    if (maskSources.has(layer.id)) continue;
    if (layer.type === 'text' && layer.text.trim() !== '') {
      items.push({ layerId: layer.id, kind: 'text', text: layer.text });
    } else if (layer.type === 'image' && layer.alt.trim() !== '') {
      items.push({ layerId: layer.id, kind: 'image', text: layer.alt });
    }
  }
  return items;
}

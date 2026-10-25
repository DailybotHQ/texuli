import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import {
  cardLayoutManifest,
  deckLayoutManifest,
  deckSlideManifest,
  docLayoutManifest,
  gridLayoutManifest,
  pageLayoutManifest,
} from '@texuli/catalog/manifests/layouts';
import type { RenderCatalog, RenderComponentSpec } from '@texuli/catalog/render/renderer';
import { renderCatalogFromSpecs } from '@texuli/catalog/render/renderer';
import { ACTION_MANIFESTS } from './action-manifests.ts';
import { CHAT_DISPLAY_MANIFESTS } from './chat-manifests.ts';
import { CONTROL_MANIFESTS } from './control-manifests.ts';
import { FLOW_MANIFESTS } from './flow-manifests.ts';
import { G20_LAYOUT_MANIFESTS } from './layout-manifests.ts';
import { REGION_MANIFESTS } from './region-manifests.ts';

/** Default catalog: the shipped content families, the content layouts (with the G20 vocabulary), the state-only controls, the host region and the G10 chat display ids. */
export function createPlayerCatalog(): RenderCatalog {
  const manifests = [
    ...CONTENT_MANIFESTS,
    cardLayoutManifest,
    pageLayoutManifest,
    docLayoutManifest,
    gridLayoutManifest,
    deckLayoutManifest,
    deckSlideManifest,
    ...G20_LAYOUT_MANIFESTS,
    ...CONTROL_MANIFESTS,
    ...REGION_MANIFESTS,

    ...FLOW_MANIFESTS,
    ...ACTION_MANIFESTS,
    ...CHAT_DISPLAY_MANIFESTS,
  ];
  const specs: RenderComponentSpec[] = manifests.map((manifest) => ({
    id: manifest.id,
    label: manifest.label,
    props: manifest.props,
    agentEmittable: manifest.agentEmittable === true,
    emit: manifest.agentEmittable === true ? ['developer', 'untrusted'] : ['developer'],
  }));
  return renderCatalogFromSpecs(specs);
}

export type { RenderCatalog };

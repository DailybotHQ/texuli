import type { PaintNode } from '@texuli/catalog/player';
import type { BlueprintNodeMotion } from '@texuli/spec/motion';
import type { Component } from 'svelte';
import type { FrameInfo } from './layouts/outline.ts';
import type { PlayerSkeletonFamily } from './skeletons.ts';
import type { StreamNodeState } from './stream/marker.ts';

export type PlayerPaintNode =
  | {
      kind: 'component';
      id: string;
      path: string;
      props: Readonly<Record<string, unknown>>;
      component: Component<Record<string, unknown>>;
      children: readonly PlayerPaintNode[];
      /** Player-owned layout data for content layouts (heading rank, id, contents). */
      frame?: FrameInfo;
      /** The parent's named slot, when not the default one (audit G04). */
      slot?: string;
      /** The node's checked motion (spec 0.6.0): presets and token steps only. */
      motion?: Readonly<BlueprintNodeMotion>;
      /** The enter delay a staggering parent gave this node, in ms (bounded). */
      motionDelay?: number;
      /** Kept painted, inert, while its exit animation plays; then it goes. */
      leaving?: boolean;
    }
  | Extract<PaintNode, { kind: 'placeholder' }>
  | {
      kind: 'skeleton';
      id: string;
      path: string;
      /** The catalog label, used in the loading announcement. */
      label: string;
      family: PlayerSkeletonFamily;
      /** The parent's named slot, when not the default one (audit G04). */
      slot?: string;
      /**
       * A streamed node not painted yet (ADR-014): `pending` (busy), `held`
       * until the final verdict, or `incomplete` after an interruption.
       */
      stream?: StreamNodeState;
    };

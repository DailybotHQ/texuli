import type { PaintNode } from '@texuli/catalog/player';
import type { Component } from 'svelte';
import type { FrameInfo } from './layouts/outline.ts';
import type { PlayerSkeletonFamily } from './skeletons.ts';

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
    };

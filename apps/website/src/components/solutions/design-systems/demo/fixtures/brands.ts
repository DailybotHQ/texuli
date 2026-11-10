/**
 * The demo's fictional brand inputs (PLAN_017 T-demo): one per input kind `texuli ds
 * generate` reads — a brief one-liner, a tiny DTCG token set and a short site stylesheet.
 * Harborline, Quillmark and Tumbletown are fictional. Each input keeps one value the
 * importer cannot place, so the generation report has something honest to show. One file per
 * brand (`harborline.ts`, `quillmark.ts`, `tumbletown.ts`): the registry scenarios.
 */
import { HARBORLINE } from './harborline.ts';
import { QUILLMARK } from './quillmark.ts';
import { TUMBLETOWN } from './tumbletown.ts';

export type DemoInputKind = 'brief' | 'tokens' | 'css';

export interface DemoBrandInput {
  readonly id: string;
  readonly name: string;
  readonly kind: DemoInputKind;
  /** The flag `texuli ds generate` takes for this input. */
  readonly flag: '--brief' | '--from-tokens' | '--from-css';
  /** One line about the brand, shown on its card. */
  readonly summary: string;
  /** The input as text: the brief, the token JSON or the stylesheet. */
  readonly source: string;
}

export const DEMO_BRAND_INPUTS: readonly DemoBrandInput[] = [HARBORLINE, QUILLMARK, TUMBLETOWN];

export const DEMO_INPUT_LABELS: Readonly<Record<DemoInputKind, string>> = {
  brief: 'Brief',
  tokens: 'Tokens',
  css: 'CSS',
};

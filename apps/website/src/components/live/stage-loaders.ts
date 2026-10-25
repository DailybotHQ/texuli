/**
 * One lazy chunk per stage family. Kept apart from the stage map so a
 * component page ships only this small table, not every id's metadata.
 */
import type { StageFamily, StageModule } from './stage-map.ts';

const load = (importer: () => Promise<unknown>) => importer as () => Promise<StageModule>;

/**
 * Families only the preview document loads (their ids are `framed`). Astro
 * links the CSS of every module a page can lazily reach; the combobox CSS is
 * also server-rendered on the primitives pages, so a shared entry put it on
 * every component page (1.5 KB gzip each).
 */
export type FramedFamily = 'combobox';
export const FRAMED_FAMILIES: ReadonlySet<StageFamily> = new Set<FramedFamily>(['combobox']);

/** One lazy chunk per family. */
export const STAGE_LOADERS: Readonly<
  Record<Exclude<StageFamily, FramedFamily>, () => Promise<StageModule>>
> = {
  badge: load(() => import('./stages/BadgeStage.svelte')),
  blocks: load(() => import('./stages/BlocksStage.svelte')),
  button: load(() => import('./stages/ButtonStage.svelte')),
  chart: load(() => import('./stages/ChartStage.svelte')),
  choice: load(() => import('./stages/ChoiceStage.svelte')),
  command: load(() => import('./stages/CommandStage.svelte')),
  data: load(() => import('./stages/DataStage.svelte')),
  dialog: load(() => import('./stages/DialogStage.svelte')),
  feedback: load(() => import('./stages/FeedbackStage.svelte')),
  field: load(() => import('./stages/FieldStage.svelte')),
  layout: load(() => import('./stages/LayoutStage.svelte')),
  media: load(() => import('./stages/MediaStage.svelte')),
  menu: load(() => import('./stages/MenuStage.svelte')),
  nav: load(() => import('./stages/NavStage.svelte')),
  'page-layout': load(() => import('./stages/PageLayoutStage.svelte')),
  popover: load(() => import('./stages/PopoverStage.svelte')),
  select: load(() => import('./stages/SelectStage.svelte')),
  sheet: load(() => import('./stages/SheetStage.svelte')),
  table: load(() => import('./stages/TableStage.svelte')),
  toast: load(() => import('./stages/ToastStage.svelte')),
};

/**
 * Every source file in the workspace packages that animates through the
 * motion runtime (`texuli/motion` seams or `@texuli/core/motion`), what it
 * animates and where this site shows it live. apps/website/tests/
 * site-motion.test.ts scans the committed package sources and fails when an
 * adopter is missing here, so the list on /motion-page/ stays complete.
 */

export interface MotionAdopter {
  /** The source file, relative to the repository root. */
  readonly file: string;
  readonly component: string;
  readonly pkg: string;
  /** What moves, with the component's default presets and duration step. */
  readonly motion: string;
  /** Where the site shows it live (a path with an anchor), or '' while its page is planned. */
  readonly live: string;
}

const T = 'packages/texuli/src/components';

export const MOTION_ADOPTERS: readonly MotionAdopter[] = [
  {
    file: `${T}/dialog/Dialog.svelte`,
    component: 'Dialog',
    pkg: 'texuli',
    motion: 'Panel scale in and out over a fading backdrop, base',
    live: '#presence',
  },
  {
    file: `${T}/dialog/AlertDialog.svelte`,
    component: 'AlertDialog',
    pkg: 'texuli',
    motion: 'Panel scale in and out over a fading backdrop, base',
    live: '#components',
  },
  {
    file: `${T}/sheet/SheetContent.svelte`,
    component: 'Sheet',
    pkg: 'texuli',
    motion: 'Slides from its edge the whole way (rise), base',
    live: '#presence',
  },
  {
    file: `${T}/sheet/SheetOverlay.svelte`,
    component: 'Sheet overlay',
    pkg: 'texuli',
    motion: 'Backdrop fade in and out',
    live: '#presence',
  },
  {
    file: `${T}/sheet/DrawerContent.svelte`,
    component: 'Drawer',
    pkg: 'texuli',
    motion: 'Slides from its edge to its snap point, base',
    live: '#components',
  },
  {
    file: `${T}/sheet/DetailPanelContent.svelte`,
    component: 'DetailPanel',
    pkg: 'texuli',
    motion: 'Slides from its edge, base',
    live: '#components',
  },
  {
    file: `${T}/sheet/ResponsiveModalContent.svelte`,
    component: 'ResponsiveModal',
    pkg: 'texuli',
    motion: 'Dialog or bottom drawer, slides from its edge, base',
    live: '#components',
  },
  {
    file: `${T}/popover/PopoverContent.svelte`,
    component: 'Popover',
    pkg: 'texuli',
    motion: 'Scale in and out, fast',
    live: '#components',
  },
  {
    file: `${T}/popover/HoverCardContent.svelte`,
    component: 'HoverCard',
    pkg: 'texuli',
    motion: 'Scale in, fade out, fast',
    live: '#components',
  },
  {
    file: `${T}/tooltip/Tooltip.svelte`,
    component: 'Tooltip',
    pkg: 'texuli',
    motion: 'Scale in, fade out, fast',
    live: '#components',
  },
  {
    file: `${T}/menus/MenuContent.svelte`,
    component: 'DropdownMenu',
    pkg: 'texuli',
    motion: 'Scale in, fade out, fast',
    live: '#components',
  },
  {
    file: `${T}/menus/MenuSubContent.svelte`,
    component: 'Submenu',
    pkg: 'texuli',
    motion: 'Scale in, fade out, fast',
    live: '#components',
  },
  {
    file: `${T}/menus/ContextMenuContent.svelte`,
    component: 'ContextMenu',
    pkg: 'texuli',
    motion: 'Scale in, fade out, fast',
    live: '#components',
  },
  {
    file: `${T}/menus/MenubarContent.svelte`,
    component: 'Menubar',
    pkg: 'texuli',
    motion: 'Scale in, fade out, fast',
    live: '#components',
  },
  {
    file: `${T}/toast/Toaster.svelte`,
    component: 'Toaster',
    pkg: 'texuli',
    motion: 'Rise in, fade out; the stack glides (layout), base',
    live: '#presence',
  },
  {
    file: `${T}/tabs-accordion/Tabs.svelte`,
    component: 'Tabs',
    pkg: 'texuli',
    motion: 'The indicator glides to the new tab (layout), base',
    live: '#components',
  },
  {
    file: `${T}/tabs-accordion/Accordion.svelte`,
    component: 'Accordion',
    pkg: 'texuli',
    motion: 'Panel height opens and closes (layout), base',
    live: '#components',
  },
  {
    file: 'packages/data/src/dashboard/Dashboard.svelte',
    component: 'Dashboard',
    pkg: '@texuli/data',
    motion: 'Widgets glide to their new cell after a change (FLIP), in development',
    live: '/dashboards-page/',
  },
  {
    file: 'packages/data/src/grid-core/DataGrid.svelte',
    component: 'DataGrid',
    pkg: '@texuli/data',
    motion: 'Rows glide on sort, insert and remove (FLIP), base',
    live: '/examples/data-grid-core/',
  },
  {
    file: 'packages/data/src/board/Board.svelte',
    component: 'Board',
    pkg: '@texuli/data',
    motion: 'Cards glide on a committed move (FLIP), base',
    live: '#layout',
  },
  {
    file: 'packages/charts/src/interaction/InteractivePlot.svelte',
    component: 'InteractivePlot (every interactive chart)',
    pkg: '@texuli/charts',
    motion:
      'Follows the MotionProvider reduced-motion setting and the OS preference (data-reduced-motion)',
    live: '#settings',
  },
  {
    file: 'packages/data/src/motion/lazy-list-motion.ts',
    component: 'Board, DataGrid and Dashboard list motion',
    pkg: '@texuli/data',
    motion: 'Loads texuli/motion list motion only once a change can animate',
    live: '#layout',
  },
  {
    file: 'packages/forms/src/view/SchemaForm.svelte',
    component: 'SchemaForm',
    pkg: '@texuli/forms',
    motion: 'Each new step fades in, fast',
    live: '/forms-page/#flow',
  },
  {
    file: 'packages/pages/src/editor/BlockList.svelte',
    component: 'PageEditor blocks',
    pkg: '@texuli/pages',
    motion: 'Blocks glide on insert, remove and move (FLIP), fast',
    live: '/documents-page/#workbench',
  },
  {
    file: 'packages/pages/src/editor/PageEditorCore.svelte',
    component: 'PageEditor',
    pkg: '@texuli/pages',
    motion: 'Takes the motion prop and passes it to its block list',
    live: '/documents-page/#workbench',
  },
  {
    file: 'packages/pages/src/editor/context.ts',
    component: 'Editor context',
    pkg: '@texuli/pages',
    motion: 'Shares the editor’s motion prop with its rows',
    live: '/documents-page/#workbench',
  },
  {
    file: 'packages/pages/src/collab/CollabEditorCore.svelte',
    component: 'CollabEditor',
    pkg: '@texuli/pages',
    motion: 'The same block motion in collaborative editing',
    live: '/documents-page/#collab',
  },
  {
    file: 'packages/canvas/src/editor/CanvasSurface.svelte',
    component: 'Canvas zoom and fit',
    pkg: '@texuli/canvas',
    motion: 'Zoom and fit glide through the runtime',
    live: '/canvas-page/#editor',
  },
  {
    file: 'packages/player/src/motion/context.ts',
    component: 'Player motion settings',
    pkg: '@texuli/player',
    motion: 'The level a blueprint or host sets',
    live: '#blueprint',
  },
  {
    file: 'packages/player/src/motion/runtime.ts',
    component: 'Blueprint node motion',
    pkg: '@texuli/player',
    motion: 'Enter, exit, layout and stagger declared as data',
    live: '#blueprint',
  },
  {
    file: 'packages/slides/src/stage/motion.ts',
    component: 'Slide transitions and fragments',
    pkg: '@texuli/slides',
    motion: 'Every transition and fragment effect at the deck’s level',
    live: '#deck',
  },
  {
    file: 'packages/slides/src/stage/motion-capture.ts',
    component: 'Stage motion (static half)',
    pkg: '@texuli/slides',
    motion: 'Reads fragments before a step change and loads the runtime half',
    live: '#deck',
  },
];

/** The pattern that marks a file as an adopter (an import of the runtime or a seam call). */
export const ADOPTER_PATTERN =
  /from '@texuli\/core\/motion'|from 'texuli\/motion'|\bcreate(?:Overlay|Presence|List|Indicator|Size)Motion\(/;

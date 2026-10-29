/**
 * Exported Svelte components with no catalog manifest of their own, each
 * with the reason. The coverage gate (`coverage.test.ts`) fails on any
 * exported component that has neither a manifest nor a row here, and on any
 * row that is stale (the component has a manifest now, or is gone).
 *
 * The list may only shrink: `EXCLUSION_CEILING` is the current count. Lower
 * it whenever a row goes away; never raise it. A new component gets a
 * manifest, not a row.
 *
 * Reason kinds:
 * - `part`: a part of a compound whose root has the named manifest; it
 *   paints inside that manifest and is not addressable alone.
 * - `chrome`: an overlay, focus trap or app shell. Overlays and shells are
 *   never agent-emittable (`src/build/tiers.ts`); the host composes them.
 * - `utility`: a helper with no content of its own (an icon set, a visually
 *   hidden span, a scroll container).
 * - `painted-by`: data that a catalog id paints under another name.
 * - `planned`: should become a manifest (a real gap, tracked here).
 */

export type ExclusionKind = 'part' | 'chrome' | 'utility' | 'painted-by' | 'planned';

export interface CatalogExclusion {
  /** `<package>::<Component>` as the coverage matrix names it. */
  key: string;
  kind: ExclusionKind;
  reason: string;
}

const rows: CatalogExclusion[] = [];
const add = (pkg: string, kind: ExclusionKind, reason: string, names: readonly string[]) => {
  for (const name of names) rows.push({ key: `${pkg}::${name}`, kind, reason });
};

// ── texuli ─────────────────────────────────────────────────────
add('texuli', 'part', 'A part of card (manifest card).', [
  'CardContent',
  'CardDescription',
  'CardFooter',
  'CardHeader',
  'CardMedia',
  'CardTitle',
]);
add('texuli', 'part', 'A part of alert (manifest alert).', ['AlertSurface', 'ToneIcon']);
add('texuli', 'part', 'A part of combobox or multi-select (manifests combobox, multi-select).', [
  'ComboboxChip',
  'ComboboxChips',
  'ComboboxContent',
  'ComboboxEmpty',
  'ComboboxError',
  'ComboboxField',
  'ComboboxInput',
  'ComboboxItem',
  'ComboboxLoading',
  'ComboboxPortal',
  'ComboboxRoot',
  'ComboboxTrigger',
  'ComboboxViewport',
  'MultiSelectRoot',
]);
add('texuli', 'part', 'A part of the command palette (manifest command-palette).', [
  'Command',
  'CommandEmpty',
  'CommandGroup',
  'CommandGroupHeading',
  'CommandGroupItems',
  'CommandInput',
  'CommandItem',
  'CommandList',
  'CommandLoading',
  'CommandRoot',
  'CommandTrigger',
]);
add('texuli', 'part', 'A part of the menus (manifests dropdown-menu, context-menu, menubar).', [
  'ContextMenuContent',
  'ContextMenuRoot',
  'DropdownMenuPortal',
  'DropdownMenuRoot',
  'MenubarContent',
  'MenubarMenu',
  'MenubarRoot',
  'MenuCheckboxItem',
  'MenuGroup',
  'MenuLabel',
  'MenuRadioGroup',
  'MenuRadioItem',
  'MenuSeparator',
  'MenuSub',
  'MenuSubContent',
  'MenuSubTrigger',
]);
add('texuli', 'part', 'A part of the navigation menu (manifest navigation-menu).', [
  'NavigationMenuContent',
  'NavigationMenuIndicator',
  'NavigationMenuItem',
  'NavigationMenuLink',
  'NavigationMenuList',
  'NavigationMenuRoot',
  'NavigationMenuTrigger',
  'NavigationMenuViewport',
]);
add('texuli', 'part', 'A part of pagination (manifest pagination).', [
  'PaginationEllipsis',
  'PaginationNext',
  'PaginationPage',
  'PaginationPrevious',
  'PaginationRoot',
]);
add('texuli', 'part', 'A part of popover or hover card (manifests popover, hover-card).', [
  'HoverCardRoot',
  'HoverCardTrigger',
  'PopoverClose',
  'PopoverRoot',
  'PopoverTrigger',
]);
add('texuli', 'part', 'A part of select (manifest select).', ['SelectRoot']);
add(
  'texuli',
  'part',
  'A part of sheet, drawer, detail panel or responsive modal (manifests sheet, drawer, detail-panel, responsive-modal).',
  [
    'DetailPanelContent',
    'DrawerContent',
    'Panel',
    'ResponsiveModalContent',
    'SheetBody',
    'SheetCloseButton',
    'SheetContent',
    'SheetFooter',
    'SheetHeader',
    'SheetOverlay',
  ]
);
add('texuli', 'part', 'A part of table (manifest table).', [
  'TableBody',
  'TableCaption',
  'TableCell',
  'TableEmpty',
  'TableFooter',
  'TableHead',
  'TableHeader',
  'TableRow',
]);
add('texuli', 'part', 'A part of timeline (manifest timeline).', ['TimelineItem']);
add('texuli', 'part', 'A part of number field or pin input; the parent is planned below.', [
  'NumberFieldDecrement',
  'NumberFieldIncrement',
  'NumberFieldInput',
  'NumberFieldRoot',
  'PinInputCell',
  'PinInputRoot',
]);
add('texuli', 'part', 'A part of toggle group or toolbar; the parent is planned below.', [
  'ToggleGroupItem',
  'ToolbarButton',
  'ToolbarGroup',
  'ToolbarGroupItem',
  'ToolbarLink',
  'ToolbarSeparator',
]);
add(
  'texuli',
  'part',
  'A part of a resizable panel group (app chrome; split-view covers fixed splits).',
  ['ResizableHandle', 'ResizablePanel', 'ResizablePanelGroup']
);
add(
  'texuli',
  'chrome',
  'An app shell or host-routed layout: host composition, never blueprint data.',
  [
    'AppShell',
    'AuthSplitHostLayout',
    'BottomNav',
    'DrawerScope',
    'MasterDetailLayout',
    'MobileAppFrame',
    'MobileDrawerLayout',
    'MobileHeader',
    'MobileTabsLayout',
    'RailLayout',
    'WizardHostLayout',
  ]
);
add(
  'texuli',
  'chrome',
  'A section of the marketing layout (manifest layout-marketing), placed by the host.',
  ['MarketingSection']
);
add('texuli', 'chrome', 'Uploading files is host chrome: a blueprint never asks for local files.', [
  'FileUpload',
]);
add(
  'texuli',
  'utility',
  'Icons are referenced by name inside other components (icon-button, nav-icon).',
  ['Icon', 'LucideIcon']
);
add('texuli', 'utility', 'A layout or accessibility helper with no content of its own.', [
  'AspectRatio',
  'ScrollArea',
  'Separator',
  'VisuallyHidden',
]);
add(
  'texuli',
  'utility',
  'Writes to the clipboard on press: host chrome next to code (manifest code).',
  ['CopyButton']
);
add('texuli', 'planned', 'Planned manifest: a display component with plain data props.', [
  'Avatar',
  'AvatarGroup',
  'CardGrid',
  'Carousel',
  'KpiRow',
  'Progress',
  'Skeleton',
  'Spinner',
]);
add(
  'texuli',
  'planned',
  'Planned manifest: disclosure or wizard structure with a bindable open value.',
  ['Accordion', 'Collapsible', 'Tabs', 'Wizard']
);
add('texuli', 'planned', 'Planned manifest: an input with a bindable value (spec 0.3.0 bind).', [
  'Calendar',
  'ColorPicker',
  'DatePicker',
  'DateRangePicker',
  'NumberField',
  'PinInput',
  'Rating',
  'Slider',
  'TagsInput',
  'Toggle',
  'ToggleGroup',
]);
add('texuli', 'planned', 'Planned manifest: a toolbar of host actions (closed emit intents).', [
  'Toolbar',
]);
add('texuli', 'planned', 'Planned manifest; data-tree-view covers trees from data today.', [
  'TreeView',
]);

// ── @texuli/data ───────────────────────────────────────────────
add('@texuli/data', 'painted-by', 'Painted by data-calendar.', ['CalendarView']);
add('@texuli/data', 'painted-by', 'Painted by data-map.', ['MapView']);
add('@texuli/data', 'painted-by', 'Painted by data-timeline.', ['TimelineView']);
add('@texuli/data', 'painted-by', 'Painted by data-tree-view.', ['TreeDataView']);
add('@texuli/data', 'part', 'A part of the editable grid.', ['CellEditor']);
add(
  '@texuli/data',
  'planned',
  'Planned: data-grid variants (column operations, editing, virtual rows).',
  ['ColumnGrid', 'EditableDataGrid', 'VirtualDataGrid']
);
add('@texuli/data', 'planned', 'Planned manifest: an activity feed with reactions and filters.', [
  'ActivityFeed',
]);

// ── @texuli/chat ───────────────────────────────────────────────
add('@texuli/chat', 'part', 'A part of the live chat thread.', ['MessageList', 'TypingIndicator']);
add(
  '@texuli/chat',
  'chrome',
  'The composer is host chrome (player design §8): a blueprint never supplies one.',
  ['Composer']
);
add(
  '@texuli/chat',
  'planned',
  'Planned: the live thread with streaming; chat-thread is the display-only transcript.',
  ['ChatThread']
);

// ── @texuli/workflows ──────────────────────────────────────────
add('@texuli/workflows', 'painted-by', 'Painted by workflow-graph (mode view).', [
  'WorkflowViewer',
]);
add('@texuli/workflows', 'painted-by', 'Painted by workflow-graph (mode edit).', [
  'WorkflowEditor',
]);
add('@texuli/workflows', 'part', 'A part of the workflow editor (workflow-graph, mode edit).', [
  'WorkflowCanvas',
  'WorkflowInspector',
  'WorkflowMinimap',
  'WorkflowNodeBody',
  'WorkflowOutline',
  'WorkflowPalette',
  'WorkflowToolbar',
]);

// ── @texuli/charts ─────────────────────────────────────────────
add(
  '@texuli/charts',
  'part',
  'A chart building block the chart families compose (axis, legend, tooltip, layers, frames, table view).',
  [
    'AnnotationLayer',
    'Axis',
    'ChartTable',
    'InteractivePlot',
    'Legend',
    'MatrixFrame',
    'RampLegend',
    'TableToggle',
    'Tooltip',
    'TooltipCrosshairLayer',
  ]
);
add('@texuli/charts', 'planned', 'Planned manifest: a chart family with plain data props.', [
  'BoxPlotChart',
  'CalendarHeatmap',
  'EcdfChart',
  'HistogramChart',
  'PackChart',
  'ViolinChart',
]);

// ── @texuli/media ──────────────────────────────────────────────
add('@texuli/media', 'planned', 'Planned manifest: a media player with untrusted-tier sources.', [
  'AudioPlayer',
  'CompositionAnimationPlayer',
  'VideoPlayer',
  'Waveform',
]);
add('@texuli/media', 'planned', 'Planned manifest: captions, chapters and transcripts.', [
  'CaptionsPanel',
  'ChapterMenu',
  'TranscriptView',
]);
add('@texuli/media', 'planned', 'Planned manifest: a gallery and its lightbox.', [
  'Gallery',
  'Lightbox',
]);
add('@texuli/media', 'chrome', 'An editing or export tool: host chrome that writes files.', [
  'AnimationTimeline',
  'CompositionExport',
  'ImageEditor',
  'VideoEditPanel',
]);
add(
  '@texuli/media',
  'chrome',
  'A generation slot: the host runs the generator; blueprints never trigger it.',
  ['GenerationRequestPlaceholder', 'GeneratorSlot']
);

// ── @texuli/blocks ─────────────────────────────────────────────
add('@texuli/blocks', 'part', 'A renderer inside its block family (manifests blocks-*).', [
  'CalculatorBlock',
  'ChartBlockView',
  'ChecklistBlock',
  'EmbedApp',
  'LinkPreview',
  'PollBlock',
  'QuizBlock',
  'RichText',
]);

export const CATALOG_EXCLUSIONS: readonly CatalogExclusion[] = Object.freeze(rows);

/** The current number of rows. It may only go down. */
// Raised once from 200 to 208 (PLAN_009, developer decision 2026-10-28):
// four sheet parts, three mobile shell parts and the matrix RampLegend can't
// be manifests: overlays and shells are never agent-emittable
// (src/build/tiers.ts) and chart parts are composed by their families. New
// content components still get a manifest.
export const EXCLUSION_CEILING = 208;

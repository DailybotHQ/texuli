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
add('texuli', 'part', 'A part of icon (manifest icon); the Lucide set of the same id.', [
  'LucideIcon',
]);
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
add('texuli', 'part', 'A part of number-field (manifest number-field).', [
  'NumberFieldDecrement',
  'NumberFieldIncrement',
  'NumberFieldInput',
  'NumberFieldRoot',
]);
add('texuli', 'part', 'A part of pin-input (manifest pin-input).', [
  'PinInputCell',
  'PinInputRoot',
]);
add(
  'texuli',
  'part',
  'A part of toggle-group (manifest toggle-group) or toolbar; toolbar is planned below.',
  [
    'ToggleGroupItem',
    'ToolbarButton',
    'ToolbarGroup',
    'ToolbarGroupItem',
    'ToolbarLink',
    'ToolbarSeparator',
  ]
);
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
    'DrawerScope',
    'MasterDetailLayout',
    'MobileDrawerLayout',
    'MobileTabsLayout',
    'RailLayout',
    'WizardHostLayout',
  ]
);
add(
  'texuli',
  'chrome',
  'A section of the marketing layout (manifest layout-marketing), placed by the host.',
  ['MarketingSection', 'MarketingSectionHeader']
);
add(
  'texuli',
  'chrome',
  'The design-system UI kit (texuli/ds-kit) is a host page that renders a design-system document, never blueprint data.',
  [
    'ApprovalBadge',
    'DesignSystemKit',
    'KitApproval',
    'KitChanges',
    'KitFoundations',
    'KitLibrary',
    'KitMatrix',
    'KitModeSwitch',
    'KitVoice',
  ]
);
add('texuli', 'utility', 'A layout or accessibility helper with no content of its own.', [
  'AspectRatio',
  'ScrollArea',
  'VisuallyHidden',
]);
add(
  'texuli',
  'utility',
  'A motion level provider with no content of its own; blueprints declare motion as data (spec 0.6.0).',
  ['MotionProvider']
);
add(
  'texuli',
  'utility',
  "A looping motion over the host's own children (D-G-046); app code ties it to state it owns (audio playing), and blueprint motion stays enter, exit, layout, stagger and duration (spec 0.6.0), with no loop to name.",
  ['MotionLoop']
);
add(
  'texuli',
  'utility',
  'A design-system scope with no content of its own; it takes a compiled design system from the host, and blueprints reference design systems as data (ADR-023).',
  ['DesignSystemProvider']
);
add(
  'texuli',
  'utility',
  'A label dictionary scope with no content of its own; it translates the built-in labels of the components below (ADR-026), and blueprint text is data the agent writes.',
  ['LabelsProvider']
);
add(
  'texuli',
  'utility',
  'An icon registry scope with no content of its own; the host registers its icon components or path data, and blueprints reference icons by name.',
  ['IconsProvider']
);
add(
  'texuli',
  'utility',
  'Writes to the clipboard on press: host chrome next to code (manifest code).',
  ['CopyButton']
);
add('texuli', 'planned', 'Planned manifest: a display component with plain data props.', [
  'AvatarGroup',
  'CardGrid',
  'KpiRow',
]);
add(
  'texuli',
  'planned',
  'Planned manifest: disclosure or wizard structure with a bindable open value.',
  ['Collapsible', 'Wizard']
);
add('texuli', 'planned', 'Planned manifest: an input with a bindable value (spec 0.3.0 bind).', [
  'Calendar',
  'ColorPicker',
  'DatePicker',
  'DateRangePicker',
  'Slider',
  'Toggle',
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
// PLAN_023 T-md-adopt-followup: real manifests (data-metric-card, data-filter-bar) are new
// catalog ids, a blueprint spec vocabulary change (packages/spec catalog, generated TS and
// Kotlin vocabularies, a spec minor); until that lands they are tracked here.
add(
  '@texuli/data',
  'planned',
  'Planned manifest data-metric-card: a KPI tile with value, delta and trend (needs a spec catalog id).',
  ['MetricCard']
);
add(
  '@texuli/data',
  'planned',
  'Planned manifest data-filter-bar: an applied-filter toolbar over data-filter-builder (needs a spec catalog id).',
  ['FilterBar']
);

// ── @texuli/chat ───────────────────────────────────────────────
add('@texuli/chat', 'part', 'A part of the live chat thread.', ['MessageList', 'TypingIndicator']);
add(
  '@texuli/chat',
  'planned',
  'Planned: the live thread with streaming; chat-thread is the display-only transcript.',
  ['ChatThread']
);
// PLAN_023 T-cmp-chat: a chat-attachment catalog id is a spec vocabulary change (owner decision).
add(
  '@texuli/chat',
  'planned',
  'Planned manifest chat-attachment: a blueprint attachment card (validate, then paint with the player); needs a spec catalog id.',
  ['ChatAttachment']
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
// content components still get a manifest. Raised to 210 under the same
// decision (PLAN_010): MarketingSectionHeader is marketing chrome placed by
// the host and MotionProvider a contentless utility. Raised to 211 in
// PLAN_011 (lead decision under the plan's trust mode, recorded in its
// decisions log): DesignSystemProvider is a contentless scope like
// MotionProvider; the host passes it a compiled design system. Raised to 212
// for LabelsProvider (ADR-026), another contentless scope: the host passes it
// a label dictionary. Raised to 213 for IconsProvider (D-G-021), another
// contentless scope: the host passes it an icon registry. Raised to 214 for
// CodeField (D-G-022, lead decision for 0.13.1): planned, its catalog id
// waits for the next spec minor because it changes the spec contract.
// Raised to 215 for AvatarGroupGrid (D-G-024, lead decision for 0.13.1),
// planned alongside AvatarGroup: the same display data, a new catalog id
// that waits for the next spec minor. Lowered to 213 with spec 0.12.0
// (0.14.0): CodeField and AvatarGroupGrid have manifests (AvatarGroup stays
// planned with Avatar). Raised to 214 for MotionLoop (D-G-046, 0.14.0): a
// motion utility over the host's children, like MotionProvider, with no
// content of its own; a loop is not in the spec motion vocabulary.
// Raised to 215 for ListItem (UG-42, 0.14.3 patch lane): planned, like
// CodeField was, because a new catalog id changes the spec contract and a
// patch release cannot carry a spec minor.
// Raised to 219 for the design-system UI kit pages (PLAN_016 T4, lead decision): host
// pages that render a design-system document, never blueprint data. Raised to 222
// for the kit's library and changes sections (KitLibrary, KitChanges, ApprovalBadge;
// PLAN_016 T-t4-library), the same kit chrome, to 223 for KitVoice (T-t4-voice), and
// to 224 for KitMatrix (T-t4-matrix). Lowered to 219 in PLAN_016 T-widen-app:
// Accordion, Tabs, BottomNav, MobileHeader and Composer gained manifests
// (host chrome stays non-emittable; the allow set governs them). Lowered
// again in PLAN_016 T-widen-display: Icon, Avatar, Skeleton, Progress, Spinner,
// Carousel, Separator and ListItem became catalog ids (LucideIcon is a part of
// icon). Combined ceiling is the live row count.
// 207: raised for MetricCard, FilterBar and ChatAttachment (PLAN_023), pending their spec catalog ids.
export const EXCLUSION_CEILING = 207;

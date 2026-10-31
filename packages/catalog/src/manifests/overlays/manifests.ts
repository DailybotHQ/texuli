import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest } from '../../manifest/types.ts';
import {
  alertDialogPropNames,
  appNavPropNames,
  breadcrumbPropNames,
  commandPalettePropNames,
  contextMenuPropNames,
  contextMenuTriggerPropNames,
  detailPanelContentPropNames,
  dialogPropNames,
  drawerContentPropNames,
  dropdownMenuContentPropNames,
  dropdownMenuItemPropNames,
  dropdownMenuPropNames,
  dropdownMenuTriggerPropNames,
  hoverCardContentPropNames,
  hoverCardPropNames,
  menubarPropNames,
  menubarTriggerPropNames,
  navigationMenuPropNames,
  paginationPropNames,
  popoverContentPropNames,
  popoverPropNames,
  responsiveModalContentPropNames,
  sheetContentPropNames,
  sidebarPropNames,
  toasterPropNames,
  tooltipPropNames,
} from './prop-names.ts';

const PKG = 'texuli';

/* @__NO_SIDE_EFFECTS__ */
function propsFrom(
  names: readonly string[],
  detail: Record<
    string,
    {
      kind: CatalogManifest['props'][number]['kind'];
      required?: boolean;
      description?: string;
      enumValues?: readonly string[];
      default?: unknown;
      trust?: 'developer' | 'untrusted';
    }
  >
): CatalogManifest['props'] {
  return names.map((name) => {
    const meta = detail[name];
    if (!meta) throw new Error(`Missing prop detail for "${name}"`);
    return {
      name,
      kind: meta.kind,
      ...(meta.required ? { required: true } : {}),
      ...(meta.description ? { description: meta.description } : {}),
      ...(meta.enumValues ? { enumValues: meta.enumValues } : {}),
      ...(meta.default !== undefined ? { default: meta.default } : {}),
      ...(meta.trust ? { trust: meta.trust } : {}),
    };
  });
}

const menuSizes = ['sm', 'md', 'lg'] as const;
const menuVariants = ['default', 'soft'] as const;
const dialogSizes = ['sm', 'md', 'lg', 'xl'] as const;
const popoverVariants = ['elevated', 'flat'] as const;
const popoverSizes = ['sm', 'md', 'lg'] as const;
const sheetSizes = ['sm', 'md', 'lg', 'xl'] as const;
const sheetSides = ['top', 'right', 'bottom', 'left', 'start', 'end', 'center'] as const;
const tooltipSides = ['top', 'right', 'bottom', 'left'] as const;
const tooltipAligns = ['start', 'center', 'end'] as const;
const navSizes = ['sm', 'md', 'lg'] as const;
const paginationVariants = ['outline', 'soft'] as const;
const sidebarVariants = ['default', 'inset'] as const;
const commandSizes = ['sm', 'md', 'lg'] as const;
const commandVariants = ['outline', 'soft'] as const;

export const dialogManifest = /* @__PURE__ */ manifestData({
  id: 'dialog',
  package: PKG,
  label: 'Dialog',
  summary: 'Modal dialog with title, optional description, body and footer.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Confirm multi-step flows', 'Show focused detail without leaving the page'],
  dontUseWhen: [
    'A destructive confirm that must trap attention (use alert-dialog)',
    'Non-modal hints (use popover or tooltip)',
  ],
  a11y: [
    'Focus moves into the dialog and returns on close',
    'Title is required; Escape dismisses unless prevented',
  ],
  props: propsFrom(dialogPropNames, {
    open: { kind: 'boolean', default: false },
    title: { kind: 'string', required: true, description: 'Accessible dialog title' },
    description: { kind: 'string' },
    size: { kind: 'enum', enumValues: [...dialogSizes], default: 'md' },
    trigger: { kind: 'slot', description: 'Trigger snippet receiving { props }' },
    footer: { kind: 'slot' },
    children: { kind: 'slot' },
    hideClose: { kind: 'boolean', default: false },
    closeLabel: { kind: 'string', default: 'Close' },
    onOpenChange: { kind: 'event' },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'basic',
      title: 'Basic dialog',
      props: { title: 'Edit note', description: 'Harbor Notes settings', open: true },
    },
  ],
  related: ['alert-dialog', 'sheet'],
});

export const alertDialogManifest = /* @__PURE__ */ manifestData({
  id: 'alert-dialog',
  package: PKG,
  label: 'AlertDialog',
  summary: 'Modal confirm/cancel dialog for consequential actions.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Confirm delete or irreversible actions', 'Require an explicit choice'],
  dontUseWhen: ['Informational copy without a choice (use dialog or toast)'],
  a11y: [
    'Role alertdialog; focus trapped until confirm or cancel',
    'Destructive mode styles the confirm action and warning icon',
  ],
  props: propsFrom(alertDialogPropNames, {
    open: { kind: 'boolean', default: false },
    title: { kind: 'string', required: true },
    description: { kind: 'string' },
    confirmLabel: { kind: 'string', default: 'Confirm' },
    cancelLabel: { kind: 'string', default: 'Cancel' },
    destructive: { kind: 'boolean', default: false },
    onConfirm: { kind: 'event' },
    onCancel: { kind: 'event' },
    trigger: { kind: 'slot' },
    children: { kind: 'slot' },
    class: { kind: 'string' },
    errorFallback: { kind: 'string' },
    onOpenChange: { kind: 'event' },
  }),
  examples: [
    {
      id: 'delete',
      title: 'Destructive confirm',
      props: {
        title: 'Delete note?',
        description: 'This cannot be undone.',
        destructive: true,
        confirmLabel: 'Delete',
        open: true,
      },
    },
  ],
  related: ['dialog', 'toaster'],
});

export const dropdownMenuManifest = /* @__PURE__ */ manifestData({
  id: 'dropdown-menu',
  package: PKG,
  label: 'DropdownMenu',
  summary: 'Menu button pattern with items, checkboxes, radios and submenus.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Actions behind a button trigger', 'Menus with keyboard typeahead'],
  dontUseWhen: [
    'Top-level app menus (use menubar)',
    'Pointer-anchored region menus (use context-menu)',
  ],
  a11y: 'APG menu button: arrow keys, typeahead, Escape closes and restores focus.',
  props: propsFrom(dropdownMenuPropNames, {
    open: { kind: 'boolean', default: false },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'actions', title: 'Actions menu', props: { open: true } }],
  related: ['context-menu', 'menubar', 'dropdown-menu-item'],
});

export const dropdownMenuTriggerManifest = /* @__PURE__ */ manifestData({
  id: 'dropdown-menu-trigger',
  package: PKG,
  label: 'DropdownMenu.Trigger',
  summary: 'Styled button that opens a dropdown menu.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Label the control that opens DropdownMenu'],
  dontUseWhen: ['Context or menubar triggers'],
  a11y: 'aria-haspopup=menu and aria-expanded track open state.',
  props: propsFrom(dropdownMenuTriggerPropNames, {
    size: { kind: 'enum', enumValues: [...menuSizes], default: 'md' },
    variant: { kind: 'enum', enumValues: [...menuVariants], default: 'default' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'default', title: 'Trigger', props: { variant: 'default' } }],
  related: ['dropdown-menu'],
});

export const dropdownMenuContentManifest = /* @__PURE__ */ manifestData({
  id: 'dropdown-menu-content',
  package: PKG,
  label: 'DropdownMenu.Content',
  summary: 'Floating menu surface for dropdown items.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Host menu items under a dropdown trigger'],
  dontUseWhen: ['Non-menu floating panels (use popover)'],
  a11y: 'role=menu; labelled by the trigger.',
  props: propsFrom(dropdownMenuContentPropNames, {
    size: { kind: 'enum', enumValues: [...menuSizes], default: 'md' },
    variant: { kind: 'enum', enumValues: [...menuVariants], default: 'default' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
    side: { kind: 'enum', enumValues: ['top', 'right', 'bottom', 'left'], default: 'bottom' },
    align: { kind: 'enum', enumValues: ['start', 'center', 'end'], default: 'start' },
    sideOffset: { kind: 'number', default: 4 },
  }),
  examples: [{ id: 'panel', title: 'Content', props: { size: 'md' } }],
  related: ['dropdown-menu', 'dropdown-menu-item'],
});

export const dropdownMenuItemManifest = /* @__PURE__ */ manifestData({
  id: 'dropdown-menu-item',
  package: PKG,
  label: 'DropdownMenu.Item',
  summary: 'Menu item with optional icon and shortcut chrome.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['A single actionable row inside a menu'],
  dontUseWhen: ['Standalone buttons outside a menu'],
  a11y: 'role=menuitem; shortcuts are visual only.',
  props: propsFrom(dropdownMenuItemPropNames, {
    disabled: { kind: 'boolean', default: false },
    textValue: { kind: 'string', description: 'Typeahead text override' },
    onSelect: { kind: 'event' },
    closeOnSelect: { kind: 'boolean', default: true },
    icon: { kind: 'slot' },
    shortcut: { kind: 'string', description: 'Displayed keyboard hint' },
    inset: { kind: 'boolean', default: false },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [
    {
      id: 'with-shortcut',
      title: 'Item with shortcut',
      props: { shortcut: '⌘N' },
    },
  ],
  related: ['dropdown-menu', 'context-menu'],
});

export const contextMenuManifest = /* @__PURE__ */ manifestData({
  id: 'context-menu',
  package: PKG,
  label: 'ContextMenu',
  summary: 'Pointer-anchored menu (right-click, long-press, Menu key).',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Actions on a canvas or list row via context click'],
  dontUseWhen: ['A visible button trigger (use dropdown-menu)'],
  a11y: 'Opens at the pointer; keyboard Menu/Shift+F10 supported on the region.',
  props: propsFrom(contextMenuPropNames, {
    open: { kind: 'boolean', default: false },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'region', title: 'Context region', props: {} }],
  related: ['dropdown-menu', 'context-menu-trigger'],
});

export const contextMenuTriggerManifest = /* @__PURE__ */ manifestData({
  id: 'context-menu-trigger',
  package: PKG,
  label: 'ContextMenu.Trigger',
  summary: 'Region that opens the context menu.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Define the hit target for a context menu'],
  dontUseWhen: ['Button menus'],
  a11y: 'Region text names the menu; long-press suppresses iOS callout.',
  props: propsFrom(contextMenuTriggerPropNames, {
    class: { kind: 'string' },
    children: { kind: 'slot' },
    disabled: { kind: 'boolean', default: false },
  }),
  examples: [{ id: 'canvas', title: 'Canvas region', props: {} }],
  related: ['context-menu'],
});

export const menubarManifest = /* @__PURE__ */ manifestData({
  id: 'menubar',
  package: PKG,
  label: 'Menubar',
  summary: 'Application menubar with roving top-level items.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Desktop-style File/Edit/View bars'],
  dontUseWhen: ['A single actions button (use dropdown-menu)'],
  a11y: 'role=menubar; one Tab stop; arrows move between menus.',
  props: propsFrom(menubarPropNames, {
    value: { kind: 'string', description: 'Open menu value or empty' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
    loop: { kind: 'boolean', default: true },
    dir: { kind: 'enum', enumValues: ['ltr', 'rtl'] },
  }),
  examples: [{ id: 'app', title: 'Application bar', props: { value: 'file' } }],
  related: ['menubar-trigger', 'dropdown-menu'],
});

export const menubarTriggerManifest = /* @__PURE__ */ manifestData({
  id: 'menubar-trigger',
  package: PKG,
  label: 'Menubar.Trigger',
  summary: 'Top-level menubar item that opens a menu.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Label a menubar menu'],
  dontUseWhen: ['Dropdown button triggers'],
  a11y: 'role=menuitem with aria-haspopup=menu.',
  props: propsFrom(menubarTriggerPropNames, {
    size: { kind: 'enum', enumValues: [...menuSizes], default: 'md' },
    variant: { kind: 'enum', enumValues: [...menuVariants], default: 'default' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
    disabled: { kind: 'boolean', default: false },
  }),
  examples: [{ id: 'file', title: 'File', props: {} }],
  related: ['menubar'],
});

export const popoverManifest = /* @__PURE__ */ manifestData({
  id: 'popover',
  package: PKG,
  label: 'Popover',
  summary: 'Non-modal floating panel anchored to a trigger.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Lightweight detail next to a control', 'Pickers that are not full dialogs'],
  dontUseWhen: ['Modal workflows (use dialog)', 'Single-line hints (use tooltip)'],
  a11y: 'Focus can move into the panel; Escape dismisses.',
  props: propsFrom(popoverPropNames, {
    open: { kind: 'boolean', default: false },
    onOpenChange: { kind: 'event' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'open', title: 'Open popover', props: { open: true } }],
  related: ['hover-card', 'tooltip', 'dialog'],
});

export const popoverContentManifest = /* @__PURE__ */ manifestData({
  id: 'popover-content',
  package: PKG,
  label: 'Popover.Content',
  summary: 'Styled popover surface with optional arrow.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Body of a popover'],
  dontUseWhen: ['Menu lists (use dropdown-menu-content)'],
  a11y: 'Provide a visible heading or aria-label when needed.',
  props: propsFrom(popoverContentPropNames, {
    variant: { kind: 'enum', enumValues: [...popoverVariants], default: 'elevated' },
    size: { kind: 'enum', enumValues: [...popoverSizes], default: 'md' },
    arrow: { kind: 'boolean', default: true },
    class: { kind: 'string' },
    children: { kind: 'slot' },
    side: { kind: 'enum', enumValues: [...tooltipSides], default: 'bottom' },
    align: { kind: 'enum', enumValues: [...tooltipAligns], default: 'center' },
    sideOffset: { kind: 'number', default: 8 },
    initialFocus: {
      kind: 'unknown',
      description:
        'An element inside the content, or a function returning one, to focus on open (for example the selected date). Falls back to the first control, else the content. Host-only: not agent-emittable (elements and functions are not data).',
    },
  }),
  examples: [{ id: 'elevated', title: 'Elevated', props: { variant: 'elevated' } }],
  related: ['popover'],
});

export const hoverCardManifest = /* @__PURE__ */ manifestData({
  id: 'hover-card',
  package: PKG,
  label: 'HoverCard',
  summary: 'Preview panel that opens on hover or focus.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Rich previews without a click'],
  dontUseWhen: ['Required interactions (use popover or dialog)'],
  a11y: 'Opens on focus as well as hover; dismissible.',
  props: propsFrom(hoverCardPropNames, {
    open: { kind: 'boolean', default: false },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'preview', title: 'Preview', props: {} }],
  related: ['popover', 'tooltip'],
});

export const hoverCardContentManifest = /* @__PURE__ */ manifestData({
  id: 'hover-card-content',
  package: PKG,
  label: 'HoverCard.Content',
  summary: 'Styled hover-card surface.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Body of a hover card'],
  dontUseWhen: ['Click-toggled panels (use popover-content)'],
  a11y: 'Same surface tokens as popover for contrast.',
  props: propsFrom(hoverCardContentPropNames, {
    variant: { kind: 'enum', enumValues: [...popoverVariants], default: 'elevated' },
    size: { kind: 'enum', enumValues: [...popoverSizes], default: 'md' },
    arrow: { kind: 'boolean', default: true },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'body', title: 'Content', props: {} }],
  related: ['hover-card'],
});

export const sheetManifest = /* @__PURE__ */ manifestData({
  id: 'sheet',
  package: PKG,
  label: 'Sheet',
  summary: 'Edge-anchored modal panel (drawer-like sheet).',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Mobile filters, detail rails, edge panels'],
  dontUseWhen: ['Centered modal forms (use dialog)'],
  a11y: 'Focus trapped while open; Escape dismisses.',
  props: propsFrom(sheetContentPropNames, {
    size: { kind: 'enum', enumValues: [...sheetSizes], default: 'md' },
    side: { kind: 'enum', enumValues: [...sheetSides], default: 'start' },
    modal: {
      kind: 'boolean',
      default: true,
      description: 'false: a non-modal panel (no focus trap, inert or scroll lock)',
    },
    dismissOutside: {
      kind: 'boolean',
      default: false,
      description: 'Non-modal only: close on a press or focus outside (never on the trigger)',
    },
    closeOnEscape: {
      kind: 'boolean',
      default: false,
      description: 'Non-modal only: close on Escape anywhere, not just from inside',
    },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'start', title: 'Start edge', props: { side: 'start', size: 'md' } }],
  related: ['drawer', 'dialog', 'sidebar'],
});

export const drawerManifest = /* @__PURE__ */ manifestData({
  id: 'drawer',
  package: PKG,
  label: 'Drawer',
  summary: 'Bottom or edge drawer with optional drag dismiss.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Mobile sheets that feel like drawers'],
  dontUseWhen: ['Desktop side navigation (use sidebar)'],
  a11y: 'Same focus model as sheet; prefer labelled titles.',
  props: propsFrom(drawerContentPropNames, {
    size: { kind: 'enum', enumValues: [...sheetSizes], default: 'md' },
    side: { kind: 'enum', enumValues: [...sheetSides], default: 'bottom' },
    dismissOutside: {
      kind: 'boolean',
      default: false,
      description: 'Non-modal panels only; a Drawer is modal and always dismisses outside',
    },
    closeOnEscape: {
      kind: 'boolean',
      default: false,
      description: 'Non-modal panels only; a Drawer is modal and always closes on Escape',
    },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'bottom', title: 'Bottom drawer', props: { side: 'bottom' } }],
  related: ['sheet', 'responsive-modal'],
});

export const detailPanelManifest = /* @__PURE__ */ manifestData({
  id: 'detail-panel',
  package: PKG,
  label: 'DetailPanel',
  summary: 'Non-modal detail panel alongside content.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Inspect a selected row without leaving the list'],
  dontUseWhen: ['Full-page blocking flows (use dialog)'],
  a11y: 'Keep a visible heading; do not trap focus unless modal.',
  props: propsFrom(detailPanelContentPropNames, {
    size: { kind: 'enum', enumValues: [...sheetSizes], default: 'md' },
    side: { kind: 'enum', enumValues: [...sheetSides], default: 'end' },
    dismissOutside: {
      kind: 'boolean',
      default: false,
      description: 'Non-modal only: close on a press or focus outside (never on the trigger)',
    },
    closeOnEscape: {
      kind: 'boolean',
      default: false,
      description: 'Non-modal only: close on Escape anywhere, not just from inside',
    },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'end', title: 'End panel', props: { side: 'end' } }],
  related: ['sheet', 'drawer'],
});

export const responsiveModalManifest = /* @__PURE__ */ manifestData({
  id: 'responsive-modal',
  package: PKG,
  label: 'ResponsiveModal',
  summary: 'Dialog on large screens, drawer/sheet on small screens.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['One flow that should adapt across breakpoints'],
  dontUseWhen: ['Fixed desktop-only dialogs'],
  a11y: 'Preserves dialog semantics on large viewports.',
  props: propsFrom(responsiveModalContentPropNames, {
    size: { kind: 'enum', enumValues: [...sheetSizes], default: 'md' },
    side: { kind: 'enum', enumValues: [...sheetSides], default: 'bottom' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'adaptive', title: 'Adaptive', props: { size: 'md' } }],
  related: ['dialog', 'drawer'],
});

export const tooltipManifest = /* @__PURE__ */ manifestData({
  id: 'tooltip',
  package: PKG,
  label: 'Tooltip',
  summary: 'Short delayed hint on hover or focus.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Icon-only controls need a name', 'Optional keyboard shortcut hints'],
  dontUseWhen: ['Essential instructions (put them in visible copy)'],
  a11y: 'Shows on focus; content is plain text or a snippet, never a sink.',
  props: propsFrom(tooltipPropNames, {
    content: { kind: 'string', required: true, description: 'Hint text or rich snippet' },
    children: { kind: 'slot', required: true, description: 'Trigger snippet { props }' },
    shortcut: { kind: 'string', description: 'Shortcut string or list shown as Kbd' },
    side: { kind: 'enum', enumValues: [...tooltipSides], default: 'top' },
    align: { kind: 'enum', enumValues: [...tooltipAligns], default: 'center' },
    sideOffset: { kind: 'number', default: 6 },
    delayDuration: { kind: 'number', default: 300 },
    disabled: { kind: 'boolean', default: false },
    open: { kind: 'boolean', default: false },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'basic',
      title: 'Basic tooltip',
      props: { content: 'Save note', side: 'top' },
    },
  ],
  related: ['popover', 'hover-card'],
});

export const toasterManifest = /* @__PURE__ */ manifestData({
  id: 'toaster',
  package: PKG,
  label: 'Toaster',
  summary: 'Live region that renders toast notifications from the shared store.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Transient success/error feedback after an action'],
  dontUseWhen: ['Blocking errors that need a decision (use alert-dialog)'],
  a11y: 'role=region with polite live updates; dismiss controls are labelled.',
  props: propsFrom(toasterPropNames, {
    label: { kind: 'string', default: 'Notifications' },
    position: {
      kind: 'enum',
      enumValues: [
        'top-start',
        'top-center',
        'top-end',
        'bottom-start',
        'bottom-center',
        'bottom-end',
      ],
      default: 'bottom-end',
      description: 'Block edge and logical inline position; narrow screens center the stack',
    },
    offset: { kind: 'string', description: 'CSS length or px number from the stack edge' },
    store: { kind: 'unknown', description: 'Optional ToastStore inject (tests)' },
    dismissLabel: { kind: 'string', default: 'Dismiss notification' },
    class: { kind: 'string' },
  }),
  examples: [{ id: 'region', title: 'Toaster region', props: { label: 'Notifications' } }],
  related: ['alert-dialog', 'banner'],
});

export const commandPaletteManifest = /* @__PURE__ */ manifestData({
  id: 'command-palette',
  package: PKG,
  label: 'CommandPalette',
  summary: 'Dialog-hosted command palette with search and recent items.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['App-wide jump-to and actions (⌘K)'],
  dontUseWhen: ['Simple select lists (use select or combobox)'],
  a11y: 'Dialog title/description; listbox keyboard for results.',
  props: propsFrom(commandPalettePropNames, {
    open: { kind: 'boolean', default: false },
    onOpenChange: { kind: 'event' },
    search: { kind: 'unknown', description: 'Sync or async search function' },
    onSelect: { kind: 'event' },
    recentItems: { kind: 'array' },
    debounceMs: { kind: 'number' },
    placeholder: { kind: 'string' },
    shortcut: { kind: 'boolean', default: true },
    recentLabel: { kind: 'string' },
    title: { kind: 'string' },
    searchLabel: {
      kind: 'string',
      description: 'Accessible name of the search combobox and its results; defaults to title',
    },
    description: { kind: 'string' },
    emptyLabel: { kind: 'string' },
    recentEmptyLabel: { kind: 'string' },
    loadingLabel: { kind: 'string' },
    errorLabel: { kind: 'string' },
    size: { kind: 'enum', enumValues: [...commandSizes], default: 'md' },
    variant: { kind: 'enum', enumValues: [...commandVariants], default: 'default' },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'palette',
      title: 'Open palette',
      props: { open: true, title: 'Command palette', placeholder: 'Search…' },
    },
  ],
  related: ['dialog', 'dropdown-menu'],
});

export const navigationMenuManifest = /* @__PURE__ */ manifestData({
  id: 'navigation-menu',
  package: PKG,
  label: 'NavigationMenu',
  summary: 'Site or app navigation with expandable triggers and links.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Primary site navigation with flyouts'],
  dontUseWhen: ['In-page tabs (use tabs)', 'App menubar (use menubar)'],
  a11y: 'Landmarks and link semantics; triggers expose expanded state.',
  props: propsFrom(navigationMenuPropNames, {
    value: { kind: 'string' },
    orientation: { kind: 'enum', enumValues: ['horizontal', 'vertical'], default: 'horizontal' },
    dir: { kind: 'enum', enumValues: ['ltr', 'rtl'] },
    delayDuration: { kind: 'number' },
    onValueChange: { kind: 'event' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
  }),
  examples: [{ id: 'main', title: 'Main nav', props: { orientation: 'horizontal' } }],
  related: ['menubar', 'breadcrumb', 'sidebar'],
});

export const breadcrumbManifest = /* @__PURE__ */ manifestData({
  id: 'breadcrumb',
  package: PKG,
  label: 'Breadcrumb',
  summary: 'Hierarchy trail with URL-policy links.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Show location in a hierarchy'],
  dontUseWhen: ['Primary navigation (use navigation-menu or sidebar)'],
  a11y: 'nav landmark; current page is not a link.',
  props: propsFrom(breadcrumbPropNames, {
    items: { kind: 'array', required: true, description: 'BreadcrumbItem[]' },
    label: { kind: 'string', default: 'Breadcrumb' },
    size: { kind: 'enum', enumValues: [...navSizes], default: 'md' },
    separatorLabel: { kind: 'string', default: 'Separator' },
    separator: { kind: 'slot' },
    maxItems: { kind: 'number', default: 0 },
    hrefTrust: {
      kind: 'enum',
      enumValues: ['developer', 'untrusted'],
      default: 'developer',
      trust: 'developer',
    },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'trail',
      title: 'Trail',
      props: {
        items: [
          { label: 'Workspace', href: 'https://example.com' },
          { label: 'Notes', href: 'https://example.com/notes' },
          { label: 'Harbor' },
        ],
      },
    },
  ],
  related: ['navigation-menu', 'pagination'],
});

export const paginationManifest = /* @__PURE__ */ manifestData({
  id: 'pagination',
  package: PKG,
  label: 'Pagination',
  summary: 'Page controls for long lists.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Paging tables or search results'],
  dontUseWhen: ['Infinite scroll only feeds'],
  a11y: 'Named navigation; previous/next buttons disabled at ends.',
  props: propsFrom(paginationPropNames, {
    page: { kind: 'number', default: 1 },
    pageCount: { kind: 'number', required: true },
    size: { kind: 'enum', enumValues: [...navSizes], default: 'md' },
    variant: { kind: 'enum', enumValues: [...paginationVariants], default: 'outline' },
    onPageChange: { kind: 'event' },
    class: { kind: 'string' },
    children: { kind: 'slot' },
    label: { kind: 'string' },
  }),
  examples: [{ id: 'pages', title: 'Twelve pages', props: { page: 1, pageCount: 12 } }],
  related: ['breadcrumb', 'table'],
});

export const sidebarManifest = /* @__PURE__ */ manifestData({
  id: 'sidebar',
  package: PKG,
  label: 'Sidebar',
  summary: 'Collapsible app rail with sections, badges and safe links.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Primary app navigation rail'],
  dontUseWhen: ['Marketing site nav (use navigation-menu)'],
  a11y: 'nav landmark; collapsed items keep accessible names via tooltips.',
  props: propsFrom(sidebarPropNames, {
    items: { kind: 'array' },
    sections: { kind: 'array' },
    collapsed: { kind: 'boolean', default: false },
    collapsible: { kind: 'boolean', default: true },
    drawer: { kind: 'boolean', default: false },
    variant: { kind: 'enum', enumValues: [...sidebarVariants], default: 'default' },
    header: { kind: 'slot' },
    footer: { kind: 'slot' },
    itemIcon: { kind: 'slot' },
    label: { kind: 'string', default: 'Main' },
    collapseLabel: { kind: 'string' },
    expandLabel: { kind: 'string' },
    hrefTrust: {
      kind: 'enum',
      enumValues: ['developer', 'untrusted'],
      default: 'developer',
      trust: 'developer',
    },
    class: { kind: 'string' },
  }),
  examples: [
    {
      id: 'workspace',
      title: 'Workspace rail',
      props: {
        label: 'Main',
        sections: [
          {
            label: 'Workspace',
            items: [{ label: 'Inbox', href: 'https://example.com/inbox', active: true }],
          },
        ],
      },
    },
  ],
  related: ['app-nav', 'navigation-menu', 'sheet'],
});

export const appNavManifest = /* @__PURE__ */ manifestData({
  id: 'app-nav',
  package: PKG,
  label: 'AppNav',
  summary: 'Desktop sidebar shell with mobile sheet drawer and main slot.',
  tier: 'app',
  agentEmittable: false,
  useWhen: ['Full app chrome with responsive navigation'],
  dontUseWhen: ['Sidebar alone inside a custom shell'],
  a11y: 'Menu button opens a labelled sheet; main has a stable id.',
  props: propsFrom(appNavPropNames, {
    items: { kind: 'array' },
    sections: { kind: 'array' },
    collapsed: { kind: 'boolean', default: false },
    collapsible: { kind: 'boolean', default: true },
    variant: { kind: 'enum', enumValues: [...sidebarVariants], default: 'default' },
    header: { kind: 'slot' },
    footer: { kind: 'slot' },
    itemIcon: { kind: 'slot' },
    children: { kind: 'slot' },
    topBar: { kind: 'slot' },
    label: { kind: 'string', default: 'Main' },
    menuLabel: { kind: 'string', default: 'Open navigation' },
    drawerTitle: { kind: 'string', default: 'Navigation' },
    hrefTrust: {
      kind: 'enum',
      enumValues: ['developer', 'untrusted'],
      default: 'developer',
      trust: 'developer',
    },
    mobileOpen: { kind: 'boolean', default: false },
    class: { kind: 'string' },
  }),
  examples: [{ id: 'shell', title: 'App shell', props: { label: 'Main' } }],
  related: ['sidebar', 'sheet'],
});

/** Every overlay/navigation manifest in stable id order. */
export const OVERLAYS_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  alertDialogManifest,
  appNavManifest,
  breadcrumbManifest,
  commandPaletteManifest,
  contextMenuManifest,
  contextMenuTriggerManifest,
  detailPanelManifest,
  dialogManifest,
  drawerManifest,
  dropdownMenuContentManifest,
  dropdownMenuItemManifest,
  dropdownMenuManifest,
  dropdownMenuTriggerManifest,
  hoverCardContentManifest,
  hoverCardManifest,
  menubarManifest,
  menubarTriggerManifest,
  navigationMenuManifest,
  paginationManifest,
  popoverContentManifest,
  popoverManifest,
  responsiveModalManifest,
  sheetManifest,
  sidebarManifest,
  toasterManifest,
  tooltipManifest,
]);

/** Map of component id → expected prop names for type/schema parity tests. */
export { OVERLAYS_PROP_NAMES as OVERLAYS_PROP_NAME_MAP } from './prop-names.ts';

export const overlaysManifestsById = /* @__PURE__ */ Object.freeze(
  /* @__PURE__ */ Object.fromEntries(
    /* @__PURE__ */ OVERLAYS_MANIFESTS.map((manifest) => [manifest.id, manifest])
  ) as Record<string, CatalogManifest>
);

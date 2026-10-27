/**
 * The headless primitives reference: one entry per `@texuli/primitives`
 * subpath, with its anatomy (how the parts nest) and the WAI-ARIA APG
 * pattern it follows. Build-time data only.
 *
 * Every part is the name you import: `Tooltip.Trigger` for a compound object,
 * or a named export such as `Root`. `apps/website/tests/component-pages.test.ts`
 * resolves each one against the package's real exports, so an anatomy cannot
 * name a part that does not exist.
 */

/** One part in an anatomy tree. */
export interface AnatomyNode {
  /** The exported name, e.g. `Tooltip.Content` or `Root`. */
  part: string;
  /** A short role note shown beside the part (optional). */
  note?: string;
  children?: readonly AnatomyNode[];
}

export interface ApgPattern {
  name: string;
  /** The APG pattern or example page, when one exists. */
  href?: string;
}

export interface PrimitiveDoc {
  /** The `@texuli/primitives/<id>` subpath, and the behavior scenario name. */
  id: string;
  name: string;
  summary: string;
  pattern: ApgPattern;
  anatomy: readonly AnatomyNode[];
  /**
   * For a module of plain named parts (`Root`, `Trigger`…): the namespace it is
   * imported as (`import * as Dialog`). Parts are shown as `Dialog.Root`.
   */
  namespace?: string;
  /** Extra notes under the anatomy (variants, related compounds). */
  notes?: readonly string[];
}

const APG = 'https://www.w3.org/WAI/ARIA/apg/patterns/';
const apg = (name: string, path: string): ApgPattern => ({ name, href: `${APG}${path}` });
const none = (name: string): ApgPattern => ({ name });

const n = (part: string, children?: readonly AnatomyNode[], note?: string): AnatomyNode => ({
  part,
  ...(children ? { children } : {}),
  ...(note ? { note } : {}),
});

/** Every primitive, in alphabetical order of its subpath. */
export const PRIMITIVES: readonly PrimitiveDoc[] = [
  {
    id: 'accordion',
    name: 'Accordion',
    summary: 'Stacked headings that each show or hide a section of content.',
    pattern: apg('Accordion', 'accordion/'),
    anatomy: [
      n('Accordion.Root', [
        n('Accordion.Item', [
          n('Accordion.Header', [n('Accordion.Trigger')]),
          n('Accordion.Content'),
        ]),
      ]),
    ],
  },
  {
    id: 'alert-dialog',
    namespace: 'AlertDialog',
    name: 'AlertDialog',
    summary: 'A modal dialog that interrupts to confirm or cancel an action.',
    pattern: apg('Alert dialog', 'alertdialog/'),
    anatomy: [
      n('Root', [
        n('Trigger'),
        n('Portal', [
          n('Overlay'),
          n('Content', [n('Title'), n('Description'), n('Cancel'), n('Action')]),
        ]),
      ]),
    ],
  },
  {
    id: 'avatar',
    name: 'Avatar',
    summary: 'An image with a fallback while it loads or when it fails.',
    pattern: none('Image with text fallback'),
    anatomy: [n('Avatar.Root', [n('Avatar.Image'), n('Avatar.Fallback')])],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    summary: 'A locale-aware month grid with keyboard navigation between days.',
    pattern: apg('Date picker dialog (grid)', 'dialog-modal/examples/datepicker-dialog/'),
    anatomy: [
      n('Calendar.Root', [
        n('Calendar.Heading'),
        n('Calendar.PrevButton'),
        n('Calendar.NextButton'),
        n('Calendar.Grid', undefined, 'one button per day'),
      ]),
    ],
  },
  {
    id: 'checkbox',
    name: 'Checkbox',
    summary: 'A two- or three-state checkbox, alone or in a group.',
    pattern: apg('Checkbox', 'checkbox/'),
    anatomy: [n('Checkbox.Group', [n('Checkbox.Root', [n('Checkbox.Indicator')])], 'optional')],
  },
  {
    id: 'collapsible',
    name: 'Collapsible',
    summary: 'One button that shows or hides one region.',
    pattern: apg('Disclosure', 'disclosure/'),
    anatomy: [n('CollapsibleRoot', [n('CollapsibleTrigger'), n('CollapsibleContent')])],
  },
  {
    id: 'color-picker',
    name: 'ColorPicker',
    summary:
      'A two-dimensional color area with hue and alpha sliders, a format field and swatches.',
    pattern: apg('Slider', 'slider/'),
    anatomy: [
      n('ColorPicker.Root', [
        n('ColorPicker.Area', undefined, 'two-axis slider'),
        n('ColorPicker.Hue'),
        n('ColorPicker.Alpha'),
        n('ColorPicker.FormatInput'),
        n('ColorPicker.Swatch'),
      ]),
    ],
  },
  {
    id: 'combobox',
    name: 'Combobox',
    summary: 'A text input that filters a popup list of options, for one or many values.',
    pattern: apg('Combobox', 'combobox/'),
    anatomy: [
      n('Combobox.Root', [
        n('Combobox.Chips', [n('Combobox.Chip', [n('Combobox.ChipRemove')])], 'multiple'),
        n('Combobox.Input'),
        n('Combobox.Trigger'),
        n('Combobox.Portal', [
          n('Combobox.Content', [
            n('Combobox.Viewport', [
              n('Combobox.Item'),
              n('Combobox.Empty'),
              n('Combobox.Loading'),
              n('Combobox.Error'),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: 'command',
    name: 'Command',
    summary: 'A search field over a filtered, grouped command list.',
    pattern: apg('Combobox with listbox popup', 'combobox/'),
    anatomy: [
      n('Command.Root', [
        n('Command.Input'),
        n('Command.List', [
          n('Command.Group', [
            n('Command.GroupHeading'),
            n('Command.GroupItems', [n('Command.Item')]),
          ]),
          n('Command.Empty'),
          n('Command.Loading'),
        ]),
      ]),
    ],
  },
  {
    id: 'context-menu',
    name: 'ContextMenu',
    summary: 'A menu opened by right-click, long press or the Menu key on a region.',
    pattern: apg('Menu', 'menubar/'),
    anatomy: [
      n('ContextMenu.Root', [
        n('ContextMenu.Trigger', undefined, 'the region'),
        n('ContextMenu.Content', undefined, 'holds Menu items'),
      ]),
    ],
    notes: ['Items, groups, radio items and submenus come from `@texuli/primitives/menu`.'],
  },
  {
    id: 'date-field',
    name: 'DateField',
    summary: 'A segmented date (or time) input, one spin button per segment.',
    pattern: apg('Spinbutton (per segment)', 'spinbutton/'),
    anatomy: [n('DateField.Root', undefined, 'renders the segments'), n('TimeField.Root')],
  },
  {
    id: 'date-picker',
    name: 'DatePicker',
    summary: 'A date field with a button that opens a calendar dialog.',
    pattern: apg('Date picker dialog', 'dialog-modal/examples/datepicker-dialog/'),
    anatomy: [
      n('DatePicker.Root', [
        n('DatePicker.Field'),
        n('DatePicker.Trigger'),
        n('DatePicker.Content', [n('DatePicker.Calendar')]),
      ]),
    ],
    notes: ['`DateRangePicker` has the same parts with start and end fields and a range `Grid`.'],
  },
  {
    id: 'dialog',
    namespace: 'Dialog',
    name: 'Dialog',
    summary: 'A modal window that traps focus, makes the page inert and restores focus on close.',
    pattern: apg('Dialog (modal)', 'dialog-modal/'),
    anatomy: [
      n('Root', [
        n('Trigger'),
        n('Portal', [n('Overlay'), n('Content', [n('Title'), n('Description'), n('Close')])]),
      ]),
    ],
  },
  {
    id: 'file-drop',
    name: 'FileDrop',
    summary: 'A drop zone and file button that validates type, size and count.',
    pattern: apg('Button', 'button/'),
    anatomy: [n('FileDrop.Root', undefined, 'zone and hidden input')],
  },
  {
    id: 'hover-card',
    name: 'HoverCard',
    summary: 'A preview card shown on hover or focus of a link, for sighted pointer users.',
    pattern: none('Non-modal preview (no APG pattern)'),
    anatomy: [n('HoverCardRoot', [n('HoverCardTrigger'), n('HoverCardContent')])],
  },
  {
    id: 'label',
    name: 'Label and Field',
    summary: 'A label, description and error wired to one control by id.',
    pattern: none('Native labelling'),
    anatomy: [
      n('FieldRoot', [n('FieldLabel'), n('FieldControl'), n('FieldDescription'), n('FieldError')]),
      n('LabelRoot', undefined, 'standalone label'),
    ],
  },
  {
    id: 'listbox',
    name: 'Listbox',
    summary: 'An inline list of options with single or multiple selection.',
    pattern: apg('Listbox', 'listbox/'),
    anatomy: [n('ListboxRoot', [n('ListboxOption')])],
  },
  {
    id: 'menu',
    namespace: 'Menu',
    name: 'Menu',
    summary: 'A menu button and its menu, with checkbox and radio items and submenus.',
    pattern: apg('Menu button', 'menu-button/'),
    anatomy: [
      n('Root', [
        n('Trigger'),
        n('Portal', [
          n('Content', [
            n('Item'),
            n('CheckboxItem'),
            n('RadioGroup', [n('RadioItem')]),
            n('Group', [n('GroupHeading'), n('Item')]),
            n('Separator'),
            n('Sub', [n('SubTrigger'), n('SubContent')]),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: 'menubar',
    namespace: 'Menubar',
    name: 'Menubar',
    summary: 'A horizontal bar of menus, as in a desktop application.',
    pattern: apg('Menubar', 'menubar/'),
    anatomy: [
      n('Root', [
        n('Menu', [
          n('Trigger'),
          n('Portal', [
            n('Content', [
              n('Item'),
              n('CheckboxItem'),
              n('RadioGroup', [n('RadioItem')]),
              n('Separator'),
              n('Sub', [n('SubTrigger'), n('SubContent')]),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: 'navigation-menu',
    name: 'NavigationMenu',
    summary: 'Site navigation whose items open flyout panels of links.',
    pattern: apg('Disclosure navigation menu', 'disclosure/examples/disclosure-navigation/'),
    anatomy: [
      n('NavigationMenu.Root', [
        n('NavigationMenu.List', [
          n('NavigationMenu.Item', [
            n('NavigationMenu.Trigger'),
            n('NavigationMenu.Content', [n('NavigationMenu.Link')]),
          ]),
          n('NavigationMenu.Indicator'),
        ]),
        n('NavigationMenu.Viewport'),
      ]),
    ],
  },
  {
    id: 'number-field',
    name: 'NumberField',
    summary: 'A locale-aware number input with step buttons.',
    pattern: apg('Spinbutton', 'spinbutton/'),
    anatomy: [
      n('NumberFieldRoot', [
        n('NumberFieldDecrement'),
        n('NumberFieldInput'),
        n('NumberFieldIncrement'),
      ]),
    ],
  },
  {
    id: 'pagination',
    name: 'Pagination',
    summary: 'Page links with previous and next buttons and collapsed ranges.',
    pattern: none('Navigation landmark'),
    anatomy: [
      n('Pagination.Root', [
        n('Pagination.PreviousButton'),
        n('Pagination.Page'),
        n('Pagination.Ellipsis'),
        n('Pagination.NextButton'),
      ]),
    ],
  },
  {
    id: 'pin-input',
    name: 'PinInput',
    summary: 'A one-time code entered one character per cell.',
    pattern: none('Text input'),
    anatomy: [n('PinInput.Root', [n('PinInput.Cell')])],
  },
  {
    id: 'popover',
    namespace: 'Popover',
    name: 'Popover',
    summary: 'A non-modal (or modal) panel anchored to a button.',
    pattern: apg('Disclosure / dialog', 'disclosure/'),
    anatomy: [n('Root', [n('Trigger'), n('Content', [n('Close')])])],
  },
  {
    id: 'portal',
    name: 'Portal',
    summary: 'Moves its content to the end of the document body (or a target).',
    pattern: none('Utility'),
    anatomy: [n('Portal')],
  },
  {
    id: 'progress',
    name: 'Progress',
    summary: 'A determinate or indeterminate progress bar.',
    pattern: none('progressbar role'),
    anatomy: [n('Progress.Root')],
  },
  {
    id: 'radio-group',
    name: 'RadioGroup',
    summary: 'A set of radio buttons where one is checked, with arrow-key movement.',
    pattern: apg('Radio group', 'radio/'),
    anatomy: [n('RadioGroup.Root', [n('RadioGroup.Item')])],
  },
  {
    id: 'scroll-area',
    name: 'ScrollArea',
    summary: 'A scroll region with custom, still accessible scrollbars.',
    pattern: none('Scrollable region'),
    anatomy: [
      n('ScrollArea.Root', [
        n('ScrollArea.Viewport'),
        n('ScrollArea.Scrollbar', [n('ScrollArea.Thumb')]),
        n('ScrollArea.Corner'),
      ]),
    ],
  },
  {
    id: 'select',
    name: 'Select',
    summary: 'A button that opens a listbox of options, with groups and typeahead.',
    pattern: apg('Select-only combobox', 'combobox/'),
    anatomy: [
      n('Select.Root', [
        n('Select.Trigger', [n('Select.Value')]),
        n('Select.Portal', [
          n('Select.Content', [
            n('Select.Viewport', [
              n('Select.Group', [n('Select.GroupLabel'), n('Select.Item')]),
              n('Select.Item'),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  {
    id: 'separator',
    name: 'Separator',
    summary: 'A horizontal or vertical divider, semantic or decorative.',
    pattern: none('separator role'),
    anatomy: [n('SeparatorRoot')],
  },
  {
    id: 'sheet',
    name: 'Sheet',
    summary: 'A dialog that slides in from an edge; Drawer adds drag to dismiss.',
    pattern: apg('Dialog (modal)', 'dialog-modal/'),
    anatomy: [
      n('Sheet.Root', [
        n('Sheet.Trigger'),
        n('Sheet.Portal', [
          n('Sheet.Overlay'),
          n('Sheet.Content', [n('Sheet.Title'), n('Sheet.Description'), n('Sheet.Close')]),
        ]),
      ]),
    ],
    notes: [
      '`Drawer` has the same parts plus a `Handle`; `Panel` and `ResponsiveModal` are variants.',
    ],
  },
  {
    id: 'slider',
    name: 'Slider',
    summary: 'One or more thumbs on a track, with steps and ticks.',
    pattern: apg('Slider', 'slider/'),
    anatomy: [n('Slider.Root', [n('Slider.Range'), n('Slider.Thumb'), n('Slider.Tick')])],
  },
  {
    id: 'splitter',
    name: 'Splitter',
    summary: 'Resizable panes separated by keyboard-operable handles.',
    pattern: apg('Window splitter', 'windowsplitter/'),
    anatomy: [n('Splitter.Root', [n('Splitter.Pane'), n('Splitter.Handle'), n('Splitter.Pane')])],
  },
  {
    id: 'switch',
    name: 'Switch',
    summary: 'An on/off control.',
    pattern: apg('Switch', 'switch/'),
    anatomy: [n('Switch.Root', [n('Switch.Thumb')])],
  },
  {
    id: 'tabs',
    name: 'Tabs',
    summary: 'A tab list where each tab shows one panel.',
    pattern: apg('Tabs', 'tabs/'),
    anatomy: [n('Tabs.Root', [n('Tabs.List', [n('Tabs.Trigger')]), n('Tabs.Content')])],
  },
  {
    id: 'tags-input',
    name: 'TagsInput',
    summary: 'A text input that turns entries into removable tags.',
    pattern: none('Text input with a list'),
    anatomy: [
      n('TagsInput.Root', [
        n('TagsInput.List', [n('TagsInput.Tag', [n('TagsInput.TagRemove')])]),
        n('TagsInput.Input'),
      ]),
    ],
  },
  {
    id: 'toast',
    name: 'Toast',
    summary: 'Timed notifications announced politely, with actions.',
    pattern: apg('Alert', 'alert/'),
    anatomy: [
      n('Toast.Provider', [
        n('Toast.Viewport', [
          n('Toast.Root', [
            n('Toast.Title'),
            n('Toast.Description'),
            n('Toast.Action'),
            n('Toast.Close'),
          ]),
        ]),
      ]),
      n('Toast.Toaster', undefined, 'ready-made viewport and list'),
    ],
  },
  {
    id: 'toggle',
    name: 'Toggle',
    summary: 'A pressed/unpressed button, alone or in a group.',
    pattern: apg('Button (toggle)', 'button/'),
    anatomy: [n('Toggle.Root'), n('ToggleGroup.Root', [n('ToggleGroup.Item')])],
  },
  {
    id: 'toolbar',
    name: 'Toolbar',
    summary: 'A row of controls reached with one Tab stop and arrow keys.',
    pattern: apg('Toolbar', 'toolbar/'),
    anatomy: [
      n('Toolbar.Root', [
        n('Toolbar.Button'),
        n('Toolbar.Link'),
        n('Toolbar.Separator'),
        n('Toolbar.Group', [n('Toolbar.GroupItem')]),
      ]),
    ],
  },
  {
    id: 'tooltip',
    name: 'Tooltip',
    summary: 'A short description shown on hover or focus, after a delay.',
    pattern: apg('Tooltip', 'tooltip/'),
    anatomy: [
      n('Tooltip.Provider', [n('Tooltip.Root', [n('Tooltip.Trigger'), n('Tooltip.Content')])]),
    ],
  },
  {
    id: 'tree',
    name: 'Tree',
    summary: 'A hierarchical list with expand, collapse, selection and lazy children.',
    pattern: apg('Tree view', 'treeview/'),
    anatomy: [n('Tree.Root', undefined, 'rows from data')],
  },
];

/** Every part named in an anatomy, depth first. */
export function anatomyParts(nodes: readonly AnatomyNode[]): string[] {
  return nodes.flatMap((node) => [node.part, ...anatomyParts(node.children ?? [])]);
}

/** How a part is written in code: `Dialog.Root` for a namespace import, else as exported. */
export function partLabel(doc: PrimitiveDoc, part: string): string {
  return doc.namespace ? `${doc.namespace}.${part}` : part;
}

/** The names to import: each part's first segment, once, in order. */
export function importNames(doc: PrimitiveDoc): string[] {
  return [...new Set(anatomyParts(doc.anatomy).map((part) => part.split('.')[0] as string))];
}

/** The import line for a primitive. */
export function importLine(doc: PrimitiveDoc): string {
  const from = `'@texuli/primitives/${doc.id}'`;
  if (doc.namespace) return `import * as ${doc.namespace} from ${from};`;
  return `import { ${importNames(doc).join(', ')} } from ${from};`;
}

export const primitivePath = (id: string) => `/primitives-page/${id}/`;

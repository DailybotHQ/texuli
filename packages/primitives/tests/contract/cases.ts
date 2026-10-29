import type { ContractCase } from '../support/contract.ts';
import AccordionContract from './AccordionContract.svelte';
import AlertDialogContract from './AlertDialogContract.svelte';
import AvatarContract from './AvatarContract.svelte';
import CalendarContract from './CalendarContract.svelte';
import CheckboxContract from './CheckboxContract.svelte';
import CollapsibleContract from './CollapsibleContract.svelte';
import ColorPickerContract from './ColorPickerContract.svelte';
import ComboboxContract from './ComboboxContract.svelte';
import ComboboxStatusContract from './ComboboxStatusContract.svelte';
import CommandContract from './CommandContract.svelte';
import ContextMenuContract from './ContextMenuContract.svelte';
import DateFieldContract from './DateFieldContract.svelte';
import DatePickerContract from './DatePickerContract.svelte';
import DialogContract from './DialogContract.svelte';
import FileDropContract from './FileDropContract.svelte';
import HoverCardContract from './HoverCardContract.svelte';
import LabelContract from './LabelContract.svelte';
import ListboxContract from './ListboxContract.svelte';
import MenubarContract from './MenubarContract.svelte';
import MenuContract from './MenuContract.svelte';
import MiscContract from './MiscContract.svelte';
import NavigationMenuContract from './NavigationMenuContract.svelte';
import NumberFieldContract from './NumberFieldContract.svelte';
import PaginationContract from './PaginationContract.svelte';
import PinInputContract from './PinInputContract.svelte';
import PopoverContract from './PopoverContract.svelte';
import RangeGridContract from './RangeGridContract.svelte';
import ScrollAreaContract from './ScrollAreaContract.svelte';
import SelectContract from './SelectContract.svelte';
import SheetContract from './SheetContract.svelte';
import SliderContract from './SliderContract.svelte';
import SortableContract from './SortableContract.svelte';
import SplitterContract from './SplitterContract.svelte';
import TabsContract from './TabsContract.svelte';
import TagsInputContract from './TagsInputContract.svelte';
import ToastContract from './ToastContract.svelte';
import ToolbarContract from './ToolbarContract.svelte';
import TooltipContract from './TooltipContract.svelte';
import TreeContract from './TreeContract.svelte';

/**
 * Exported components that render no element of their own (providers that
 * hold state, portals that move their children, a text-only value), so no
 * rest attributes, `ref` or handlers apply. Keep this list minimal.
 */
export const EXCLUDED: Record<string, string> = {
  'alert-dialog/Root': 'provider: open state and context, renders only its children',
  'alert-dialog/Portal': 'placement: moves its children to the portal target',
  'combobox/Root': 'provider: selection state, renders its children and hidden form fields',
  'combobox/Portal': 'placement: renders its children in place for the content',
  'command/GroupItems': 'placement: renders its children for the group',
  'context-menu/Root': 'provider: open state and context, renders only its children',
  'date-picker/DatePickerRoot': 'provider: wraps Popover.Root, renders only its children',
  'date-picker/DateRangePickerRoot': 'provider: wraps Popover.Root, renders only its children',
  'dialog/Root': 'provider: open state and context, renders only its children',
  'dialog/Portal': 'placement: moves its children to the portal target',
  'hover-card/HoverCardRoot': 'provider: open state and timers, renders only its children',
  'menu/Root': 'provider: holds the open state, renders only its children',
  'menu/Sub': 'provider: holds the submenu open state, renders only its children',
  'menu/Portal': 'placement: moves its children to the portal host',
  'menubar/Menu': 'provider: one menu of the bar, renders only its children',
  'popover/Root': 'provider: open state and context, renders only its children',
  'portal/Portal': 'placement: moves its children to the portal target',
  'select/Root': 'provider: selection state, renders its children and a hidden form field',
  'select/Portal': 'placement: moves its children to the portal target',
  'select/Value': 'text: renders the selected label or placeholder, no element',
  'toast/Provider': 'provider: the toast manager and hotkey, renders only its children',
  'tooltip/TooltipProvider': 'provider: shared delays, renders only its children',
  'tooltip/TooltipRoot': 'provider: open state and timers, renders only its children',
};

/** One case per exported rendering part, each mounted in its family harness. */
export const CASES: ContractCase[] = [
  { key: 'accordion/AccordionRoot', harness: AccordionContract },
  { key: 'accordion/AccordionItem', harness: AccordionContract },
  { key: 'accordion/AccordionHeader', harness: AccordionContract },
  { key: 'accordion/AccordionTrigger', harness: AccordionContract },
  { key: 'accordion/AccordionContent', harness: AccordionContract },
  { key: 'alert-dialog/Trigger', harness: AlertDialogContract },
  { key: 'alert-dialog/Overlay', harness: AlertDialogContract },
  { key: 'alert-dialog/Content', harness: AlertDialogContract },
  { key: 'alert-dialog/Title', harness: AlertDialogContract },
  { key: 'alert-dialog/Description', harness: AlertDialogContract },
  { key: 'alert-dialog/Cancel', harness: AlertDialogContract },
  { key: 'alert-dialog/Action', harness: AlertDialogContract },
  { key: 'dialog/Trigger', harness: DialogContract },
  { key: 'dialog/Overlay', harness: DialogContract },
  { key: 'dialog/Content', harness: DialogContract },
  { key: 'dialog/Title', harness: DialogContract },
  { key: 'dialog/Description', harness: DialogContract },
  { key: 'dialog/Close', harness: DialogContract },
  { key: 'avatar/AvatarRoot', harness: AvatarContract },
  { key: 'avatar/AvatarImage', harness: AvatarContract },
  { key: 'avatar/AvatarFallback', harness: AvatarContract },
  { key: 'calendar/Root', harness: CalendarContract },
  { key: 'calendar/Heading', harness: CalendarContract },
  { key: 'calendar/PrevButton', harness: CalendarContract },
  { key: 'calendar/NextButton', harness: CalendarContract },
  { key: 'calendar/Grid', harness: CalendarContract },
  { key: 'checkbox/CheckboxRoot', harness: CheckboxContract },
  { key: 'checkbox/CheckboxGroup', harness: CheckboxContract },
  { key: 'checkbox/CheckboxIndicator', harness: CheckboxContract },
  { key: 'collapsible/Root', harness: CollapsibleContract },
  { key: 'collapsible/Trigger', harness: CollapsibleContract },
  { key: 'collapsible/Content', harness: CollapsibleContract },
  { key: 'color-picker/Root', harness: ColorPickerContract },
  { key: 'color-picker/Area', harness: ColorPickerContract },
  { key: 'color-picker/Hue', harness: ColorPickerContract },
  { key: 'color-picker/Alpha', harness: ColorPickerContract },
  { key: 'color-picker/FormatInput', harness: ColorPickerContract },
  { key: 'color-picker/Swatch', harness: ColorPickerContract },
  { key: 'combobox/Input', harness: ComboboxContract },
  { key: 'combobox/Trigger', harness: ComboboxContract },
  { key: 'combobox/Content', harness: ComboboxContract },
  { key: 'combobox/Viewport', harness: ComboboxContract },
  {
    key: 'combobox/Item',
    harness: ComboboxContract,
    idOwned: 'option ids derive from the value, for aria-activedescendant on the input',
  },
  { key: 'combobox/Chips', harness: ComboboxContract },
  { key: 'combobox/Chip', harness: ComboboxContract },
  { key: 'combobox/ChipRemove', harness: ComboboxContract },
  { key: 'command/Root', harness: CommandContract },
  { key: 'command/Input', harness: CommandContract },
  { key: 'command/List', harness: CommandContract },
  { key: 'command/Group', harness: CommandContract },
  { key: 'command/GroupHeading', harness: CommandContract },
  { key: 'command/Item', harness: CommandContract },
  { key: 'context-menu/Trigger', harness: ContextMenuContract },
  { key: 'context-menu/Content', harness: ContextMenuContract },
  { key: 'date-field/DateField', harness: DateFieldContract },
  { key: 'date-field/TimeField', harness: DateFieldContract },
  { key: 'date-picker/DatePickerField', harness: DatePickerContract },
  { key: 'date-picker/Trigger', harness: DatePickerContract },
  { key: 'date-picker/Content', harness: DatePickerContract },
  { key: 'date-picker/DatePickerCalendar', harness: DatePickerContract },
  { key: 'date-picker/RangeGrid', harness: RangeGridContract },
  { key: 'file-drop/FileDropRoot', harness: FileDropContract },
  { key: 'hover-card/HoverCardTrigger', harness: HoverCardContract },
  { key: 'hover-card/HoverCardContent', harness: HoverCardContract },
  { key: 'label/FieldRoot', harness: LabelContract },
  { key: 'label/FieldLabel', harness: LabelContract },
  { key: 'label/FieldControl', harness: LabelContract },
  { key: 'label/FieldDescription', harness: LabelContract },
  { key: 'label/FieldError', harness: LabelContract },
  { key: 'label/LabelRoot', harness: LabelContract },
  { key: 'listbox/ListboxRoot', harness: ListboxContract },
  { key: 'listbox/ListboxOption', harness: ListboxContract },
  { key: 'menu/Trigger', harness: MenuContract },
  { key: 'menu/Content', harness: MenuContract },
  { key: 'menu/Item', harness: MenuContract },
  { key: 'menu/Separator', harness: MenuContract },
  { key: 'menu/Group', harness: MenuContract },
  { key: 'menu/GroupHeading', harness: MenuContract },
  { key: 'menu/CheckboxItem', harness: MenuContract },
  { key: 'menu/RadioGroup', harness: MenuContract },
  { key: 'menu/RadioItem', harness: MenuContract },
  { key: 'menu/SubTrigger', harness: MenuContract },
  { key: 'menu/SubContent', harness: MenuContract },
  { key: 'menubar/Root', harness: MenubarContract },
  { key: 'menubar/Trigger', harness: MenubarContract },
  { key: 'menubar/Content', harness: MenubarContract },
  { key: 'navigation-menu/Root', harness: NavigationMenuContract },
  { key: 'navigation-menu/List', harness: NavigationMenuContract },
  { key: 'navigation-menu/Item', harness: NavigationMenuContract },
  { key: 'navigation-menu/Trigger', harness: NavigationMenuContract },
  { key: 'navigation-menu/Content', harness: NavigationMenuContract },
  { key: 'navigation-menu/Link', harness: NavigationMenuContract },
  { key: 'navigation-menu/Indicator', harness: NavigationMenuContract },
  { key: 'number-field/NumberFieldRoot', harness: NumberFieldContract },
  { key: 'number-field/NumberFieldInput', harness: NumberFieldContract },
  { key: 'number-field/NumberFieldIncrement', harness: NumberFieldContract },
  { key: 'number-field/NumberFieldDecrement', harness: NumberFieldContract },
  { key: 'pagination/Root', harness: PaginationContract },
  { key: 'pagination/Page', harness: PaginationContract },
  { key: 'pagination/PreviousButton', harness: PaginationContract },
  { key: 'pagination/NextButton', harness: PaginationContract },
  { key: 'pagination/Ellipsis', harness: PaginationContract },
  { key: 'pin-input/Root', harness: PinInputContract },
  { key: 'pin-input/Cell', harness: PinInputContract },
  { key: 'popover/Trigger', harness: PopoverContract },
  { key: 'popover/Content', harness: PopoverContract },
  { key: 'popover/Close', harness: PopoverContract },
  { key: 'progress/Progress', harness: MiscContract },
  { key: 'radio-group/RadioGroup', harness: MiscContract },
  { key: 'radio-group/RadioGroupItem', harness: MiscContract },
  { key: 'separator/SeparatorRoot', harness: MiscContract },
  { key: 'switch/Root', harness: MiscContract },
  { key: 'switch/Thumb', harness: MiscContract },
  { key: 'toggle/Toggle', harness: MiscContract },
  { key: 'toggle/ToggleGroup', harness: MiscContract },
  { key: 'toggle/ToggleGroupItem', harness: MiscContract },
  { key: 'scroll-area/Root', harness: ScrollAreaContract },
  { key: 'scroll-area/Viewport', harness: ScrollAreaContract },
  { key: 'scroll-area/Scrollbar', harness: ScrollAreaContract },
  { key: 'scroll-area/Thumb', harness: ScrollAreaContract },
  { key: 'scroll-area/Corner', harness: ScrollAreaContract },
  { key: 'select/Trigger', harness: SelectContract },
  { key: 'select/Content', harness: SelectContract },
  { key: 'select/Viewport', harness: SelectContract },
  { key: 'select/Item', harness: SelectContract },
  { key: 'select/Group', harness: SelectContract },
  { key: 'select/GroupLabel', harness: SelectContract },
  { key: 'slider/SliderRoot', harness: SliderContract },
  { key: 'slider/SliderRange', harness: SliderContract },
  { key: 'slider/SliderThumb', harness: SliderContract },
  { key: 'slider/SliderTick', harness: SliderContract },
  { key: 'sortable/SortableRoot', harness: SortableContract },
  {
    key: 'sortable/SortableList',
    harness: SortableContract,
    idOwned: '`id` names the list in the sortable model (containers)',
  },
  {
    key: 'sortable/SortableItem',
    harness: SortableContract,
    idOwned: '`id` names the item in the sortable model (items)',
  },
  { key: 'sortable/SortableHandle', harness: SortableContract },
  { key: 'splitter/Root', harness: SplitterContract },
  { key: 'splitter/Pane', harness: SplitterContract },
  { key: 'splitter/Handle', harness: SplitterContract },
  { key: 'tabs/TabsRoot', harness: TabsContract },
  { key: 'tabs/TabsList', harness: TabsContract },
  { key: 'tabs/TabsTrigger', harness: TabsContract },
  { key: 'tabs/TabsContent', harness: TabsContract },
  { key: 'tags-input/TagsInputRoot', harness: TagsInputContract },
  { key: 'tags-input/TagsInputList', harness: TagsInputContract },
  { key: 'tags-input/TagsInputTag', harness: TagsInputContract },
  { key: 'tags-input/TagsInputTagRemove', harness: TagsInputContract },
  { key: 'tags-input/TagsInputInput', harness: TagsInputContract },
  { key: 'toast/Viewport', harness: ToastContract },
  { key: 'toast/Root', harness: ToastContract },
  { key: 'toast/Title', harness: ToastContract },
  { key: 'toast/Description', harness: ToastContract },
  { key: 'toast/Action', harness: ToastContract },
  { key: 'toast/Close', harness: ToastContract },
  { key: 'toolbar/Root', harness: ToolbarContract },
  { key: 'toolbar/Group', harness: ToolbarContract },
  { key: 'toolbar/GroupItem', harness: ToolbarContract },
  { key: 'toolbar/Separator', harness: ToolbarContract },
  { key: 'toolbar/Button', harness: ToolbarContract },
  { key: 'toolbar/Link', harness: ToolbarContract },
  { key: 'tooltip/TooltipTrigger', harness: TooltipContract },
  { key: 'tooltip/TooltipContent', harness: TooltipContract },
  { key: 'tree/TreeRoot', harness: TreeContract },
  { key: 'combobox/Empty', harness: ComboboxContract, variant: 'empty' },
  { key: 'combobox/Loading', harness: ComboboxStatusContract, variant: 'loading' },
  { key: 'combobox/Error', harness: ComboboxStatusContract, variant: 'error' },
  { key: 'command/Empty', harness: CommandContract, variant: 'empty' },
  { key: 'command/Loading', harness: CommandContract, variant: 'loading' },
  { key: 'date-picker/DateRangePickerField', harness: DatePickerContract, variant: 'range' },
  { key: 'date-picker/DateRangePickerCalendar', harness: DatePickerContract, variant: 'range' },
  { key: 'navigation-menu/Viewport', harness: NavigationMenuContract, variant: 'viewport' },
  { key: 'sheet/SheetContent', harness: SheetContract, variant: 'sheet' },
  { key: 'sheet/DrawerContent', harness: SheetContract, variant: 'drawer' },
  { key: 'sheet/Handle', harness: SheetContract, variant: 'drawer' },
  { key: 'sheet/PanelContent', harness: SheetContract, variant: 'panel' },
  { key: 'sheet/ResponsiveContent', harness: SheetContract, variant: 'responsive' },
  { key: 'toast/Toaster', harness: ToastContract, variant: 'toaster' },
];

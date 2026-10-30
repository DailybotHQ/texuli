// @texuli/primitives: entries are added by the PLAN_001 tasks that build this package (docs/ARCHITECTURE.md).

export {
  Accordion,
  type AccordionContentProps,
  type AccordionHeaderProps,
  type AccordionHeadingLevel,
  type AccordionItemProps,
  type AccordionMultipleRootProps,
  type AccordionOrientation,
  type AccordionRootProps,
  type AccordionSingleRootProps,
  type AccordionTriggerProps,
  type AccordionType,
} from './accordion/index.ts';
export * as AlertDialog from './alert-dialog/index.ts';
export {
  Avatar,
  type AvatarContext,
  type AvatarFallbackProps,
  type AvatarImageLoadingStatus,
  type AvatarImageProps,
  type AvatarRootProps,
  avatarContext,
} from './avatar/index.ts';
export { Calendar, CalendarDate, type CalendarIdentifier } from './calendar/index.ts';
export {
  Checkbox,
  type CheckboxFormBridge,
  type CheckboxFormOptions,
  CheckboxGroup,
  type CheckboxGroupContext,
  CheckboxIndicator,
  CheckboxRoot,
  type CheckedState,
  createCheckboxFormBridge,
  getCheckboxGroupContext,
  setCheckboxGroupContext,
} from './checkbox/index.ts';
export {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from './collapsible/index.ts';
export { ColorPicker } from './color-picker/index.ts';
export {
  Combobox,
  type ComboboxItemData,
  type ComboboxLoadStatus,
  type ComboboxRootProps,
  type ComboboxSelection,
} from './combobox/index.ts';
export { Command } from './command/index.ts';
export {
  ContextMenu,
  type ContextMenuContext,
  type ContextMenuPoint,
  contextMenuContext,
  LONG_PRESS_MS,
  LONG_PRESS_SLOP,
} from './context-menu/index.ts';
export {
  DateField,
  type DateFieldRootProps,
  type DateParts,
  type DateSegment,
  type DateSegmentInputProps,
  dateSegmentLabel,
  dateSegmentOrder,
  dateSegmentSeparator,
  dayPeriod,
  formatDate,
  formatHour,
  formatTime,
  isValidDate,
  parseDate,
  parseHour,
  parseTime,
  TimeField,
  type TimeFieldRootProps,
  type TimeParts,
  type TimeSegment,
  timeSegmentOrder,
} from './date-field/index.ts';
export {
  DatePicker,
  type DatePickerLabels,
  type DateRange,
  DateRangePicker,
} from './date-picker/index.ts';
export * as Dialog from './dialog/index.ts';
export {
  FileDrop,
  type FileDropChildren,
  type FileDropChildState,
  type FileDropInputProps,
  type FileDropRejection,
  type FileDropRejectReason,
  FileDropRoot,
  type FileDropRootProps,
  type FileDropValidationOptions,
  type FileDropValidationResult,
  matchesFileAccept,
  validateFiles,
} from './file-drop/index.ts';
export {
  getI18nContext,
  PRIMITIVES_MESSAGES_EN,
  setI18nContext,
  useMessages,
} from './i18n/index.ts';
export {
  controlAttributes,
  Field,
  type FieldContextValue,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  type FieldState,
  fieldContext,
  fieldDataAttributes,
  joinIds,
  Label,
  LabelRoot,
  shouldPreventLabelSelection,
} from './label/index.ts';
export { type ListboxItemData, ListboxOption, ListboxRoot } from './listbox/index.ts';
export * as Menu from './menu/index.ts';
export * as Menubar from './menubar/index.ts';
export {
  createNavigationMenuController,
  NavigationMenu,
  type NavigationMenuController,
  type NavigationMenuControllerOptions,
} from './navigation-menu/index.ts';
export {
  createPressRepeat,
  NumberField,
  type NumberFieldContextValue,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
  type NumberFormatOptions,
  numberFieldContext,
  parseNumber,
  stepNumber,
} from './number-field/index.ts';
export {
  getPageCount,
  getPageTokens,
  type PageToken,
  Pagination,
  type PaginationClickEvent,
  type PaginationNavigationButtonProps,
  type PaginationPageProps,
  type PaginationRootProps,
  type PaginationSnippetProps,
} from './pagination/index.ts';
export {
  type PinCell,
  PinInput,
  REGEXP_ONLY_CHARS,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
} from './pin-input/index.ts';
export * as Popover from './popover/index.ts';
export { Portal, Root as PortalRoot } from './portal/index.ts';
export { Progress, type ProgressRootProps } from './progress/index.ts';
export {
  RadioGroup,
  type RadioGroupContext,
  type RadioGroupOrientation,
  radioGroupContext,
} from './radio-group/index.ts';
export { ScrollArea } from './scroll-area/index.ts';
export {
  getSelectContext,
  SELECT_CONTEXT,
  Select,
  type SelectContext,
  type SelectItemRecord,
} from './select/index.ts';
export {
  Separator,
  type SeparatorAttributeOptions,
  type SeparatorAttributes,
  type SeparatorOrientation,
  SeparatorRoot,
  separatorAttributes,
} from './separator/index.ts';
export {
  DRAWER_PROJECTION_MS,
  Drawer,
  type DrawerContext,
  dismissDirection,
  drawerContext,
  Panel,
  ResponsiveModal,
  releaseTarget,
  Sheet,
  type SheetSide,
} from './sheet/index.ts';
export {
  Slider,
  type SliderMultipleRootProps,
  type SliderOrientation,
  type SliderRangeProps,
  type SliderRootProps,
  type SliderRootSnippetProps,
  type SliderSingleRootProps,
  type SliderThumbItem,
  type SliderThumbProps,
  type SliderTickItem,
  type SliderTickProps,
} from './slider/index.ts';
export {
  initialLayout,
  isCollapsed,
  type KeyResizeOptions,
  layoutForKey,
  loadLayout,
  normalizeLayout,
  type PaneConstraints,
  paneBounds,
  resizeLayout,
  Splitter,
  type SplitterContext,
  type SplitterDirection,
  type SplitterPaneEntry,
  type SplitterStorage,
  saveLayout,
  setPaneSize,
  toggleCollapse,
} from './splitter/index.ts';
export {
  Root as SwitchRoot,
  Switch,
  type SwitchContext,
  switchContext,
  Thumb as SwitchThumb,
} from './switch/index.ts';
export {
  Tabs,
  type TabsActivationMode,
  type TabsContext,
  type TabsOrientation,
  tabsContext,
} from './tabs/index.ts';
export {
  addTags,
  DEFAULT_TAGS_INPUT_LABELS,
  isDelimiterKey,
  splitTags,
  type TagDecision,
  type TagDelimiter,
  type TagRejection,
  type TagRules,
  TagsInput,
  type TagsInputInputProps,
  type TagsInputInvalidDetail,
  type TagsInputLabels,
  type TagsInputListProps,
  type TagsInputRootProps,
  type TagsInputTagProps,
  type TagsInputTagRemoveProps,
} from './tags-input/index.ts';
export {
  createToastManager,
  type PublishToastInput,
  Toast,
  type ToastManager,
  type ToastManagerOptions,
  type ToastPriority,
  type ToastRecord,
  type ToastTone,
} from './toast/index.ts';
export { Toggle, ToggleGroup } from './toggle/index.ts';
export {
  TOOLBAR_ITEM,
  Toolbar,
  type ToolbarContext,
  type ToolbarGroupContext,
  type ToolbarGroupType,
  type ToolbarOrientation,
} from './toolbar/index.ts';
export * from './tooltip/index.ts';
export * from './tree/index.ts';

import { type Component } from 'svelte';
import AccordionIds from './fixtures/ids/AccordionIds.svelte';
import AlertDialogIds from './fixtures/ids/AlertDialogIds.svelte';
import AvatarIds from './fixtures/ids/AvatarIds.svelte';
import CalendarIds from './fixtures/ids/CalendarIds.svelte';
import CheckboxIds from './fixtures/ids/CheckboxIds.svelte';
import CollapsibleIds from './fixtures/ids/CollapsibleIds.svelte';
import ColorPickerIds from './fixtures/ids/ColorPickerIds.svelte';
import ComboboxIds from './fixtures/ids/ComboboxIds.svelte';
import CommandIds from './fixtures/ids/CommandIds.svelte';
import ContextMenuIds from './fixtures/ids/ContextMenuIds.svelte';
import DateFieldIds from './fixtures/ids/DateFieldIds.svelte';
import DatePickerIds from './fixtures/ids/DatePickerIds.svelte';
import DialogIds from './fixtures/ids/DialogIds.svelte';
import DialogNoDescriptionIds from './fixtures/ids/DialogNoDescriptionIds.svelte';
import FieldIds from './fixtures/ids/FieldIds.svelte';
import FileDropIds from './fixtures/ids/FileDropIds.svelte';
import HoverCardIds from './fixtures/ids/HoverCardIds.svelte';
import ListboxIds from './fixtures/ids/ListboxIds.svelte';
import MenubarIds from './fixtures/ids/MenubarIds.svelte';
import MenuIds from './fixtures/ids/MenuIds.svelte';
import NavigationMenuIds from './fixtures/ids/NavigationMenuIds.svelte';
import NumberFieldIds from './fixtures/ids/NumberFieldIds.svelte';
import PinInputIds from './fixtures/ids/PinInputIds.svelte';
import PopoverIds from './fixtures/ids/PopoverIds.svelte';
import RadioGroupIds from './fixtures/ids/RadioGroupIds.svelte';
import SelectIds from './fixtures/ids/SelectIds.svelte';
import SheetIds from './fixtures/ids/SheetIds.svelte';
import SliderIds from './fixtures/ids/SliderIds.svelte';
import SplitterIds from './fixtures/ids/SplitterIds.svelte';
import SwitchIds from './fixtures/ids/SwitchIds.svelte';
import TabsIds from './fixtures/ids/TabsIds.svelte';
import TagsInputIds from './fixtures/ids/TagsInputIds.svelte';
import TooltipIds from './fixtures/ids/TooltipIds.svelte';
import TreeIds from './fixtures/ids/TreeIds.svelte';
import { fireEvent, type IdCase, runIdCases, screen } from './support/id-cases.ts';

// FIX-consumer-ids: every primitive rendered with consumer ids on its id-bearing
// parts; support/id-cases.ts runs each table as one test, case by case.

const CASES_1: IdCase[] = [
  {
    name: 'select',
    fixture: SelectIds as Component,
    open: () => fireEvent.click(screen.getByRole('combobox')),
    ids: { 'plan-trigger': 'combobox', 'plan-list': 'listbox' },
    labels: { Plan: 'combobox' },
    refs: { 'plan-trigger': { attribute: 'aria-controls', id: 'plan-list' } },
  },
  {
    name: 'combobox',
    fixture: ComboboxIds as Component,
    open: () => fireEvent.click(screen.getByRole('button', { name: 'Show cities' })),
    ids: { 'city-input': 'combobox', 'city-list': 'listbox' },
    labels: { City: 'combobox' },
    refs: { 'city-input': { attribute: 'aria-controls', id: 'city-list' } },
  },
  {
    // Content names a description only while one is mounted.
    name: 'dialog without a description',
    fixture: DialogNoDescriptionIds as Component,
    open: () => fireEvent.click(screen.getByRole('button', { name: 'Rename' })),
    ids: { 'rename-dialog': 'dialog', 'rename-title': 'h2' },
    refs: { 'rename-dialog': { attribute: 'aria-labelledby', id: 'rename-title' } },
  },
];

const CASES_2: IdCase[] = [
  {
    name: 'field (label, control, description, error)',
    fixture: FieldIds as Component,
    ids: { email: 'input', 'email-label': 'label', 'email-help': 'p', 'email-error': 'p' },
    labels: { 'Work email': 'input' },
    refs: {
      email: { attribute: 'aria-describedby', id: 'email-help email-error' },
      'email-label': { attribute: 'for', id: 'email' },
    },
  },
  {
    name: 'checkbox',
    fixture: CheckboxIds as Component,
    ids: { terms: 'checkbox' },
    labels: { 'Accept the terms': 'checkbox' },
  },
  {
    name: 'switch',
    fixture: SwitchIds as Component,
    ids: { alerts: 'switch' },
    labels: { 'Email alerts': 'switch' },
  },
  {
    name: 'radio-group',
    fixture: RadioGroupIds as Component,
    ids: { 'plan-group': 'radiogroup', 'plan-free': 'radio', 'plan-team': 'radio' },
    labels: { Free: 'radio', Team: 'radio' },
    refs: { 'plan-group': { attribute: 'aria-labelledby', id: 'plan-heading' } },
  },
  {
    name: 'slider',
    fixture: SliderIds as Component,
    ids: { 'volume-thumb': 'slider' },
    refs: { 'volume-thumb': { attribute: 'aria-labelledby', id: 'volume-label' } },
  },
  {
    name: 'number-field (steppers control the consumer id)',
    fixture: NumberFieldIds as Component,
    ids: { quantity: 'spinbutton' },
    labels: { Quantity: 'spinbutton' },
  },
  {
    name: 'pin-input',
    fixture: PinInputIds as Component,
    ids: { code: 'input' },
    labels: { 'Verification code': 'input' },
  },
  {
    name: 'tags-input',
    fixture: TagsInputIds as Component,
    ids: { topics: 'input' },
    labels: { Topics: 'input' },
  },
  {
    name: 'date-field',
    fixture: DateFieldIds as Component,
    ids: { 'due-date': 'group' },
  },
  {
    name: 'calendar',
    fixture: CalendarIds as Component,
    ids: { 'trip-grid': 'grid' },
    refs: { 'trip-grid': { attribute: 'aria-labelledby', id: 'trip-heading' } },
  },
  {
    name: 'color-picker',
    fixture: ColorPickerIds as Component,
    ids: { 'brand-hue': 'input', 'brand-hex': 'input' },
    labels: { 'Brand hue': 'input', 'Brand hex': 'input' },
  },
];

const click = (name: string) => async () => {
  await fireEvent.click(screen.getByRole('button', { name }));
};

const CASES_3: IdCase[] = [
  {
    name: 'dialog',
    fixture: DialogIds as Component,
    open: click('Edit profile'),
    ids: {
      'edit-trigger': 'button',
      'edit-dialog': 'dialog',
      'edit-title': 'h2',
      'edit-description': 'p',
    },
    refs: {
      'edit-trigger': { attribute: 'aria-controls', id: 'edit-dialog' },
      'edit-dialog': { attribute: 'aria-labelledby', id: 'edit-title' },
    },
  },
  {
    name: 'alert-dialog',
    fixture: AlertDialogIds as Component,
    open: click('Delete'),
    ids: {
      'delete-trigger': 'button',
      'delete-dialog': 'alertdialog',
      'delete-title': 'h2',
      'delete-description': 'p',
    },
    refs: {
      'delete-trigger': { attribute: 'aria-controls', id: 'delete-dialog' },
      'delete-dialog': { attribute: 'aria-labelledby', id: 'delete-title' },
    },
  },
  {
    name: 'sheet',
    fixture: SheetIds as Component,
    open: click('Open filters'),
    ids: {
      'filters-trigger': 'button',
      'filters-sheet': 'dialog',
      'filters-title': 'h2',
      'filters-description': 'p',
    },
    refs: {
      'filters-trigger': { attribute: 'aria-controls', id: 'filters-sheet' },
      'filters-sheet': { attribute: 'aria-labelledby', id: 'filters-title' },
    },
  },
  {
    name: 'popover',
    fixture: PopoverIds as Component,
    open: click('Share'),
    ids: { 'share-trigger': 'button', 'share-popover': 'dialog' },
    refs: { 'share-trigger': { attribute: 'aria-controls', id: 'share-popover' } },
  },
  {
    name: 'hover-card',
    fixture: HoverCardIds as Component,
    ids: { 'profile-trigger': 'button', 'profile-card': 'dialog' },
    refs: { 'profile-trigger': { attribute: 'aria-controls', id: 'profile-card' } },
  },
  {
    name: 'tooltip',
    fixture: TooltipIds as Component,
    ids: { 'save-trigger': 'button', 'save-tip': 'tooltip' },
    refs: { 'save-trigger': { attribute: 'aria-describedby', id: 'save-tip' } },
  },
  {
    name: 'menu (trigger, content, group heading, submenu)',
    fixture: MenuIds as Component,
    open: async () => {
      await fireEvent.click(screen.getByRole('button', { name: 'View' }));
      await fireEvent.click(screen.getByRole('menuitem', { name: 'Export' }));
    },
    ids: {
      'view-trigger': 'button',
      'view-menu': 'menu',
      'view-heading': 'div',
      'export-trigger': 'menuitem',
      'export-menu': 'menu',
    },
    refs: {
      'view-trigger': { attribute: 'aria-controls', id: 'view-menu' },
      'view-menu': { attribute: 'aria-labelledby', id: 'view-trigger' },
      'export-trigger': { attribute: 'aria-controls', id: 'export-menu' },
      'export-menu': { attribute: 'aria-labelledby', id: 'export-trigger' },
    },
  },
  {
    name: 'context-menu',
    fixture: ContextMenuIds as Component,
    ids: { 'canvas-trigger': 'div', 'canvas-menu': 'menu' },
    refs: { 'canvas-menu': { attribute: 'aria-labelledby', id: 'canvas-trigger' } },
  },
  {
    name: 'menubar',
    fixture: MenubarIds as Component,
    ids: { 'file-trigger': 'menuitem', 'file-menu': 'menu' },
    refs: {
      'file-trigger': { attribute: 'aria-controls', id: 'file-menu' },
      'file-menu': { attribute: 'aria-labelledby', id: 'file-trigger' },
    },
  },
  {
    name: 'navigation-menu',
    fixture: NavigationMenuIds as Component,
    ids: { 'products-trigger': 'button', 'products-panel': 'group' },
    refs: {
      'products-trigger': { attribute: 'aria-controls', id: 'products-panel' },
      'products-panel': { attribute: 'aria-labelledby', id: 'products-trigger' },
    },
  },
  {
    name: 'date-picker',
    fixture: DatePickerIds as Component,
    open: async () => {
      await fireEvent.click(document.getElementById('due-trigger') as HTMLElement);
    },
    ids: { 'due-trigger': 'button', 'due-calendar': 'dialog' },
    refs: { 'due-trigger': { attribute: 'aria-controls', id: 'due-calendar' } },
  },
];

const CASES_4: IdCase[] = [
  {
    name: 'tabs',
    fixture: TabsIds as Component,
    ids: { 'tab-a': 'tab', 'tab-b': 'tab', 'panel-a': 'tabpanel', 'panel-b': 'tabpanel' },
    refs: {
      'tab-a': { attribute: 'aria-controls', id: 'panel-a' },
      'tab-b': { attribute: 'aria-controls', id: 'panel-b' },
      'panel-a': { attribute: 'aria-labelledby', id: 'tab-a' },
      'panel-b': { attribute: 'aria-labelledby', id: 'tab-b' },
    },
  },
  {
    name: 'accordion',
    fixture: AccordionIds as Component,
    ids: { 'shipping-trigger': 'button', 'shipping-panel': 'region' },
    refs: {
      'shipping-trigger': { attribute: 'aria-controls', id: 'shipping-panel' },
      'shipping-panel': { attribute: 'aria-labelledby', id: 'shipping-trigger' },
    },
  },
  {
    name: 'collapsible',
    fixture: CollapsibleIds as Component,
    ids: { 'details-trigger': 'button', 'details-content': 'div' },
    refs: {
      'details-trigger': { attribute: 'aria-controls', id: 'details-content' },
      'details-content': { attribute: 'aria-labelledby', id: 'details-trigger' },
    },
  },
  {
    name: 'listbox',
    fixture: ListboxIds as Component,
    open: async () => {
      const list = screen.getByRole('listbox', { name: 'Fruit' });
      list.focus();
      await fireEvent.keyDown(list, { key: 'ArrowDown' });
    },
    ids: { 'fruit-list': 'listbox', 'fruit-apple': 'option', 'fruit-pear': 'option' },
    refs: { 'fruit-list': { attribute: 'aria-activedescendant', id: 'fruit-apple' } },
  },
  {
    name: 'command',
    fixture: CommandIds as Component,
    open: async () => {
      await fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Home' });
    },
    ids: {
      'command-input': 'combobox',
      'command-list': 'listbox',
      'command-inbox': 'option',
      'nav-heading': 'div',
    },
    labels: { 'Search commands': 'combobox' },
    refs: {
      'command-input': { attribute: 'aria-controls', id: 'command-list' },
    },
  },
  {
    name: 'command (active item)',
    fixture: CommandIds as Component,
    open: async () => {
      await fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Home' });
    },
    ids: { 'command-inbox': 'option' },
    refs: { 'command-input': { attribute: 'aria-activedescendant', id: 'command-inbox' } },
  },
  {
    name: 'splitter',
    fixture: SplitterIds as Component,
    ids: { 'nav-pane': 'div', 'main-pane': 'div' },
  },
  {
    name: 'file-drop',
    fixture: FileDropIds as Component,
    ids: { attachments: 'group', 'attachments-input': 'input' },
    labels: { Attachments: 'input' },
    refs: {
      'attachments-input': { attribute: 'aria-describedby', id: 'attachments-input-description' },
    },
  },
  {
    name: 'avatar',
    fixture: AvatarIds as Component,
    ids: { 'crew-avatar': 'div' },
  },
  {
    name: 'tree',
    fixture: TreeIds as Component,
    ids: { files: 'tree' },
  },
];

runIdCases('a consumer id wins and every reference follows it', {
  forms: [...CASES_1, ...CASES_2],
  overlays: CASES_3,
  composites: CASES_4,
});

import { cleanup } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { afterEach } from 'vitest';
import AlertDialogIds from './fixtures/ids/AlertDialogIds.svelte';
import ContextMenuIds from './fixtures/ids/ContextMenuIds.svelte';
import DatePickerIds from './fixtures/ids/DatePickerIds.svelte';
import DialogIds from './fixtures/ids/DialogIds.svelte';
import HoverCardIds from './fixtures/ids/HoverCardIds.svelte';
import MenubarIds from './fixtures/ids/MenubarIds.svelte';
import MenuIds from './fixtures/ids/MenuIds.svelte';
import NavigationMenuIds from './fixtures/ids/NavigationMenuIds.svelte';
import PopoverIds from './fixtures/ids/PopoverIds.svelte';
import SheetIds from './fixtures/ids/SheetIds.svelte';
import TooltipIds from './fixtures/ids/TooltipIds.svelte';
import { fireEvent, type IdCase, runIdCases, screen } from './support/id-cases.ts';

// FIX-consumer-ids: overlay primitives (support/id-cases.ts runs the table).

afterEach(() => cleanup());

const click = (name: string) => async () => {
  await fireEvent.click(screen.getByRole('button', { name }));
};

const CASES: IdCase[] = [
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

runIdCases('a consumer id wins and every reference follows it: overlays', CASES);

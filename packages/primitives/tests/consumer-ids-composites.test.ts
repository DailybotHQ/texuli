import { cleanup } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { afterEach } from 'vitest';
import AccordionIds from './fixtures/ids/AccordionIds.svelte';
import AvatarIds from './fixtures/ids/AvatarIds.svelte';
import CollapsibleIds from './fixtures/ids/CollapsibleIds.svelte';
import CommandIds from './fixtures/ids/CommandIds.svelte';
import FileDropIds from './fixtures/ids/FileDropIds.svelte';
import ListboxIds from './fixtures/ids/ListboxIds.svelte';
import SplitterIds from './fixtures/ids/SplitterIds.svelte';
import TabsIds from './fixtures/ids/TabsIds.svelte';
import TreeIds from './fixtures/ids/TreeIds.svelte';
import { fireEvent, type IdCase, runIdCases, screen } from './support/id-cases.ts';

// FIX-consumer-ids: composite and disclosure primitives (support/id-cases.ts runs the table).

afterEach(() => cleanup());

const CASES: IdCase[] = [
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

runIdCases('a consumer id wins and every reference follows it: composites', CASES);

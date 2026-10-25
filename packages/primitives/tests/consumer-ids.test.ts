import { cleanup } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { afterEach } from 'vitest';
import ComboboxIds from './fixtures/ids/ComboboxIds.svelte';
import DialogNoDescriptionIds from './fixtures/ids/DialogNoDescriptionIds.svelte';
import SelectIds from './fixtures/ids/SelectIds.svelte';
import { fireEvent, type IdCase, runIdCases, screen } from './support/id-cases.ts';

// FIX-consumer-ids: select and combobox, plus a dialog with no description
// (support/id-cases.ts runs the table).

afterEach(() => cleanup());

const CASES: IdCase[] = [
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

runIdCases('a consumer id wins and every reference follows it: select, combobox, dialog', CASES);

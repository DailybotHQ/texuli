import { cleanup } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { afterEach } from 'vitest';
import CalendarIds from './fixtures/ids/CalendarIds.svelte';
import CheckboxIds from './fixtures/ids/CheckboxIds.svelte';
import ColorPickerIds from './fixtures/ids/ColorPickerIds.svelte';
import DateFieldIds from './fixtures/ids/DateFieldIds.svelte';
import FieldIds from './fixtures/ids/FieldIds.svelte';
import NumberFieldIds from './fixtures/ids/NumberFieldIds.svelte';
import PinInputIds from './fixtures/ids/PinInputIds.svelte';
import RadioGroupIds from './fixtures/ids/RadioGroupIds.svelte';
import SliderIds from './fixtures/ids/SliderIds.svelte';
import SwitchIds from './fixtures/ids/SwitchIds.svelte';
import TagsInputIds from './fixtures/ids/TagsInputIds.svelte';
import { type IdCase, runIdCases } from './support/id-cases.ts';

// FIX-consumer-ids: form primitives (support/id-cases.ts runs the table).

afterEach(() => cleanup());

const CASES: IdCase[] = [
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

runIdCases('a consumer id wins and every reference follows it: form primitives', CASES);

/// <reference types="node" />

import { render, screen } from '@testing-library/svelte';
import { createI18n, isPseudoLocalized, PSEUDO_LOCALE } from '@texuli/core/i18n';
import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DATE_PICKER_LABELS } from '../src/date-picker/shared.ts';
import { PRIMITIVES_MESSAGES_EN } from '../src/i18n/index.ts';
import { Pagination } from '../src/index.ts';
import { DEFAULT_TAGS_INPUT_LABELS } from '../src/tags-input/labels.ts';
import I18nHarness from './I18nHarness.svelte';
import { catalogDrift, hardCodedLabels, messageCalls } from './support/i18n-coverage.ts';

const SRC = 'packages/primitives/src';

describe('primitives labels resolve through @texuli/core/i18n (ADR-016)', () => {
  it('hard-codes no English label: every default goes through a message id', () => {
    expect(hardCodedLabels(SRC)).toEqual([]);
  });

  it('keeps PRIMITIVES_MESSAGES_EN equal to the ids and English defaults in the sources', () => {
    const calls = messageCalls(SRC);
    expect(calls.size).toBeGreaterThan(20);
    expect(
      catalogDrift(PRIMITIVES_MESSAGES_EN, calls, [
        ['primitives.tags-input', DEFAULT_TAGS_INPUT_LABELS],
        ['primitives.date-picker', DEFAULT_DATE_PICKER_LABELS],
      ])
    ).toEqual([]);
  });

  it('resolves instance prop, then the context catalog, then English, and follows lazy locales', async () => {
    const i18n = createI18n({
      loaders: {
        es: async () => ({
          locale: 'es',
          messages: {
            'primitives.pagination.previous-label': 'Página anterior',
            'primitives.pagination.page-label': 'Página {page}',
          },
        }),
      },
    });
    render(I18nHarness, {
      props: {
        i18n,
        component: Pagination.Root as never,
        props: { pageCount: 3, nextLabel: 'Onward' },
      },
    });
    // English defaults until a locale loads; the instance prop always wins.
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Onward' })).toBeTruthy();
    expect(await i18n.setLocale('es')).toBe(true);
    await tick();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Página 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Onward' })).toBeTruthy();
  });

  it('shows every label of a rendered primitive pseudo-localized under en-XA', async () => {
    const i18n = createI18n({ locale: PSEUDO_LOCALE });
    const view = render(I18nHarness, {
      props: { i18n, component: Pagination.Root as never, props: { pageCount: 2 } },
    });
    const names = [...view.container.querySelectorAll('[aria-label]')].map(
      (element) => element.getAttribute('aria-label') ?? ''
    );
    expect(names.length).toBeGreaterThan(3);
    expect(names.filter((name) => !isPseudoLocalized(name))).toEqual([]);
  });
});

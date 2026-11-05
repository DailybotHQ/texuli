/// <reference types="node" />

import { render, screen } from '@testing-library/svelte';
import { createI18n, createLabels, isPseudoLocalized, PSEUDO_LOCALE } from '@texuli/core/i18n';
import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import {
  catalogDrift,
  hardCodedLabels,
  messageCalls,
} from '../../primitives/tests/support/i18n-coverage.ts';
import { DEFAULT_CAROUSEL_MESSAGES } from '../src/components/carousel/carousel.ts';
import { DEFAULT_DATE_RANGE_PRESET_LABELS } from '../src/components/date/presets.ts';
import { DEFAULT_FILE_UPLOAD_LABELS } from '../src/components/file-upload/types.ts';
import { DEFAULT_RATING_LABELS } from '../src/components/rating/rating.ts';
import { DEFAULT_TIMELINE_MESSAGES } from '../src/components/timeline/types.ts';
import { TEXULI_MESSAGES_EN } from '../src/i18n/index.ts';
import { Breadcrumb, Pagination, Timeline } from '../src/index.ts';

const PaginationRoot = Pagination.Root;

import { DEFAULT_MOBILE_LABELS } from '../src/layouts/mobile/labels.ts';
import I18nHarness from './I18nHarness.svelte';
import LabelsProviderHarness from './LabelsProviderHarness.svelte';
import SetLabelsHarness from './SetLabelsHarness.svelte';

const SRC = 'packages/texuli/src';

describe('texuli labels resolve through @texuli/core/i18n (ADR-016)', () => {
  it('hard-codes no English label: every default goes through a message id', () => {
    expect(hardCodedLabels(SRC)).toEqual([]);
  });

  it('keeps TEXULI_MESSAGES_EN equal to the ids and English defaults in the sources', () => {
    const calls = messageCalls(SRC);
    expect(calls.size).toBeGreaterThan(80);
    expect(
      catalogDrift(TEXULI_MESSAGES_EN, calls, [
        ['texuli.carousel', DEFAULT_CAROUSEL_MESSAGES],
        ['texuli.date-range-picker.presets', DEFAULT_DATE_RANGE_PRESET_LABELS],
        ['texuli.file-upload', DEFAULT_FILE_UPLOAD_LABELS],
        ['texuli.rating', DEFAULT_RATING_LABELS],
        ['texuli.timeline', DEFAULT_TIMELINE_MESSAGES],
        ['texuli.mobile-layout', DEFAULT_MOBILE_LABELS],
      ])
    ).toEqual([]);
  });

  it('resolves instance prop, then the context catalog, then English, and follows lazy locales', async () => {
    const i18n = createI18n({
      loaders: {
        'pt-BR': async () => ({
          default: {
            locale: 'pt-BR',
            messages: {
              'texuli.breadcrumb.label': 'Trilha',
              'texuli.timeline.label': 'Linha do tempo',
            },
          },
        }),
      },
    });
    const items = [{ label: 'Home', href: '/' }, { label: 'Reports' }];
    render(I18nHarness, { props: { i18n, component: Breadcrumb as never, props: { items } } });
    render(I18nHarness, {
      props: {
        i18n,
        component: Timeline as never,
        props: {
          items: [{ title: 'Kickoff', status: 'complete' }],
          messages: { complete: 'Done' },
        },
      },
    });
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Timeline' })).toBeTruthy();
    expect(await i18n.setLocale('pt-BR')).toBe(true);
    await tick();
    expect(screen.getByRole('navigation', { name: 'Trilha' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Linha do tempo' })).toBeTruthy();
    // The `messages` prop still wins over the catalog.
    expect(document.body.textContent).toContain('Done');
  });

  it('shows the labels of a rendered component pseudo-localized under en-XA', () => {
    const i18n = createI18n({ locale: PSEUDO_LOCALE });
    const view = render(I18nHarness, {
      props: {
        i18n,
        component: Breadcrumb as never,
        props: { items: [{ label: 'Home', href: '/' }, { label: 'Reports' }] },
      },
    });
    const names = [...view.container.querySelectorAll('[aria-label]')].map(
      (element) => element.getAttribute('aria-label') ?? ''
    );
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !isPseudoLocalized(name))).toEqual([]);
  });

  it('LabelsProvider (ADR-026): prop, then the nearest dictionary, then outer ones, then English; updates live', async () => {
    const outer = {
      'texuli.breadcrumb.label': 'Ruta',
      'texuli.timeline.label': 'Cronología',
      'texuli.timeline.complete': 'Completado',
    };
    const inner = { 'texuli.timeline.complete': 'Terminado' };
    const view = render(LabelsProviderHarness, { props: { outer, inner } });
    expect(screen.getByRole('navigation', { name: 'Ruta' })).toBeTruthy();
    // The inner dictionary wins for its id; the outer one fills the rest.
    expect(screen.getByRole('list', { name: 'Cronología' })).toBeTruthy();
    const words = [...view.container.querySelectorAll('.tx-timeline__sr-only')].map(
      (node) => node.textContent
    );
    // The `messages` prop wins over both dictionaries.
    expect(words).toEqual([', Terminado', ', Ahora mismo']);
    await view.rerender({ outer: { ...outer, 'texuli.breadcrumb.label': 'Migas' }, inner });
    await tick();
    expect(screen.getByRole('navigation', { name: 'Migas' })).toBeTruthy();
  });

  it('setTexuliLabels puts one dictionary in context for styled components and primitives, over any outer one', () => {
    const outer = createLabels(
      { 'primitives.pagination.previous-button.label': 'Página anterior' },
      { locale: 'es' }
    );
    render(I18nHarness, {
      props: {
        i18n: outer,
        component: SetLabelsHarness as never,
        props: {
          labels: { 'primitives.pagination.label': 'Paginación' },
          component: PaginationRoot as never,
          props: { page: 2, pageCount: 5 },
        },
      },
    });
    const nav = screen.getByRole('navigation', { name: 'Paginación' });
    // The outer dictionary fills the ids the inner one leaves out.
    expect(nav.querySelector('[aria-label="Página anterior"]')).not.toBeNull();
    render(SetLabelsHarness, {
      props: {
        labels: {},
        component: Breadcrumb as never,
        props: { items: [{ label: 'Inicio' }] },
      },
    });
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
  });
});

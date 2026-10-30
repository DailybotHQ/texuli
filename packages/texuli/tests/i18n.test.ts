/// <reference types="node" />

import { render, screen } from '@testing-library/svelte';
import { createI18n, isPseudoLocalized, PSEUDO_LOCALE } from '@texuli/core/i18n';
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
import { Breadcrumb, Timeline } from '../src/index.ts';
import I18nHarness from './I18nHarness.svelte';

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
});

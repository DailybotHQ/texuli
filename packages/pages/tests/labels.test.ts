import { render, waitFor } from '@testing-library/svelte';
import { BLOCKS_MESSAGES_EN } from '@texuli/blocks/i18n';
import { BLOCKS_LABELS_ES } from '@texuli/blocks/i18n/es';
import type { MessageCatalog } from '@texuli/core/i18n';
import { PRIMITIVES_MESSAGES_EN } from '@texuli/primitives';
import { TEXULI_MESSAGES_EN } from 'texuli';
import { TEXULI_LABELS_ES } from 'texuli/i18n/es';
import { describe, expect, it } from 'vitest';
import { hardCodedLabels } from '../../primitives/tests/support/i18n-coverage.ts';
import { PAGES_LABELS_ES } from '../src/i18n/es.ts';
import { PAGES_MESSAGES_EN } from '../src/index.ts';
import { doc, para, text } from './fixtures.ts';
import LabelsHarness from './LabelsHarness.svelte';
import { ES } from './labels.es.ts';
import { recordPagesMessages } from './support/record-labels.ts';

const CATALOGS: readonly MessageCatalog[] = [
  TEXULI_MESSAGES_EN,
  PRIMITIVES_MESSAGES_EN,
  BLOCKS_MESSAGES_EN,
  PAGES_MESSAGES_EN,
];

/** Every English default that is plain text (no placeholder), longer than one character. */
function englishDefaults(): Set<string> {
  const out = new Set<string>();
  for (const catalog of CATALOGS) {
    for (const message of Object.values(catalog.messages)) {
      if (typeof message === 'string' && message.length > 1 && !message.includes('{')) {
        out.add(message.trim());
      }
    }
  }
  return out;
}

/** Visible text and accessible names: text nodes and the attributes that name or describe. */
function renderedStrings(root: HTMLElement): string[] {
  const out: string[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.textContent?.trim();
    if (value) out.push(value);
  }
  for (const element of root.querySelectorAll('*')) {
    for (const name of ['aria-label', 'title', 'placeholder', 'alt', 'aria-roledescription']) {
      const value = element.getAttribute(name)?.trim();
      if (value) out.push(value);
    }
  }
  return out;
}

const page = () =>
  doc(
    [
      { id: 'h1', type: 'heading', level: 2, content: text('Resumen') },
      para('p1', 'Primer párrafo'),
      { id: 'h2', type: 'heading', level: 2, content: text('Detalles') },
      para('p2', 'Segundo párrafo'),
    ],
    'Notas de campo'
  );

describe('one label dictionary for every package (ADR-026)', () => {
  it('keeps PAGES_MESSAGES_EN equal to every id the pages label factories resolve', () => {
    expect(hardCodedLabels('packages/pages/src')).toEqual([]);
    const recorded = recordPagesMessages();
    expect(recorded.size).toBeGreaterThan(150);
    expect(Object.fromEntries(recorded)).toEqual({ ...PAGES_MESSAGES_EN.messages });
  });

  it('renders texuli, primitives, blocks and pages under a Spanish dictionary with no English default left', async () => {
    // The hand-written Spanish set, and a marked value for every other id:
    // any English default still on screen did not resolve through the dictionary.
    const labels: Record<string, string> = {};
    for (const catalog of CATALOGS) {
      for (const id of Object.keys(catalog.messages)) labels[id] = `«${id}»`;
    }
    Object.assign(labels, ES);
    const view = render(LabelsHarness, { props: { labels, doc: page() } });
    await waitFor(() => {
      expect(view.container.querySelector('[data-tx-diagram="terminal"]')).not.toBeNull();
    });
    const english = englishDefaults();
    const shown = renderedStrings(view.container);
    expect(shown.length).toBeGreaterThan(40);
    expect(shown.filter((value) => english.has(value))).toEqual([]);
    // The Spanish set is what renders.
    for (const expected of [
      'Notificaciones',
      'Cronología',
      'Aún no hay datos',
      'Información',
      'Advertencia',
      'Sin tarjetas',
      'En esta página',
      'Paginación',
    ]) {
      expect(shown, expected).toContain(expected);
    }
    expect(shown).toContain('Tablero con 2 columnas y 1 tarjeta');
  });

  it('PAGES_LABELS_ES (@texuli/pages/i18n/es) has every id, the same placeholders, and no blank label', () => {
    const english = PAGES_MESSAGES_EN.messages as Readonly<Record<string, string>>;
    expect(Object.keys(PAGES_LABELS_ES).sort()).toEqual(Object.keys(english).sort());
    expect(Object.isFrozen(PAGES_LABELS_ES)).toBe(true);
    const placeholders = (text: string) =>
      (text.match(/\{[A-Za-z0-9_.-]{1,64}\}/g) ?? []).sort().join();
    const drift = Object.entries(PAGES_LABELS_ES).filter(
      ([id, spanish]) =>
        placeholders(spanish) !== placeholders(english[id] ?? '') || spanish.trim() === ''
    );
    expect(drift).toEqual([]);
  });

  it('renders texuli, primitives, blocks and pages with the shipped es catalogs and no English default left', async () => {
    const labels = { ...TEXULI_LABELS_ES, ...BLOCKS_LABELS_ES, ...PAGES_LABELS_ES };
    const view = render(LabelsHarness, { props: { labels, doc: page() } });
    await waitFor(() => {
      expect(view.container.querySelector('[data-tx-diagram="terminal"]')).not.toBeNull();
    });
    // Words the Spanish catalogs keep as in English (key names, loanwords).
    const same = new Set(
      Object.values(labels).filter((value) => englishDefaults().has(value.trim()))
    );
    const english = englishDefaults();
    const shown = renderedStrings(view.container);
    expect(shown.length).toBeGreaterThan(40);
    expect(shown.filter((value) => english.has(value) && !same.has(value))).toEqual([]);
    for (const expected of ['Notificaciones', 'En esta página', 'Paginación', 'Sin tarjetas']) {
      expect(shown, expected).toContain(expected);
    }
  });

  it('detects English defaults when no dictionary is set (the check above is not vacuous)', async () => {
    const view = render(LabelsHarness, { props: { labels: {}, doc: page() } });
    await waitFor(() => {
      expect(view.container.querySelector('[data-tx-diagram="terminal"]')).not.toBeNull();
    });
    const english = englishDefaults();
    const leaked = new Set(renderedStrings(view.container).filter((value) => english.has(value)));
    for (const expected of ['Notifications', 'Timeline', 'No data yet', 'Info', 'On this page']) {
      expect(leaked, expected).toContain(expected);
    }
  });
});

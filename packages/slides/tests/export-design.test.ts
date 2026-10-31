// @vitest-environment node
import { createHash } from 'node:crypto';
import { type Deck, parseDeck } from '@texuli/deck/model';
import { describe, expect, it } from 'vitest';
import { readZip } from '../../core/tests/zip-reader.ts';
import { type DeckPptxDesign, writeDeckPptx } from '../src/export/index.ts';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const decoder = new TextDecoder();

/** `writeDeckPptx(designDeck())` before design values existed (recorded at 7e5211f7). */
const DEFAULT_PPTX_SHA = 'e0773a13bc5590ff938f32eb0abc64671970fe904c921e0ce573b3dba6445364';

function designDeck(theme?: unknown): Deck {
  const parsed = parseDeck({
    formatVersion: 2,
    meta: { title: 'Design plan', locale: 'en' },
    style: { aspect: '16:9', ...(theme ? { theme } : {}) },
    slides: [
      {
        id: 'cover',
        layout: 'title-hero',
        props: { title: 'A calm release', subtitle: 'Fictional' },
      },
      {
        id: 'part',
        layout: 'section-divider',
        background: 'gradient-brand',
        props: { title: 'Part one' },
      },
      { id: 'quote', layout: 'quote', props: { quote: 'Small pieces.', cite: 'Ana Example' } },
    ],
  });
  if (!parsed.ok || !parsed.deck) throw new Error(JSON.stringify(parsed.issues));
  return parsed.deck;
}

/** Plain design values, as `designValues(compiled, 'light')` builds them. */
const ACME: DeckPptxDesign = {
  colors: {
    background: '#ffffff',
    foreground: '#111827',
    surface: '#f7ffff',
    primary: '#4f46e5',
    muted: '#f3f4f6',
    border: '#e5e7eb',
    info: '#0871c1',
    success: '#079455',
    warning: '#916600',
    destructive: '#d92d20',
    chart2: '#0ea5e9',
  },
  fonts: {
    sans: '"Acme Sans", system-ui, sans-serif',
    heading: '"Acme Display", "Acme Sans", system-ui',
    mono: '"Acme Mono", ui-monospace, monospace',
  },
};

async function theme(deck: Deck, options: Parameters<typeof writeDeckPptx>[1] = {}) {
  const result = await writeDeckPptx(deck, options);
  const entry = readZip(result.bytes).find((file) => file.path === 'ppt/theme/theme1.xml');
  return { result, xml: decoder.decode(entry?.data) };
}

describe('PPTX: design values', () => {
  it('keeps the default package byte for byte without a design (and with an empty one)', async () => {
    expect(sha((await writeDeckPptx(designDeck())).bytes)).toBe(DEFAULT_PPTX_SHA);
    for (const design of [null, {}, { colors: { primary: 'red' }, fonts: { sans: 'serif' } }])
      expect(sha((await writeDeckPptx(designDeck(), { design })).bytes)).toBe(DEFAULT_PPTX_SHA);
  });

  it('maps the design palette and fonts into theme1.xml', async () => {
    const { xml } = await theme(designDeck(), { design: ACME });
    for (const hex of ['111827', '4F46E5', '0EA5E9', 'D92D20'])
      expect(xml, hex).toContain(`val="${hex}"`);
    expect(xml).toContain('<a:latin typeface="Acme Display"');
    expect(xml).toContain('<a:latin typeface="Acme Sans"');
    expect(xml).not.toContain('Calibri');
  });

  it('layers the design over an embedded theme, and an explicit palette or font still wins', async () => {
    const embedded = {
      kind: 'embedded',
      theme: {
        id: 'harbor',
        name: 'Harbor',
        fontFamily: 'Georgia, serif',
        light: { primary: '#2456a6', link: '#123456' },
      },
    };
    const layered = await theme(designDeck(embedded), {
      design: { colors: { foreground: '#111827' } },
    });
    expect(layered.xml).toContain('val="2456A6"');
    expect(layered.xml).toContain('val="111827"');
    expect(layered.xml).toContain('<a:latin typeface="Georgia"');
    const host = await theme(designDeck(), {
      design: ACME,
      palette: {
        background: '#000000',
        foreground: '#fafafa',
        surface: '#111111',
        primary: '#ff0000',
        accent: '#00ff00',
        muted: '#222222',
        border: '#333333',
        info: '#0000ff',
        success: '#00aa00',
        warning: '#aaaa00',
        destructive: '#aa0000',
      },
      fonts: { body: 'Example Body' },
    });
    expect(host.xml).toContain('val="FF0000"');
    expect(host.xml).not.toContain('val="4F46E5"');
    expect(host.xml).toContain('<a:latin typeface="Example Body"');
    expect(host.xml).toContain('<a:latin typeface="Acme Display"');
  });
});

import type { Block } from '@texuli/blocks/core';
import type { Deck, DeckAspect, DeckSlide } from '../model/index.ts';
import { deckExportFilename } from './filename.ts';
import { el, serializeXml, type XmlElement } from './xml.ts';
import { writeZip } from './zip.ts';

export const PPTX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export interface DeckPptxOptions {
  /** Write speaker notes as PowerPoint notes pages. Defaults to true. */
  notes?: boolean;
}

/** A block left out of the export: media, charts, or a block with no text. */
export interface DeckPptxOmission {
  slideId: string;
  blockType: Block['type'];
  path: string;
}

export interface DeckPptxPart {
  path: string;
  contentType: string | null;
  xml: string;
}

export interface DeckPptxPackage {
  filename: string;
  parts: DeckPptxPart[];
  omitted: DeckPptxOmission[];
}

const NS = {
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  rels: 'http://schemas.openxmlformats.org/package/2006/relationships',
  types: 'http://schemas.openxmlformats.org/package/2006/content-types',
} as const;

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PML = 'application/vnd.openxmlformats-officedocument.presentationml';

/** Slide sizes in EMU (914400 per inch), matching the print page table. */
export const PPTX_SLIDE_SIZES: Readonly<Record<DeckAspect, { cx: number; cy: number }>> =
  Object.freeze({
    '16:9': Object.freeze({ cx: 12_192_000, cy: 6_858_000 }),
    '4:3': Object.freeze({ cx: 9_144_000, cy: 6_858_000 }),
    '1:1': Object.freeze({ cx: 6_858_000, cy: 6_858_000 }),
  });

const MARGIN = 457_200;
const TITLE_TOP = 342_900;
const TITLE_HEIGHT = 1_143_000;
const BODY_TOP = 1_600_200;

const pml = (name: string, ...children: Parameters<typeof el>[2][]) =>
  el(name, { 'xmlns:a': NS.a, 'xmlns:r': NS.r, 'xmlns:p': NS.p }, ...children);

function relationships(rels: readonly [string, string, string][]): XmlElement {
  return el(
    'Relationships',
    { xmlns: NS.rels },
    ...rels.map(([id, type, target]) => el('Relationship', { Id: id, Type: type, Target: target }))
  );
}

function emptyTree(...shapes: XmlElement[]): XmlElement {
  return el(
    'p:spTree',
    {},
    el('p:nvGrpSpPr', {}, el('p:cNvPr', { id: 1, name: '' }), el('p:cNvGrpSpPr'), el('p:nvPr')),
    el('p:grpSpPr'),
    ...shapes
  );
}

const COLOR_MAP = {
  bg1: 'lt1',
  tx1: 'dk1',
  bg2: 'lt2',
  tx2: 'dk2',
  accent1: 'accent1',
  accent2: 'accent2',
  accent3: 'accent3',
  accent4: 'accent4',
  accent5: 'accent5',
  accent6: 'accent6',
  hlink: 'hlink',
  folHlink: 'folHlink',
};

function themeXml(): XmlElement {
  const srgb = (name: string, value: string) =>
    el(`a:${name}`, {}, el('a:srgbClr', { val: value }));
  const font = (name: string) =>
    el(
      `a:${name}`,
      {},
      el('a:latin', { typeface: 'Calibri' }),
      el('a:ea', { typeface: '' }),
      el('a:cs', { typeface: '' })
    );
  const phFill = () => el('a:solidFill', {}, el('a:schemeClr', { val: 'phClr' }));
  const three = (make: () => XmlElement) => [make(), make(), make()];
  return el(
    'a:theme',
    { 'xmlns:a': NS.a, name: 'Texuli' },
    el(
      'a:themeElements',
      {},
      el(
        'a:clrScheme',
        { name: 'Texuli' },
        el('a:dk1', {}, el('a:srgbClr', { val: '1F2328' })),
        el('a:lt1', {}, el('a:srgbClr', { val: 'FFFFFF' })),
        srgb('dk2', '344054'),
        srgb('lt2', 'F2F4F7'),
        srgb('accent1', '2B6CE0'),
        srgb('accent2', '0E7490'),
        srgb('accent3', '15803D'),
        srgb('accent4', 'B45309'),
        srgb('accent5', 'B42318'),
        srgb('accent6', '6941C6'),
        srgb('hlink', '2B6CE0'),
        srgb('folHlink', '6941C6')
      ),
      el('a:fontScheme', { name: 'Texuli' }, font('majorFont'), font('minorFont')),
      el(
        'a:fmtScheme',
        { name: 'Texuli' },
        el('a:fillStyleLst', {}, ...three(phFill)),
        el('a:lnStyleLst', {}, ...three(() => el('a:ln', { w: 6350 }, phFill()))),
        el('a:effectStyleLst', {}, ...three(() => el('a:effectStyle', {}, el('a:effectLst')))),
        el('a:bgFillStyleLst', {}, ...three(phFill))
      )
    )
  );
}

interface Paragraph {
  text: string;
  size: number;
  bold?: boolean;
  bullet?: boolean;
  mono?: boolean;
}

function paragraphXml(paragraph: Paragraph, lang: string): XmlElement {
  const runProps = el(
    'a:rPr',
    { lang, sz: paragraph.size, b: paragraph.bold ? true : undefined, dirty: false },
    paragraph.mono ? el('a:latin', { typeface: 'Courier New' }) : null
  );
  return el(
    'a:p',
    {},
    paragraph.bullet
      ? el('a:pPr', { marL: 342_900, indent: -342_900 }, el('a:buChar', { char: '•' }))
      : null,
    paragraph.text.length > 0
      ? el('a:r', {}, runProps, el('a:t', {}, paragraph.text))
      : el('a:endParaRPr', { lang, sz: paragraph.size })
  );
}

function textBox(
  id: number,
  name: string,
  frame: { x: number; y: number; cx: number; cy: number },
  paragraphs: Paragraph[],
  lang: string,
  placeholder?: XmlElement
): XmlElement {
  return el(
    'p:sp',
    {},
    el(
      'p:nvSpPr',
      {},
      el('p:cNvPr', { id, name }),
      placeholder
        ? el('p:cNvSpPr', {}, el('a:spLocks', { noGrp: true }))
        : el('p:cNvSpPr', { txBox: true }),
      el('p:nvPr', {}, placeholder ?? null)
    ),
    el(
      'p:spPr',
      {},
      el(
        'a:xfrm',
        {},
        el('a:off', { x: frame.x, y: frame.y }),
        el('a:ext', { cx: frame.cx, cy: frame.cy })
      ),
      el('a:prstGeom', { prst: 'rect' }, el('a:avLst'))
    ),
    el(
      'p:txBody',
      {},
      el('a:bodyPr', { wrap: 'square' }, el('a:normAutofit')),
      el('a:lstStyle'),
      ...(paragraphs.length > 0 ? paragraphs : [{ text: '', size: 2000 }]).map((paragraph) =>
        paragraphXml(paragraph, lang)
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Block text, local on purpose: `blockText`, `walkBlocks` and the media family
// of `catalogIdForBlock` (`@texuli/blocks/core`, the deck grammar) would pull
// whole block-schema modules into the export entry once they are shared with
// the lazy print and v2 chunks. `tests/export.test.ts` holds them in parity.

/** Block types of the `blocks-media` catalog family. */
export const V1_MEDIA_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'image',
  'figure',
  'video',
  'gallery',
]);

function joinParts(parts: readonly string[]): string {
  return parts
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function stripLightMarkdown(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Plain text of one block (no children of containers), as `blockText` in `@texuli/blocks/core`. */
export function v1BlockText(block: Block): string {
  switch (block.type) {
    case 'heading':
      return joinParts([block.eyebrow ?? '', block.text, block.subtitle ?? '']);
    case 'text':
      return stripLightMarkdown(block.markdown);
    case 'list':
      return block.items.map((item) => stripLightMarkdown(item.text)).join('\n');
    case 'quote':
      return joinParts([stripLightMarkdown(block.quote), block.cite ?? '']);
    case 'callout':
      return joinParts([block.title ?? '', stripLightMarkdown(block.body)]);
    case 'code':
      return block.caption ? `${block.caption.trim()}\n${block.code}` : block.code;
    case 'cta':
      return block.actions.map((action) => action.label).join(' ');
    case 'tabs':
      return joinParts([block.label, ...block.panels.map((panel) => panel.label)]);
    case 'accordion':
      return joinParts([
        block.label ?? '',
        ...block.items.map((item) => joinParts([item.title, item.body ?? ''])),
      ]);
    case 'cards':
      return joinParts([
        block.title ?? '',
        ...block.items.map((item) => joinParts([item.eyebrow ?? '', item.title, item.body ?? ''])),
      ]);
    case 'grid':
      return joinParts([
        block.title ?? '',
        ...block.cells.map((cell) => joinParts([cell.title ?? '', cell.body ?? ''])),
      ]);
    case 'image':
      return joinParts([
        block.decorative ? '' : (block.alt ?? ''),
        block.caption ?? '',
        block.credit ?? '',
      ]);
    case 'figure':
      return joinParts([
        block.decorative ? '' : (block.alt ?? ''),
        block.caption,
        block.credit ?? '',
      ]);
    case 'video':
      return joinParts([block.label, block.caption ?? '']);
    case 'gallery':
      return joinParts([
        block.title ?? '',
        ...block.items.map((item) =>
          joinParts([item.decorative ? '' : (item.alt ?? ''), item.caption ?? ''])
        ),
      ]);
    default:
      return '';
  }
}

function jsonPath(path: readonly (string | number)[]): string {
  let result = '$';
  for (const segment of path) {
    result += typeof segment === 'number' ? `[${segment}]` : `[${JSON.stringify(segment)}]`;
  }
  return result;
}

/** Depth-first walk (columns and tab panels), as `walkBlocks` in `@texuli/blocks/core`. */
export function v1WalkBlocks(
  blocks: readonly Block[],
  path: readonly (string | number)[] = [],
  out: { block: Block; jsonPath: string }[] = []
): { block: Block; jsonPath: string }[] {
  blocks.forEach((block, index) => {
    if (!block) return;
    const blockPath = [...path, index];
    out.push({ block, jsonPath: jsonPath(blockPath) });
    if (block.type === 'columns') {
      block.columns.forEach((column, c) => {
        if (column) v1WalkBlocks(column, [...blockPath, 'columns', c], out);
      });
    } else if (block.type === 'tabs') {
      block.panels.forEach((panel, p) => {
        if (panel) v1WalkBlocks(panel.blocks, [...blockPath, 'panels', p, 'blocks'], out);
      });
    }
  });
  return out;
}

function lines(value: string): string[] {
  return value.split(/\r\n|\r|\n/);
}

function headingSize(level: number): number {
  return level <= 1 ? 3200 : level === 2 ? 2800 : 2400;
}

/** Plain-text paragraphs for one slide, plus the blocks that had no text. */
function slideParagraphs(slide: DeckSlide): {
  paragraphs: Paragraph[];
  omitted: DeckPptxOmission[];
} {
  const paragraphs: Paragraph[] = [];
  const omitted: DeckPptxOmission[] = [];
  for (const { block, jsonPath } of v1WalkBlocks(slide.blocks)) {
    if (block.type === 'columns' || block.type === 'divider') continue;
    // Media and charts are visual; exporting only their alt text would misrepresent them.
    if (V1_MEDIA_BLOCK_TYPES.has(block.type) || block.type === 'chart') {
      omitted.push({ slideId: slide.id, blockType: block.type, path: jsonPath });
      continue;
    }
    if (block.type === 'list') {
      for (const item of v1BlockText(block).split('\n')) {
        paragraphs.push({ text: item, size: 2000, bullet: true });
      }
      continue;
    }
    const text = v1BlockText(block).trim();
    if (!text) {
      omitted.push({ slideId: slide.id, blockType: block.type, path: jsonPath });
      continue;
    }
    if (block.type === 'heading') {
      paragraphs.push({ text: block.text, size: headingSize(block.level), bold: true });
      const rest = v1BlockText({ ...block, text: '' }).trim();
      for (const line of rest ? lines(rest) : []) paragraphs.push({ text: line, size: 2000 });
      continue;
    }
    const mono = block.type === 'code';
    for (const line of lines(text)) paragraphs.push({ text: line, size: mono ? 1600 : 2000, mono });
  }
  return { paragraphs, omitted };
}

function slideXml(slide: DeckSlide, index: number, size: { cx: number; cy: number }, lang: string) {
  const { paragraphs, omitted } = slideParagraphs(slide);
  const width = size.cx - MARGIN * 2;
  const xml = pml(
    'p:sld',
    el(
      'p:cSld',
      { name: slide.title ?? `Slide ${index + 1}` },
      emptyTree(
        textBox(
          2,
          'Title',
          { x: MARGIN, y: TITLE_TOP, cx: width, cy: TITLE_HEIGHT },
          [{ text: slide.title ?? '', size: 3600, bold: true }],
          lang
        ),
        textBox(
          3,
          'Content',
          { x: MARGIN, y: BODY_TOP, cx: width, cy: size.cy - BODY_TOP - MARGIN },
          paragraphs,
          lang
        )
      )
    ),
    el('p:clrMapOvr', {}, el('a:masterClrMapping'))
  );
  return { xml, omitted };
}

function notesXml(slide: DeckSlide, lang: string): XmlElement {
  return pml(
    'p:notes',
    el(
      'p:cSld',
      {},
      emptyTree(
        textBox(
          2,
          'Notes Placeholder',
          { x: 685_800, y: 4_343_400, cx: 5_486_400, cy: 4_114_800 },
          lines(slide.notes ?? '').map((text) => ({ text, size: 1200 })),
          lang,
          el('p:ph', { type: 'body', idx: 1 })
        )
      )
    ),
    el('p:clrMapOvr', {}, el('a:masterClrMapping'))
  );
}

/**
 * Build the PresentationML parts for a validated deck. Slide titles, text
 * from text-bearing blocks and speaker notes are written as escaped text;
 * blocks without text are reported in `omitted`. The deck is not mutated.
 */
export function buildDeckPptx(deck: Deck, options: DeckPptxOptions = {}): DeckPptxPackage {
  const withNotes = options.notes ?? true;
  const lang = deck.meta.locale ?? 'en-US';
  const size = PPTX_SLIDE_SIZES[deck.meta.aspect];
  const parts: DeckPptxPart[] = [];
  const omitted: DeckPptxOmission[] = [];
  const add = (path: string, contentType: string | null, root: XmlElement) =>
    parts.push({ path, contentType, xml: serializeXml(root) });

  const notesSlides = withNotes
    ? deck.slides.map((slide, index) => (slide.notes ? index : -1)).filter((index) => index >= 0)
    : [];
  const hasNotes = notesSlides.length > 0;

  add(
    '_rels/.rels',
    null,
    relationships([
      ['rId1', `${REL}/officeDocument`, 'ppt/presentation.xml'],
      [
        'rId2',
        'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
        'docProps/core.xml',
      ],
    ])
  );
  add(
    'docProps/core.xml',
    'application/vnd.openxmlformats-package.core-properties+xml',
    el(
      'cp:coreProperties',
      {
        'xmlns:cp': 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
        'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
        'xmlns:dcterms': 'http://purl.org/dc/terms/',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      },
      el('dc:title', {}, deck.meta.title),
      deck.meta.description ? el('dc:description', {}, deck.meta.description) : null,
      deck.meta.locale ? el('dc:language', {}, deck.meta.locale) : null
    )
  );

  const slideRelStart = 2;
  const presentationRels: [string, string, string][] = [
    ['rId1', `${REL}/slideMaster`, 'slideMasters/slideMaster1.xml'],
    ...deck.slides.map(
      (_slide, index) =>
        [`rId${slideRelStart + index}`, `${REL}/slide`, `slides/slide${index + 1}.xml`] as [
          string,
          string,
          string,
        ]
    ),
  ];
  const themeRelId = `rId${slideRelStart + deck.slides.length}`;
  const notesMasterRelId = `rId${slideRelStart + deck.slides.length + 1}`;
  presentationRels.push([themeRelId, `${REL}/theme`, 'theme/theme1.xml']);
  if (hasNotes) {
    presentationRels.push([
      notesMasterRelId,
      `${REL}/notesMaster`,
      'notesMasters/notesMaster1.xml',
    ]);
  }

  add(
    'ppt/presentation.xml',
    `${PML}.presentation.main+xml`,
    pml(
      'p:presentation',
      el('p:sldMasterIdLst', {}, el('p:sldMasterId', { id: 2147483648, 'r:id': 'rId1' })),
      hasNotes
        ? el('p:notesMasterIdLst', {}, el('p:notesMasterId', { 'r:id': notesMasterRelId }))
        : null,
      el(
        'p:sldIdLst',
        {},
        ...deck.slides.map((_slide, index) =>
          el('p:sldId', { id: 256 + index, 'r:id': `rId${slideRelStart + index}` })
        )
      ),
      el('p:sldSz', { cx: size.cx, cy: size.cy }),
      el('p:notesSz', { cx: 6_858_000, cy: 9_144_000 })
    )
  );
  add('ppt/_rels/presentation.xml.rels', null, relationships(presentationRels));

  add(
    'ppt/slideMasters/slideMaster1.xml',
    `${PML}.slideMaster+xml`,
    pml(
      'p:sldMaster',
      el('p:cSld', {}, emptyTree()),
      el('p:clrMap', COLOR_MAP),
      el('p:sldLayoutIdLst', {}, el('p:sldLayoutId', { id: 2147483649, 'r:id': 'rId1' }))
    )
  );
  add(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    null,
    relationships([
      ['rId1', `${REL}/slideLayout`, '../slideLayouts/slideLayout1.xml'],
      ['rId2', `${REL}/theme`, '../theme/theme1.xml'],
    ])
  );
  add(
    'ppt/slideLayouts/slideLayout1.xml',
    `${PML}.slideLayout+xml`,
    el(
      'p:sldLayout',
      { 'xmlns:a': NS.a, 'xmlns:r': NS.r, 'xmlns:p': NS.p, type: 'blank', preserve: true },
      el('p:cSld', { name: 'Blank' }, emptyTree()),
      el('p:clrMapOvr', {}, el('a:masterClrMapping'))
    )
  );
  add(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    null,
    relationships([['rId1', `${REL}/slideMaster`, '../slideMasters/slideMaster1.xml']])
  );
  add(
    'ppt/theme/theme1.xml',
    'application/vnd.openxmlformats-officedocument.theme+xml',
    themeXml()
  );

  deck.slides.forEach((slide, index) => {
    const number = index + 1;
    const built = slideXml(slide, index, size, lang);
    omitted.push(...built.omitted);
    add(`ppt/slides/slide${number}.xml`, `${PML}.slide+xml`, built.xml);
    const withSlideNotes = notesSlides.includes(index);
    add(
      `ppt/slides/_rels/slide${number}.xml.rels`,
      null,
      relationships([
        ['rId1', `${REL}/slideLayout`, '../slideLayouts/slideLayout1.xml'],
        ...(withSlideNotes
          ? ([['rId2', `${REL}/notesSlide`, `../notesSlides/notesSlide${number}.xml`]] as [
              string,
              string,
              string,
            ][])
          : []),
      ])
    );
    if (withSlideNotes) {
      add(
        `ppt/notesSlides/notesSlide${number}.xml`,
        `${PML}.notesSlide+xml`,
        notesXml(slide, lang)
      );
      add(
        `ppt/notesSlides/_rels/notesSlide${number}.xml.rels`,
        null,
        relationships([
          ['rId1', `${REL}/notesMaster`, '../notesMasters/notesMaster1.xml'],
          ['rId2', `${REL}/slide`, `../slides/slide${number}.xml`],
        ])
      );
    }
  });

  if (hasNotes) {
    add(
      'ppt/notesMasters/notesMaster1.xml',
      `${PML}.notesMaster+xml`,
      pml(
        'p:notesMaster',
        el(
          'p:cSld',
          {},
          emptyTree(
            textBox(
              2,
              'Notes Placeholder',
              { x: 685_800, y: 4_343_400, cx: 5_486_400, cy: 4_114_800 },
              [],
              lang,
              el('p:ph', { type: 'body', idx: 1 })
            )
          )
        ),
        el('p:clrMap', COLOR_MAP)
      )
    );
    add(
      'ppt/notesMasters/_rels/notesMaster1.xml.rels',
      null,
      relationships([['rId1', `${REL}/theme`, '../theme/theme2.xml']])
    );
    add(
      'ppt/theme/theme2.xml',
      'application/vnd.openxmlformats-officedocument.theme+xml',
      themeXml()
    );
  }

  const contentTypes = el(
    'Types',
    { xmlns: NS.types },
    el('Default', {
      Extension: 'rels',
      ContentType: 'application/vnd.openxmlformats-package.relationships+xml',
    }),
    el('Default', { Extension: 'xml', ContentType: 'application/xml' }),
    ...parts
      .filter((part) => part.contentType)
      .map((part) => el('Override', { PartName: `/${part.path}`, ContentType: part.contentType }))
  );
  parts.unshift({
    path: '[Content_Types].xml',
    contentType: null,
    xml: serializeXml(contentTypes),
  });

  return { filename: deckExportFilename(deck.meta.title, 'pptx'), parts, omitted };
}

/** Zip the parts into PPTX bytes. Output is deterministic for the same deck. */
export function writeDeckPptx(
  deck: Deck,
  options: DeckPptxOptions = {}
): { filename: string; bytes: Uint8Array; omitted: DeckPptxOmission[] } {
  const built = buildDeckPptx(deck, options);
  const bytes = writeZip(built.parts.map((part) => ({ path: part.path, data: part.xml })));
  return { filename: built.filename, bytes, omitted: built.omitted };
}

/** PPTX as a Blob for a host download; nothing is uploaded. */
export function exportDeckPptx(
  deck: Deck,
  options: DeckPptxOptions = {}
): { filename: string; blob: Blob; omitted: DeckPptxOmission[] } {
  const written = writeDeckPptx(deck, options);
  return {
    filename: written.filename,
    blob: new Blob([written.bytes as BlobPart], { type: PPTX_MIME_TYPE }),
    omitted: written.omitted,
  };
}

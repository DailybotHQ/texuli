// @vitest-environment node
/**
 * The website builder's models (apps/website/src/components/builder): history,
 * inspector fields (choice, media, number, rich text, text), outline moves and
 * drops, palette, JSON payload and share links, and the preview model. Each
 * field mirrors the renderer's own closed rule and URL policy tier. The DOM
 * behavior is site-builder-dom.test.ts; the round-trip property is
 * site-builder-roundtrip.property.test.ts.
 */
import { type CatalogManifest } from '@texuli/catalog';
import {
  applyEditOp,
  applyEditOps,
  blueprintDigest,
  canonicalBlueprintJson,
  type EditOp,
} from '@texuli/catalog/edit';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import {
  cardLayoutManifest,
  deckLayoutManifest,
  gridLayoutManifest,
  pageLayoutManifest,
} from '@texuli/catalog/manifests/layouts';
import { type CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { type PlayerDiagnosticsEvent } from '@texuli/player';
import { describe, expect, it } from 'vitest';
import {
  announceMove,
  createBuilderUndo,
  describeEdit,
  historyShortcut,
  ownsTextUndo,
  selectionAfterMove,
} from '../../apps/website/src/components/builder/history/model.ts';
import {
  type ChoiceProp,
  choiceIssues,
  defaultText,
  enumControl,
  enumInput,
  isChoiceProp,
  readChoice,
  showRaw as showRaw_1,
  switchChecked,
} from '../../apps/website/src/components/builder/inspector/choice/model.ts';
import {
  fieldFamily,
  unsupportedReason,
} from '../../apps/website/src/components/builder/inspector/coverage.ts';
import {
  AVATAR_IDS,
  BLUEPRINT_TIER,
  blockSourceKindOf,
  checkMediaBlock,
  dataUriOf,
  describeSource,
  editableMediaBlock,
  editGallery,
  GALLERY_ITEM_FIELDS,
  isAltProp,
  isTrustPinned,
  MAX_GALLERY_ITEMS,
  MEDIA_FIELDS,
  MEDIA_PRESETS,
  MEDIA_TYPES,
  type MediaBlockValue,
  type MediaField,
  policyFor,
  readAlt,
  readBlockSource,
  readUrl,
  setRecordField,
  sourceKindsFor,
  switchMediaType,
  URL_PROP_IDS,
  type UrlRole,
  urlRoleOf,
  validateMediaBlock,
} from '../../apps/website/src/components/builder/inspector/media/model.ts';
import {
  describeBounds,
  isNumberProp,
  type NumberBounds,
  type NumberProp,
  numberControl,
  numberIssues,
  parseNumberInput,
  readNumber,
  shownDefault,
  showRaw as showRaw_2,
  sliderStep,
  withinBounds,
} from '../../apps/website/src/components/builder/inspector/number/model.ts';
import {
  chartNumberHints,
  chartPropSchemas,
  numberHints,
  paintNumberHints,
} from '../../apps/website/src/components/builder/inspector/number/sources.ts';
import {
  GRID_GAP,
  isLocaleTag,
  isStringProp,
  REGION_NAME,
  readString,
  type StringProp,
  stringInput,
  stringIssues,
  stringRule,
} from '../../apps/website/src/components/builder/inspector/string/model.ts';
import {
  BLOCK_CONTENT_LIMITS,
  editableBlock,
  editItems,
  itemTexts,
  linkVerdicts,
  primaryText,
  remaining,
  setField,
  switchType,
  TEXT_FIELDS,
  TEXT_PRESETS,
  TEXT_TYPES,
  type TextBlockValue,
  TONES,
  validateTextBlock,
} from '../../apps/website/src/components/builder/inspector/text/model.ts';
import {
  readRichText,
  writeRichText,
} from '../../apps/website/src/components/builder/inspector/text/richtext.ts';
import {
  BUILDER_MANIFEST_BY_ID,
  BUILDER_MANIFESTS,
  BUILDER_ROOT_ONLY,
  builderInsertable,
} from '../../apps/website/src/components/builder/manifest.ts';
import {
  createBuilderHistory,
  duplicateJsonKeys,
  inspectorFields,
  refusedPropName,
  validateBuilderTree,
} from '../../apps/website/src/components/builder/model.ts';
import {
  blockIds,
  cloneSubtree,
  copySubtrees,
  duplicateOps,
  freshBlockId,
  type GroupResult,
  groupDropMove,
  groupKeyboardMove,
  groupRemoveOps,
  groupRoots,
  pasteOps,
  pathAfterOp,
  placedPaths,
  rangeKeys,
  toggleKey,
} from '../../apps/website/src/components/builder/outline/group.ts';
import {
  moveKeepsStructure,
  structuralErrors,
} from '../../apps/website/src/components/builder/outline/guard.ts';
import {
  type DropPosition,
  dropMove,
  dropPosition,
  keyboardMove,
  type MoveResult,
  manifestCanContain,
  nodeAt,
  outlineRows,
  pathAfterRemoval,
} from '../../apps/website/src/components/builder/outline/model.ts';
import {
  AVAILABILITY_NOTES,
  createPaletteEntries,
  groupPalette,
  moveActive,
  paletteCountText,
  searchPalette,
} from '../../apps/website/src/components/builder/palette/model.ts';
import {
  PALETTE_MANIFESTS,
  playerPaints,
  unavailableReason,
} from '../../apps/website/src/components/builder/palette/sources.ts';
import {
  builderTreeIssues,
  checkPayloadText,
  describeIssue,
  locateJson,
  parseErrorPosition,
  positionAt,
  positionIndex,
  prettyBlueprintJson,
} from '../../apps/website/src/components/builder/payload/model.ts';
import {
  builderPathOf,
  DEFAULT_PREVIEW_VIEW,
  PREVIEW_WIDTH_PX,
  parseView,
  previewIssues,
  previewSummary,
  stageClass,
  stageInlineSize,
  viewText,
} from '../../apps/website/src/components/builder/preview/model.ts';
import {
  decodeShare,
  encodeShare,
  isShareHash,
  MAX_SHARE_CHARS,
  SHARE_PREFIX,
} from '../../apps/website/src/components/builder/share/model.ts';
import {
  loadStarter,
  STARTER_IDS,
  STARTERS,
} from '../../apps/website/src/components/builder/starters/model.ts';
import { activeHighlightIndex } from '../../packages/blocks/src/code/token-styles.ts';
import { canvasBackingSize } from '../../packages/media/src/composition-canvas/geometry.ts';
import { IMAGE_LIMITS, intrinsicSize } from '../../packages/media/src/image/model.ts';
import { HOST_REGION_NAME } from '../../packages/player/src/region-manifests.ts';

describe('history', () => {
  const labels: Record<string, string> = {
    'layout-page': 'Page layout',
    'layout-card': 'Card layout',
    'blocks-text': 'Text blocks',
  };
  const labelOf = (id: string) => labels[id] ?? id;
  const text = (markdown: string): CatalogTreeInput => ({
    id: 'blocks-text',
    props: { block: { type: 'text', markdown } },
  });
  const start: CatalogTreeInput = {
    id: 'layout-page',
    props: { title: 'Fictional' },
    children: [
      { id: 'layout-card', props: { title: 'Alpha' }, children: [text('one')] },
      text('two'),
    ],
  };
  const fresh = () => createBuilderUndo(createBuilderHistory(start), labelOf);
  const key = (overrides: Partial<Parameters<typeof historyShortcut>[0]>) => ({
    key: 'z',
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  });

  describe('builder history labels', () => {
    it('names each edit by its op and the node it touched; announces what came back, and redo is cleared by a new edit; keeps one label for coalesced typing, and an explicit label wins; records no step for an edit that changes nothing or is refused', () => {
      expect(
        describeEdit(start, [{ op: 'setProp', path: [0], name: 'title', value: 'B' }], labelOf)
      ).toBe('Set title on Card layout');
      expect(describeEdit(start, [{ op: 'unsetProp', path: [], name: 'title' }], labelOf)).toBe(
        'Clear title on Page layout'
      );
      expect(describeEdit(start, [{ op: 'remove', path: [1] }], labelOf)).toBe(
        'Remove Text blocks'
      );
      expect(
        describeEdit(start, [{ op: 'insert', parent: [], index: 2, node: text('x') }], labelOf)
      ).toBe('Insert Text blocks');
      expect(describeEdit(start, [{ op: 'move', path: [1], parent: [0], index: 0 }], labelOf)).toBe(
        'Move Text blocks'
      );
      expect(describeEdit(start, [{ op: 'replaceAll', tree: start }], labelOf)).toBe(
        'Replace the draft'
      );
      // announces what came back, and redo is cleared by a new edit
      {
        const history = fresh();
        history.apply({ op: 'setProp', path: [0], name: 'title', value: 'Beta' });
        history.apply({ op: 'remove', path: [1] });
        expect(history.undoLabel).toBe('Remove Text blocks');

        const undone = history.undo();
        expect(undone && announceMove(undone)).toBe('Undid: Remove Text blocks.');
        expect(history.redoLabel).toBe('Remove Text blocks');
        expect(history.undoLabel).toBe('Set title on Card layout');

        const redone = history.redo();
        expect(redone && announceMove(redone)).toBe('Redid: Remove Text blocks.');

        history.undo();
        expect(history.canRedo).toBe(true);
        history.apply({ op: 'setProp', path: [], name: 'title', value: 'New' });
        expect(history.canRedo).toBe(false);
        expect(history.redoLabel).toBeNull();
        expect(history.redo()).toBeNull();
      }
      // keeps one label for coalesced typing, and an explicit label wins
      {
        const history = fresh();
        for (const value of ['B', 'Be', 'Bet']) {
          history.apply(
            { op: 'setProp', path: [0], name: 'title', value },
            { coalesceKey: 'prop:0:title' }
          );
        }
        history.apply({ op: 'replaceAll', tree: start }, { label: 'Commit JSON' });
        expect(history.undo()?.label).toBe('Commit JSON');
        expect(history.undo()?.label).toBe('Set title on Card layout');
        expect(history.canUndo).toBe(false);
        expect(history.undoLabel).toBeNull();
      }
      // records no step for an edit that changes nothing or is refused
      {
        const history = fresh();
        history.apply({ op: 'unsetProp', path: [], name: 'subtitle' });
        history.apply({ op: 'remove', path: [9] });
        expect(history.canUndo).toBe(false);
        expect(history.undoLabel).toBeNull();
      }
    });
  });

  describe('selection after a history move', () => {
    it('follows what came back: a prop change, a reinserted node, a moved node; keeps the selection on a whole-draft replacement when the node still exists', () => {
      // follows what came back: a prop change, a reinserted node, a moved node
      {
        const history = fresh();
        history.apply({
          op: 'setProp',
          path: [0, 0],
          name: 'block',
          value: text('changed').props?.block,
        });
        const propUndo = history.undo();
        expect(propUndo && selectionAfterMove(propUndo, [])).toEqual([0, 0]);

        history.apply({ op: 'remove', path: [1] });
        const removeUndo = history.undo();
        expect(removeUndo && selectionAfterMove(removeUndo, [])).toEqual([1]);
        const removeRedo = history.redo();
        expect(removeRedo && selectionAfterMove(removeRedo, [1])).toEqual([]);

        history.undo();
        history.apply({ op: 'move', path: [1], parent: [0], index: 0 });
        const moveUndo = history.undo();
        expect(moveUndo && selectionAfterMove(moveUndo, [0, 0])).toEqual([1]);
      }
      // keeps the selection on a whole-draft replacement when the node still exists
      {
        const history = fresh();
        history.apply({ op: 'replaceAll', tree: { id: 'layout-page', props: {}, children: [] } });
        const undone = history.undo();
        expect(undone && selectionAfterMove(undone, [0, 0])).toEqual([0, 0]);
        const redone = history.redo();
        expect(redone && selectionAfterMove(redone, [0, 0])).toEqual([]);
      }
    });
  });

  describe('history shortcuts', () => {
    it('maps Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z and Ctrl+Y; leaves text fields their own undo', () => {
      expect(historyShortcut(key({ metaKey: true }))).toBe('undo');
      expect(historyShortcut(key({ ctrlKey: true }))).toBe('undo');
      expect(historyShortcut(key({ key: 'Z', metaKey: true, shiftKey: true }))).toBe('redo');
      expect(historyShortcut(key({ key: 'y', ctrlKey: true }))).toBe('redo');
      expect(historyShortcut(key({}))).toBeNull();
      expect(historyShortcut(key({ metaKey: true, altKey: true }))).toBeNull();
      expect(historyShortcut(key({ key: 'y', metaKey: true }))).toBeNull();
      expect(ownsTextUndo({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
      expect(ownsTextUndo({ tagName: 'INPUT', type: 'text' } as unknown as EventTarget)).toBe(true);
      expect(ownsTextUndo({ tagName: 'INPUT', type: 'number' } as unknown as EventTarget)).toBe(
        true
      );
      expect(
        ownsTextUndo({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)
      ).toBe(true);
      expect(ownsTextUndo({ tagName: 'INPUT', type: 'checkbox' } as unknown as EventTarget)).toBe(
        false
      );
      expect(ownsTextUndo({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false);
      expect(ownsTextUndo(null)).toBe(false);
    });
  });

  describe('inspector fields (Task 77 visual finding)', () => {
    it('never offers a prop the closed rule refuses, nor slots and events', () => {
      const props = [
        { name: 'title', kind: 'string' },
        { name: 'class', kind: 'string' },
        { name: 'style', kind: 'string' },
        { name: 'onclick', kind: 'event' },
        { name: 'onready', kind: 'string' },
        { name: 'children', kind: 'slot' },
        { name: 'toc', kind: 'boolean' },
      ];
      expect(inspectorFields(props).map((prop) => prop.name)).toEqual(['title', 'toc']);
      // Every builder manifest: no inspector field can only produce refusals.
      for (const manifest of BUILDER_MANIFESTS) {
        for (const field of inspectorFields(manifest.props)) {
          expect(refusedPropName(field.name), `${manifest.id}.${field.name}`).toBe(false);
        }
      }
    });
  });
});

describe('inspector: choice', () => {
  /** Every enum and boolean prop the builder can edit, from the real manifests. */
  const CHOICE_PROPS: { id: string; prop: ChoiceProp }[] = BUILDER_MANIFESTS.flatMap((manifest) =>
    manifest.props.filter(isChoiceProp).map((prop) => ({ id: manifest.id, prop }))
  );

  /** Values a hostile or stale payload might carry. */
  const HOSTILE: unknown[] = [
    'evil',
    '',
    ' ',
    0,
    1,
    -1,
    Number.NaN,
    null,
    {},
    [],
    ['light'],
    { value: 'light' },
    'true',
    'false',
    '<b>x</b>',
    '<img src=x onerror=alert(1)>',
    '\u202Edark',
    '__proto__',
    'constructor',
    'x'.repeat(10_000),
  ];

  /** The rule the renderer applies, written out independently of it. */
  function oracle(prop: ChoiceProp, value: unknown): 'unset' | 'set' | 'invalid' {
    if (value === undefined) return 'unset';
    if (prop.kind === 'boolean') return typeof value === 'boolean' ? 'set' : 'invalid';
    return typeof value === 'string' && (prop.enumValues ?? []).includes(value) ? 'set' : 'invalid';
  }

  describe('choice props in the builder manifests', () => {
    it('covers every enum and boolean prop the builder edits; reads every value exactly as the renderer will: unset, accepted or refused; accepts every closed-set value as input and refuses anything else; uses radios for up to four values and a select above that', () => {
      // covers every enum and boolean prop the builder edits
      {
        // PLAN_005 task 5 adds the G20 layouts: row align and wrap, stack, row and split gaps, split ratio.
        // PLAN_005 task 6: the deck root adds its aspect enum.
        expect(CHOICE_PROPS.length).toBe(40);
        expect(CHOICE_PROPS.filter((entry) => entry.prop.kind === 'boolean')).toHaveLength(7);
        const ids = new Set(CHOICE_PROPS.map((entry) => `${entry.id}.${entry.prop.name}`));
        for (const name of [
          'layout-stack.gap',
          'layout-row.align',
          'layout-row.wrap',
          'layout-split.ratio',
        ]) {
          expect(ids.has(name), name).toBe(true);
        }
      }
      // reads every value exactly as the renderer will: unset, accepted or refused
      {
        let checked = 0;
        for (const { id, prop } of CHOICE_PROPS) {
          const values: unknown[] = [
            undefined,
            true,
            false,
            ...(prop.enumValues ?? []),
            ...(prop.enumValues ?? []).flatMap((value) => [
              value.toUpperCase(),
              ` ${value}`,
              `${value} `,
            ]),
            ...HOSTILE,
          ];
          for (const value of values) {
            const expected = oracle(prop, value);
            const reading = readChoice(prop, value);
            expect(reading.state, `${id}.${prop.name} = ${showRaw_1(value)}`).toBe(expected);
            if (reading.state === 'invalid') {
              expect(reading.message.length).toBeGreaterThan(0);
              expect(choiceIssues(prop, value).some((issue) => issue.severity === 'error')).toBe(
                true
              );
            }
            checked += 1;
          }
        }
        expect(checked).toBeGreaterThan(1000);
      }
      for (const { id, prop } of CHOICE_PROPS) {
        if (prop.kind !== 'enum') continue;
        for (const value of prop.enumValues ?? []) {
          expect(enumInput(prop, value), `${id}.${prop.name}`).toEqual({ ok: true, value });
        }
        for (const outsider of [
          'evil',
          (prop.enumValues?.[0] ?? '').toUpperCase(),
          ' x',
          '__proto__',
        ].filter((candidate) => !prop.enumValues?.includes(candidate))) {
          expect(enumInput(prop, outsider), `${id}.${prop.name} ${outsider}`).toEqual({
            ok: false,
          });
        }
        // "Not set" exists only for optional props.
        expect(enumInput(prop, '')).toEqual(
          prop.required === true ? { ok: false } : { ok: true, value: undefined }
        );
      }
      // uses radios for up to four values and a select above that
      {
        for (const { prop } of CHOICE_PROPS) {
          if (prop.kind !== 'enum') continue;
          expect(enumControl(prop)).toBe((prop.enumValues?.length ?? 0) <= 4 ? 'radio' : 'select');
        }
        const fit = CHOICE_PROPS.find(
          (entry) => entry.id === 'media-image' && entry.prop.name === 'fit'
        );
        expect(fit && enumControl(fit.prop)).toBe('select');
      }
    });
  });

  describe('choice issues', () => {
    const find = (id: string, name: string) => {
      const entry = CHOICE_PROPS.find(
        (candidate) => candidate.id === id && candidate.prop.name === name
      );
      if (!entry) throw new Error(`${id}.${name} not found`);
      return entry.prop;
    };

    it('asks for a value when a required prop is unset, and only then; warns when a pinned prop is set to anything but the pinned value; explains a refused value with the renderer reason and the value as text', () => {
      // asks for a value when a required prop is unset, and only then
      {
        const kind = find('charts-cartesian', 'kind');
        expect(choiceIssues(kind, undefined)).toEqual([
          { severity: 'error', message: 'Required: choose a value.' },
        ]);
        expect(choiceIssues(kind, 'line')).toEqual([]);
        expect(choiceIssues(find('charts-line', 'mode'), undefined)).toEqual([]);
      }
      // warns when a pinned prop is set to anything but the pinned value
      {
        const trust = find('media-image', 'trust');
        expect(choiceIssues(trust, 'developer', 'untrusted')).toEqual([
          {
            severity: 'warning',
            message: 'The player always paints this as “untrusted”; a blueprint cannot change it.',
          },
        ]);
        expect(choiceIssues(trust, 'untrusted', 'untrusted')).toEqual([]);
        expect(choiceIssues(trust, undefined, 'untrusted')).toEqual([]);
      }
      // explains a refused value with the renderer reason and the value as text
      {
        const [issue] = choiceIssues(find('charts-line', 'mode'), '<b>dark</b>');
        expect(issue?.severity).toBe('error');
        expect(issue?.message).toContain('"<b>dark</b>"');
        expect(issue?.message).toContain('will be refused at paint');
      }
    });
  });

  describe('switches, defaults and raw values', () => {
    it('shows a boolean value, else its default, else off; shows refused values as short JSON text', () => {
      // shows a boolean value, else its default, else off
      {
        const toc = CHOICE_PROPS.find(
          (entry) => entry.id === 'layout-doc' && entry.prop.name === 'toc'
        );
        if (!toc) throw new Error('layout-doc.toc not found');
        expect(switchChecked(toc.prop, undefined)).toBe(true);
        expect(switchChecked(toc.prop, false)).toBe(false);
        expect(switchChecked(toc.prop, 'yes')).toBe(true);
        expect(defaultText(toc.prop)).toBe('Default: on. A default is not saved.');
        for (const { prop } of CHOICE_PROPS) {
          if (prop.kind === 'boolean' && prop.default === undefined) {
            expect(switchChecked(prop, undefined)).toBe(false);
            expect(defaultText(prop)).toBeUndefined();
          }
        }
      }
      // shows refused values as short JSON text
      {
        expect(showRaw_1('evil')).toBe('"evil"');
        expect(showRaw_1({ a: 1 })).toBe('{"a":1}');
        expect(showRaw_1(null)).toBe('null');
        expect(showRaw_1(Number.NaN)).toBe('null');
        const long = showRaw_1('x'.repeat(10_000));
        expect([...long].length).toBe(61);
        expect(long.endsWith('…')).toBe(true);
      }
    });
  });
});

describe('inspector: media', () => {
  const image = BUILDER_MANIFESTS.find((manifest) => manifest.id === 'media-image');
  const propOf = (name: string) => {
    const prop = image?.props.find((candidate) => candidate.name === name);
    if (!prop) throw new Error(`media-image.${name} missing`);
    return prop;
  };

  /** Sources an agent or a careless author might write; fictional hosts only. */
  const SOURCES = [
    'https://images.example.com/cat.png',
    'https://user:pass@images.example.com/cat.png',
    'https:images.example.com/cat.png',
    'http://images.example.com/cat.png',
    'images/cat.png',
    './images/cat.png',
    'C:/images/cat.png',
    '//images.example.com/cat.png',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'vbscript:msgbox',
    'data:image/png;base64,iVBORw0KGgo=',
    'data:text/html;base64,PGI+',
    'blob:https://app.example.com/2f6c',
    'mailto:team@example.com',
    '#details',
    'ftp://files.example.com/cat.png',
    'https://images.example.com/a b.png',
    'https://images.example.com/\u200bcat.png',
    'images/\u202ecat.png',
    ' https://images.example.com/cat.png ',
    'https://images.example.com/a.png 480w, https://images.example.com/b.png 960w',
    'https://images.example.com/a.png 480w, https://images.example.com/b.png 2x',
    'https://images.example.com/a.png 1x, http://images.example.com/b.png 2x',
    '',
    'x'.repeat(5000),
  ];

  describe('media-image URL props', () => {
    it("maps exactly the props the image component passes through the URL policy; reads every id with URL props at the untrusted tier, because the player pins its trust; paints exactly what the core URL policy keeps at the untrusted tier; explains a developer-only source as a tier difference, and a script URL as blocked everywhere; refuses a non-string or markup value with the renderer's own message; reads alt the way the player's media policy will paint it", () => {
      // maps exactly the props the image component passes through the URL policy
      {
        const roles = image?.props.flatMap((prop) => {
          const role = urlRoleOf('media-image', prop.name);
          return role ? [`${prop.name}:${role}`] : [];
        });
        expect(roles).toEqual(['src:image-src', 'srcset:image-srcset', 'href:href']);
        expect(urlRoleOf('media-image', 'alt')).toBeUndefined();
        expect(urlRoleOf('charts-pie', 'src')).toBeUndefined();
        expect(isAltProp('media-image', 'alt')).toBe(true);
      }
      expect(BLUEPRINT_TIER).toBe('untrusted');
      for (const id of URL_PROP_IDS) expect(isTrustPinned(id), id).toBe(true);
      // paints exactly what the core URL policy keeps at the untrusted tier
      {
        let checked = 0;
        for (const [name, role] of [
          ['src', 'image-src'],
          ['srcset', 'image-srcset'],
          ['href', 'href'],
        ] as [string, UrlRole][]) {
          for (const source of SOURCES) {
            const reading = readUrl(propOf(name), role, source);
            const kept = policyFor(role, source, 'untrusted');
            expect(reading.state, `${name} ${JSON.stringify(source)}`).toBe(
              kept === undefined ? 'blocked' : 'painted'
            );
            if (reading.state === 'painted') expect(reading.url).toBe(kept);
            if (reading.state === 'blocked') {
              expect(reading.developer).toBe(policyFor(role, source, 'developer') !== undefined);
              expect(reading.reason.length).toBeGreaterThan(10);
            }
            checked += 1;
          }
        }
        expect(checked).toBe(SOURCES.length * 3);
      }
      // explains a developer-only source as a tier difference, and a script URL as blocked everywhere
      {
        const http = readUrl(propOf('src'), 'image-src', 'http://images.example.com/cat.png');
        expect(http).toMatchObject({ state: 'blocked', kind: 'http', developer: true });
        if (http.state === 'blocked') expect(http.reason).toContain('developer tier');
        const script = readUrl(propOf('href'), 'href', 'javascript:alert(1)');
        expect(script).toMatchObject({ state: 'blocked', kind: 'script', developer: false });
        if (script.state === 'blocked')
          expect(script.reason).toBe('Script URLs are blocked at every tier.');
      }
      for (const value of [42, null, ['a.png'], { src: 'a.png' }, '<img src=x onerror=alert(1)>']) {
        const reading = readUrl(propOf('src'), 'image-src', value);
        expect(reading.state, JSON.stringify(value)).toBe('refused');
      }
      expect(readUrl(propOf('src'), 'image-src', undefined)).toEqual({
        state: 'unset',
        required: true,
      });
      expect(readUrl(propOf('href'), 'href', undefined)).toEqual({
        state: 'unset',
        required: false,
      });
      // reads alt the way the player's media policy will paint it
      {
        const alt = propOf('alt');
        expect(readAlt(alt, 'A cat on a mat')).toEqual({ state: 'set' });
        expect(readAlt(alt, '')).toEqual({ state: 'replaced' });
        expect(readAlt(alt, '   ')).toEqual({ state: 'replaced' });
        expect(readAlt(alt, '<b>cat</b>').state).toBe('refused');
        expect(readAlt(alt, 3).state).toBe('refused');
        expect(readAlt(alt, undefined)).toEqual({ state: 'unset' });
      }
    });
  });

  describe('blocks-media sources', () => {
    it('reads every source with the block parser: avatar, embedded data, relative, never remote; turns file bytes into a data URI the parser accepts, within its size cap', () => {
      expect(readBlockSource('avatar:av-007', 'image')).toMatchObject({ ok: true, kind: 'avatar' });
      expect(readBlockSource('avatar:av-176', 'image').ok).toBe(false);
      expect(readBlockSource('avatar:av-007', 'video').ok).toBe(false);
      expect(readBlockSource(MEDIA_PRESETS.image.src, 'image')).toMatchObject({
        ok: true,
        kind: 'data',
      });
      expect(readBlockSource('images/cat.png', 'image')).toMatchObject({
        ok: true,
        kind: 'relative',
      });
      expect(readBlockSource('media/tour.mp4', 'video')).toMatchObject({
        ok: true,
        kind: 'relative',
      });
      for (const remote of [
        'https://images.example.com/cat.png',
        'images/cat.svg',
        '../cat.png',
        'javascript:alert(1)',
        'data:image/svg+xml;base64,PHN2Zz4=',
        '',
        7,
      ]) {
        expect(readBlockSource(remote, 'image').ok, String(remote)).toBe(false);
      }
      expect(AVATAR_IDS).toHaveLength(175);
      for (const id of AVATAR_IDS) expect(readBlockSource(`avatar:${id}`, 'image').ok).toBe(true);
      expect(sourceKindsFor('video')).toEqual(['data', 'relative']);
      expect(blockSourceKindOf('avatar:av-001')).toBe('avatar');
      expect(blockSourceKindOf('data:image/png;base64,AAAA')).toBe('data');
      expect(blockSourceKindOf(undefined)).toBe('relative');
      // turns file bytes into a data URI the parser accepts, within its size cap
      {
        const bytes = Uint8Array.from(atob(MEDIA_PRESETS.image.src.split(',')[1] ?? ''), (char) =>
          char.charCodeAt(0)
        );
        const uri = dataUriOf(bytes, 'image/png');
        expect(uri).toBe(MEDIA_PRESETS.image.src);
        expect(readBlockSource(uri, 'image').ok).toBe(true);
        const tooBig = dataUriOf(new Uint8Array(200 * 1024), 'image/png');
        const reading = readBlockSource(tooBig, 'image');
        expect(reading.ok).toBe(false);
        if (!reading.ok) expect(reading.message).toContain('at most 192 KB');
        expect(describeSource(tooBig)).toBe('image/png, about 200 KB');
        expect(describeSource('images/cat.png')).toBe('images/cat.png');
      }
    });
  });

  describe('blocks-media blocks', () => {
    it("starts every type from a preset the parser accepts; keys the parser's first problem to the field it names; lists exactly the fields the parser keeps: a block with every field set round-trips; switches type keeping the image, and drops empty optional fields; keeps a gallery within 1 to 12 items", () => {
      for (const type of MEDIA_TYPES) {
        expect(validateMediaBlock(MEDIA_PRESETS[type]), type).toEqual([]);
      }
      // keys the parser's first problem to the field it names
      {
        const missingAlt = { ...MEDIA_PRESETS.image, alt: undefined };
        expect(validateMediaBlock(missingAlt)).toEqual([
          { field: 'alt', message: 'Describe the image in alt, or mark it decorative: true' },
        ]);
        const remote = { ...MEDIA_PRESETS.image, src: 'https://images.example.com/cat.png' };
        expect(validateMediaBlock(remote)[0]?.field).toBe('src');
        const gallery = editGallery(MEDIA_PRESETS.gallery, {
          action: 'set',
          index: 1,
          item: { src: 'cat.svg', alt: 'x', width: 1, height: 1 },
        });
        expect(validateMediaBlock(gallery)[0]?.field).toBe('items.1.src');
        const video = { ...MEDIA_PRESETS.video, autoplay: true };
        expect(validateMediaBlock(video)[0]?.field).toBe('muted');
        expect(validateMediaBlock('not a block')[0]?.field).toBeDefined();
      }
      // lists exactly the fields the parser keeps: a block with every field set round-trips
      {
        const valid = (field: MediaField): unknown => {
          switch (field.kind) {
            case 'source':
              return field.media === 'image' ? 'images/cat.png' : 'media/tour.mp4';
            case 'plain':
              return 'Fictional text';
            case 'dimension':
              return 320;
            case 'boolean':
              return field.name !== 'decorative';
            case 'fit':
              return 'cover';
            case 'columns':
              return 3;
            case 'items':
              return [
                Object.fromEntries(GALLERY_ITEM_FIELDS.map((item) => [item.name, valid(item)])),
              ];
          }
        };
        for (const type of MEDIA_TYPES) {
          const full: Record<string, unknown> = { type };
          for (const field of MEDIA_FIELDS[type]) full[field.name] = valid(field);
          const result = checkMediaBlock(full);
          expect(result.ok, `${type}: ${JSON.stringify(result.ok ? '' : result.issues)}`).toBe(
            true
          );
          if (result.ok) expect(result.block).toEqual(full);
        }
      }
      // switches type keeping the image, and drops empty optional fields
      {
        const figure = switchMediaType(MEDIA_PRESETS.image, 'figure');
        expect(figure.type).toBe('figure');
        expect(figure.src).toBe(MEDIA_PRESETS.image.src);
        expect(validateMediaBlock(figure)).toEqual([]);
        const gallery = switchMediaType({ ...MEDIA_PRESETS.image, alt: 'Kept' }, 'gallery');
        expect((gallery.items as Record<string, unknown>[])[0]?.alt).toBe('Kept');
        expect(switchMediaType(MEDIA_PRESETS.image, 'video')).toEqual(MEDIA_PRESETS.video);
        const caption = MEDIA_FIELDS.image.find((field) => field.name === 'caption');
        if (!caption) throw new Error('caption field missing');
        expect(setRecordField({ caption: 'x' }, caption, '')).toEqual({});
        expect(editableMediaBlock({ type: 'heading' }).type).toBe('image');
      }
      // keeps a gallery within 1 to 12 items
      {
        let block: MediaBlockValue = MEDIA_PRESETS.gallery;
        for (let index = 0; index < 20; index += 1) block = editGallery(block, { action: 'add' });
        expect((block.items as unknown[]).length).toBe(MAX_GALLERY_ITEMS);
        expect(validateMediaBlock(block)).toEqual([]);
        let one: MediaBlockValue = MEDIA_PRESETS.gallery;
        one = editGallery(one, { action: 'remove', index: 0 });
        one = editGallery(one, { action: 'remove', index: 0 });
        expect((one.items as unknown[]).length).toBe(1);
        const moved = editGallery(MEDIA_PRESETS.gallery, { action: 'move', index: 0, step: 1 });
        expect((moved.items as { alt: string }[]).map((item) => item.alt)).toEqual([
          'A second placeholder',
          'A placeholder image',
        ]);
      }
    });
  });
});

describe('inspector: number', () => {
  /** Every number prop the builder can edit, from the real manifests. */
  const NUMBER_PROPS: { id: string; prop: NumberProp }[] = BUILDER_MANIFESTS.flatMap((manifest) =>
    manifest.props.filter(isNumberProp).map((prop) => ({ id: manifest.id, prop }))
  );

  const HOSTILE: unknown[] = [
    JSON.parse('1e400'),
    JSON.parse('-1e400'),
    Number.NaN,
    '12',
    '',
    ' 3 ',
    '1e3',
    null,
    true,
    false,
    {},
    [],
    [1],
    { value: 1 },
    '<b>1</b>',
    '__proto__',
    'x'.repeat(10_000),
  ];
  const FINITE = [0, -0, 1, -1, 0.5, 1e6, -1e6, Number.MAX_SAFE_INTEGER, Number.MIN_VALUE];

  /** The renderer's rule for `kind: 'number'`, written out independently of it. */
  function oracle(value: unknown): 'unset' | 'set' | 'invalid' {
    if (value === undefined) return 'unset';
    return typeof value === 'number' && Number.isFinite(value) ? 'set' : 'invalid';
  }

  describe('number props in the builder manifests', () => {
    it('covers every number prop the builder edits; reads every value exactly as the renderer will: unset, accepted or refused', () => {
      // PLAN_005 task 5 adds the grid tile's span and rowSpan.
      expect(NUMBER_PROPS.length).toBe(46);
      // reads every value exactly as the renderer will: unset, accepted or refused
      {
        let checked = 0;
        for (const { id, prop } of NUMBER_PROPS) {
          for (const value of [undefined, ...FINITE, ...HOSTILE]) {
            const reading = readNumber(prop, value);
            expect(reading.state, `${id}.${prop.name} = ${showRaw_2(value)}`).toBe(oracle(value));
            const errors = numberIssues(prop, value, chartNumberHints(id, prop.name)).filter(
              (issue) => issue.severity === 'error'
            );
            if (reading.state === 'invalid') expect(errors).toHaveLength(1);
            if (reading.state === 'set') expect(errors).toHaveLength(0);
            if (reading.state === 'unset') expect(errors).toHaveLength(prop.required ? 1 : 0);
            checked += 1;
          }
        }
        expect(checked).toBeGreaterThan(1000);
      }
    });
  });

  describe('schema hints', () => {
    it('reads bounds and defaults from the chart schemas, and only from them; warns, never errors, outside a documented range, around every bound; shows the manifest default first, then the schema default, and never writes either', () => {
      for (const { id, prop } of NUMBER_PROPS) {
        const hints = chartNumberHints(id, prop.name);
        const schema = (
          chartPropSchemas as Record<string, { props: readonly Record<string, unknown>[] }>
        )[id];
        const source = schema?.props.find((candidate) => candidate.name === prop.name);
        if (!source) {
          expect(hints, `${id}.${prop.name}`).toBeUndefined();
          continue;
        }
        const c = (source.constraints ?? {}) as Record<string, number | boolean | undefined>;
        expect(hints?.default).toBe(
          typeof source.default === 'number' ? source.default : undefined
        );
        expect(hints?.bounds?.min).toBe(c.exclusiveMinimum ?? c.minimum);
        expect(hints?.bounds?.exclusive).toBe(c.exclusiveMinimum !== undefined ? true : undefined);
        expect(hints?.bounds?.max).toBe(c.maximum);
      }
      expect(chartNumberHints('media-image', 'width')).toBeUndefined();
      expect(chartNumberHints('charts-canvas-renderer', 'width')).toBeUndefined();
      expect(chartNumberHints('charts-gauge', 'not-a-prop')).toBeUndefined();
      // warns, never errors, outside a documented range, around every bound
      {
        let bounded = 0;
        for (const { id, prop } of NUMBER_PROPS) {
          const hints = chartNumberHints(id, prop.name);
          const bounds = hints?.bounds;
          if (!bounds || bounds.min === undefined) continue;
          bounded += 1;
          for (const value of [bounds.min - 1, bounds.min, bounds.min + 0.001, bounds.min + 1000]) {
            const inside = bounds.exclusive ? value > bounds.min : value >= bounds.min;
            const issues = numberIssues(prop, value, hints);
            expect(
              issues.some((issue) => issue.severity === 'error'),
              `${id}.${prop.name}=${value}`
            ).toBe(false);
            expect(
              issues.some((issue) => issue.severity === 'warning'),
              `${id}.${prop.name}=${value}`
            ).toBe(!inside);
          }
        }
        expect(bounded).toBe(29);
      }
      // shows the manifest default first, then the schema default, and never writes either
      {
        const columns = NUMBER_PROPS.find(
          (entry) => entry.id === 'layout-grid' && entry.prop.name === 'columns'
        );
        const size = NUMBER_PROPS.find(
          (entry) => entry.id === 'charts-gauge' && entry.prop.name === 'size'
        );
        const width = NUMBER_PROPS.find(
          (entry) => entry.id === 'media-image' && entry.prop.name === 'width'
        );
        if (!columns || !size || !width) throw new Error('fixture props missing');
        expect(shownDefault(columns.prop, chartNumberHints(columns.id, 'columns'))).toBe(2);
        expect(shownDefault(size.prop, chartNumberHints(size.id, 'size'))).toBe(144);
        expect(shownDefault(width.prop, chartNumberHints(width.id, 'width'))).toBeUndefined();
      }
    });
  });

  describe('controls and input', () => {
    it('uses number inputs today: no builder prop documents both ends of a range; switches to a slider only for a two-sided inclusive range; stores only finite numbers typed into the box; describes ranges in plain words and checks them; shows refused values as short JSON text', () => {
      // uses number inputs today: no builder prop documents both ends of a range
      {
        const sliders = NUMBER_PROPS.filter(
          ({ id, prop }) => numberControl(chartNumberHints(id, prop.name)) === 'slider'
        );
        expect(sliders).toEqual([]);
      }
      // switches to a slider only for a two-sided inclusive range
      {
        const ratio: NumberBounds = { min: 0, max: 0.85 };
        expect(numberControl({ bounds: ratio, source: 'test' })).toBe('slider');
        expect(sliderStep(ratio)).toBeCloseTo(0.0085);
        expect(sliderStep({ min: 0, max: 6, integer: true })).toBe(1);
        expect(numberControl({ bounds: { min: 0, exclusive: true, max: 1 }, source: 'test' })).toBe(
          'input'
        );
        expect(numberControl({ bounds: { min: 0 }, source: 'test' })).toBe('input');
        expect(numberControl(undefined)).toBe('input');
      }
      // stores only finite numbers typed into the box
      {
        const optional = { name: 'size', kind: 'number' } as NumberProp;
        const required = { name: 'value', kind: 'number', required: true } as NumberProp;
        expect(parseNumberInput(optional, '')).toEqual({ ok: true, value: undefined });
        expect(parseNumberInput(required, '  ')).toEqual({
          ok: false,
          message: 'Required: enter a number.',
        });
        expect(parseNumberInput(optional, ' 12 ')).toEqual({ ok: true, value: 12 });
        expect(parseNumberInput(optional, '-0.5')).toEqual({ ok: true, value: -0.5 });
        expect(parseNumberInput(optional, '1e3')).toEqual({ ok: true, value: 1000 });
        for (const bad of ['abc', 'Infinity', '-Infinity', '1e400', 'NaN', '1,5', '0x']) {
          expect(parseNumberInput(optional, bad), bad).toEqual({
            ok: false,
            message: 'Enter a finite number.',
          });
        }
      }
      expect(describeBounds({ min: 0, exclusive: true })).toBe('greater than 0');
      expect(describeBounds({ min: 0 })).toBe('at least 0');
      expect(describeBounds({ min: 0, max: 0.85 })).toBe('0 to 0.85');
      expect(describeBounds({ min: 0, max: 6, integer: true })).toBe('0 to 6, a whole number');
      expect(describeBounds({})).toBeUndefined();
      expect(withinBounds(0, { min: 0, exclusive: true })).toBe(false);
      expect(withinBounds(0, { min: 0 })).toBe(true);
      expect(withinBounds(2.5, { min: 0, max: 6, integer: true })).toBe(false);
      expect(withinBounds(7, { min: 0, max: 6 })).toBe(false);
      expect(showRaw_2('12')).toBe('"12"');
      expect(showRaw_2(Number.POSITIVE_INFINITY)).toBe('null');
      expect([...showRaw_2('x'.repeat(10_000))].length).toBe(61);
    });
  });

  describe('painting-code hints (PLAN_005 task 5)', () => {
    const at = (id: string, name: string) => {
      const entry = NUMBER_PROPS.find(
        (candidate) => candidate.id === id && candidate.prop.name === name
      );
      if (!entry) throw new Error(`${id}.${name} missing`);
      return entry.prop;
    };

    it('gives every builder number prop a documented range except the canvas renderer size; matches the clamps in the painting code; turns two-sided ranges into sliders and warns outside them', () => {
      // gives every builder number prop a documented range except the canvas renderer size
      {
        const bare = NUMBER_PROPS.filter(({ id, prop }) => !numberHints(id, prop.name)).map(
          ({ id, prop }) => `${id}.${prop.name}`
        );
        // CanvasRenderer passes width and height straight to the canvas element: no rule to show.
        expect(bare).toEqual(['charts-canvas-renderer.width', 'charts-canvas-renderer.height']);
        // The chart schema wins wherever it has an entry.
        for (const { id, prop } of NUMBER_PROPS) {
          const chart = chartNumberHints(id, prop.name);
          if (chart) expect(numberHints(id, prop.name)).toEqual(chart);
        }
      }
      expect(paintNumberHints('layout-grid', 'columns')?.bounds).toEqual({
        min: 1,
        max: 4,
        integer: true,
      });
      expect(paintNumberHints('layout-tile', 'span')?.bounds).toEqual({
        min: 1,
        max: 4,
        integer: true,
      });
      expect(paintNumberHints('layout-tile', 'rowSpan')?.bounds).toEqual({
        min: 1,
        max: 2,
        integer: true,
      });
      expect(paintNumberHints('blocks-map', 'headingLevel')?.bounds).toEqual({
        min: 1,
        max: 6,
        integer: true,
      });
      // The image limit is the media package's own constant, and intrinsicSize enforces it.
      expect(paintNumberHints('media-image', 'width')?.bounds?.max).toBe(IMAGE_LIMITS.dimension);
      expect(intrinsicSize(IMAGE_LIMITS.dimension, 10)).toBeDefined();
      expect(intrinsicSize(IMAGE_LIMITS.dimension + 1, 10)).toBeUndefined();
      expect(intrinsicSize(0, 10)).toBeUndefined();
      // The canvas caps its ratio at 4 and falls back to 1 at 0 or below.
      expect(paintNumberHints('media-composition-canvas', 'pixelRatio')?.bounds).toEqual({
        min: 0,
        exclusive: true,
        max: 4,
      });
      expect(canvasBackingSize(100, 100, 8)).toEqual(canvasBackingSize(100, 100, 4));
      expect(canvasBackingSize(100, 100, 0)).toEqual(canvasBackingSize(100, 100, 1));
      // Code steps count from 0: a negative step reads as the first one.
      expect(activeHighlightIndex(3, -2)).toBe(0);
      expect(paintNumberHints('blocks-code', 'step')?.bounds).toEqual({ min: 0, integer: true });
      // turns two-sided ranges into sliders and warns outside them
      {
        const columns = at('layout-grid', 'columns');
        const hints = numberHints('layout-grid', 'columns');
        expect(numberControl(hints)).toBe('slider');
        expect(numberIssues(columns, 3, hints)).toEqual([]);
        expect(numberIssues(columns, 6, hints)).toEqual([
          {
            severity: 'warning',
            message:
              'Outside the documented range (1 to 4, a whole number); it may not paint as intended.',
          },
        ]);
        expect(numberControl(numberHints('media-composition-canvas', 'pixelRatio'))).toBe('input');
        expect(
          shownDefault(at('layout-tile', 'rowSpan'), numberHints('layout-tile', 'rowSpan'))
        ).toBe(1);
      }
    });
  });
});

describe('inspector: rich text', () => {
  const MAX = BLOCK_CONTENT_LIMITS.markdown;

  describe('builder rich text interchange', () => {
    it('round-trips the inline Markdown text blocks store; keeps a refused link as text and says so; caps the source at the field limit with a note; treats raw HTML as literal text, never markup; writes Markdown the text block parser accepts', () => {
      for (const markdown of [
        'Fictional **launch** notes.',
        'Keep *this* and ~~that~~ with `code`.',
        'Read the [plan](https://example.com/plan).',
      ]) {
        const field = readRichText(markdown, MAX);
        expect(field.notes).toEqual([]);
        expect(writeRichText(field.doc)).toBe(markdown);
      }
      // keeps a refused link as text and says so
      {
        const field = readRichText('Read [this](javascript:alert(1)) first.', MAX);
        expect(writeRichText(field.doc)).toBe('Read this first.');
        expect(field.notes).toHaveLength(1);
        expect(field.notes[0]).toMatch(/refused by the URL policy/);
      }
      // caps the source at the field limit with a note
      {
        const field = readRichText('a'.repeat(30), 10);
        expect(writeRichText(field.doc)).toBe('a'.repeat(10));
        expect(field.notes).toEqual(['Text past the field limit was left out of the editor.']);
      }
      // treats raw HTML as literal text, never markup
      {
        const field = readRichText('<img src=x onerror=alert(1)> hello', MAX);
        const saved = writeRichText(field.doc);
        expect(field.doc.blocks).toHaveLength(1);
        expect(field.doc.blocks[0]?.type).toBe('paragraph');
        expect(saved).toContain('hello');
      }
      // writes Markdown the text block parser accepts
      {
        const { doc } = readRichText('Fictional **launch** notes.', MAX);
        const markdown = writeRichText(doc);
        expect(validateTextBlock({ type: 'text', markdown })).toEqual([]);
      }
    });
  });
});

describe('inspector: text', () => {
  // validateTextBlock runs the text family parser (`safeParseBlock`) itself.
  const parses = (block: TextBlockValue) => validateTextBlock(block).length === 0;
  const chars = (count: number, char = 'a') => char.repeat(count);
  const fieldsOf = (issues: ReturnType<typeof validateTextBlock>) =>
    issues.map((issue) => issue.field);

  describe('text inspector fields mirror the text family parser', () => {
    it('starts every type from a preset the parser accepts; accepts every text field at its limit and refuses one character more, on that field; keeps plain fields single-line and markdown fields multi-line; removes empty optional fields and flags empty required ones; accepts heading levels 1 to 4 only; accepts every block tone, and no tone at all; treats an unchecked numbered-list box as no field; ignores fields the type does not have', () => {
      for (const type of TEXT_TYPES) {
        expect(parses(TEXT_PRESETS[type]), type).toBe(true);
        expect(validateTextBlock(TEXT_PRESETS[type])).toEqual([]);
      }
      // accepts every text field at its limit and refuses one character more, on that field
      {
        let checked = 0;
        for (const type of TEXT_TYPES) {
          for (const field of TEXT_FIELDS[type]) {
            if (field.kind !== 'plain' && field.kind !== 'markdown') continue;
            const atLimit = setField(TEXT_PRESETS[type], field.name, chars(field.max));
            expect(validateTextBlock(atLimit), `${type}.${field.name} at limit`).toEqual([]);
            const over = { ...TEXT_PRESETS[type], [field.name]: chars(field.max + 1) };
            expect(fieldsOf(validateTextBlock(over)), `${type}.${field.name} over`).toContain(
              field.name
            );
            expect(remaining(chars(field.max), field.max)).toBe(0);
            checked += 1;
          }
        }
        expect(checked).toBe(8);
      }
      for (const type of TEXT_TYPES) {
        for (const field of TEXT_FIELDS[type]) {
          if (field.kind !== 'plain' && field.kind !== 'markdown') continue;
          const twoLines = { ...TEXT_PRESETS[type], [field.name]: 'first line\nsecond line' };
          const issues = fieldsOf(validateTextBlock(twoLines));
          if (field.kind === 'plain') expect(issues, `${type}.${field.name}`).toContain(field.name);
          else expect(issues, `${type}.${field.name}`).toEqual([]);
        }
      }
      for (const type of TEXT_TYPES) {
        for (const field of TEXT_FIELDS[type]) {
          if (field.kind !== 'plain' && field.kind !== 'markdown') continue;
          const cleared = setField({ ...TEXT_PRESETS[type], [field.name]: 'x' }, field.name, '');
          if (field.required) {
            expect(fieldsOf(validateTextBlock(cleared)), `${type}.${field.name}`).toContain(
              field.name
            );
          } else {
            expect(field.name in cleared, `${type}.${field.name}`).toBe(false);
            expect(validateTextBlock(cleared)).toEqual([]);
          }
        }
      }
      for (const level of [1, 2, 3, 4]) {
        expect(validateTextBlock(setField(TEXT_PRESETS.heading, 'level', level))).toEqual([]);
      }
      for (const level of [0, 5, 2.5]) {
        expect(fieldsOf(validateTextBlock({ ...TEXT_PRESETS.heading, level }))).toContain('level');
      }
      for (const type of TEXT_TYPES) {
        for (const tone of TONES) {
          expect(
            validateTextBlock(setField(TEXT_PRESETS[type], 'tone', tone)),
            `${type} ${tone}`
          ).toEqual([]);
        }
        expect('tone' in setField({ ...TEXT_PRESETS[type], tone: 'info' }, 'tone', '')).toBe(false);
        expect(fieldsOf(validateTextBlock({ ...TEXT_PRESETS[type], tone: 'loud' }))).toContain(
          'tone'
        );
      }
      // treats an unchecked numbered-list box as no field
      {
        const on = setField(TEXT_PRESETS.list, 'ordered', true);
        expect(on.ordered).toBe(true);
        expect(validateTextBlock(on)).toEqual([]);
        expect('ordered' in setField(on, 'ordered', false)).toBe(false);
      }
      // ignores fields the type does not have
      {
        const block = setField(TEXT_PRESETS.text, 'level', 3);
        expect(block).toBe(TEXT_PRESETS.text);
      }
    });
  });

  describe('list items', () => {
    const list = (count: number): TextBlockValue => ({
      type: 'list',
      items: Array.from({ length: count }, (_, index) => ({ text: `Item ${index + 1}` })),
    });

    it('parses 1 to listItems items and refuses 0 or one more; reports an over-long item on that item; keeps every add, remove and move inside 1..listItems and refuses the rest', () => {
      for (let count = 1; count <= BLOCK_CONTENT_LIMITS.listItems; count += 1) {
        expect(validateTextBlock(list(count)), `${count}`).toEqual([]);
      }
      expect(fieldsOf(validateTextBlock(list(0)))).toContain('items');
      expect(fieldsOf(validateTextBlock(list(BLOCK_CONTENT_LIMITS.listItems + 1)))).toContain(
        'items'
      );
      // reports an over-long item on that item
      {
        const block = editItems(list(3), {
          action: 'set',
          index: 1,
          text: chars(BLOCK_CONTENT_LIMITS.shortMarkdown + 1),
        });
        expect(fieldsOf(validateTextBlock(block))).toEqual(['items.1']);
      }
      // keeps every add, remove and move inside 1..listItems and refuses the rest
      {
        let block = list(1);
        for (let count = 2; count <= BLOCK_CONTENT_LIMITS.listItems; count += 1) {
          block = editItems(block, { action: 'add', after: count - 2 });
          expect(itemTexts(block)).toHaveLength(count);
        }
        expect(editItems(block, { action: 'add', after: 0 })).toBe(block);
        for (let count = BLOCK_CONTENT_LIMITS.listItems - 1; count >= 1; count -= 1) {
          block = editItems(block, { action: 'remove', index: 0 });
          expect(itemTexts(block)).toHaveLength(count);
        }
        expect(editItems(block, { action: 'remove', index: 0 })).toBe(block);

        const three = list(3);
        expect(itemTexts(editItems(three, { action: 'move', index: 0, step: 1 }))).toEqual([
          'Item 2',
          'Item 1',
          'Item 3',
        ]);
        expect(itemTexts(editItems(three, { action: 'move', index: 2, step: -1 }))).toEqual([
          'Item 1',
          'Item 3',
          'Item 2',
        ]);
        expect(editItems(three, { action: 'move', index: 0, step: -1 })).toBe(three);
        expect(editItems(three, { action: 'move', index: 2, step: 1 })).toBe(three);
        expect(editItems(three, { action: 'set', index: 7, text: 'x' })).toBe(three);
        // A new item is inserted after the given one, and starts empty.
        expect(itemTexts(editItems(three, { action: 'add', after: 0 }))).toEqual([
          'Item 1',
          '',
          'Item 2',
          'Item 3',
        ]);
      }
    });
  });

  describe('switching block types', () => {
    const samples: TextBlockValue[] = [
      ...TEXT_TYPES.map((type) => TEXT_PRESETS[type]),
      { type: 'text', markdown: 'Line one\nLine two\n\nLine three', tone: 'warning' },
      { type: 'heading', level: 3, text: 'Only heading', tone: 'info' },
      { type: 'list', items: Array.from({ length: 12 }, (_, i) => ({ text: `Point ${i}` })) },
      { type: 'text', markdown: chars(BLOCK_CONTENT_LIMITS.markdown) },
      { type: 'callout', body: 'x', title: 'Kept title is not carried' },
      { type: 'quote', quote: '   ' },
    ];

    it('always yields a block the parser accepts, keeping the tone, from and to every type; carries the main text: first line into a heading, one item per line into a list; edits other block shapes as a fresh text block', () => {
      // always yields a block the parser accepts, keeping the tone, from and to every type
      {
        let pairs = 0;
        for (const sample of samples) {
          for (const type of TEXT_TYPES) {
            const next = switchType(sample, type);
            expect(next.type).toBe(type);
            expect(validateTextBlock(next), `${sample.type} → ${type}`).toEqual([]);
            if (sample.type !== type) expect(next.tone).toBe(sample.tone);
            pairs += 1;
          }
        }
        expect(pairs).toBe(samples.length * TEXT_TYPES.length);
      }
      // carries the main text: first line into a heading, one item per line into a list
      {
        const text: TextBlockValue = { type: 'text', markdown: 'Alpha\nBeta\nGamma' };
        expect(switchType(text, 'heading').text).toBe('Alpha');
        expect(itemTexts(switchType(text, 'list'))).toEqual(['Alpha', 'Beta', 'Gamma']);
        expect(switchType(text, 'quote').quote).toBe('Alpha\nBeta\nGamma');
        expect(primaryText(switchType(switchType(text, 'list'), 'callout'))).toBe(
          'Alpha\nBeta\nGamma'
        );
        expect(switchType(text, 'text')).toBe(text);
      }
      expect(editableBlock({ type: 'table', columns: [] })).toEqual(TEXT_PRESETS.text);
      expect(editableBlock(null)).toEqual(TEXT_PRESETS.text);
      expect(editableBlock(TEXT_PRESETS.quote)).toEqual(TEXT_PRESETS.quote);
    });
  });

  describe('link verdicts', () => {
    it('reports each link with the URL-policy verdict the paint applies; finds no links in plain prose or code', () => {
      // reports each link with the URL-policy verdict the paint applies
      {
        const markdown = [
          'See [the guide](https://example.com/guide) and [notes](/notes).',
          'Never [this](javascript:alert(1)) or [that](data:text/html,x).',
          '- A [listed link](https://example.com/list)',
          '> A [quoted link](mailto:team@example.com)',
          'Auto <https://example.com/auto>.',
        ].join('\n\n');
        expect(linkVerdicts(markdown)).toEqual([
          { text: 'the guide', href: 'https://example.com/guide', kept: true },
          // The untrusted tier refuses relative links too; the widget surfaces that before paint.
          { text: 'notes', href: undefined, kept: false },
          { text: 'this', href: undefined, kept: false },
          { text: 'that', href: undefined, kept: false },
          { text: 'listed link', href: 'https://example.com/list', kept: true },
          { text: 'quoted link', href: 'mailto:team@example.com', kept: true },
          { text: 'https://example.com/auto', href: 'https://example.com/auto', kept: true },
        ]);
      }
      expect(linkVerdicts('Just words, and `[not](https://example.com)` code.')).toEqual([]);
    });
  });

  /** Every text prop the inspector edits as a text box, from the real manifests. */
  const STRING_PROPS: { id: string; prop: StringProp }[] = BUILDER_MANIFESTS.flatMap((manifest) =>
    inspectorFields(manifest.props)
      .filter((prop) => fieldFamily(manifest.id, prop) === 'string')
      .filter(isStringProp)
      .map((prop) => ({ id: manifest.id, prop }))
  );
  const propOf = (id: string, name: string): StringProp => {
    const entry = STRING_PROPS.find(
      (candidate) => candidate.id === id && candidate.prop.name === name
    );
    if (!entry) throw new Error(`${id}.${name} missing`);
    return entry.prop;
  };

  describe('text box props (PLAN_005 task 5)', () => {
    it('reads every value as the renderer will: text is kept, anything else is refused; flags a missing required text, and an empty box clears the prop; checks the grid gap against the player’s own length rule; checks a host region name with the player’s rule, and a map locale with Intl; applies the chart schemas’ non-empty rule to chart titles and nothing invented elsewhere', () => {
      expect(STRING_PROPS.length).toBeGreaterThan(50);
      // The renderer forbids className like class, so the inspector never offers it.
      expect(STRING_PROPS.some(({ prop }) => prop.name === 'className')).toBe(false);
      for (const { id, prop } of STRING_PROPS) {
        expect(readString(prop, undefined).state, `${id}.${prop.name}`).toBe('unset');
        expect(readString(prop, 'Harbor notes').state, `${id}.${prop.name}`).toBe('set');
        for (const hostile of [1, true, null, {}, ['a']]) {
          const issues = stringIssues(prop, hostile);
          expect(issues, `${id}.${prop.name}`).toHaveLength(1);
          expect(issues[0]?.severity).toBe('error');
          expect(issues[0]?.message).toContain('refused at paint');
        }
      }
      expect(stringIssues(propOf('host-region', 'label'), undefined)).toEqual([
        { severity: 'error', message: 'Required: enter text.' },
      ]);
      expect(stringIssues(propOf('layout-page', 'title'), undefined)).toEqual([]);
      expect(stringInput('')).toBeUndefined();
      expect(stringInput(' a ')).toBe(' a ');
      // checks the grid gap against the player’s own length rule
      {
        const rule = stringRule('layout-grid', 'gap');
        expect(rule?.source).toBe('player grid layout');
        const gap = propOf('layout-grid', 'gap');
        for (const ok of ['0', '1rem', '0.5em', '1.25rem', '12px', '999px']) {
          expect(stringIssues(gap, ok, rule), ok).toEqual([]);
        }
        for (const ignored of [
          '1 rem',
          '100rem',
          '1000px',
          'calc(1rem)',
          '1rem; color: red',
          'red',
        ]) {
          expect(stringIssues(gap, ignored, rule)[0]?.severity, ignored).toBe('warning');
        }
        expect(GRID_GAP.test('2.5rem')).toBe(true);
      }
      // checks a host region name with the player’s rule, and a map locale with Intl
      {
        expect(REGION_NAME).toBe(HOST_REGION_NAME);
        const name = propOf('host-region', 'name');
        const region = stringRule('host-region', 'name');
        expect(stringIssues(name, 'payment', region)).toEqual([]);
        expect(stringIssues(name, 'Payment', region)[0]?.message).toContain(
          'No host can claim this name'
        );
        const locale = propOf('blocks-map', 'locale');
        const localeRule = stringRule('blocks-map', 'locale');
        expect(stringIssues(locale, 'pt-BR', localeRule)).toEqual([]);
        expect(stringIssues(locale, 'not a tag', localeRule)[0]).toMatchObject({
          severity: 'error',
        });
        expect(isLocaleTag('en-GB')).toBe(true);
        expect(isLocaleTag('')).toBe(false);
      }
      // applies the chart schemas’ non-empty rule to chart titles and nothing invented elsewhere
      {
        const title = propOf('charts-line', 'title');
        const rule = stringRule('charts-line', 'title');
        expect(rule?.source).toBe('LineChart chart schema');
        expect(stringIssues(title, '   ', rule)[0]?.severity).toBe('error');
        expect(stringIssues(title, 'Weekly activity', rule)).toEqual([]);
        // Props with no published rule get the renderer's verdict only.
        expect(stringRule('layout-page', 'title')).toBeUndefined();
        expect(stringRule('charts-sparkline', 'period')).toBeUndefined();
      }
    });
  });
});

describe('outline', () => {
  const CONTAINERS = new Set(['layout-page', 'layout-card', 'layout-grid']);
  const canContain = (id: string) => CONTAINERS.has(id);
  // Unique fictional text per node, so a moved node can be found after the move.
  const text = (markdown: string): CatalogTreeInput => ({
    id: 'blocks-text',
    props: { block: { type: 'text', markdown } },
  });
  const card = (title: string, children: CatalogTreeInput[]): CatalogTreeInput => ({
    id: 'layout-card',
    props: { title },
    children,
  });
  const TREE: CatalogTreeInput = {
    id: 'layout-page',
    props: { title: 'Fictional report' },
    children: [
      card('Alpha', [text('one'), text('two')]),
      { id: 'layout-grid', props: { columns: 2 }, children: [card('Beta', [text('three')])] },
      text('four'),
    ],
  };

  function applied(result: MoveResult): CatalogTreeInput {
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    const next = applyEditOp(TREE, result.op);
    expect(next.ok).toBe(true);
    if (!next.ok) throw new Error(next.error.message);
    return next.tree;
  }

  const markdownOf = (node: CatalogTreeInput | undefined) =>
    (node?.props?.block as { markdown?: string } | undefined)?.markdown;

  describe('outline rows', () => {
    it('lists every node in reading order with tree semantics; reads child support from the manifest children slot', () => {
      // lists every node in reading order with tree semantics
      {
        const rows = outlineRows(TREE, (id) => id, canContain);
        expect(rows.map((row) => row.key)).toEqual([
          '',
          '0',
          '0.0',
          '0.1',
          '1',
          '1.0',
          '1.0.0',
          '2',
        ]);
        const two = rows.find((row) => row.key === '0.1');
        expect(two).toMatchObject({
          level: 3,
          position: 2,
          siblings: 2,
          childCount: 0,
          canContain: false,
        });
        expect(rows[0]).toMatchObject({
          level: 1,
          position: 1,
          siblings: 1,
          childCount: 3,
          canContain: true,
        });
      }
      for (const manifest of [pageLayoutManifest, cardLayoutManifest, gridLayoutManifest]) {
        expect(manifestCanContain(manifest)).toBe(true);
      }
      for (const manifest of CONTENT_MANIFESTS) expect(manifestCanContain(manifest)).toBe(false);
    });
  });

  describe('keyboard moves (Alt+Arrow)', () => {
    it('moves up and down among siblings; indents into the previous sibling, as its last child; outdents to just after its parent; refuses moves that cannot happen, with a reason', () => {
      // moves up and down among siblings
      {
        const down = applied(keyboardMove(TREE, [0, 0], 'down', canContain));
        expect(markdownOf(nodeAt(down, [0, 1]))).toBe('one');
        const up = applied(keyboardMove(TREE, [0, 1], 'up', canContain));
        expect(markdownOf(nodeAt(up, [0, 0]))).toBe('two');
      }
      // indents into the previous sibling, as its last child
      {
        const next = applied(keyboardMove(TREE, [2], 'indent', canContain));
        // "four" follows the grid, so it becomes the grid's last child.
        expect(markdownOf(nodeAt(next, [1, 1]))).toBe('four');
        expect(next.children).toHaveLength(2);
      }
      // outdents to just after its parent
      {
        const next = applied(keyboardMove(TREE, [0, 1], 'outdent', canContain));
        expect(markdownOf(nodeAt(next, [1]))).toBe('two');
        expect(nodeAt(next, [0])?.children).toHaveLength(1);
      }
      expect(keyboardMove(TREE, [], 'down', canContain)).toEqual({ ok: false, reason: 'root' });
      expect(keyboardMove(TREE, [0, 0], 'up', canContain)).toEqual({ ok: false, reason: 'first' });
      expect(keyboardMove(TREE, [2], 'down', canContain)).toEqual({ ok: false, reason: 'last' });
      expect(keyboardMove(TREE, [0, 1], 'indent', canContain)).toEqual({
        ok: false,
        reason: 'no-container',
      });
      expect(keyboardMove(TREE, [1], 'outdent', canContain)).toEqual({
        ok: false,
        reason: 'top-level',
      });
    });
  });

  describe('drag drops', () => {
    it('places every accepted drop exactly before, after or inside its target; refuses drops into itself, into leaves, onto the root edge and in place; readdresses the target after removal and picks the drop zone from the pointer', () => {
      // places every accepted drop exactly before, after or inside its target
      {
        const rows = outlineRows(TREE, (id) => id, canContain);
        let accepted = 0;
        for (const from of rows) {
          for (const target of rows) {
            for (const position of ['before', 'after', 'inside'] as DropPosition[]) {
              const result = dropMove(TREE, from.path, target.path, position, canContain);
              if (!result.ok) continue;
              accepted += 1;
              const next = applyEditOp(TREE, result.op);
              expect(next.ok, JSON.stringify(result.op)).toBe(true);
              if (!next.ok) continue;
              const destination = [...result.op.parent, result.op.index];
              // The moved subtree arrives unchanged.
              expect(nodeAt(next.tree, destination)).toEqual(nodeAt(TREE, from.path));
              const parent = nodeAt(next.tree, result.op.parent);
              const targetNode = nodeAt(TREE, target.path);
              if (position === 'inside') {
                expect(parent?.id).toBe(targetNode?.id);
                expect(parent?.props).toEqual(targetNode?.props);
                expect(result.op.index).toBe((parent?.children?.length ?? 0) - 1);
              } else {
                const neighbor =
                  parent?.children?.[result.op.index + (position === 'before' ? 1 : -1)];
                expect(neighbor?.id).toBe(targetNode?.id);
                expect(neighbor?.props).toEqual(targetNode?.props);
              }
            }
          }
        }
        expect(accepted).toBeGreaterThan(20);
      }
      expect(dropMove(TREE, [1], [1, 0], 'inside', canContain)).toEqual({
        ok: false,
        reason: 'into-itself',
      });
      expect(dropMove(TREE, [0, 0], [2], 'inside', canContain)).toEqual({
        ok: false,
        reason: 'no-container',
      });
      expect(dropMove(TREE, [2], [], 'before', canContain)).toEqual({ ok: false, reason: 'root' });
      expect(dropMove(TREE, [0, 0], [0, 1], 'before', canContain)).toEqual({
        ok: false,
        reason: 'same-place',
      });
      expect(pathAfterRemoval([0], [2])).toEqual([1]);
      expect(pathAfterRemoval([0, 0], [0, 1])).toEqual([0, 0]);
      expect(pathAfterRemoval([2], [0, 1])).toEqual([0, 1]);
      expect(pathAfterRemoval([1], [1, 0])).toBeNull();
      expect(dropPosition(2, 40, true)).toBe('before');
      expect(dropPosition(20, 40, true)).toBe('inside');
      expect(dropPosition(38, 40, true)).toBe('after');
      expect(dropPosition(19, 40, false)).toBe('before');
      expect(dropPosition(21, 40, false)).toBe('after');
    });
  });

  describe('builder history', () => {
    it('applies an outline move as one undoable edit', () => {
      const history = createBuilderHistory();
      expect(history.apply({ op: 'replaceAll', tree: TREE }).ok).toBe(true);
      const move = keyboardMove(history.tree, [0, 0], 'down', canContain);
      expect(move.ok).toBe(true);
      if (!move.ok) return;
      expect(history.apply(move.op).ok).toBe(true);
      expect(markdownOf(nodeAt(history.tree, [0, 1]))).toBe('one');
      expect(history.undo()).toBe(true);
      expect(history.tree).toEqual(TREE);
    });
  });

  describe('structure guard', () => {
    it('refuses a change that adds structural errors and allows one that removes them', () => {
      const nested: CatalogTreeInput = {
        id: 'layout-page',
        props: { title: 'Fictional' },
        children: [{ id: 'layout-doc', props: { title: 'Nested' }, children: [] }],
      };
      const clean: CatalogTreeInput = {
        id: 'layout-page',
        props: { title: 'Fictional' },
        children: [],
      };
      expect(structuralErrors(clean)).toBe(0);
      expect(structuralErrors(nested)).toBeGreaterThan(0);
      expect(moveKeepsStructure(clean, nested)).toBe(false);
      expect(moveKeepsStructure(nested, clean)).toBe(true);
      expect(moveKeepsStructure(TREE, TREE)).toBe(true);
    });
  });

  function appliedGroup<Op extends EditOp>(result: GroupResult<Op>, tree = TREE): CatalogTreeInput {
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    const next = applyEditOps(tree, result.ops);
    expect(next.ok).toBe(true);
    if (!next.ok) throw new Error(next.error.message);
    return next.tree;
  }

  /** Reading-order markdown of every text node: the order a group op must keep. */
  const texts = (tree: CatalogTreeInput): string[] => {
    const out: string[] = [];
    const visit = (node: CatalogTreeInput) => {
      const markdown = markdownOf(node);
      if (markdown) out.push(markdown);
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
    return out;
  };

  describe('multi-select', () => {
    it('toggles one row and selects the range from the anchor in reading order; acts on group roots: unique, in reading order, never the root or a carried descendant', () => {
      // toggles one row and selects the range from the anchor in reading order
      {
        expect(toggleKey(['0'], '2')).toEqual(['0', '2']);
        expect(toggleKey(['0', '2'], '0')).toEqual(['2']);
        const keys = outlineRows(TREE, (id) => id, canContain).map((row) => row.key);
        expect(rangeKeys(keys, '0.1', '1.0')).toEqual(['0.1', '1', '1.0']);
        expect(rangeKeys(keys, '1.0', '0.1')).toEqual(['0.1', '1', '1.0']);
        expect(rangeKeys(keys, 'gone', '2')).toEqual(['2']);
      }
      expect(groupRoots([[2], [0, 1], [], [0], [0, 1], [1, 0, 0]])).toEqual([[0], [1, 0, 0], [2]]);
    });
  });

  describe('group moves', () => {
    it('moves a selection up and down together, keeping its order, and reports where it lands; indents and outdents a group without reversing it; is all or nothing: one row that cannot move refuses the whole group', () => {
      // moves a selection up and down together, keeping its order, and reports where it lands
      {
        const tree: CatalogTreeInput = {
          id: 'layout-page',
          children: [text('a'), text('b'), text('c'), text('d')],
        };
        const down = groupKeyboardMove(tree, [[1], [2]], 'down', canContain);
        expect(down.ok && down.paths).toEqual([[2], [3]]);
        expect(texts(appliedGroup(down, tree))).toEqual(['a', 'd', 'b', 'c']);
        const up = groupKeyboardMove(tree, [[2], [1]], 'up', canContain);
        expect(texts(appliedGroup(up, tree))).toEqual(['b', 'c', 'a', 'd']);
        // Non-adjacent rows each take one step.
        const spread = groupKeyboardMove(tree, [[1], [3]], 'up', canContain);
        expect(texts(appliedGroup(spread, tree))).toEqual(['b', 'a', 'd', 'c']);
      }
      // indents and outdents a group without reversing it
      {
        const tree: CatalogTreeInput = {
          id: 'layout-page',
          children: [card('Box', []), text('a'), text('b')],
        };
        const indent = groupKeyboardMove(tree, [[1], [2]], 'indent', canContain);
        const indented = appliedGroup(indent, tree);
        expect(indent.ok && indent.paths).toEqual([
          [0, 0],
          [0, 1],
        ]);
        expect(texts(nodeAt(indented, [0]) as CatalogTreeInput)).toEqual(['a', 'b']);
        const outdent = groupKeyboardMove(
          indented,
          [
            [0, 0],
            [0, 1],
          ],
          'outdent',
          canContain
        );
        expect(appliedGroup(outdent, indented)).toEqual(tree);
      }
      expect(groupKeyboardMove(TREE, [[0, 0], [2]], 'up', canContain)).toEqual({
        ok: false,
        reason: 'first',
      });
      expect(groupKeyboardMove(TREE, [[0, 1], [2]], 'down', canContain)).toEqual({
        ok: false,
        reason: 'last',
      });
      expect(groupKeyboardMove(TREE, [[]], 'down', canContain)).toEqual({
        ok: false,
        reason: 'root',
      });
      expect(groupKeyboardMove(TREE, [[9]], 'down', canContain)).toEqual({
        ok: false,
        reason: 'missing',
      });
    });
  });

  describe('group drag drops', () => {
    it('drops a selection together before, after or inside a target, in reading order; refuses drops into a member, into leaves, onto the root edge and in place; agrees with a single drop for a group of one', () => {
      // drops a selection together before, after or inside a target, in reading order
      {
        const inside = groupDropMove(TREE, [[2], [0, 0]], [1, 0], 'inside', canContain);
        const next = appliedGroup(inside);
        // Alpha keeps its index once its child leaves, so Beta's card stays at 1.0.
        expect(texts(nodeAt(next, [1, 0]) as CatalogTreeInput)).toEqual(['three', 'one', 'four']);
        expect(texts(nodeAt(next, [0]) as CatalogTreeInput)).toEqual(['two']);
        expect(inside.ok && inside.paths.map((path) => markdownOf(nodeAt(next, path)))).toEqual([
          'one',
          'four',
        ]);
        const before = appliedGroup(groupDropMove(TREE, [[0, 1], [2]], [0], 'before', canContain));
        expect(texts(before)).toEqual(['two', 'four', 'one', 'three']);
        // Dropping after a member of the group itself is allowed and keeps the group together.
        const after = appliedGroup(groupDropMove(TREE, [[0, 0], [2]], [0, 0], 'after', canContain));
        expect(texts(nodeAt(after, [0]) as CatalogTreeInput)).toEqual(['one', 'four', 'two']);
      }
      expect(groupDropMove(TREE, [[1], [2]], [1, 0], 'inside', canContain)).toEqual({
        ok: false,
        reason: 'into-itself',
      });
      expect(groupDropMove(TREE, [[0, 0], [1]], [1], 'inside', canContain)).toEqual({
        ok: false,
        reason: 'into-itself',
      });
      expect(groupDropMove(TREE, [[0, 0], [1]], [2], 'inside', canContain)).toEqual({
        ok: false,
        reason: 'no-container',
      });
      expect(groupDropMove(TREE, [[0, 0], [1]], [], 'after', canContain)).toEqual({
        ok: false,
        reason: 'root',
      });
      expect(
        groupDropMove(
          TREE,
          [
            [0, 0],
            [0, 1],
          ],
          [0, 0],
          'before',
          canContain
        )
      ).toEqual({
        ok: false,
        reason: 'same-place',
      });
      // agrees with a single drop for a group of one
      {
        const rows = outlineRows(TREE, (id) => id, canContain);
        let compared = 0;
        for (const from of rows) {
          for (const target of rows) {
            for (const position of ['before', 'after', 'inside'] as DropPosition[]) {
              const single = dropMove(TREE, from.path, target.path, position, canContain);
              const group = groupDropMove(TREE, [from.path], target.path, position, canContain);
              expect(group.ok, `${from.key} ${position} ${target.key}`).toBe(single.ok);
              if (!single.ok || !group.ok) continue;
              compared += 1;
              expect(appliedGroup(group)).toEqual(applied(single));
            }
          }
        }
        expect(compared).toBeGreaterThan(20);
      }
    });
  });

  describe('group delete', () => {
    it('removes every selected subtree last first, as one batch', () => {
      const ops = groupRemoveOps([[0, 0], [2], [0, 0], [1, 0, 0], [1, 0]]);
      expect(ops).toEqual([
        { op: 'remove', path: [2] },
        { op: 'remove', path: [1, 0] },
        { op: 'remove', path: [0, 0] },
      ]);
      const next = applyEditOps(TREE, ops);
      expect(next.ok && texts(next.tree)).toEqual(['two']);
      expect(groupRemoveOps([[]])).toEqual([]);
    });
  });

  describe('duplicate and paste', () => {
    const ided = (id: string, markdown: string): CatalogTreeInput => ({
      id: 'blocks-text',
      props: { block: { type: 'text', id, markdown } },
    });

    it('gives every copied block a fresh, valid, deterministic id; duplicates each selected subtree right after itself, with no repeated block id; copies plain subtrees and pastes inside a container or after a leaf, fresh each time; a paste the container rules refuse never reaches the tree', () => {
      // gives every copied block a fresh, valid, deterministic id
      {
        const taken = new Set(['intro', 'intro-copy']);
        expect(freshBlockId('intro', taken)).toBe('intro-copy-2');
        expect(freshBlockId('intro-copy', new Set())).toBe('intro-copy');
        const long = `a${'b'.repeat(47)}`;
        const fresh = freshBlockId(long, new Set());
        expect(fresh).toMatch(/^[a-z][a-z0-9-]{0,47}$/);
        expect(fresh.endsWith('-copy')).toBe(true);
        const source = card('Box', [ided('intro', 'one'), text('plain')]);
        const clone = cloneSubtree(source, new Set(['intro']));
        expect(blockIds(clone)).toEqual(new Set(['intro-copy']));
        expect(markdownOf(nodeAt(clone, [1]))).toBe('plain');
        // The source is never touched.
        expect(blockIds(source)).toEqual(new Set(['intro']));
      }
      // duplicates each selected subtree right after itself, with no repeated block id
      {
        const tree: CatalogTreeInput = {
          id: 'layout-page',
          children: [ided('intro', 'one'), card('Box', [ided('detail', 'two')]), text('three')],
        };
        const result = duplicateOps(tree, [[0], [1]]);
        const next = appliedGroup(result, tree);
        expect(texts(next)).toEqual(['one', 'one', 'two', 'two', 'three']);
        expect(result.ok && result.paths).toEqual([[1], [3]]);
        const ids = [...blockIds(next)].sort();
        expect(ids).toEqual(['detail', 'detail-copy', 'intro', 'intro-copy']);
        expect(blockIds(nodeAt(next, [1]) as CatalogTreeInput)).toEqual(new Set(['intro-copy']));
        expect(duplicateOps(tree, [[]])).toEqual({ ok: false, reason: 'root' });
      }
      // copies plain subtrees and pastes inside a container or after a leaf, fresh each time
      {
        const tree: CatalogTreeInput = {
          id: 'layout-page',
          children: [ided('intro', 'one'), card('Box', [])],
        };
        const clipboard = copySubtrees(tree, [[0], [0]]);
        expect(clipboard).toEqual([nodeAt(tree, [0])]);
        expect(clipboard[0]).not.toBe(nodeAt(tree, [0]));
        const inCard = pasteOps(tree, clipboard, [1], canContain);
        const afterCard = appliedGroup(inCard, tree);
        expect(inCard.ok && inCard.paths).toEqual([[1, 0]]);
        expect(blockIds(afterCard)).toEqual(new Set(['intro', 'intro-copy']));
        // Pasting again never reuses an id.
        const again = appliedGroup(pasteOps(afterCard, clipboard, [0], canContain), afterCard);
        expect(markdownOf(nodeAt(again, [1]))).toBe('one');
        expect([...blockIds(again)].sort()).toEqual(['intro', 'intro-copy', 'intro-copy-2']);
        // Nothing selected (or a stale path): the end of the page.
        const stale = pasteOps(tree, clipboard, [7, 7], canContain);
        expect(stale.ok && stale.ops[0]).toMatchObject({ parent: [], index: 2 });
        expect(pasteOps(tree, [], [1], canContain)).toEqual({
          ok: false,
          reason: 'empty-clipboard',
        });
        expect(pasteOps({ id: 'blocks-text' }, clipboard, [], canContain)).toEqual({
          ok: false,
          reason: 'no-container',
        });
      }
      // a paste the container rules refuse never reaches the tree
      {
        // A doc layout pasted into a page adds structural errors: the builder's guard refuses it.
        const page: CatalogTreeInput = {
          id: 'layout-page',
          props: { title: 'Fictional' },
          children: [],
        };
        const result = pasteOps(
          page,
          [{ id: 'layout-doc', props: { title: 'Doc' }, children: [] }],
          [],
          canContain
        );
        const next = appliedGroup(result, page);
        expect(moveKeepsStructure(page, next)).toBe(false);
      }
    });
  });

  describe('path bookkeeping', () => {
    it('follows nodes through inserts, removals and moves', () => {
      expect(pathAfterOp({ op: 'insert', parent: [0], index: 0, node: text('x') }, [0, 0])).toEqual(
        [0, 1]
      );
      expect(pathAfterOp({ op: 'insert', parent: [0], index: 2, node: text('x') }, [0, 1])).toEqual(
        [0, 1]
      );
      expect(pathAfterOp({ op: 'remove', path: [0] }, [0, 1])).toBeNull();
      expect(pathAfterOp({ op: 'move', path: [0], parent: [1], index: 0 }, [0, 1])).toEqual([
        1, 0, 1,
      ]);
      // Old [2] becomes [1] and is the new parent itself, so it does not shift.
      expect(pathAfterOp({ op: 'move', path: [0], parent: [1], index: 0 }, [2])).toEqual([1]);
      expect(pathAfterOp({ op: 'move', path: [0], parent: [], index: 0 }, [2])).toEqual([2]);
      expect(
        placedPaths([
          { op: 'insert', parent: [], index: 3, node: text('x') },
          { op: 'insert', parent: [], index: 1, node: text('y') },
        ])
      ).toEqual([[1], [4]]);
    });
  });
});

describe('palette', () => {
  // A fictional Tier U manifest with no painter, shaped like the chat display ids.
  const chatLike: CatalogManifest = {
    ...cardLayoutManifest,
    id: 'chat-thread',
    package: '@texuli/chat',
    label: 'Chat thread',
    summary: 'A read-only fictional conversation.',
    useWhen: ['Show a finished exchange between a person and an agent.'],
    agentEmittable: true,
  };
  const appOnly: CatalogManifest = {
    ...cardLayoutManifest,
    id: 'layout-app-shell',
    agentEmittable: false,
  };

  const manifests = [
    ...CONTENT_MANIFESTS,
    pageLayoutManifest,
    deckLayoutManifest,
    cardLayoutManifest,
    chatLike,
    appOnly,
  ];
  const builderIds = new Set([...CONTENT_MANIFESTS.map((m) => m.id), 'layout-page', 'layout-card']);
  const entries = createPaletteEntries(manifests, {
    paintable: (id) => id !== 'chat-thread',
    insertable: (id) => builderIds.has(id),
  });

  describe('builder palette entries', () => {
    it('lists Tier U (agent-emittable) manifests only, once each', () => {
      expect(entries.some((entry) => entry.id === 'layout-app-shell')).toBe(false);
      const ids = entries.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(entries.every((entry) => entry.tier === 'content' || entry.tier === 'app')).toBe(true);
    });

    it('marks Tier U growth the host cannot insert, with the reason', () => {
      const byId = new Map(entries.map((entry) => [entry.id, entry]));
      expect(byId.get('blocks-text')?.availability).toBe('insertable');
      expect(byId.get('layout-deck')?.availability).toBe('not-in-host');
      expect(byId.get('chat-thread')?.availability).toBe('no-painter');
      expect(byId.get('chat-thread')?.group).toBe('Chat display');
    });

    it('counts the props each manifest marks required', () => {
      const cartesian = entries.find((entry) => entry.id === 'charts-cartesian');
      const manifest = CONTENT_MANIFESTS.find((m) => m.id === 'charts-cartesian');
      expect(cartesian && manifest).toBeTruthy();
      if (!cartesian || !manifest) return;
      expect(cartesian.requiredProps).toBe(manifest.props.filter((prop) => prop.required).length);
      expect(cartesian.requiredProps).toBeGreaterThan(0);
    });

    it('orders by group, then label, and groups in that order', () => {
      const groups = groupPalette(entries);
      expect(groups.map((section) => section.group)).toEqual([
        'Layouts',
        'Content blocks',
        'Charts',
        'Media',
        'Chat display',
      ]);
      const labels = (groups.find((section) => section.group === 'Charts')?.entries ?? []).map(
        (entry) => entry.label
      );
      expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'en')));
    });
  });

  describe('builder palette search', () => {
    it('matches label, id, summary and useWhen hints, case-insensitively; requires every term and keeps everything for an empty query; describes the result count for the live region; moves the active option with wrapping, and reports an empty list', () => {
      expect(
        searchPalette(entries, 'CHAT THREAD').some((entry) => entry.id === 'chat-thread')
      ).toBe(true);
      expect(
        searchPalette(entries, 'chat-thread').some((entry) => entry.id === 'chat-thread')
      ).toBe(true);
      // Only in the useWhen hint, not in the label, id or summary.
      expect(searchPalette(entries, 'finished exchange').map((entry) => entry.id)).toEqual([
        'chat-thread',
      ]);
      expect(searchPalette(entries, '   ')).toHaveLength(entries.length);
      expect(searchPalette(entries, 'chat zzzz-no-match')).toEqual([]);
      expect(paletteCountText(entries.length, entries.length)).toBe(`${entries.length} components`);
      expect(paletteCountText(3, 40)).toBe('3 of 40 components');
      expect(paletteCountText(0, 40)).toBe('No components match. 40 available.');
      expect(moveActive(-1, 5, 1)).toBe(0);
      expect(moveActive(-1, 5, -1)).toBe(4);
      expect(moveActive(4, 5, 1)).toBe(0);
      expect(moveActive(0, 5, -1)).toBe(4);
      expect(moveActive(2, 0, 1)).toBe(-1);
    });
  });

  /** The palette the builder really shows: the real sources, as BuilderApp builds it. */
  const real = createPaletteEntries(PALETTE_MANIFESTS, {
    paintable: playerPaints,
    insertable: builderInsertable,
    reason: unavailableReason,
  });
  const realById = new Map(real.map((entry) => [entry.id, entry]));

  describe('the builder palette (PLAN_005 task 5)', () => {
    it('lists every Tier U manifest the player catalog holds, with nothing silently missing; inserts the G20 layouts and the host region, which paint and need no envelope declarations; explains each painted id it cannot insert, specifically; groups the real palette, with the interaction ids in their own group; searches labels, ids and group names case-insensitively; every insertable entry is a builder manifest, and every prop it offers has a working field', () => {
      // Every id the player can paint is in the palette, insertable or explained.
      for (const manifest of PALETTE_MANIFESTS.filter((m) => m.agentEmittable === true)) {
        expect(realById.has(manifest.id), manifest.id).toBe(true);
      }
      for (const entry of real) {
        if (entry.availability === 'insertable') expect(entry.note, entry.id).toBeNull();
        else expect(entry.note?.length ?? 0, entry.id).toBeGreaterThan(20);
      }
      for (const id of [
        'layout-stack',
        'layout-row',
        'layout-split',
        'layout-tile',
        'host-region',
      ]) {
        expect(realById.get(id)?.availability, id).toBe('insertable');
        expect(playerPaints(id), id).toBe(true);
      }
      expect(realById.get('layout-tile')?.group).toBe('Layouts');
      expect(realById.get('host-region')?.group).toBe('Interaction');
      // explains each painted id it cannot insert, specifically
      {
        const note = (id: string) => realById.get(id)?.note ?? '';
        expect(realById.get('layout-deck')?.availability).toBe('not-in-host');
        // A deck is a whole draft (the deck starter); the palette never nests one.
        expect(note('layout-deck')).toContain('start one from the Planning deck starter');
        expect(BUILDER_MANIFEST_BY_ID.has('layout-deck')).toBe(true);
        expect(note('deck-slide')).toContain('slide editor');
        for (const id of ['control-toggle', 'control-choice', 'control-slider', 'control-filter']) {
          expect(realById.get(id)?.availability, id).toBe('not-in-host');
          expect(note(id), id).toContain('state variable declared in the blueprint envelope');
        }
        for (const id of ['flow-view', 'flow-action']) expect(note(id), id).toContain('flow');
        for (const id of ['action-form', 'form-field', 'form-submit']) {
          expect(note(id), id).toContain('action declared in the blueprint envelope');
        }
        expect(realById.get('chat-thread')?.availability).toBe('no-painter');
        expect(note('chat-thread')).toContain('no painter for chat display ids');
        // No unavailable entry falls back to the generic note: every one has its own reason.
        const generic = new Set(Object.values(AVAILABILITY_NOTES));
        for (const entry of real.filter((candidate) => candidate.availability !== 'insertable')) {
          expect(generic.has(entry.note ?? ''), entry.id).toBe(false);
        }
      }
      // groups the real palette, with the interaction ids in their own group
      {
        expect(groupPalette(real).map((section) => section.group)).toEqual([
          'Layouts',
          'Content blocks',
          'Charts',
          'Media',
          'Interaction',
          'Chat display',
        ]);
        const interaction = groupPalette(real).find((section) => section.group === 'Interaction');
        expect(interaction?.entries.map((entry) => entry.id).sort()).toEqual([
          'action-form',
          'control-choice',
          'control-filter',
          'control-slider',
          'control-toggle',
          'flow-action',
          'flow-view',
          'form-field',
          'form-submit',
          'host-region',
        ]);
      }
      // searches labels, ids and group names case-insensitively
      {
        // "Grid tile" is the tile's label; the grid layout's summary mentions tiles too.
        expect(searchPalette(real, 'GRID TILE').map((entry) => entry.id)).toEqual([
          'layout-grid',
          'layout-tile',
        ]);
        expect(searchPalette(real, 'LAYOUT-TILE').map((entry) => entry.id)).toEqual([
          'layout-tile',
        ]);
        expect(searchPalette(real, 'layout-split').map((entry) => entry.id)).toEqual([
          'layout-split',
        ]);
        expect(searchPalette(real, 'interaction').map((entry) => entry.id)).toHaveLength(10);
        // A search can surface unavailable entries too; they keep their reason.
        const toggle = searchPalette(real, 'control-toggle')[0];
        expect(toggle?.availability).toBe('not-in-host');
        expect(toggle?.note).toBeTruthy();
      }
      // every insertable entry is a builder manifest, and every prop it offers has a working field
      {
        const insertable = real.filter((entry) => entry.availability === 'insertable');
        expect(insertable.map((entry) => entry.id).sort()).toEqual(
          BUILDER_MANIFESTS.map((manifest) => manifest.id)
            .filter((id) => !BUILDER_ROOT_ONLY.has(id))
            .sort()
        );
        const families: Record<string, number> = {};
        for (const manifest of BUILDER_MANIFESTS) {
          for (const prop of inspectorFields(manifest.props)) {
            const family = fieldFamily(manifest.id, prop);
            families[family] = (families[family] ?? 0) + 1;
            // A field is never a plain text box for a value the component reads as another kind.
            if (family === 'unsupported') expect(unsupportedReason(manifest.id, prop)).toBeTruthy();
            if (family === 'string')
              expect(prop.kind, `${manifest.id}.${prop.name}`).toBe('string');
            if (family === 'json') {
              expect(['object', 'array', 'unknown'], `${manifest.id}.${prop.name}`).toContain(
                prop.kind
              );
            }
          }
        }
        for (const family of [
          'text-block',
          'media-block',
          'url',
          'alt',
          'choice',
          'number',
          'struct',
          'string',
          'json',
          'unsupported',
        ]) {
          expect(families[family] ?? 0, family).toBeGreaterThan(0);
        }
      }
    });
  });
});

describe('payload', () => {
  /**
   * The builder's payload panel (builder design §6, Task 71): blueprint text and
   * structured edits round-trip, and refused text is never applied in part.
   */

  const text = (markdown: string): CatalogTreeInput => ({
    id: 'blocks-text',
    props: { block: { type: 'text', markdown } },
  });
  const report: CatalogTreeInput = {
    id: 'layout-page',
    props: { title: 'Fictional weekly report' },
    children: [
      { id: 'layout-card', props: { title: 'Summary' }, children: [text('Closed **38** items.')] },
      {
        id: 'blocks-text',
        props: { block: { type: 'heading', level: 2, text: 'Next week' } },
      },
    ],
  };

  describe('round trip', () => {
    it('shows canonical JSON with a 2-space indent, and reads back to the same tree', () => {
      const pretty = prettyBlueprintJson(report);
      expect(pretty.split('\n').length).toBeGreaterThan(10);
      expect(pretty).toBe(JSON.stringify(JSON.parse(canonicalBlueprintJson(report)), null, 2));
      const back = checkPayloadText(pretty);
      expect(back.ok).toBe(true);
      if (!back.ok) return;
      expect(canonicalBlueprintJson(back.tree)).toBe(canonicalBlueprintJson(report));
    });

    it('is idempotent after the first normalization, whatever the input formatting', () => {
      const messy =
        '{ "children": [ ], "props" : {"title":"A\\u0020B","toc":true}, "id":"layout-doc" }';
      const first = checkPayloadText(messy);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const once = prettyBlueprintJson(first.tree);
      const again = checkPayloadText(once);
      expect(again.ok && prettyBlueprintJson(again.tree)).toBe(once);
      expect(once).toContain('"title": "A B"');
    });

    it('keeps the digest the player computes over canonical JSON', async () => {
      const back = checkPayloadText(prettyBlueprintJson(report));
      if (!back.ok) throw new Error('refused');
      expect(await blueprintDigest(back.tree)).toBe(await blueprintDigest(report));
    });

    it('reflects an inspector write, and a committed text is one replaceAll entry', () => {
      const history = createBuilderHistory(report);
      const write = history.apply({ op: 'setProp', path: [0], name: 'title', value: 'Highlights' });
      expect(write.ok).toBe(true);
      expect(prettyBlueprintJson(history.tree)).toContain('"title": "Highlights"');

      const edited = prettyBlueprintJson(history.tree).replace('Highlights', 'Edited in JSON');
      const checked = checkPayloadText(edited);
      if (!checked.ok) throw new Error('refused');
      expect(history.apply({ op: 'replaceAll', tree: checked.tree }).ok).toBe(true);
      expect(prettyBlueprintJson(history.tree)).toBe(edited);
      expect(history.undo()).toBe(true);
      expect(prettyBlueprintJson(history.tree)).toContain('"title": "Highlights"');
    });
  });

  describe('refused text is line-precise and never applied in part', () => {
    const lines = (...rows: string[]) => rows.join('\n');

    it('places a parse error, even when the engine names no position', () => {
      const broken = lines(
        '{',
        '  "id": "layout-page",',
        '  "props": {',
        '    "title": ',
        '  }',
        '}'
      );
      const result = checkPayloadText(broken);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issues[0]?.message).toMatch(/^JSON parse failed/);
      expect(result.issues[0]?.at).toMatchObject({ line: 5, column: 3 });
      expect(locateJson(broken).stoppedAt).toBe(broken.indexOf('}'));
    });

    it.each([
      ['position', 'Unexpected token at position 5', { line: 2, column: 4 }],
      ['line and column', 'Bad thing (line 2 column 3)', { line: 2, column: 3 }],
      ['the end of input', 'Unexpected end of JSON input', { line: 3, column: 3 }],
    ])('reads a parse error %s from the engine message', (_label, message, at) => {
      expect(parseErrorPosition('{\n "a"\n }', message)).toMatchObject(at);
    });

    it('points at the second key of a duplicate, which JSON.parse would keep silently', () => {
      const doubled = lines(
        '{',
        '  "id": "layout-page",',
        '  "props": {',
        '    "title": "first",',
        '    "title": "second"',
        '  }',
        '}'
      );
      const result = checkPayloadText(doubled);
      if (result.ok) throw new Error('accepted');
      expect(result.issues).toEqual([
        expect.objectContaining({
          path: ['props', 'title'],
          at: expect.objectContaining({ line: 5, column: 5 }),
        }),
      ]);
      expect(result.issues[0]?.message).toContain('Duplicate JSON keys');
      expect(duplicateJsonKeys(doubled)).toEqual(['props.title']);
    });

    it('points at each refused id, prop and field', () => {
      const hostile = prettyBlueprintJson({
        id: 'layout-page',
        props: { title: 'Fictional' },
        children: [
          { id: 'layout-card', props: { title: 'A', colour: 'red' } },
          { id: 'dialog', props: { title: 'Delete?' } },
        ],
      }).replace('"title": "A"', '"title": "A",\n          "onclick": "alert(1)"');
      const result = checkPayloadText(hostile);
      if (result.ok) throw new Error('accepted');
      const placed = result.issues.map((issue) => [issue.path?.join('.'), issue.at?.line]);
      const lineOf = (needle: string) =>
        hostile.split('\n').findIndex((row) => row.includes(needle)) + 1;
      expect(placed).toEqual([
        ['children.0.props.colour', lineOf('"colour"')],
        ['children.0.props.onclick', lineOf('"onclick"')],
        ['children.1.id', lineOf('"dialog"')],
      ]);
      expect(describeIssue(result.issues[2] as never)).toMatch(
        /^Line \d+, column \d+: "dialog" is not a component/
      );
    });

    it('refuses exactly what the builder history refuses, so text and inspector share one closed rule', () => {
      const cases: unknown[] = [
        report,
        { id: 'layout-page', props: { class: 'x' } },
        { id: 'layout-page', props: { onClick: 'x' } },
        { id: 'layout-page', props: { nope: 1 } },
        { id: 'dialog' },
        { id: 'layout-page', children: {} },
        { id: 'layout-page', props: [] },
        [report],
        'layout-page',
      ];
      for (const value of cases) {
        expect(builderTreeIssues(value).length === 0, JSON.stringify(value)).toBe(
          validateBuilderTree(value)
        );
      }
    });

    it('leaves the draft untouched when any part of the text is refused', () => {
      const history = createBuilderHistory(report);
      const before = history.tree;
      const partlyGood = prettyBlueprintJson(report).replace('"Summary"', '"Summary", "nope": 1');
      const result = checkPayloadText(partlyGood);
      expect(result.ok).toBe(false);
      // The panel applies only an accepted check, so nothing reached the history.
      expect(history.tree).toBe(before);
      expect(history.canUndo).toBe(false);
    });

    it('refuses text over the byte cap before parsing it', () => {
      const huge = `{"id":"layout-page","props":{"title":"${'x'.repeat(300_000)}"}}`;
      const result = checkPayloadText(huge);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues[0]?.message).toMatch(/byte limit/);
    });

    it('refuses 200-deep trees and dangerous prop names in both panel and direct history commits', () => {
      let deep: unknown = { id: 'blocks-text' };
      for (let index = 0; index < 200; index += 1) {
        deep = { id: 'layout-card', children: [deep] };
      }

      const hostile = [
        JSON.stringify(deep),
        '{"id":"layout-page","props":{"__proto__":{"polluted":true}}}',
        '{"id":"layout-page","props":{"onClick":"alert(1)"}}',
        '{"id":"layout-page","props":{"class":"hostile"}}',
        '{"id":"layout-page","props":{"style":{"position":"fixed"}}}',
      ];

      for (const source of hostile) {
        const panel = checkPayloadText(source);
        expect(panel.ok, source.slice(0, 80)).toBe(false);

        const history = createBuilderHistory(report);
        const before = history.tree;
        const direct = history.apply({
          op: 'replaceAll',
          tree: JSON.parse(source) as CatalogTreeInput,
        });
        expect(direct.ok, source.slice(0, 80)).toBe(false);
        expect(history.tree).toBe(before);
        expect(history.canUndo).toBe(false);
      }

      expect(Object.prototype).not.toHaveProperty('polluted');
    });

    it('counts lines and columns from 1', () => {
      expect(positionAt('ab\ncd', 4)).toEqual({ offset: 4, line: 2, column: 2 });
    });

    it('places many issues through one line index, with the same positions as a rescan', () => {
      for (const text of [
        '',
        'a',
        '\n',
        'ab\ncd',
        '\n\nx\n',
        '{\n  "a": 1,\n\n  "b": [\n    2\n  ]\n}\n',
      ]) {
        const at = positionIndex(text);
        for (let offset = -2; offset <= text.length + 2; offset += 1) {
          expect(at(offset), `${JSON.stringify(text)} @ ${offset}`).toEqual(
            positionAt(text, offset)
          );
        }
      }
    });
  });

  const SHARED: CatalogTreeInput = {
    id: 'layout-page',
    props: { title: 'Fictional harbor notes' },
    children: [
      {
        id: 'blocks-text',
        props: { block: { type: 'heading', level: 2, text: 'Pier 4 — überblick' } },
      },
      { id: 'layout-card', props: { title: 'Summary' }, children: [] },
    ],
  };

  /** A hash whose payload is `text`, deflated the way the builder does it. */
  async function hashOf(text: string, version = '1'): Promise<string> {
    const stream = new Blob([new TextEncoder().encode(text)])
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const data = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${SHARE_PREFIX}${version}.${data}`;
  }

  describe('share links (PLAN_005 task 6)', () => {
    it('round-trips the exact draft and the preview view, deterministically', async () => {
      const view = { width: 'mobile', mode: 'dark' } as const;
      const hash = await encodeShare(SHARED, view);
      expect(isShareHash(hash)).toBe(true);
      expect(hash).toMatch(/^#draft=1\.[A-Za-z0-9_-]+$/);
      expect(await encodeShare(SHARED, view)).toBe(hash);
      const opened = await decodeShare(hash);
      expect(opened.ok).toBe(true);
      if (!opened.ok) return;
      expect(canonicalBlueprintJson(opened.tree)).toBe(canonicalBlueprintJson(SHARED));
      expect(await blueprintDigest(opened.tree)).toBe(await blueprintDigest(SHARED));
      expect(opened.view).toEqual(view);
      // Key order never changes the link: the draft is canonical JSON.
      const reordered = JSON.parse(
        JSON.stringify({ children: SHARED.children, props: SHARED.props, id: SHARED.id })
      );
      expect(await encodeShare(reordered, view)).toBe(hash);
    });

    it('refuses what a JSON commit refuses, before anything paints', async () => {
      const hostile = [
        ['unknown id', 'light desktop\n{"id":"dialog"}'],
        ['handler prop', 'light desktop\n{"id":"layout-page","props":{"onclick":"x"}}'],
        ['class prop', 'light desktop\n{"id":"layout-page","props":{"class":"x"}}'],
        ['duplicate keys', 'light desktop\n{"id":"layout-page","id":"layout-doc"}'],
        ['broken JSON', 'light desktop\n{"id":'],
        ['bad view', 'sepia desktop\n{"id":"layout-page"}'],
        ['no view line', '{"id":"layout-page"}'],
      ] as const;
      for (const [name, text] of hostile) {
        const result = await decodeShare(await hashOf(text));
        expect(result.ok, name).toBe(false);
        if (!result.ok) expect(result.message.length, name).toBeGreaterThan(10);
      }
      const passes = await decodeShare(
        await hashOf('dark tablet\n{"id":"layout-page","props":{}}')
      );
      expect(passes.ok).toBe(true);
    });

    it('refuses damaged, foreign, oversized and bomb-like links', async () => {
      expect((await decodeShare('#other=1.abc')).ok).toBe(false);
      expect((await decodeShare(`${SHARE_PREFIX}2.abc`)).ok).toBe(false);
      expect((await decodeShare(`${SHARE_PREFIX}1.`)).ok).toBe(false);
      expect((await decodeShare(`${SHARE_PREFIX}1.not*base64`)).ok).toBe(false);
      expect((await decodeShare(`${SHARE_PREFIX}1.AAAA`)).ok).toBe(false);
      expect((await decodeShare(`${SHARE_PREFIX}1.${'A'.repeat(MAX_SHARE_CHARS + 1)}`)).ok).toBe(
        false
      );
      // Highly compressible text past the draft limit stops inflating at the cap.
      const bomb = await hashOf(`light desktop\n${' '.repeat(5_000_000)}`);
      expect(bomb.length).toBeLessThan(MAX_SHARE_CHARS);
      const result = await decodeShare(bomb);
      expect(result).toEqual({
        ok: false,
        message: 'The link is damaged or holds more than a draft can.',
      });
    });
  });

  describe('starter drafts (PLAN_005 task 6)', () => {
    it('offers an empty page and three registry blueprints; every starter passes the JSON commit check and the history, and is a fresh copy', async () => {
      expect(STARTER_IDS).toEqual(['empty', 'report', 'dashboard', 'deck']);
      expect(STARTERS.map((starter) => starter.label)).toEqual([
        'Empty page',
        'Weekly report',
        'Operations dashboard',
        'Planning deck',
      ]);
      for (const id of STARTER_IDS) {
        const tree = await loadStarter(id);
        const checked = checkPayloadText(JSON.stringify(tree));
        expect(checked.ok, `${id}: ${checked.ok ? '' : JSON.stringify(checked.issues)}`).toBe(true);
        const history = createBuilderHistory();
        const applied = history.apply({ op: 'replaceAll', tree });
        expect(applied.ok, id).toBe(true);
        expect(await loadStarter(id)).not.toBe(tree);
      }
      expect((await loadStarter('report')).id).toBe('layout-doc');
      expect((await loadStarter('dashboard')).id).toBe('layout-page');
      expect((await loadStarter('deck')).id).toBe('layout-deck');
      // Fictional data only: no link leaves example.com.
      for (const id of STARTER_IDS) {
        const urls = JSON.stringify(await loadStarter(id)).match(/https?:\/\/[^"\s]+/g) ?? [];
        for (const url of urls)
          expect(new URL(url).hostname.endsWith('example.com'), url).toBe(true);
      }
    });
  });
});

describe('preview', () => {
  const event = (overrides: Partial<PlayerDiagnosticsEvent> = {}): PlayerDiagnosticsEvent => ({
    status: 'draft',
    surface: 'tree',
    diagnostics: [],
    receipt: null,
    stateIssues: [],
    ...overrides,
  });

  const missingBlock = {
    check: 'render',
    code: 'missing-required',
    severity: 'error',
    path: '0.children.0.children.1',
    message: 'Required prop "block" is missing.',
    id: 'blocks-text',
  } as const;

  describe('builder preview model', () => {
    it('maps player node paths to builder paths; lists validation diagnostics with the node they belong to, once each; adds state issues and painter errors after the diagnostics; summarizes the draft for the polite status line', () => {
      expect(builderPathOf('0')).toEqual([]);
      expect(builderPathOf('0.children.2')).toEqual([2]);
      expect(builderPathOf('0.children.0.children.1')).toEqual([0, 1]);
      expect(builderPathOf('0.children.1.props.block.items.0')).toEqual([1]);
      expect(builderPathOf('$.tree')).toBeNull();
      expect(builderPathOf('')).toBeNull();
      // lists validation diagnostics with the node they belong to, once each
      {
        const issues = previewIssues(
          event({ status: 'invalid', diagnostics: [missingBlock, { ...missingBlock }] })
        );
        expect(issues).toEqual([
          {
            key: 'missing-required@0.children.0.children.1',
            severity: 'error',
            code: 'missing-required',
            message: 'Required prop "block" is missing.',
            path: [0, 1],
          },
        ]);
      }
      // adds state issues and painter errors after the diagnostics
      {
        const issues = previewIssues(
          event({
            stateIssues: [
              { code: 'state-shape', path: 'state', message: 'State must be an object.' },
            ],
          }),
          [
            { code: 'node-error', id: 'charts-line', path: '0.children.3', phase: 'load' },
            { code: 'no-loader', id: 'charts-line', path: '0.children.4' },
          ]
        );
        expect(issues.map((issue) => [issue.code, issue.path])).toEqual([
          ['state-shape', null],
          ['node-error', [3]],
          ['no-loader', [4]],
        ]);
        expect(issues[1]?.message).toBe('This component failed to load or render in the preview.');
      }
      expect(previewSummary(null, 0)).toBe('Preparing the preview…');
      expect(previewSummary(event(), 0)).toBe('No issues: the draft passes validation.');
      expect(previewSummary(event({ status: 'invalid' }), 2)).toBe(
        'The draft has 2 issues; the preview paints the rest with placeholders.'
      );
      expect(previewSummary(event({ status: 'invalid', surface: 'notice' }), 1)).toBe(
        'The draft cannot be previewed: 1 issue.'
      );
      expect(previewSummary(event(), 1)).toBe('1 issue in the draft.');
    });
  });

  describe('preview breakpoints and color mode (PLAN_005 task 6)', () => {
    it('constrains the stage to a real width per breakpoint, never a scale; names the width and mode in the stage classes; writes and reads the view exactly, refusing anything else', () => {
      expect(PREVIEW_WIDTH_PX).toEqual({ mobile: 390, tablet: 768, desktop: null });
      expect(stageInlineSize('mobile')).toBe('390px');
      expect(stageInlineSize('tablet')).toBe('768px');
      expect(stageInlineSize('desktop')).toBe('100%');
      expect(stageClass(DEFAULT_PREVIEW_VIEW)).toBe(
        'builder-preview__stage builder-preview__stage--desktop builder-preview__stage--light'
      );
      expect(stageClass({ width: 'mobile', mode: 'dark' })).toContain(
        'builder-preview__stage--mobile'
      );
      expect(stageClass({ width: 'mobile', mode: 'dark' })).toContain(
        'builder-preview__stage--dark'
      );
      for (const view of [
        { width: 'mobile', mode: 'dark' },
        { width: 'tablet', mode: 'light' },
        DEFAULT_PREVIEW_VIEW,
      ] as const) {
        expect(parseView(viewText(view))).toEqual(view);
      }
      for (const bad of [
        '',
        'dark',
        'dark  mobile',
        'DARK mobile',
        'dark mobile extra',
        'sepia mobile',
        'dark watch',
      ]) {
        expect(parseView(bad), bad).toBeNull();
      }
    });
  });
});

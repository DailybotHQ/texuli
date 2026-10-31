/**
 * The studio islands' logic (T-82, T-88, W9): builder first run, playground
 * presets and their captions, theme studio starting points and share links
 * (recipe only, never image data, fail closed), WCAG 2.1.4 character-key
 * shortcuts scoped to the focused tool, WCAG 2.5.3 label in name, and the
 * trust sentences and sink-free island sources. Rendered behavior is covered
 * by playground-sr.test.ts and the site e2e specs.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { HOSTILE_SAMPLES, type HostileSample } from '@texuli/catalog/render/hostile';
import { type CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { safeHref } from '@texuli/core/url-policy';
import { SEMANTIC_ROLES, type Theme } from '@texuli/tokens';
import { getFullThemeLibraryMeta, loadFullLibraryTheme } from '@texuli/tokens/library-expand';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_BLUEPRINT, isBareDraft } from '../src/components/builder/model.ts';
import {
  HOSTILE_PROVES,
  PLAYGROUND_PRESETS,
  presetById,
} from '../src/components/playground/presets.ts';
import { formatDiagnostics, runPlaygroundTree } from '../src/components/playground/run.ts';
import {
  decodeStudioShare,
  encodeStudioShare,
  FEATURED_LIBRARY_THEMES,
  generateStudioTheme,
  humanizeThemeId,
  isStudioShareHash,
  normalizeHex,
  roleDefault,
  STUDIO_SEED_PRESETS,
  type StudioShareState,
  studioShareFor,
  themeFromLibraryPayload,
  themeFromShare,
} from '../src/components/theme-studio/studio.ts';
import { isEditableTarget, runToolShortcut, toolShortcut } from '../src/components/tool-keys.ts';

describe('builder first run', () => {
  describe('isBareDraft', () => {
    it('is true only for the untouched page root, at any depth', () => {
      expect(isBareDraft(EMPTY_BLUEPRINT)).toBe(true);
      expect(isBareDraft({ id: 'layout-page', props: {} })).toBe(true);
      // is false once any child lands, at any depth
      {
        const withChild: CatalogTreeInput = {
          id: 'layout-page',
          props: {},
          children: [{ id: 'card', props: { title: 'First' }, children: [] }],
        };
        expect(isBareDraft(withChild)).toBe(false);
        const nested: CatalogTreeInput = {
          id: 'layout-page',
          props: {},
          children: [
            {
              id: 'layout-section',
              props: {},
              children: [{ id: 'card', props: {}, children: [] }],
            },
          ],
        };
        expect(isBareDraft(nested)).toBe(false);
      }
    });
  });
});

describe('playground presets', () => {
  /**
   * T-82 — playground preset captions (punch-list row 5): every preset states
   * in one line what its run proves, every hostile corpus category has a
   * caption, and the preset JSON still runs through the playground pipeline.
   */

  describe('playground presets', () => {
    it('captions every preset, covers every hostile category, and keeps hostile presets runnable', () => {
      expect(PLAYGROUND_PRESETS.length).toBeGreaterThan(3);
      for (const preset of PLAYGROUND_PRESETS) {
        expect(preset.proves.trim().length, preset.id).toBeGreaterThan(10);
        expect(preset.proves, preset.id).not.toMatch(/TODO|TBD/);
      }
      // covers every hostile corpus category with a caption
      {
        const categories = new Set<HostileSample['category']>(
          HOSTILE_SAMPLES.map((s) => s.category)
        );
        for (const category of categories) {
          expect(HOSTILE_PROVES[category], `no caption for ${category}`).toBeTruthy();
        }
        // A new corpus category cannot ship without a caption: the map is total.
        expect(Object.keys(HOSTILE_PROVES).length).toBe(categories.size);
      }
      // keeps hostile presets runnable, with a diagnostic or a placeholder to show
      {
        const hostile = PLAYGROUND_PRESETS.filter((preset) => preset.id.startsWith('hostile-'));
        expect(hostile.length).toBeGreaterThan(10);
        let withFindings = 0;
        for (const preset of hostile) {
          const result = runPlaygroundTree(`${JSON.stringify(preset.tree, null, 2)}\n`);
          if (!result.ok) continue; // parse-level samples are covered by the corpus tests
          const lines = formatDiagnostics(result);
          if (lines.length > 0 || result.roots.some((root) => root.kind === 'placeholder')) {
            withFindings += 1;
          }
        }
        expect(withFindings).toBeGreaterThan(0);
      }
      // resolves presets by id with the caption attached
      {
        const preset = presetById('safe-card');
        expect(preset?.proves).toBeTruthy();
        expect(presetById('does-not-exist')).toBeUndefined();
      }
    });
  });

  /**
   * PLAN_006 W9: the `bidi` and `url-trick` captions said more than the code
   * does. These pin the honest captions and the behavior each one states.
   */
  describe('playground captions state what the renderer and URL policy do (W9)', () => {
    const run = (id: string) => {
      const preset = presetById(id);
      if (!preset) throw new Error(`missing preset ${id}`);
      const result = runPlaygroundTree(JSON.stringify(preset.tree));
      if (!result.ok) throw new Error(`preset ${id} did not run`);
      return result;
    };

    it('captions state what the renderer and URL policy really do (W9)', () => {
      // bidi: the caption says the characters are kept, and they are
      {
        expect(HOSTILE_PROVES.bidi).toBe(
          'Bidi overrides and zero-width marks are not removed from text: the title renders as plain text with them kept, so it can still read reordered. What the untrusted URL policy refuses is a link that carries them.'
        );
        const root = run('hostile-bidi-override-title').roots[0];
        expect(root?.kind).toBe('component');
        expect(root?.kind === 'component' && root.props.title).toBe('Safe\u202Eexe.gpj\u202D file');
        expect(safeHref('https://example.com/\u202Egpj.exe', 'untrusted')).toBeUndefined();
      }
      expect(HOSTILE_PROVES['url-trick']).toBe(
        'Tabs, newlines and mixed case in a scheme cannot smuggle javascript: past the policy. The untrusted tier keeps only https:, mailto: and #fragment links and refuses protocol-relative (//host) links, relative paths and credentials before the host; any other https: host still passes.'
      );
      for (const id of [
        'hostile-url-tab-split-scheme',
        'hostile-url-newline-and-case',
        'hostile-url-protocol-relative',
        'hostile-url-developer-only-relative',
        'hostile-url-credentials-host',
      ]) {
        const result = run(id);
        const root = result.roots[0];
        expect(root?.kind === 'component' && 'href' in root.props, id).toBe(false);
        expect(formatDiagnostics(result).join(' '), id).toContain('href');
      }
      // Cross-origin https links are not refused: the policy is not an allowlist.
      expect(safeHref('https://evil.example/steal', 'untrusted')).toBe(
        'https://evil.example/steal'
      );
    });
  });
});

describe('theme studio library', () => {
  /**
   * T-82 — theme studio starting points (punch-list rows 2 and 8 support):
   * preset seeds, the featured library themes, and the payload importer that
   * turns a `/theme-data/<id>.json` file into an editable studio theme.
   *
   * The importer is pinned against a real library theme: a full round trip
   * through the explorer payload must preserve every role color, so "start
   * from a library theme" starts from the real palette, not an approximation.
   */

  type PayloadRole = { role: string; default: string; hover?: string; active?: string };

  /** The explorer payload shape the studio imports (roles only, as shipped). */
  function payloadOf(theme: Theme): unknown {
    const modes = ['light', 'dark'] as const;
    return {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      category: 'test',
      contrastLevel: 'AA',
      ...Object.fromEntries(
        modes.map((mode) => [
          mode,
          {
            mode,
            roles: SEMANTIC_ROLES.map((role) => {
              const value = theme[mode][role];
              const entry: PayloadRole = { role, default: value?.default ?? '#000000' };
              if (value?.hover) entry.hover = value.hover;
              if (value?.active) entry.active = value.active;
              return entry;
            }),
          },
        ])
      ),
    };
  }

  describe('studio starting points', () => {
    it('offers preset seeds that generate and library themes that exist', async () => {
      // offers preset seeds whose hexes all normalize and generate
      {
        expect(STUDIO_SEED_PRESETS.length).toBeGreaterThanOrEqual(6);
        const labels = new Set(STUDIO_SEED_PRESETS.map((preset) => preset.label));
        expect(labels.size).toBe(STUDIO_SEED_PRESETS.length);
        for (const preset of STUDIO_SEED_PRESETS) {
          expect(normalizeHex(preset.hex)).toBe(preset.hex.toLowerCase());
          const result = generateStudioTheme({
            source: 'color',
            seed: preset.hex,
            contrast: 'AA',
            id: 'seed-preset-test',
            name: preset.label,
          });
          expect(result.ok).toBe(true);
        }
      }
      // features library themes that exist in the real 210-theme library
      {
        const meta = await getFullThemeLibraryMeta();
        const ids = new Set(meta.map((entry) => entry.id));
        // 210 themes as of 2026-10-26; other lanes may grow the library, but it
        // must never silently shrink under the studio's starting points.
        expect(meta.length).toBeGreaterThanOrEqual(210);
        expect(FEATURED_LIBRARY_THEMES.length).toBeLessThanOrEqual(8);
        for (const featured of FEATURED_LIBRARY_THEMES) {
          expect(ids.has(featured.id), `featured id ${featured.id} must exist`).toBe(true);
          expect(featured.category).toBeTruthy();
        }
      }
      expect(humanizeThemeId('enterprise-neutral')).toBe('Enterprise Neutral');
      expect(humanizeThemeId('okabe-blue')).toBe('Okabe Blue');
    });
  });

  describe('themeFromLibraryPayload', () => {
    it('round-trips a real library theme (also through JSON) and fails closed on junk', async () => {
      // round-trips a real library theme without losing a single role color
      {
        const source = await loadFullLibraryTheme('enterprise-neutral');
        const result = themeFromLibraryPayload(payloadOf(source));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.theme.id).toBe('theme-studio');
        expect(result.theme.name).toBe(source.name);
        for (const mode of ['light', 'dark'] as const) {
          for (const role of SEMANTIC_ROLES) {
            expect(result.theme[mode][role]?.default, `${mode}.${role}`).toBe(
              source[mode][role]?.default
            );
            expect(result.theme[mode][role]?.hover, `${mode}.${role} hover`).toBe(
              source[mode][role]?.hover
            );
            expect(result.theme[mode][role]?.active, `${mode}.${role} active`).toBe(
              source[mode][role]?.active
            );
          }
        }
      }
      // fails closed on junk instead of returning a partial theme
      {
        expect(themeFromLibraryPayload(null).ok).toBe(false);
        expect(themeFromLibraryPayload('card').ok).toBe(false);
        expect(themeFromLibraryPayload({}).ok).toBe(false);
        expect(themeFromLibraryPayload({ light: { roles: [] }, dark: { roles: [] } }).ok).toBe(
          false
        );

        const source = await loadFullLibraryTheme('enterprise-neutral');
        const payload = payloadOf(source) as { light: { roles: PayloadRole[] } };
        const [dropped, ...rest] = payload.light.roles;
        expect(dropped).toBeTruthy();
        const incomplete = themeFromLibraryPayload({ name: 'Broken', light: { roles: rest } });
        expect(incomplete.ok).toBe(false);
        if (!incomplete.ok) expect(incomplete.message).toContain('role');
      }
      // survives a JSON round trip, as a fetched theme file would
      {
        const source = await loadFullLibraryTheme('okabe-blue');
        const fetched = JSON.parse(JSON.stringify(payloadOf(source))) as unknown;
        const result = themeFromLibraryPayload(fetched, { name: 'Okabe blue (tuned here)' });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.theme.name).toBe('Okabe blue (tuned here)');
        expect(result.theme.light.primary.default).toBe(source.light.primary.default);
      }
    });
  });
});

describe('theme studio share encoding', () => {
  /**
   * T-82 — theme-as-URL share links (punch-list row 8): the recipe (seed or
   * words, contrast target, preview mode, role edits) encodes into and decodes
   * out of a `#theme=` hash entirely locally, and every broken or hostile
   * input fails closed instead of half-applying.
   */

  function baseState(overrides: Partial<StudioShareState> = {}): StudioShareState {
    return {
      source: 'color',
      seed: '#2b6ce0',
      secondary: '',
      words: 'calm ocean',
      neutral: 'zinc',
      contrast: 'AA',
      mode: 'light',
      edits: [],
      ...overrides,
    };
  }

  describe('encodeStudioShare', () => {
    it('encodes only the recipe, never image data, and refuses unlinkable states', () => {
      // produces a hash that only holds the recipe
      {
        const hash = encodeStudioShare(baseState());
        expect(hash).toMatch(/^#theme=/);
        expect(hash).toContain('s=c');
        expect(hash).toContain('seed=%232b6ce0');
        expect(hash).toContain('w=calm+ocean');
        expect(hash).toContain('m=l');
      }
      // carries role edits under r.<mode>.<role>, normalized
      {
        const hash = encodeStudioShare(
          baseState({
            edits: [
              { role: 'primary', mode: 'dark', hex: '#ABC' },
              { role: 'link', mode: 'light', hex: '#0f766e' },
            ],
          })
        );
        expect(hash).toContain('r.d.primary=%23aabbcc');
        expect(hash).toContain('r.l.link=%230f766e');
      }
      // maps an image source to the color it produced, never image data
      {
        const hash = encodeStudioShare(baseState({ source: 'image', seed: '#123456' }));
        expect(hash).not.toContain('s=i');
        expect(hash).toContain('s=c');
        expect(hash).toContain('seed=%23123456');
      }
      expect(encodeStudioShare(baseState({ contrast: 'A' as 'AA' }))).toBeNull();
      expect(encodeStudioShare(baseState({ mode: 'system' as 'light' }))).toBeNull();
      expect(
        encodeStudioShare(baseState({ words: 'x'.repeat(121), source: 'words', seed: '' }))
      ).toBeNull();
    });
  });

  describe('decodeStudioShare', () => {
    it('round-trips into a working generation and fails closed on bad links', () => {
      // round-trips the state it encoded
      {
        const state = baseState({
          secondary: '#e11d48',
          contrast: 'AAA',
          mode: 'dark',
          edits: [{ role: 'accent', mode: 'light', hex: '#7c3aed' }],
        });
        const hash = encodeStudioShare(state);
        expect(hash).toBeTruthy();
        const result = decodeStudioShare(hash as string);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.share.source).toBe('color');
        expect(result.share.seed).toBe('#2b6ce0');
        expect(result.share.secondary).toBe('#e11d48');
        expect(result.share.words).toBe('calm ocean');
        expect(result.share.neutral).toBe('zinc');
        expect(result.share.contrast).toBe('AAA');
        expect(result.share.mode).toBe('dark');
        expect(result.share.edits).toEqual([{ role: 'accent', mode: 'light', hex: '#7c3aed' }]);
      }
      // feeds a working generation when opened
      {
        const hash = encodeStudioShare(
          baseState({ words: 'warm sunset', source: 'words', seed: '' })
        );
        const result = decodeStudioShare(hash as string);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const generated = generateStudioTheme({
          source: result.share.source,
          seed: result.share.seed,
          words: result.share.words,
          contrast: result.share.contrast,
        });
        expect(generated.ok).toBe(true);
      }
      // fails closed on anything that is not a usable theme link
      {
        expect(isStudioShareHash('#other=1')).toBe(false);
        expect(decodeStudioShare('#other=1').ok).toBe(false);
        expect(decodeStudioShare('#theme=').ok).toBe(false);
        expect(decodeStudioShare('#theme=s=x&c=AA&m=l').ok).toBe(false);
        expect(decodeStudioShare('#theme=s=c&c=AA').ok).toBe(false);
        expect(decodeStudioShare('#theme=s=c&c=AA&m=x').ok).toBe(false);
        // An image recipe never travels; the link says so instead of regenerating.
        const image = decodeStudioShare('#theme=s=i&c=AA&m=l');
        expect(image.ok).toBe(false);
        if (!image.ok) expect(image.message).toMatch(/image/i);
        // Unreadable role edits refuse the whole link.
        expect(
          decodeStudioShare('#theme=s=c&seed=%23123456&c=AA&m=l&r.l.notarole=%23111111').ok
        ).toBe(false);
        expect(decodeStudioShare('#theme=s=c&seed=%23123456&c=AA&m=l&r.l.primary=zzz').ok).toBe(
          false
        );
        // A long word list cannot sneak past the cap on the way back in.
        expect(decodeStudioShare(`#theme=s=w&w=${'x'.repeat(121)}&c=AA&m=l`).ok).toBe(false);
      }
    });
  });
});

describe('theme studio share origin', () => {
  /**
   * T-84 (routed from the wave-3 interim review): a share link must rebuild the
   * theme the visitor is looking at. A theme started from the library is a
   * palette, not a seed recipe, so its link carries the library id and opening
   * it re-imports that theme (then re-applies the role edits). An image theme
   * comes from pixels that never travel in links, so it cannot be a link; the
   * studio says so instead of sharing a different theme.
   */

  const recipe: Omit<StudioShareState, 'edits'> = {
    source: 'color',
    seed: '#2b6ce0',
    secondary: '',
    words: '',
    neutral: 'zinc',
    contrast: 'AA',
    mode: 'dark',
  };

  /** The explorer payload the site serves at `/theme-data/<id>.json` (roles only). */
  function payloadOf(theme: Theme): unknown {
    const modes = ['light', 'dark'] as const;
    return {
      id: theme.id,
      name: theme.name,
      ...Object.fromEntries(
        modes.map((mode) => [
          mode,
          {
            mode,
            roles: SEMANTIC_ROLES.map((role) => {
              const value = theme[mode][role];
              return {
                role,
                default: value?.default ?? '#000000',
                ...(value?.hover ? { hover: value.hover } : {}),
                ...(value?.active ? { active: value.active } : {}),
              };
            }),
          },
        ])
      ),
    };
  }

  describe('share links rebuild the theme on screen', () => {
    it('rebuilds library and seed themes exactly, keeps image themes local, refuses hostile ids', async () => {
      // round-trips a library theme exactly, role edits included
      {
        const library = await loadFullLibraryTheme('violet');
        if (!library) throw new Error('the violet library theme must exist');
        const payload = payloadOf(library);
        const imported = themeFromLibraryPayload(payload);
        if (!imported.ok) throw new Error(imported.message);
        const edits = [{ role: 'link' as const, mode: 'light' as const, hex: '#0f766e' }];

        const state = studioShareFor({ kind: 'library', id: 'violet' }, recipe, edits);
        expect(state).not.toBeNull();
        const hash = encodeStudioShare(state as StudioShareState);
        expect(hash).toContain('lib=violet');
        const decoded = decodeStudioShare(hash ?? '');
        if (!decoded.ok) throw new Error(decoded.message);

        const requested: string[] = [];
        const opened = await themeFromShare(decoded.share, async (id) => {
          requested.push(id);
          return payload;
        });
        if (!opened.ok) throw new Error(opened.message);
        expect(requested).toEqual(['violet']);
        expect(opened.origin).toEqual({ kind: 'library', id: 'violet' });
        for (const mode of ['light', 'dark'] as const) {
          for (const role of SEMANTIC_ROLES) {
            const expected =
              mode === 'light' && role === 'link'
                ? '#0f766e'
                : roleDefault(imported.theme, mode, role);
            expect(roleDefault(opened.theme, mode, role), `${mode} ${role}`).toBe(expected);
          }
        }
      }
      expect(studioShareFor({ kind: 'image' }, recipe, [])).toBeNull();
      // shares a seed recipe as before
      {
        const state = studioShareFor({ kind: 'recipe' }, recipe, []);
        expect(state).toEqual({ ...recipe, edits: [] });
        expect(encodeStudioShare(state as StudioShareState)).not.toContain('lib=');
      }
      // fails closed on a hostile or unknown library id
      {
        for (const id of ['../secrets', 'Violet', 'a b', 'x'.repeat(65)]) {
          expect(encodeStudioShare({ ...recipe, edits: [], library: id }), id).toBeNull();
          const decoded = decodeStudioShare(`#theme=s=c&c=AA&m=l&lib=${encodeURIComponent(id)}`);
          expect(decoded.ok, id).toBe(false);
        }
        const decoded = decodeStudioShare('#theme=s=c&c=AA&m=l&lib=not-a-theme');
        if (!decoded.ok) throw new Error(decoded.message);
        const opened = await themeFromShare(decoded.share, async () => null);
        expect(opened.ok).toBe(false);
      }
    });
  });
});

describe('tool keys: bare presses', () => {
  /**
   * T-82 — the shared tool keyboard matcher (punch-list row 4): single-key
   * shortcuts fire only outside fields and never with Control, Meta or Alt,
   * so typing and browser shortcuts stay untouched on every studio island.
   */

  const KEYS = { g: 'generate', d: 'mode', c: 'copy', r: 'render', '/': 'filter', '?': 'keys' };

  function press(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
    return {
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      ...modifiers,
    } as KeyboardEvent;
  }

  describe('toolShortcut', () => {
    it('maps bare presses (Caps Lock safe), never inside a field or with modifiers', () => {
      expect(toolShortcut(press('g'), null, KEYS)).toBe('generate');
      expect(toolShortcut(press('r'), null, KEYS)).toBe('render');
      expect(toolShortcut(press('?'), null, KEYS)).toBe('keys');
      expect(toolShortcut(press('G'), null, KEYS)).toBe('generate');
      expect(toolShortcut(press('D'), null, KEYS)).toBe('mode');
      // never fires inside a field
      {
        const input = document.createElement('input');
        const textarea = document.createElement('textarea');
        const select = document.createElement('select');
        const editable = document.createElement('div');
        editable.contentEditable = 'true';
        for (const target of [input, textarea, select, editable]) {
          expect(toolShortcut(press('g'), target, KEYS)).toBeNull();
          expect(isEditableTarget(target)).toBe(true);
        }
        const button = document.createElement('button');
        expect(toolShortcut(press('g'), button, KEYS)).toBe('generate');
        expect(isEditableTarget(button)).toBe(false);
      }
      expect(toolShortcut(press('g', { ctrlKey: true }), null, KEYS)).toBeNull();
      expect(toolShortcut(press('g', { metaKey: true }), null, KEYS)).toBeNull();
      expect(toolShortcut(press('g', { altKey: true }), null, KEYS)).toBeNull();
      expect(toolShortcut(press('F6'), null, KEYS)).toBeNull();
      expect(toolShortcut(press('ArrowLeft'), null, KEYS)).toBeNull();
      expect(toolShortcut(press('z'), null, KEYS)).toBeNull();
    });
  });
});

describe('tool keys: scope (WCAG 2.1.4)', () => {
  /**
   * T-88 — WCAG 2.1.4 (Character Key Shortcuts) for the tool islands. The
   * single-key shortcuts are active only while the focus is inside the tool
   * (the "active only on focus" option of 2.1.4): a speech-input or keyboard
   * user elsewhere on the page never fires one by accident. A press another
   * handler already consumed, or one inside an ARIA widget that answers
   * printable keys itself (listbox, menu, tree, grid, combobox typeahead),
   * stays with that widget. A handled shortcut prevents the default action so
   * `/` never also types a slash into the field it focuses.
   */

  const KEYS = { g: 'generate', '/': 'filter', '?': 'keys' };

  afterEach(() => {
    document.body.replaceChildren();
  });

  function tool(): { root: HTMLElement; button: HTMLButtonElement; outside: HTMLButtonElement } {
    const root = document.createElement('div');
    const button = document.createElement('button');
    root.append(button);
    const outside = document.createElement('button');
    document.body.append(root, outside);
    return { root, button, outside };
  }

  function keydown(target: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  describe('runToolShortcut', () => {
    it('fires only for presses inside a mounted tool root, not already consumed, and prevents the default', () => {
      // fires for a press whose focus is inside the tool, and prevents the default
      {
        const { root, button } = tool();
        const run = vi.fn();
        let handled = false;
        button.addEventListener('keydown', (event) => {
          handled = runToolShortcut(event, root, KEYS, run);
        });
        const event = keydown(button, '/');
        expect(handled).toBe(true);
        expect(run).toHaveBeenCalledWith('filter');
        expect(event.defaultPrevented).toBe(true);
      }
      // stays inactive while the focus is outside the tool or on the page body
      {
        const { root, outside } = tool();
        const run = vi.fn();
        const listener = (event: KeyboardEvent) => runToolShortcut(event, root, KEYS, run);
        window.addEventListener('keydown', listener);
        const fromOutside = keydown(outside, 'g');
        const fromBody = keydown(document.body, 'g');
        window.removeEventListener('keydown', listener);
        expect(run).not.toHaveBeenCalled();
        expect(fromOutside.defaultPrevented).toBe(false);
        expect(fromBody.defaultPrevented).toBe(false);
      }
      // stays inactive when the tool root is not mounted
      {
        const { button } = tool();
        const run = vi.fn();
        button.addEventListener('keydown', (event) => runToolShortcut(event, null, KEYS, run));
        keydown(button, 'g');
        expect(run).not.toHaveBeenCalled();
      }
      // leaves a press another handler already consumed
      {
        const { root, button } = tool();
        const run = vi.fn();
        button.addEventListener('keydown', (event) => event.preventDefault());
        root.addEventListener('keydown', (event) => runToolShortcut(event, root, KEYS, run));
        keydown(button, 'g');
        expect(run).not.toHaveBeenCalled();
      }
    });
  });

  describe('toolShortcut and typeahead widgets', () => {
    it('leaves printable keys to typeahead widgets and to presses already prevented', () => {
      for (const role of ['listbox', 'menu', 'menubar', 'tree', 'treegrid', 'grid', 'combobox']) {
        const widget = document.createElement('div');
        widget.setAttribute('role', role);
        widget.tabIndex = 0;
        const item = document.createElement('div');
        item.tabIndex = -1;
        widget.append(item);
        document.body.append(widget);
        const press = { key: 'g', ctrlKey: false, metaKey: false, altKey: false };
        expect(toolShortcut(press, widget, KEYS), role).toBeNull();
        expect(toolShortcut(press, item, KEYS), role).toBeNull();
      }
      // ignores a press whose default was already prevented
      {
        const press = {
          key: 'g',
          ctrlKey: false,
          metaKey: false,
          altKey: false,
          defaultPrevented: true,
        };
        expect(toolShortcut(press, null, KEYS)).toBeNull();
      }
    });
  });

  describe('tool islands', () => {
    const islands = [
      'playground/PlaygroundApp.svelte',
      'theme-studio/DesignSystemStudio.svelte',
      'color-explorer/ColorExplorer.svelte',
    ];
    it('every tool island scopes its shortcuts to its own root', () => {
      for (const island of islands) {
        const source = readFileSync(
          join(import.meta.dirname, '..', 'src', 'components', island),
          'utf8'
        );
        expect(source).toMatch(/runToolShortcut\(event, \w+, \w+_KEYS,/);
        expect(source).not.toMatch(/\btoolShortcut\(/);
        expect(source).toMatch(/bind:this=\{toolRoot\}/);
        expect(source, island).toMatch(/while the focus is inside/);
      }
    });
  });
});

describe('design system studio label in name', () => {
  /**
   * T-88 (routed from the T-90 screen-reader pass), carried into the design
   * system studio (PLAN_011 T-ds-studio): WCAG 2.5.3 Label in Name. Every
   * text field and select is named by a visible <label for>, never by an
   * aria-label that could drift from what a speech-input user sees.
   */
  const dir = join(import.meta.dirname, '..', 'src', 'components', 'theme-studio');
  const island = readFileSync(join(dir, 'DesignSystemStudio.svelte'), 'utf8');
  const field = readFileSync(join(dir, 'StudioField.svelte'), 'utf8');

  it('labels every control of the island with a visible <label for>', () => {
    const ids = [...island.matchAll(/<(?:Input|Textarea|select|input)\b[^>]*?\sid="([^"]+)"/g)].map(
      (match) => match[1]
    );
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const id of ids) {
      expect(island, id).toMatch(new RegExp(`<label[^>]*for="${id}"`));
    }
  });

  it('names every generated field by its visible label', () => {
    expect(field).toMatch(/<label class="field__label" for=\{id\}>/);
    expect(field).not.toMatch(/aria-label=\{spec\.label\}/);
  });
});

describe('studio trust voice', () => {
  /**
   * T-82 — the studios' checkable trust sentences stay verbatim, and the
   * island sources stay free of HTML sinks.
   */

  function repoRoot(): string {
    let dir = process.cwd();
    for (;;) {
      if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
      dir = dirname(dir);
    }
  }

  function read(path: string): string {
    return readFileSync(resolve(repoRoot(), path), 'utf8');
  }

  describe('the trust voice stays verbatim (punch-list row 9)', () => {
    it('keeps the trust sentences verbatim and the island sources free of HTML sinks', () => {
      expect(read('apps/website/src/pages/theme-studio/index.astro')).toContain(
        'Nothing leaves this origin.'
      );
      expect(read('apps/website/src/pages/builder/index.astro')).toContain(
        'Drafts stay untrusted and are never activated here.'
      );
      expect(read('apps/website/src/pages/playground/index.astro')).toContain(
        'Nothing here executes agent HTML or loads remote code.'
      );
      for (const file of [
        'apps/website/src/components/theme-studio/DesignSystemStudio.svelte',
        'apps/website/src/components/theme-studio/StudioField.svelte',
        'apps/website/src/components/theme-studio/StudioPreviews.svelte',
        'apps/website/src/components/theme-studio/StudioReport.svelte',
        'apps/website/src/components/theme-studio/ComponentsEditor.svelte',
        'apps/website/src/components/playground/PlaygroundApp.svelte',
        'apps/website/src/components/builder/BuilderApp.svelte',
        'apps/website/src/components/color-explorer/ColorExplorer.svelte',
      ]) {
        expect(read(file), file).not.toMatch(/\{@html/);
      }
    });
  });
});

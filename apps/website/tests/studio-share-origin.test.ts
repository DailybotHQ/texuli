/**
 * T-84 (routed from the wave-3 interim review): a share link must rebuild the
 * theme the visitor is looking at. A theme started from the library is a
 * palette, not a seed recipe, so its link carries the library id and opening
 * it re-imports that theme (then re-applies the role edits). An image theme
 * comes from pixels that never travel in links, so it cannot be a link; the
 * studio says so instead of sharing a different theme.
 */
import { SEMANTIC_ROLES, type Theme } from '@texuli/tokens';
import { loadFullLibraryTheme } from '@texuli/tokens/library-expand';
import { describe, expect, it } from 'vitest';
import {
  decodeStudioShare,
  encodeStudioShare,
  roleDefault,
  type StudioShareState,
  studioShareFor,
  themeFromLibraryPayload,
  themeFromShare,
} from '../src/components/theme-studio/studio.ts';

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
  it('round-trips a library theme exactly, role edits included', async () => {
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
          mode === 'light' && role === 'link' ? '#0f766e' : roleDefault(imported.theme, mode, role);
        expect(roleDefault(opened.theme, mode, role), `${mode} ${role}`).toBe(expected);
      }
    }
  });

  it('keeps an image theme on this device: no link instead of a different theme', () => {
    expect(studioShareFor({ kind: 'image' }, recipe, [])).toBeNull();
  });

  it('shares a seed recipe as before', () => {
    const state = studioShareFor({ kind: 'recipe' }, recipe, []);
    expect(state).toEqual({ ...recipe, edits: [] });
    expect(encodeStudioShare(state as StudioShareState)).not.toContain('lib=');
  });

  it('fails closed on a hostile or unknown library id', async () => {
    for (const id of ['../secrets', 'Violet', 'a b', 'x'.repeat(65)]) {
      expect(encodeStudioShare({ ...recipe, edits: [], library: id }), id).toBeNull();
      const decoded = decodeStudioShare(`#theme=s=c&c=AA&m=l&lib=${encodeURIComponent(id)}`);
      expect(decoded.ok, id).toBe(false);
    }
    const decoded = decodeStudioShare('#theme=s=c&c=AA&m=l&lib=not-a-theme');
    if (!decoded.ok) throw new Error(decoded.message);
    const opened = await themeFromShare(decoded.share, async () => null);
    expect(opened.ok).toBe(false);
  });
});

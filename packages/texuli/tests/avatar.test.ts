import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/svelte';
import { contrastRatio } from '@texuli/tokens';
import { getFullThemeLibraryMeta, loadFullLibraryTheme } from '@texuli/tokens/library-expand';
import { createHighContrastPalette } from '@texuli/tokens/modes';
import { afterEach, describe, expect, it } from 'vitest';
import { avatarInitials, avatarToneIndex, hashString } from '../src/components/avatar/initials.ts';
import { AVATAR_SIZES, AVATAR_STATUSES } from '../src/components/avatar/variants.ts';
import AvatarFixture from './fixtures/AvatarFixture.svelte';

afterEach(cleanup);

describe('avatarInitials / tone', () => {
  it('builds stable initials and tone slots from names', () => {
    expect(avatarInitials('Ada Example')).toBe('AE');
    expect(avatarInitials('Bea')).toBe('B');
    expect(avatarInitials('  ')).toBe('?');
    expect(hashString('Ada')).toBe(hashString('Ada'));
    expect(avatarToneIndex('Ada Example')).toBeGreaterThanOrEqual(0);
    expect(avatarToneIndex('Ada Example')).toBeLessThan(5);
  });
});

describe('Avatar', () => {
  it('renders initials with an accessible name and every size class', () => {
    for (const size of AVATAR_SIZES) {
      const view = render(AvatarFixture, {
        props: { name: 'Ada Example', size, mode: 'single' },
      });
      const root = view.container.querySelector('[data-tx-avatar]');
      expect(root?.getAttribute('data-size')).toBe(size);
      expect(root?.className).toContain(`tx-avatar--${size}`);
      expect(root?.getAttribute('role')).toBe('img');
      expect(root?.getAttribute('aria-label')).toBe('Ada Example');
      expect(view.container.textContent).toContain('AE');
      view.unmount();
    }
  });

  it('shows a status indicator and includes it in the accessible name', () => {
    for (const status of AVATAR_STATUSES) {
      const view = render(AvatarFixture, {
        props: { name: 'Bea Harbor', status, mode: 'single' },
      });
      const root = view.container.querySelector('[data-tx-avatar]');
      expect(root?.getAttribute('data-status')).toBe(status);
      expect(root?.getAttribute('aria-label')?.toLowerCase()).toContain(
        status === 'online'
          ? 'online'
          : status === 'away'
            ? 'away'
            : status === 'busy'
              ? 'busy'
              : 'offline'
      );
      expect(view.container.querySelector('[data-tx-avatar-status]')).toBeTruthy();
      view.unmount();
    }
  });

  it('marks decorative avatars as hidden from assistive tech', () => {
    render(AvatarFixture, {
      props: { name: 'Ada Example', decorative: true, mode: 'single' },
    });
    const root = document.querySelector('[data-tx-avatar]');
    expect(root?.getAttribute('aria-hidden')).toBe('true');
    expect(root?.getAttribute('aria-label')).toBeNull();
  });

  it('rejects unsafe image schemes and keeps initials via the primitive', async () => {
    render(AvatarFixture, {
      props: {
        name: 'Ada Example',
        src: 'javascript:alert(1)',
        mode: 'single',
      },
    });
    const root = await screen.findByRole('img', { name: 'Ada Example' });
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('AE');
  });
});

describe('AvatarGroup', () => {
  it('stacks items and shows a +N overflow chip when max is set', () => {
    render(AvatarFixture, {
      props: {
        mode: 'group',
        max: 2,
        label: 'Harbor team',
        items: [
          { name: 'Ada Example' },
          { name: 'Bea Harbor' },
          { name: 'Cal Orbit' },
          { name: 'Dee Quill' },
        ],
      },
    });
    const group = screen.getByRole('group', { name: 'Harbor team' });
    expect(group.querySelectorAll('[data-tx-avatar]').length).toBe(2);
    const overflow = group.querySelector('[data-tx-avatar-group-overflow]');
    expect(overflow?.textContent).toBe('+2');
    expect(overflow?.getAttribute('aria-label')).toBe('+2');
  });
});

describe('avatar initials contrast', () => {
  const css = readFileSync(
    join(import.meta.dirname, '../src/components/avatar/avatar.css'),
    'utf8'
  );
  const screenCss = css.slice(0, css.indexOf('@media (forced-colors: active)'));

  it('paints initials only with the gated foreground-on-muted pair', () => {
    // Every surface rule outside forced colors: background is muted, text is foreground.
    const surfaceRules = [...screenCss.matchAll(/\.tx-avatar__surface[^{]*\{([^}]*)\}/g)].map(
      (m) => m[1] ?? ''
    );
    expect(surfaceRules.length).toBeGreaterThan(1);
    for (const body of surfaceRules) {
      for (const [, value] of body.matchAll(/(?<![-\w])background-color:\s*([^;]+);/g)) {
        expect(value?.trim()).toBe('var(--tx-muted, Canvas)');
      }
      for (const [, value] of body.matchAll(/(?<![-\w])color:\s*([^;]+);/g)) {
        expect(value?.trim()).toBe('var(--tx-foreground, CanvasText)');
      }
    }
    // The seeded tone never reaches the text pair (no translucent tints behind initials).
    expect(screenCss).not.toMatch(/\.tx-avatar__surface[^{]*\{[^}]*color-mix/);
  });

  it('meets 4.5:1 for foreground on muted in every library theme, light and dark, and high contrast', async () => {
    const themes = await getFullThemeLibraryMeta();
    expect(themes).toHaveLength(210);
    const failures: string[] = [];
    let checked = 0;
    for (const meta of themes) {
      const theme = await loadFullLibraryTheme(meta.id);
      for (const mode of ['light', 'dark'] as const) {
        const palette = theme[mode] as unknown as Record<string, { default: string }>;
        const foreground = palette.foreground?.default ?? '';
        const muted = palette.muted?.default ?? '';
        const ratio = contrastRatio(foreground, muted);
        checked += 1;
        if (!(ratio >= 4.5))
          failures.push(`${meta.id} ${mode}: ${foreground} on ${muted} = ${ratio.toFixed(2)}`);
      }
    }
    expect(failures).toEqual([]);
    expect(checked).toBe(420);
    // High contrast uses system colors: CanvasText on Canvas, the forced-colors pair.
    const highContrast = createHighContrastPalette() as unknown as Record<
      string,
      { default: string }
    >;
    expect(highContrast.foreground?.default).toBe('CanvasText');
    expect(highContrast.muted?.default).toBe('Canvas');
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*\.tx-avatar__surface[^{]*\{[^}]*background-color: Canvas;[^}]*color: CanvasText;/
    );
  }, 120_000);
});

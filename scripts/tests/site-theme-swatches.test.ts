// @vitest-environment node
/**
 * Theme pickers embed each theme's own palette hexes (T-site-theme-swatches).
 */
import { describe, expect, it } from 'vitest';
import { buildGalleryThemeCards } from '../../apps/website/src/components/gallery-themes/build.ts';
import { buildThemeCatalog } from '../../apps/website/src/components/theme-switcher/library.ts';

describe('theme swatch colors (own palette)', () => {
  it('buildThemeCatalog paints distinct primaries for two different themes', async () => {
    const catalog = await buildThemeCatalog();
    expect(catalog.length).toBeGreaterThan(10);
    const a = catalog.find((t) => t.id === 'harbor-teal') ?? catalog[0];
    const b =
      catalog.find((t) => t.id === 'violet') ?? catalog.find((t) => t.id !== a!.id) ?? catalog[1];
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a!.swatches.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(b!.swatches.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(a!.swatches.primary.toLowerCase()).not.toBe(b!.swatches.primary.toLowerCase());
    expect(a!.swatches.background).toBeTruthy();
    expect(a!.swatches.accent).toBeTruthy();
    expect(a!.swatches.surface).toBeTruthy();
    expect(a!.swatches.foreground).toBeTruthy();
  }, 120_000);

  it('gallery cards embed distinct light primaries for two themes', async () => {
    const cards = await buildGalleryThemeCards();
    const a = cards.find((c) => c.id === 'harbor-teal') ?? cards[0];
    const b = cards.find((c) => c.id === 'violet') ?? cards.find((c) => c.id !== a!.id);
    expect(a!.swatches.light.primary.toLowerCase()).not.toBe(
      b!.swatches.light.primary.toLowerCase()
    );
    expect(a!.swatches.dark.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
  }, 180_000);
});

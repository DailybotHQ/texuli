/**
 * The theme-aware image pair (D-G-023, `media-image-dark`): with
 * `srcDark`, the page mode (`data-tx-mode` from `?mode=`) and a forced scope
 * pick the image over the OS preference, and `darkMode="system"` follows the
 * OS alone. Each box exposes one named image.
 */
import { expect, test } from '@playwright/test';

for (const os of ['light', 'dark'] as const) {
  test(`the pair follows the theme scope over the OS preference (OS ${os})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: os });
    for (const mode of ['light', 'dark'] as const) {
      await page.goto(`/?fixture=media-image-dark&mode=${mode}`);
      const boxes = page.locator('[data-example="media-image-dark"] [data-tx-image]');
      await expect(boxes).toHaveCount(4, { timeout: 30_000 });
      await expect(page.locator('[data-example="media-image-dark"] [data-tx-theme]')).toHaveCount(
        2
      );
      const shown = await boxes.evaluateAll((nodes) =>
        nodes.map((box) =>
          [...box.querySelectorAll('img')]
            .filter((img) => getComputedStyle(img).display !== 'none')
            .map((img) => ((img.currentSrc || img.src).includes('logo-dark') ? 'dark' : 'light'))
            .join('+')
        )
      );
      // Page theme, forced dark scope, forced light scope, OS-only <picture>.
      expect(shown, `OS ${os}, page ${mode}`).toEqual([mode, 'dark', 'light', os]);
      await expect(page.getByRole('img', { name: 'Harbor Studio wordmark' })).toHaveCount(4);
    }
  });
}

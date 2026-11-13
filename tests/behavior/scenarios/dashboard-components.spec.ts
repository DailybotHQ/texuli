import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';

scenario(
  'dashboard-components',
  defineRows([
    {
      id: 'filter-chips-builder-clear',
      title:
        'applied filters are named removable chips; the builder adds conditions and clear resets them',
      async run({ page }) {
        if (!(await page.getByText('Region eq North').isVisible()))
          throw new Error('initial chip missing');
        if (!(await page.getByText('Unsaved changes').isVisible()))
          throw new Error('unsaved state missing');
        await page.getByRole('button', { name: 'Remove Region eq North' }).click();
        if (!(await page.locator('.tx-filter-bar__empty').isVisible()))
          throw new Error('remove did not clear the chip');
        await page.getByText('Add filter').click();
        const builder = page.locator('[data-tx-filter-builder]');
        if (!(await builder.isVisible())) throw new Error('add filter did not open the builder');
        await builder.getByRole('button', { name: 'Add condition' }).click();
        if (!(await builder.locator('[data-filter-path="r-0"]').isVisible()))
          throw new Error('builder did not add a condition');
        await page.locator('.tx-filter-bar__editor summary').click();
        await expect(builder).toBeHidden();
      },
    },
    {
      id: 'metric-card-states-and-a11y',
      title: 'metric cards expose the trend, an accessible sparkline, loading and empty states',
      async run({ page }) {
        const card = page.locator('[data-tx-component="data-metric-card"]').first();
        await expect(card.getByRole('heading', { name: 'Revenue' })).toBeVisible();
        await expect(card.getByText('$48,290')).toBeVisible();
        await expect(card.getByRole('img', { name: 'Revenue trend' })).toBeVisible();
        await expect(card.getByText('12%')).toBeVisible();
        await expect(page.getByText('Loading forecast'), 'loading state').toBeVisible();
        await expect(page.getByText('No data for this period')).toBeVisible();
        const axe = await new AxeBuilder({ page })
          .include('[data-tx-filter-bar]')
          .include('[data-tx-component="data-metric-card"]')
          .analyze();
        if (axe.violations.length) {
          throw new Error(
            `accessibility violations: ${axe.violations.map((violation) => `${violation.id} (${violation.nodes.length})`).join(', ')}`
          );
        }
      },
    },
    {
      id: 'metric-card-loading-text-keeps-aa-contrast',
      title: 'loading text keeps AA contrast at the pulse minimum in light and dark',
      projects: ['chromium', 'webkit'],
      isolate: true,
      async run({ page }) {
        const loading = page.getByText('Loading forecast');
        await expect(loading).toBeVisible();
        for (const scheme of ['light', 'dark'] as const) {
          await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'no-preference' });
          const result = await loading.evaluate((element) => {
            const animation = element
              .getAnimations()
              .find((candidate) =>
                candidate.effect?.getKeyframes().some((frame) => Number(frame.opacity) < 1)
              );
            let lowestOpacity = 1;
            if (animation) {
              const opacities =
                animation.effect
                  ?.getKeyframes()
                  .map((frame) => Number(frame.opacity))
                  .filter(Number.isFinite) ?? [];
              if (opacities.length > 0) lowestOpacity = Math.min(...opacities);
              // Apply the animation's lowest keyframe directly so sampling
              // does not depend on where axe or the browser lands in the cycle.
              (element as HTMLElement).style.animation = 'none';
              (element as HTMLElement).style.opacity = String(lowestOpacity);
            }

            const rgb = (value: string) => {
              const channels = value.match(/[\d.]+/g)?.map(Number);
              if (!channels || channels.length < 3) throw new Error(`Unexpected color: ${value}`);
              return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0];
            };
            const color = getComputedStyle(element).color;
            const background = getComputedStyle(element.parentElement!).backgroundColor;
            const opacity = Number(getComputedStyle(element).opacity);
            const fg = rgb(color);
            const bg = rgb(background);
            const colorChannels = color.match(/[\d.]+/g)?.map(Number) ?? [];
            const alpha = colorChannels.length >= 4 ? (colorChannels[3] ?? 1) : 1;
            const effective = fg.map((channel, index) => {
              const under = bg[index] ?? 0;
              return channel * alpha * opacity + under * (1 - alpha * opacity);
            });
            const luminance = (channels: number[]) => {
              const linear = channels.map((channel) => {
                const value = channel / 255;
                return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
              });
              return (
                0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0)
              );
            };
            const foreground = luminance(effective);
            const backgroundLuminance = luminance(bg);
            const ratio =
              (Math.max(foreground, backgroundLuminance) + 0.05) /
              (Math.min(foreground, backgroundLuminance) + 0.05);
            return { ratio, opacity, color, background };
          });
          expect(
            result.ratio,
            `${scheme} loading text contrast at opacity ${result.opacity} (${result.color} on ${result.background})`
          ).toBeGreaterThanOrEqual(4.5);
        }
      },
    },
  ])
);

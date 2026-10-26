// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source guards for the T-75 layouts & shells audit.
 * Skip-target regions (tabindex="-1" focused by the skip link) must keep a
 * visible :focus-visible ring; shells need a forced-colors block; settings
 * list chevrons flip under RTL.
 */

const layoutsRoot = join(process.cwd(), 'packages/texuli/src/layouts');

const css = (path: string) => readFileSync(join(layoutsRoot, path), 'utf8');

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|[\\s}])${escaped}\\s*\\{([^}]*)\\}`).exec(source);
  if (!match?.[1]) throw new Error(`no rule for ${selector}`);
  return match[1];
}

/** The forced-colors media block of a stylesheet (from its first occurrence). */
function forcedColors(source: string): string {
  const index = source.indexOf('@media (forced-colors: active)');
  if (index === -1) throw new Error('no forced-colors block');
  return source.slice(index);
}

describe('layouts audit CSS guards (T-75)', () => {
  it('AppShell main shows a focus ring when the skip link focuses it', () => {
    const source = css('shells/shells.css');
    const focus = rule(source, '.tx-app-shell__main:focus-visible');
    expect(focus).toMatch(/outline:\s*2px solid var\(--tx-ring,\s*Highlight\)/);
  });

  it('shells.css keeps frame chrome visible under forced colors', () => {
    const forced = forcedColors(css('shells/shells.css'));
    expect(forced).toMatch(/\.tx-app-shell__command-bar/);
    expect(forced).toMatch(/CanvasText|ButtonText|Highlight/);
  });

  it('app layout screen (skip target) shows a focus ring on keyboard focus', () => {
    const source = css('app/app.css');
    const focus = rule(source, '.tx-app-layout__screen:focus-visible');
    expect(focus).toMatch(/outline:\s*2px solid var\(--tx-ring,\s*Highlight\)/);
  });

  it('mobile layout main (skip target) shows a focus ring on keyboard focus', () => {
    const source = css('mobile/mobile.css');
    const focus = rule(source, '.tx-mobile-layout__main:focus-visible');
    expect(focus).toMatch(/outline:\s*2px solid var\(--tx-ring,\s*Highlight\)/);
  });

  it('dashboard main (skip target) shows a focus ring on keyboard focus', () => {
    const source = css('dashboard/dashboard.css');
    const focus = rule(source, '.tx-layout-dashboard__main:focus-visible');
    expect(focus).toMatch(/outline:\s*2px solid var\(--tx-ring,\s*Highlight\)/);
  });

  it('settings detail title shows a focus ring after list→detail focus move', () => {
    const source = css('auth-settings/auth-settings.css');
    const focus = rule(source, '.tx-settings-layout__detail-title:focus-visible');
    expect(focus).toMatch(/outline:\s*2px solid var\(--tx-ring,\s*Highlight\)/);
  });

  it('settings list chevrons flip under RTL', () => {
    const source = css('auth-settings/auth-settings.css');
    expect(source).toMatch(
      /\.tx-settings-layout:dir\(rtl\)\s+\.tx-settings-layout__chevron\s*\{[^}]*transform:\s*scaleX\(-1\)/
    );
  });

  it('layout family stylesheets use no physical left/right inset properties', () => {
    const files = [
      'shells/shells.css',
      'app/app.css',
      'mobile/mobile.css',
      'dashboard/dashboard.css',
      'marketing/marketing.css',
      'auth-settings/auth-settings.css',
      'content/content.css',
      'host/host.css',
    ];
    for (const file of files) {
      const source = css(file);
      expect(source, file).not.toMatch(/(?<![-\w])(left|right)\s*:/);
      expect(source, file).not.toMatch(/(margin|padding|border)-(left|right)\s*:/);
    }
  });

  it('layout family stylesheets keep colors on --tx-* tokens (no bare hex)', () => {
    const files = [
      'shells/shells.css',
      'app/app.css',
      'mobile/mobile.css',
      'dashboard/dashboard.css',
      'marketing/marketing.css',
      'auth-settings/auth-settings.css',
      'content/content.css',
      'host/host.css',
    ];
    for (const file of files) {
      const source = css(file);
      // Strip comments so hex in docs does not trip the guard.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
      const bareHex =
        code.match(/(?<![\w-])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g) ?? [];
      expect(bareHex, file).toEqual([]);
    }
  });
});

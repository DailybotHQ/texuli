import type { LayoutOptions } from '../host/contract.ts';

/**
 * Strings the mobile layouts render. Layout options are flat data, so apps
 * translate them (and set the screen title) through `options`:
 * `title`, `backLabel`, `moreLabel`, `tabsLabel`, `menuLabel`, `closeLabel`,
 * `homeLabel` and `moreCurrentLabel`.
 */
export interface MobileLabels {
  /** The app's title for the current screen (a detail screen's name). */
  title: string | undefined;
  back: string;
  more: string;
  moreCurrent: string;
  tabs: string;
  menu: string;
  close: string;
  home: string;
}

/** The English defaults (ids `texuli.mobile-layout.<key>`), translated through the catalog in context. */
export const DEFAULT_MOBILE_LABELS: Readonly<Omit<MobileLabels, 'title'>> = Object.freeze({
  back: 'Back',
  more: 'More',
  moreCurrent: '(contains the current page)',
  tabs: 'Primary',
  menu: 'Open navigation',
  close: 'Close',
  home: 'Home',
});

function read(options: LayoutOptions | undefined, key: string, fallback: string): string {
  const value = options?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

export function mobileLabels(
  options: LayoutOptions | undefined,
  defaults: Readonly<Omit<MobileLabels, 'title'>> = DEFAULT_MOBILE_LABELS
): MobileLabels {
  const title = options?.title;
  return {
    title: typeof title === 'string' && title.trim() !== '' ? title : undefined,
    back: read(options, 'backLabel', defaults.back),
    more: read(options, 'moreLabel', defaults.more),
    moreCurrent: read(options, 'moreCurrentLabel', defaults.moreCurrent),
    tabs: read(options, 'tabsLabel', defaults.tabs),
    menu: read(options, 'menuLabel', defaults.menu),
    close: read(options, 'closeLabel', defaults.close),
    home: read(options, 'homeLabel', defaults.home),
  };
}

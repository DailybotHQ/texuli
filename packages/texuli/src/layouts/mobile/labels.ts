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

function read(options: LayoutOptions | undefined, key: string, fallback: string): string {
  const value = options?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

export function mobileLabels(options: LayoutOptions | undefined): MobileLabels {
  const title = options?.title;
  return {
    title: typeof title === 'string' && title.trim() !== '' ? title : undefined,
    back: read(options, 'backLabel', 'Back'),
    more: read(options, 'moreLabel', 'More'),
    moreCurrent: read(options, 'moreCurrentLabel', '(contains the current page)'),
    tabs: read(options, 'tabsLabel', 'Primary'),
    menu: read(options, 'menuLabel', 'Open navigation'),
    close: read(options, 'closeLabel', 'Close'),
    home: read(options, 'homeLabel', 'Home'),
  };
}

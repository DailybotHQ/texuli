import { ICON_NAMES, type IconName } from './types.ts';

const ICON_PATHS: Readonly<Record<IconName, string>> = {
  check: 'm5 12 4 4L19 6',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-right': 'm9 18 6-6-6-6',
  close: 'm18 6-12 12M6 6l12 12',
  info: 'M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  minus: 'M5 12h14',
  plus: 'M12 5v14m-7-7h14',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm6-2 4 4',
  warning:
    'M12 9v4m0 4h.01M10.3 3.86 1.82 18.14A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-2.86L13.7 3.86a2 2 0 0 0-3.4 0Z',
};

export function isIconName(value: string): value is IconName {
  return (ICON_NAMES as readonly string[]).includes(value);
}

export function iconPath(name: IconName): string {
  return ICON_PATHS[name];
}

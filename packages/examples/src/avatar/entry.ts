import { defineExample } from '../registry.ts';

const component = 'texuli/Avatar';

export const avatarExamples = [
  defineExample({
    id: 'ui-avatar',
    title: 'Avatar',
    description:
      'Styled avatars with initials, presence status and a stacked group with overflow. Fictional Harbor names only.',
    tags: ['ui', 'avatar', 'a11y'],
    component,
    props: ['name', 'src', 'size', 'status', 'max'],
    load: () => import('./AvatarDefaultDemo.svelte'),
  }),
  defineExample({
    id: 'ui-avatar-variants',
    title: 'Avatar sizes',
    description: 'Every avatar size from xs to lg on the token contract.',
    tags: ['ui', 'avatar', 'variant'],
    component,
    props: ['size'],
    load: () => import('./AvatarVariantsDemo.svelte'),
  }),
  defineExample({
    id: 'ui-avatar-states',
    title: 'Avatar states',
    description: 'Presence dots, unsafe src fallback and decorative pairing.',
    tags: ['ui', 'avatar', 'states'],
    component,
    props: ['status', 'src', 'decorative'],
    load: () => import('./AvatarStatesDemo.svelte'),
  }),
  defineExample({
    id: 'ui-avatar-rtl',
    title: 'Avatar, right to left',
    description: 'Arabic labels and stacked group in a right-to-left layout.',
    tags: ['ui', 'avatar', 'rtl', 'i18n'],
    component,
    load: () => import('./AvatarRtlDemo.svelte'),
  }),
  defineExample({
    id: 'ui-avatar-dark',
    title: 'Avatar on a dark surface',
    description: 'Avatars and groups on the dark theme using only token colors.',
    tags: ['ui', 'avatar', 'dark'],
    component,
    load: () => import('./AvatarDarkDemo.svelte'),
  }),
] as const;

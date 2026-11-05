import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './avatar.css';

export const AVATAR_SIZES = ['xs', 'sm', 'md', 'lg'] as const;
export type AvatarSize = (typeof AVATAR_SIZES)[number];

export const AVATAR_STATUSES = ['online', 'away', 'busy', 'offline'] as const;
export type AvatarStatus = (typeof AVATAR_STATUSES)[number];

/** CSS pixel size for the image width/height attributes (avoids layout shift). */
export const AVATAR_PIXELS: Record<AvatarSize, number> = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
};

export const avatarRootClass = variants({
  base: 'tx-avatar',
  variants: {
    size: {
      xs: 'tx-avatar--xs',
      sm: 'tx-avatar--sm',
      md: 'tx-avatar--md',
      lg: 'tx-avatar--lg',
    },
  },
  defaultVariants: { size: 'md' },
});

export const avatarGroupClass = variants({
  base: 'tx-avatar-group',
  variants: {
    size: {
      xs: 'tx-avatar-group--xs',
      sm: 'tx-avatar-group--sm',
      md: 'tx-avatar-group--md',
      lg: 'tx-avatar-group--lg',
    },
  },
  defaultVariants: { size: 'md' },
});

export const avatarStatusClass = variants({
  base: 'tx-avatar__status',
  variants: {
    status: {
      online: 'tx-avatar__status--online',
      away: 'tx-avatar__status--away',
      busy: 'tx-avatar__status--busy',
      offline: 'tx-avatar__status--offline',
    },
  },
});

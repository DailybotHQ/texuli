import type { HrefTrust } from '@texuli/core/url-policy';
import type { AvatarStatus } from './variants.ts';

export type AvatarGroupItem = {
  name: string;
  src?: string | null;
  srcTrust?: HrefTrust;
  /** Responsive candidates, each through the URL policy at `srcTrust`. */
  srcset?: string | null;
  sizes?: string;
  status?: AvatarStatus;
  decorative?: boolean;
};

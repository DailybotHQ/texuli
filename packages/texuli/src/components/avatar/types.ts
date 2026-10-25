import type { HrefTrust } from '@texuli/core/url-policy';
import type { AvatarStatus } from './variants.ts';

export type AvatarGroupItem = {
  name: string;
  src?: string | null;
  srcTrust?: HrefTrust;
  status?: AvatarStatus;
  decorative?: boolean;
};

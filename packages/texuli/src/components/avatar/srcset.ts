import { filterImageSrcset, type HrefTrust } from '@texuli/core/url-policy';

/**
 * Filter an avatar `srcset` candidate by candidate: `filterImageSrcset` from
 * `@texuli/core/url-policy`, which the `Avatar.Image` primitive uses too.
 * Every candidate URL goes through the image URL policy at `trust`; a refused
 * or malformed candidate (or one whose URL holds a comma) is dropped and the
 * rest are kept. Candidates keep the descriptor kind of the first kept one
 * (`x` or `w`), since a srcset cannot mix them. Returns `undefined` when
 * nothing is left.
 */
export function avatarSrcset(
  value: string | null | undefined,
  trust: HrefTrust = 'untrusted'
): string | undefined {
  return filterImageSrcset(value, trust);
}

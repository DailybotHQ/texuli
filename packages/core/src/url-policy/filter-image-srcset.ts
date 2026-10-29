import type { HrefTrust } from '../url/safe-href.ts';
import { safeImageSrcset } from './safe-image-srcset.ts';

/**
 * Split a `srcset` into candidates the way the HTML parser reads it: a URL is
 * a run of non-whitespace (so a `data:` URL may hold commas), trailing commas
 * end it, and descriptors run to the next comma.
 */
function candidates(value: string): { url: string; descriptors: string }[] {
  const out: { url: string; descriptors: string }[] = [];
  let index = 0;
  while (index < value.length) {
    while (index < value.length && /[\s,]/.test(value[index] ?? '')) index += 1;
    if (index >= value.length) break;
    let end = index;
    while (end < value.length && !/\s/.test(value[end] ?? '')) end += 1;
    let url = value.slice(index, end);
    index = end;
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '');
      out.push({ url, descriptors: '' });
      continue;
    }
    let close = index;
    while (close < value.length && value[close] !== ',') close += 1;
    out.push({ url, descriptors: value.slice(index, close).trim() });
    index = close + 1;
  }
  return out;
}

/**
 * Filter an image `srcset` candidate by candidate, where `safeImageSrcset`
 * refuses the whole value. Every candidate URL goes through the image URL
 * policy (`safeImageSrc`) at `trust`; a refused or malformed candidate (or one
 * whose URL holds a comma) is dropped and the rest are kept. Candidates keep
 * the descriptor kind of the first kept one (`x` or `w`), since a srcset
 * cannot mix them. Returns `undefined` when nothing is left, so a caller can
 * drop `sizes` with it.
 */
export function filterImageSrcset(
  value: unknown,
  trust: HrefTrust = 'untrusted'
): string | undefined {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 16_384) return undefined;
  const kept: string[] = [];
  let kind: 'density' | 'width' | undefined;
  for (const { url, descriptors } of candidates(value)) {
    if (url === '' || url.includes(',')) continue;
    const candidate = safeImageSrcset(descriptors ? `${url} ${descriptors}` : url, trust);
    if (candidate === undefined) continue;
    const candidateKind = descriptors.endsWith('w') ? 'width' : 'density';
    kind ??= candidateKind;
    if (candidateKind !== kind) continue;
    kept.push(candidate);
  }
  return kept.length > 0 ? safeImageSrcset(kept.join(', '), trust) : undefined;
}

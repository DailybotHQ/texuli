import type { HrefTrust } from '../url/safe-href.ts';
import { safeImageSrc } from './safe-image-src.ts';
import { resolveTrust } from './trust.ts';

type DescriptorKind = 'density' | 'width';

/**
 * Validate every URL and descriptor in an image `srcset`. Candidates use the
 * standard comma-separated URL plus optional `x` or `w` descriptor form. If
 * any part is malformed or unsafe, the entire value returns `undefined`.
 */
export function safeImageSrcset(
  value: unknown,
  requested: HrefTrust = 'untrusted'
): string | undefined {
  const trust = resolveTrust(requested);
  if (typeof value !== 'string' || value.trim() === '' || value.length > 16_384) return undefined;
  const candidates = value.split(',').map((candidate) => candidate.trim());
  if (candidates.length === 0 || candidates.some((candidate) => candidate === '')) return undefined;

  let kind: DescriptorKind | undefined;
  const normalized: string[] = [];
  for (const candidate of candidates) {
    const parts = candidate.split(/\s+/);
    if (parts.length < 1 || parts.length > 2) return undefined;
    const [url, descriptor] = parts;
    if (!url || !safeImageSrc(url, trust)) return undefined;

    if (descriptor) {
      const descriptorKind: DescriptorKind = descriptor.endsWith('w') ? 'width' : 'density';
      if (kind && kind !== descriptorKind) return undefined;
      kind = descriptorKind;
      const rawNumber = descriptor.slice(0, -1);
      const number = Number(rawNumber);
      if (!Number.isFinite(number) || number <= 0) return undefined;
      if (
        descriptorKind === 'width' &&
        (!/^\d+w$/.test(descriptor) || !Number.isSafeInteger(number))
      )
        return undefined;
      if (descriptorKind === 'density' && !/^(?:\d+(?:\.\d+)?|\.\d+)x$/.test(descriptor))
        return undefined;
    } else {
      if (kind === 'width') return undefined;
      kind = 'density';
    }
    normalized.push(parts.join(' '));
  }
  return normalized.join(', ');
}

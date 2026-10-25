import type {
  FileDropRejection,
  FileDropValidationOptions,
  FileDropValidationResult,
} from './types.ts';

/** Match a File against the extension and MIME patterns supported by `accept`. */
export function matchesFileAccept(file: File, accept?: string): boolean {
  const tokens = accept
    ?.split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens?.length || tokens.includes('*/*')) return true;

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return token.length > 1 && name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

/** Validate file metadata only; contents are never opened or interpreted. */
export function validateFiles(
  incoming: Iterable<File>,
  options: FileDropValidationOptions = {}
): FileDropValidationResult {
  const {
    accept,
    maxSize,
    maxFiles = Number.POSITIVE_INFINITY,
    currentCount = 0,
    multiple = true,
  } = options;

  if (maxSize !== undefined && (!Number.isFinite(maxSize) || maxSize < 0)) {
    throw new RangeError('maxSize must be a non-negative number');
  }
  if (maxFiles !== Number.POSITIVE_INFINITY && (!Number.isSafeInteger(maxFiles) || maxFiles < 0)) {
    throw new RangeError('maxFiles must be a non-negative integer');
  }
  if (!Number.isSafeInteger(currentCount) || currentCount < 0) {
    throw new RangeError('currentCount must be a non-negative integer');
  }

  const accepted: File[] = [];
  const rejected: FileDropRejection[] = [];
  let remaining = multiple
    ? Math.max(0, maxFiles - currentCount)
    : currentCount > 0
      ? 0
      : Math.min(1, maxFiles);

  for (const file of incoming) {
    let reason: FileDropRejection['reason'] | undefined;
    if (remaining <= 0) reason = 'count';
    else if (!matchesFileAccept(file, accept)) reason = 'type';
    else if (maxSize !== undefined && file.size > maxSize) reason = 'size';

    if (reason) {
      rejected.push({ file, reason });
      continue;
    }
    accepted.push(file);
    remaining -= 1;
  }

  return { accepted, rejected };
}

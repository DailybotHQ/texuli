import { NATIVE_COMPATIBILITY } from '../../../../data/native/compatibility.ts';

export const NATIVE_MATRIX_VERSION = NATIVE_COMPATIBILITY.specVersion;
export const NATIVE_MATRIX_TOTALS = NATIVE_COMPATIBILITY.totals;
export const NATIVE_MATRIX_PLATFORMS = NATIVE_COMPATIBILITY.platforms;

export function nativeMatrixKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const NATIVE_MATRIX_ROWS = NATIVE_COMPATIBILITY.components.map((component) => ({
  ...component,
  statuses: [component.web, component.composeDesktop, component.conformance].map(nativeMatrixKey),
}));

export const NATIVE_MATRIX_GROUPS = [...new Set(NATIVE_MATRIX_ROWS.map(({ group }) => group))].sort(
  (a, b) => a.localeCompare(b)
);

export const NATIVE_MATRIX_STATUSES = [
  'Supported',
  'Partial',
  'Experimental',
  'Planned',
  'Unsupported',
  'Not applicable',
] as const;

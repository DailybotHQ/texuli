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

/** The full matrix lives on its own static route; /native/ links it from the summary. */
export const NATIVE_MATRIX_ROUTE = '/native/compatibility/';

export interface NativeMatrixGroupCount {
  readonly group: string;
  readonly total: number;
  /** Components that paint in Compose Desktop (supported or partial). */
  readonly painted: number;
  /** Components with a checked-in conformance trace. */
  readonly traced: number;
}

/** Per-group counts for the /native/ summary, derived from the generated rows. */
export const NATIVE_MATRIX_GROUP_COUNTS: readonly NativeMatrixGroupCount[] =
  NATIVE_MATRIX_GROUPS.map((group) => {
    const rows = NATIVE_MATRIX_ROWS.filter((row) => row.group === group);
    return {
      group,
      total: rows.length,
      painted: rows.filter((row) => row.composeDesktop !== 'Unsupported').length,
      traced: rows.filter((row) => row.evidence.traces.length > 0).length,
    };
  });

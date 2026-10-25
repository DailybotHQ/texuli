/** Plain, serializable lineage metadata for media assets and exports. */
export type MediaProvenanceSource = 'upload' | 'programmatic-export' | 'model' | 'static';
export type MediaGeneratorKind = 'image' | 'video';
export type MediaGenerationOptionValue = string | number | boolean;
export type MediaGenerationOptions = Readonly<Record<string, MediaGenerationOptionValue>>;

type ProvenanceLineage = {
  parentAssetId?: string;
  contentSha256?: string;
};

type GeneratedMediaProvenance = ProvenanceLineage & {
  source: 'model';
  createdAt: string;
  generatorKind: MediaGeneratorKind;
  /** Model-free host/provider label, such as `host:mock`. Never a credential. */
  providerLabel: string;
  promptHash: string;
  options: MediaGenerationOptions;
};

type NonGeneratedMediaProvenance = ProvenanceLineage & {
  source: Exclude<MediaProvenanceSource, 'model'>;
  createdAt: string;
};

export type MediaProvenance = GeneratedMediaProvenance | NonGeneratedMediaProvenance;

export interface CompositionProvenanceEntry {
  layerId: string;
  provenance: MediaProvenance;
}

const HASH_PATTERN = /^[a-f\d]{64}$/i;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PROVIDER_LABEL_PATTERN = /^[a-z][a-z0-9-]{0,30}:[a-z0-9][a-z0-9._-]{0,63}$/i;
const OPTION_KEY_PATTERN = /^[a-z][a-zA-Z0-9_-]{0,31}$/;
const SENSITIVE_OPTION_KEY = /(?:prompt|secret|token|api[-_]?key|credential)/i;
const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/;
const MAX_OPTIONS = 16;
const MAX_OPTION_STRING = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isIsoTimestamp(value: string): boolean {
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;
  const [
    ,
    yearPart,
    monthPart,
    dayPart,
    hourPart,
    minutePart,
    secondPart,
    ,
    ,
    offsetHour,
    offsetMinute,
  ] = match;
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const second = Number(secondPart);
  const timezoneHour = Number(offsetHour ?? 0);
  const timezoneMinute = Number(offsetMinute ?? 0);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDay = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return (
    Number.isFinite(Date.parse(value)) &&
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= maxDay &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    timezoneHour <= 14 &&
    timezoneMinute <= 59 &&
    (timezoneHour !== 14 || timezoneMinute === 0)
  );
}

/** Normalize bounded, JSON-safe generator options; reject keys that could hold prompt or secrets. */
export function normalizeMediaGenerationOptions(
  value: unknown
): MediaGenerationOptions | undefined {
  if (value === undefined) return {};
  if (!isRecord(value) || Object.keys(value).length > MAX_OPTIONS) return undefined;
  const options: Record<string, MediaGenerationOptionValue> = {};
  for (const key of Object.keys(value).sort()) {
    const option = value[key];
    if (!OPTION_KEY_PATTERN.test(key) || SENSITIVE_OPTION_KEY.test(key)) return undefined;
    if (typeof option === 'string') {
      if (option.length > MAX_OPTION_STRING) return undefined;
      options[key] = option;
    } else if (typeof option === 'boolean') {
      options[key] = option;
    } else if (typeof option === 'number' && Number.isFinite(option)) {
      options[key] = option;
    } else {
      return undefined;
    }
  }
  return options;
}

/** Validate and copy media provenance; unknown fields and incomplete model records fail closed. */
export function parseMediaProvenance(value: unknown): MediaProvenance | undefined {
  if (!isRecord(value)) return undefined;
  const allowed = [
    'source',
    'createdAt',
    'generatorKind',
    'providerLabel',
    'promptHash',
    'options',
    'parentAssetId',
    'contentSha256',
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return undefined;
  if (
    typeof value.source !== 'string' ||
    !['upload', 'programmatic-export', 'model', 'static'].includes(value.source) ||
    typeof value.createdAt !== 'string' ||
    value.createdAt.length > 40 ||
    !isIsoTimestamp(value.createdAt)
  ) {
    return undefined;
  }

  const lineage: ProvenanceLineage = {};
  for (const field of ['parentAssetId'] as const) {
    if (value[field] === undefined) continue;
    if (typeof value[field] !== 'string' || !ID_PATTERN.test(value[field])) return undefined;
    lineage[field] = value[field];
  }
  for (const field of ['contentSha256'] as const) {
    if (value[field] === undefined) continue;
    if (typeof value[field] !== 'string' || !HASH_PATTERN.test(value[field])) return undefined;
    lineage[field] = value[field];
  }

  if (value.source !== 'model') {
    if (
      value.generatorKind !== undefined ||
      value.providerLabel !== undefined ||
      value.promptHash !== undefined ||
      value.options !== undefined
    ) {
      return undefined;
    }
    return {
      source: value.source as NonGeneratedMediaProvenance['source'],
      createdAt: value.createdAt,
      ...lineage,
    };
  }

  const options = normalizeMediaGenerationOptions(value.options);
  if (
    (value.generatorKind !== 'image' && value.generatorKind !== 'video') ||
    typeof value.providerLabel !== 'string' ||
    !PROVIDER_LABEL_PATTERN.test(value.providerLabel) ||
    typeof value.promptHash !== 'string' ||
    !HASH_PATTERN.test(value.promptHash) ||
    value.options === undefined ||
    options === undefined
  ) {
    return undefined;
  }
  return {
    source: 'model',
    createdAt: value.createdAt,
    generatorKind: value.generatorKind,
    providerLabel: value.providerLabel,
    promptHash: value.promptHash,
    options,
    ...lineage,
  };
}

/** Preserve image-layer provenance as sidecar metadata on composition export results. */
export function collectCompositionProvenance(
  layers: readonly { id: string; type: string; provenance?: MediaProvenance }[]
): CompositionProvenanceEntry[] {
  return layers.flatMap((layer) =>
    layer.type === 'image' && layer.provenance
      ? [{ layerId: layer.id, provenance: layer.provenance }]
      : []
  );
}

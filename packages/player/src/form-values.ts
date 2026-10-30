/**
 * Action values for a `schema-form` submission (spec 0.8.0). Action intents
 * carry scalars, so scalars pass as they are, a list answer (multiselect,
 * tags) travels as JSON array text, and a file answer as the JSON list of
 * its file names: the player has no upload channel, uploads are the
 * host's. Empty (`null`) answers are left out.
 */
export function formActionValues(
  values: Readonly<Record<string, unknown>>
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [name, value] of Object.entries(values)) {
    let entry: string | number | boolean | undefined;
    if (Array.isArray(value)) {
      entry = JSON.stringify(
        value.map((item: unknown) =>
          typeof item === 'string'
            ? item
            : typeof item === 'object' &&
                item !== null &&
                typeof (item as { name?: unknown }).name === 'string'
              ? (item as { name: string }).name
              : ''
        )
      );
    } else if (typeof value === 'string' || typeof value === 'boolean') {
      entry = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      entry = value;
    }
    if (entry !== undefined) {
      Object.defineProperty(out, name, {
        value: entry,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
  return out;
}

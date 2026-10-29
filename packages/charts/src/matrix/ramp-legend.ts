/**
 * Strings of the ramp legend's accessible name. Hosts pass translations;
 * English is the default. `{label}`, `{min}` and `{max}` are replaced as
 * plain text (never markup).
 */
export interface RampLegendLabels {
  /** Both ends known: "Weekly volume, color scale from 0 to 120". */
  range: string;
  /** No end values: "Weekly volume, color scale". */
  scale: string;
}

export const RAMP_LEGEND_LABELS: Readonly<RampLegendLabels> = /* @__PURE__ */ Object.freeze({
  range: '{label}, color scale from {min} to {max}',
  scale: '{label}, color scale',
});

/** Merges host overrides over the English defaults; non-string overrides are ignored. */
export function rampLegendLabels(overrides: Partial<RampLegendLabels> = {}): RampLegendLabels {
  return {
    range: typeof overrides.range === 'string' ? overrides.range : RAMP_LEGEND_LABELS.range,
    scale: typeof overrides.scale === 'string' ? overrides.scale : RAMP_LEGEND_LABELS.scale,
  };
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(label|min|max)\}/g, (_, key: string) => values[key] ?? '');

/**
 * The legend's accessible name: the label, then either the host's
 * `description` or the range sentence (the scale sentence when an end is
 * missing).
 */
export function rampLegendText(
  labels: RampLegendLabels,
  label: string,
  min: string,
  max: string,
  description?: string
): string {
  if (description) return `${label}, ${description}`;
  return fill(min && max ? labels.range : labels.scale, { label, min, max });
}

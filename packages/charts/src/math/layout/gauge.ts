/*
 * Gauge geometry in the same angle convention as `arcPath`: radians, 0 at
 * 12 o'clock, clockwise. Default sweep is 270° (−135° … +135°).
 */

export interface GaugeBand {
  index: number;
  from: number;
  to: number;
  startAngle: number;
  endAngle: number;
}

export interface GaugeLayout {
  /** Value clamped to [min, max]; NaN becomes min. */
  value: number;
  /** 0…1 along the sweep. */
  ratio: number;
  /** Angle of the value (needle or end of the value arc). */
  angle: number;
  track: { startAngle: number; endAngle: number };
  valueArc: { startAngle: number; endAngle: number };
  /** Threshold bands from min to max, e.g. ok / warning / critical. */
  bands: GaugeBand[];
  /** Index of the band holding the value. */
  band: number;
}

export interface GaugeOptions {
  min?: number;
  max?: number;
  startAngle?: number;
  endAngle?: number;
  /** Inner band edges between min and max, e.g. `[60, 85]` for three bands. */
  thresholds?: readonly number[];
}

export function gaugeLayout(value: number, options: GaugeOptions = {}): GaugeLayout {
  const min = options.min ?? 0;
  const max = options.max ?? 100;
  if (!(max > min)) throw new RangeError('gaugeLayout(): max must be greater than min');
  const startAngle = options.startAngle ?? -0.75 * Math.PI;
  const endAngle = options.endAngle ?? 0.75 * Math.PI;
  const angleOf = (v: number) => startAngle + ((v - min) / (max - min)) * (endAngle - startAngle);
  const clamped = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  const edges = [
    min,
    ...[...new Set(options.thresholds ?? [])]
      .filter((t) => t > min && t < max)
      .sort((a, b) => a - b),
    max,
  ];
  const bands = edges.slice(0, -1).map((from, index) => {
    const to = edges[index + 1] as number;
    return { index, from, to, startAngle: angleOf(from), endAngle: angleOf(to) };
  });
  const band = Math.max(
    0,
    bands.findIndex((b) => clamped < b.to || b.index === bands.length - 1)
  );
  const angle = angleOf(clamped);
  return {
    value: clamped,
    ratio: (clamped - min) / (max - min),
    angle,
    track: { startAngle, endAngle },
    valueArc: { startAngle, endAngle: angle },
    bands,
    band,
  };
}

export interface GaugeLabelSizes {
  /** Value label font size and baseline, in the SVG's user units. */
  value: { fontSize: number; y: number };
  /** Band label font size and baseline, in user units. */
  band: { fontSize: number; y: number };
}

/**
 * The center labels' size and position, in the gauge's own user units, so
 * they scale with it (the SVG `viewBox` is the diameter). At the default
 * 144-unit gauge drawn at 12rem, the value reads at about 27 px (between the
 * `2xl` and `3xl` type steps) and the band label at about 14 px (the `sm`
 * step). A size in `em` would resolve against the page font (16 px) before
 * the viewBox scales it, which made the labels about 3 px tall.
 */
export function gaugeLabelSizes(diameter: number): GaugeLabelSizes {
  const valueSize = diameter * 0.14;
  const bandSize = diameter * 0.075;
  return {
    // Centered in the open middle; the band label sits below with a gap.
    value: { fontSize: valueSize, y: valueSize * 0.35 },
    band: { fontSize: bandSize, y: valueSize * 0.35 + bandSize * 1.6 },
  };
}

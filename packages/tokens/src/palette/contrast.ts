/** Parse the deliberately small, deterministic sRGB hex input contract. */
export function parseHex(color: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  let hex = match[1] as string;
  if (hex.length === 3) hex = [...hex].map((channel) => channel + channel).join('');
  return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function linearize(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance for an sRGB hex color. */
export function relativeLuminance(color: string): number {
  const rgb = parseHex(color);
  if (!rgb) throw new TypeError(`relativeLuminance(): expected #rgb or #rrggbb, got "${color}"`);
  const [red, green, blue] = rgb.map(linearize) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG 2.x contrast ratio (1–21) for two sRGB hex colors. */
export function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  const [lighter, darker] = fg > bg ? [fg, bg] : [bg, fg];
  return (lighter + 0.05) / (darker + 0.05);
}

function mixHex(color: string, toward: string, amount: number): string | null {
  const source = parseHex(color);
  const target = parseHex(toward);
  if (!source || !target) return null;
  return `#${source
    .map((channel, index) =>
      Math.round(channel + ((target[index] as number) - channel) * amount)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}

/** A visible hover fill that preserves at least 4.5:1 against its text. */
export function hoverFill(fill: string, text: string): string {
  if (!parseHex(fill) || !parseHex(text)) return fill;
  const candidates = ['#000000', '#ffffff']
    .map((target) => mixHex(fill, target, 0.14) as string)
    .map((color) => ({
      color,
      ratio: contrastRatio(color, text),
      delta: Math.abs(relativeLuminance(color) - relativeLuminance(fill)),
    }))
    .filter(({ ratio, delta }) => ratio >= 4.5 && delta >= 0.01);
  candidates.sort((a, b) => b.ratio - a.ratio);
  return candidates[0]?.color ?? fill;
}

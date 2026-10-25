export interface OklchColor {
  l: number;
  c: number;
  h: number;
  a: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function hexToRgb(hex: string): [number, number, number, number] | undefined {
  const value = hex.trim().replace(/^#/, '');
  if (!/^(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) return undefined;
  const expanded = value.length <= 4 ? [...value].map((part) => part + part).join('') : value;
  const red = Number.parseInt(expanded.slice(0, 2), 16) / 255;
  const green = Number.parseInt(expanded.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(expanded.slice(4, 6), 16) / 255;
  const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
  return [red, green, blue, alpha];
}

function linearize(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function encode(value: number): number {
  const bounded = clamp(value, 0, 1);
  return bounded <= 0.0031308 ? bounded * 12.92 : 1.055 * bounded ** (1 / 2.4) - 0.055;
}

export function parseColor(input: string): OklchColor | undefined {
  const hex = hexToRgb(input);
  if (!hex) return undefined;
  const [red = 0, green = 0, blue = 0, a = 1] = hex;
  const r = linearize(red);
  const g = linearize(green);
  const b = linearize(blue);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const axisA = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const axisB = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
  return {
    l: clamp(lightness, 0, 1),
    c: Math.hypot(axisA, axisB),
    h: ((Math.atan2(axisB, axisA) * 180) / Math.PI + 360) % 360,
    a,
  };
}

function toRgb({ l, c, h }: OklchColor): [number, number, number] {
  const angle = ((h % 360) * Math.PI) / 180;
  const axisA = c * Math.cos(angle);
  const axisB = c * Math.sin(angle);
  const lRoot = l + 0.3963377774 * axisA + 0.2158037573 * axisB;
  const mRoot = l - 0.1055613458 * axisA - 0.0638541728 * axisB;
  const sRoot = l - 0.0894841775 * axisA - 1.291485548 * axisB;
  const ll = lRoot ** 3;
  const mm = mRoot ** 3;
  const ss = sRoot ** 3;
  return [
    encode(4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss),
    encode(-1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss),
    encode(-0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss),
  ];
}

export function colorToHex(color: OklchColor): string {
  let chroma = clamp(color.c, 0, 0.5);
  let rgb = toRgb({ ...color, c: chroma });
  // Binary-search the chroma down until the color is in the sRGB gamut.
  if (rgb.some((channel) => channel < 0 || channel > 1)) {
    let low = 0;
    let high = chroma;
    for (let step = 0; step < 16; step += 1) {
      chroma = (low + high) / 2;
      rgb = toRgb({ ...color, c: chroma });
      if (rgb.some((channel) => channel < 0 || channel > 1)) high = chroma;
      else low = chroma;
    }
    rgb = toRgb({ ...color, c: low });
  }
  const channels = rgb.map((channel) => Math.round(clamp(channel, 0, 1) * 255));
  const alpha = Math.round(clamp(color.a, 0, 1) * 255);
  const base = `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  return alpha === 255 ? base : `${base}${alpha.toString(16).padStart(2, '0')}`;
}

export function formatColor(color: OklchColor, format: ColorFormat): string {
  if (format === 'oklch') {
    const alpha = color.a < 1 ? ` / ${Number(color.a.toFixed(3))}` : '';
    return `oklch(${Number(color.l.toFixed(3))} ${Number(color.c.toFixed(3))} ${Math.round(color.h % 360)}${alpha})`;
  }
  const [r, g, b] = toRgb(color).map((channel) => Math.round(channel * 255));
  if (format === 'rgb')
    return `rgb(${r} ${g} ${b}${color.a < 1 ? ` / ${Number(color.a.toFixed(3))}` : ''})`;
  if (format === 'hsl') {
    const red = (r ?? 0) / 255;
    const green = (g ?? 0) / 255;
    const blue = (b ?? 0) / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    const lightness = (max + min) / 2;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    const hue =
      delta === 0
        ? 0
        : delta === red
          ? ((green - blue) / delta) % 6
          : delta === green
            ? (blue - red) / delta + 2
            : (red - green) / delta + 4;
    const h = Math.round((hue * 60 + 360) % 360);
    const s = Math.round(saturation * 100);
    const l = Math.round(lightness * 100);
    return `hsl(${h} ${s}% ${l}%${color.a < 1 ? ` / ${Number(color.a.toFixed(3))}` : ''})`;
  }
  return colorToHex(color);
}

export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';

export function parseFormattedColor(input: string): OklchColor | undefined {
  const value = input.trim();
  const hex = parseColor(value);
  if (hex) return hex;
  const oklch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/i.exec(value);
  if (oklch) {
    const [, lText, cText, hText, aText] = oklch;
    const l = Number(lText);
    const c = Number(cText);
    const h = Number(hText);
    const a = aText === undefined ? 1 : Number(aText);
    if (
      [l, c, h, a].every(Number.isFinite) &&
      l >= 0 &&
      l <= 1 &&
      c >= 0 &&
      c <= 0.5 &&
      a >= 0 &&
      a <= 1
    ) {
      return { l, c, h: ((h % 360) + 360) % 360, a };
    }
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s*\/\s*([\d.]+))?\s*\)$/i.exec(
    value
  );
  if (rgb) {
    const [, redText, greenText, blueText, alphaText] = rgb;
    const channels = [Number(redText), Number(greenText), Number(blueText)];
    const alpha = alphaText === undefined ? 1 : Number(alphaText);
    if (channels.every((channel) => channel >= 0 && channel <= 255) && alpha >= 0 && alpha <= 1) {
      return parseColor(
        `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}${
          alpha < 1
            ? Math.round(alpha * 255)
                .toString(16)
                .padStart(2, '0')
            : ''
        }`
      );
    }
  }
  const hsl = /^hsla?\(\s*([\d.]+)\s+(\d{1,3})%\s+(\d{1,3})%(?:\s*\/\s*([\d.]+))?\s*\)$/i.exec(
    value
  );
  if (hsl) {
    const [, hueText, saturationText, lightnessText, alphaText] = hsl;
    const hue = Number(hueText);
    const saturation = Number(saturationText) / 100;
    const lightness = Number(lightnessText) / 100;
    const alpha = alphaText === undefined ? 1 : Number(alphaText);
    if (
      [hue, saturation, lightness, alpha].every(Number.isFinite) &&
      saturation <= 1 &&
      lightness <= 1 &&
      alpha <= 1
    ) {
      const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
      const section = (((hue % 360) + 360) % 360) / 60;
      const x = chroma * (1 - Math.abs((section % 2) - 1));
      const [red, green, blue] =
        section < 1
          ? [chroma, x, 0]
          : section < 2
            ? [x, chroma, 0]
            : section < 3
              ? [0, chroma, x]
              : section < 4
                ? [0, x, chroma]
                : section < 5
                  ? [x, 0, chroma]
                  : [chroma, 0, x];
      const m = lightness - chroma / 2;
      return parseColor(
        `#${[red, green, blue]
          .map((channel) =>
            Math.round((channel + m) * 255)
              .toString(16)
              .padStart(2, '0')
          )
          .join('')}${
          alpha < 1
            ? Math.round(alpha * 255)
                .toString(16)
                .padStart(2, '0')
            : ''
        }`
      );
    }
  }
  return undefined;
}

export function withArea(color: OklchColor, lightness: number, chroma: number): OklchColor {
  return { ...color, l: clamp(lightness, 0, 1), c: clamp(chroma, 0, 0.4) };
}

export function withHue(color: OklchColor, hue: number): OklchColor {
  return { ...color, h: ((hue % 360) + 360) % 360 };
}

export function withAlpha(color: OklchColor, alpha: number): OklchColor {
  return { ...color, a: clamp(alpha, 0, 1) };
}

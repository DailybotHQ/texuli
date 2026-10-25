/**
 * Hex colors mixed in OKLCH, so a fade between two hues stays vivid and even
 * instead of passing through gray as an sRGB mix does. Alpha mixes linearly.
 * Framework-free and small on purpose: the media package does not pull the
 * token palette engine in for this.
 */

const HEX = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;

/** `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`, as the composition model accepts. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

type Rgba = [number, number, number, number];
type Lch = { l: number; c: number; h: number; alpha: number };

function parseHex(hex: string): Rgba {
  let body = hex.slice(1);
  if (body.length <= 4) body = [...body].map((digit) => digit + digit).join('');
  const channel = (at: number) => Number.parseInt(body.slice(at, at + 2), 16) / 255;
  return [channel(0), channel(2), channel(4), body.length === 8 ? channel(6) : 1];
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function toLch([r, g, b, alpha]: Rgba): Lch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h, alpha };
}

/** Linear sRGB from OKLCH, unclamped (may fall outside 0–1 when out of gamut). */
function toLinearRgb({ l: L, c, h }: Lch): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: readonly number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

function toHex(color: Lch): string {
  // Out of gamut: keep lightness and hue, reduce chroma until it fits.
  let rgb = toLinearRgb(color);
  if (!inGamut(rgb)) {
    let low = 0;
    let high = color.c;
    for (let i = 0; i < 16; i += 1) {
      const mid = (low + high) / 2;
      if (inGamut(toLinearRgb({ ...color, c: mid }))) low = mid;
      else high = mid;
    }
    rgb = toLinearRgb({ ...color, c: low });
  }
  const byte = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  const hex = `#${rgb.map((v) => byte(toGamma(Math.min(1, Math.max(0, v))))).join('')}`;
  return color.alpha >= 1 ? hex : `${hex}${byte(color.alpha)}`;
}

/** Below this chroma a color has no meaningful hue (white, gray, black). */
const ACHROMATIC = 0.002;

/**
 * Mixes two hex colors in OKLCH at `t` (0 gives `from`, 1 gives `to`): the hue
 * takes the shorter way round, a gray end borrows the other end's hue, and
 * alpha mixes linearly. Returns `#rrggbb`, or `#rrggbbaa` when not opaque.
 */
export function mixOklch(from: string, to: string, t: number): string {
  const amount = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  const a = toLch(parseHex(from));
  const b = toLch(parseHex(to));
  if (a.c < ACHROMATIC) a.h = b.h;
  if (b.c < ACHROMATIC) b.h = a.h;
  let delta = b.h - a.h;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  const h = (a.h + delta * amount + 360) % 360;
  return toHex({
    l: a.l + (b.l - a.l) * amount,
    c: a.c + (b.c - a.c) * amount,
    h,
    alpha: a.alpha + (b.alpha - a.alpha) * amount,
  });
}

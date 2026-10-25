import type { Theme } from '../contract/types.ts';
import { oklchToHex, rgbToOklch } from '../palette/oklch.ts';
import { generateThemeFromSeed, type ThemeFromSeedOptions } from './seed.ts';

/** RGBA pixels, as `ImageData` holds them (4 bytes per pixel). */
export interface PixelSource {
  data: ArrayLike<number>;
}

export interface DominantColor {
  /** The average color of the cluster, `#rrggbb`. */
  color: string;
  /** Share of the counted (opaque, sampled) pixels, 0–1. */
  weight: number;
  /** OKLCH chroma of the color: near 0 for whites, grays and blacks. */
  chroma: number;
}

export interface DominantColorOptions {
  /** Most colors to return. Defaults to 5. */
  count?: number;
  /** Pixels at or below this alpha (0–255) are ignored. Defaults to 127. */
  alphaThreshold?: number;
  /** Pixels sampled at most, evenly spaced, so big images stay fast. Defaults to 20,000. */
  maxSamples?: number;
}

/**
 * The dominant colors of an image's pixels, most common first. Pixels are
 * binned at 4 bits per channel (4,096 bins); each bin keeps its average
 * color, and bins closer than a small OKLCH distance to a stronger one are
 * merged into it. Transparent pixels are ignored. The result depends only on
 * the pixels, so the same image always gives the same colors.
 */
export function dominantColors(
  pixels: PixelSource,
  options: DominantColorOptions = {}
): DominantColor[] {
  const { count = 5, alphaThreshold = 127, maxSamples = 20_000 } = options;
  const total = Math.floor(pixels.data.length / 4);
  const stride = Math.max(1, Math.ceil(total / maxSamples));
  const bins = new Map<number, [number, number, number, number]>();
  let counted = 0;
  for (let p = 0; p < total; p += stride) {
    const i = p * 4;
    if ((pixels.data[i + 3] ?? 255) <= alphaThreshold) continue;
    const r = pixels.data[i] ?? 0;
    const g = pixels.data[i + 1] ?? 0;
    const b = pixels.data[i + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? [0, 0, 0, 0];
    bin[0] += r;
    bin[1] += g;
    bin[2] += b;
    bin[3]++;
    bins.set(key, bin);
    counted++;
  }
  // Strongest bins first; ties break on the bin key, so the order never depends on the Map.
  const ranked = [...bins.entries()].sort((a, b) => b[1][3] - a[1][3] || a[0] - b[0]);
  const clusters: { lab: [number, number, number]; sum: [number, number, number]; n: number }[] =
    [];
  for (const [, [r, g, b, n]] of ranked) {
    const { l, c, h } = rgbToOklch([r / n, g / n, b / n]);
    const lab: [number, number, number] = [
      l,
      c * Math.cos((h * Math.PI) / 180),
      c * Math.sin((h * Math.PI) / 180),
    ];
    const near = clusters.find(
      (cluster) =>
        Math.hypot(cluster.lab[0] - lab[0], cluster.lab[1] - lab[1], cluster.lab[2] - lab[2]) < 0.08
    );
    if (near) {
      near.sum[0] += r;
      near.sum[1] += g;
      near.sum[2] += b;
      near.n += n;
    } else {
      clusters.push({ lab, sum: [r, g, b], n });
    }
  }
  return clusters
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map(({ sum, n }) => {
      const color = rgbToOklch([sum[0] / n, sum[1] / n, sum[2] / n]);
      return { color: oklchToHex(color), weight: n / Math.max(1, counted), chroma: color.c };
    });
}

/**
 * The seed (and secondary) a theme takes from an image: the dominant color
 * with the most `weight × chroma`, so a large white or gray background does
 * not win over the image's real colors, then the next one at least 30° of hue
 * away. An image with no color (a gray photo) gives a gray seed.
 */
export function seedsFromColors(colors: readonly DominantColor[]): {
  seed: string;
  secondary?: string;
} {
  if (colors.length === 0)
    throw new TypeError('The image has no opaque pixels to take colors from.');
  const chromatic = colors.filter((color) => color.chroma >= 0.04);
  if (chromatic.length === 0) return { seed: (colors[0] as DominantColor).color };
  const score = (color: DominantColor) => color.weight * (0.25 + color.chroma);
  const [seed, ...rest] = [...chromatic].sort((a, b) => score(b) - score(a)) as [
    DominantColor,
    ...DominantColor[],
  ];
  const hue = (color: string) => rgbToOklch(hexRgb(color)).h;
  const seedHue = hue(seed.color);
  const second = rest.find((color) => {
    const delta = Math.abs(hue(color.color) - seedHue) % 360;
    return Math.min(delta, 360 - delta) >= 30;
  });
  return second ? { seed: seed.color, secondary: second.color } : { seed: seed.color };
}

function hexRgb(color: string): [number, number, number] {
  return [1, 3, 5].map((at) => Number.parseInt(color.slice(at, at + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** A theme from an image's pixels (see `dominantColors` and `seedsFromColors`). */
export function generateThemeFromImage(
  pixels: PixelSource,
  options: Omit<ThemeFromSeedOptions, 'seed' | 'secondary'> & DominantColorOptions = {}
): Theme {
  const { count, alphaThreshold, maxSamples, ...theme } = options;
  const seeds = seedsFromColors(
    dominantColors(pixels, {
      ...(count === undefined ? {} : { count }),
      ...(alphaThreshold === undefined ? {} : { alphaThreshold }),
      ...(maxSamples === undefined ? {} : { maxSamples }),
    })
  );
  return generateThemeFromSeed({ ...theme, ...seeds });
}

/**
 * Reads the pixels of an image that is already loaded in the page (an `<img>`
 * from a file the user picked, a canvas, an `ImageBitmap`), scaled down to at
 * most `maxSide` pixels a side. It draws on a canvas from `document`: nothing
 * is fetched. A cross-origin image without CORS taints the canvas, and this
 * throws instead of returning pixels.
 */
export function readImagePixels(
  image: CanvasImageSource & {
    width: number | SVGAnimatedLength;
    height: number | SVGAnimatedLength;
  },
  document: Document,
  maxSide = 96
): ImageData {
  const size = (value: number | SVGAnimatedLength) =>
    typeof value === 'number' ? value : value.baseVal.value;
  const width = (image as HTMLImageElement).naturalWidth || size(image.width);
  const height = (image as HTMLImageElement).naturalHeight || size(image.height);
  if (!width || !height)
    throw new TypeError('The image has no size yet: wait until it has loaded.');
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new TypeError('This browser cannot read image pixels (no 2D canvas).');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  try {
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    throw new TypeError('The image is cross-origin without CORS, so its pixels cannot be read.');
  }
}

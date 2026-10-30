/** Font stacks use installed system fonts; loading an optional font is explicit and same-origin. */
export interface FontPairing {
  readonly id: string;
  readonly label: string;
  readonly category:
    | 'system'
    | 'humanist'
    | 'geometric'
    | 'grotesk'
    | 'editorial'
    | 'rounded'
    | 'condensed'
    | 'mono';
  readonly fontFamily: string;
  readonly fontFamilyHeading: string;
  readonly fontFamilyMono: string;
}

const system = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export const FONT_CATALOG = [
  {
    id: 'system',
    label: 'System',
    category: 'system',
    fontFamily: system,
    fontFamilyHeading: system,
    fontFamilyMono: mono,
  },
  {
    id: 'humanist',
    label: 'Humanist',
    category: 'humanist',
    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
    fontFamilyHeading: '"Trebuchet MS", "Segoe UI", sans-serif',
    fontFamilyMono: mono,
  },
  {
    id: 'geometric',
    label: 'Geometric',
    category: 'geometric',
    fontFamily: '"Avenir Next", Avenir, "Century Gothic", sans-serif',
    fontFamilyHeading: '"Avenir Next", Avenir, "Century Gothic", sans-serif',
    fontFamilyMono: mono,
  },
  {
    id: 'grotesk',
    label: 'Grotesk',
    category: 'grotesk',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontFamilyHeading: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontFamilyMono: mono,
  },
  {
    id: 'editorial',
    label: 'Editorial serif',
    category: 'editorial',
    fontFamily: system,
    fontFamilyHeading: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
    fontFamilyMono: mono,
  },
  {
    id: 'rounded',
    label: 'Rounded',
    category: 'rounded',
    fontFamily: '"Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", sans-serif',
    fontFamilyHeading: '"Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", sans-serif',
    fontFamilyMono: mono,
  },
  {
    id: 'condensed',
    label: 'Condensed',
    category: 'condensed',
    fontFamily: '"Arial Narrow", "Roboto Condensed", "Liberation Sans Narrow", sans-serif',
    fontFamilyHeading: '"Arial Narrow", "Roboto Condensed", "Liberation Sans Narrow", sans-serif',
    fontFamilyMono: mono,
  },
  {
    id: 'mono',
    label: 'Monospace',
    category: 'mono',
    fontFamily: system,
    fontFamilyHeading: system,
    fontFamilyMono: mono,
  },
] as const satisfies readonly FontPairing[];

export function getFontPairing(id: string): FontPairing | undefined {
  return FONT_CATALOG.find((font) => font.id === id);
}

export interface SelfHostedVariableFont {
  family: string;
  /** Same-origin `.woff2` URL, commonly an asset imported by the consumer's bundler. */
  src: string;
  weight?: string;
  style?: 'normal' | 'italic';
}

/** Load an optional same-origin font only when requested; no network or import-time work occurs. */
export async function loadVariableFont(
  asset: SelfHostedVariableFont,
  target?: Document
): Promise<FontFace> {
  if (!asset.family.trim()) throw new TypeError('A font family name is required');
  const documentTarget = target ?? globalThis.document;
  if (!documentTarget) {
    throw new Error(
      'A document is required to register a font; pass the target document explicitly.'
    );
  }
  const baseUrl = new URL(documentTarget.baseURI);
  const url = new URL(asset.src, baseUrl);
  if (url.origin !== baseUrl.origin || !url.pathname.toLowerCase().endsWith('.woff2')) {
    throw new TypeError('Variable fonts must use a same-origin .woff2 asset URL');
  }
  const face = new FontFace(asset.family, `url(${JSON.stringify(url.href)})`, {
    display: 'swap',
    style: asset.style ?? 'normal',
    weight: asset.weight ?? '100 900',
  });
  await face.load();
  documentTarget.fonts.add(face);
  return face;
}

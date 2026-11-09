/** Closed CSS policy for prototypes checked against a locked design system. */

export const LOCKED_CSS_CODES = [
  'css-utility-not-allowed',
  'css-arbitrary-value',
  'css-property-not-allowed',
  'css-literal-color',
  'css-inline-style',
  'css-dynamic-class',
] as const;
export type LockedCssCode = (typeof LOCKED_CSS_CODES)[number];

export interface LockedCssIssue {
  readonly code: LockedCssCode;
  readonly path: string;
  readonly value: string;
  readonly message: string;
}
export interface LockedCssReport {
  readonly ok: boolean;
  readonly codes: LockedCssCode[];
  readonly errors: LockedCssIssue[];
}

const spacing = Array.from({ length: 13 }, (_, index) => String(index));
const dimension = [
  ...spacing,
  'auto',
  'full',
  'min',
  'max',
  'fit',
  'screen',
  '1/2',
  '1/3',
  '2/3',
  '1/4',
  '3/4',
];
const utilityRules: Record<string, readonly string[]> = {
  display: [
    'block',
    'inline',
    'inline-block',
    'flex',
    'inline-flex',
    'grid',
    'inline-grid',
    'hidden',
  ],
  flexDirection: ['flex-row', 'flex-row-reverse', 'flex-col', 'flex-col-reverse'],
  flexWrap: ['flex-wrap', 'flex-wrap-reverse', 'flex-nowrap'],
  flexSizing: [
    'flex-1',
    'flex-auto',
    'flex-initial',
    'flex-none',
    'grow',
    'grow-0',
    'shrink',
    'shrink-0',
    'basis-auto',
    'basis-full',
    'basis-0',
    ...spacing.map((n) => `basis-${n}`),
  ],
  grid: [
    ...Array.from({ length: 12 }, (_, i) => `grid-cols-${i + 1}`),
    ...Array.from({ length: 12 }, (_, i) => `grid-rows-${i + 1}`),
    'grid-flow-row',
    'grid-flow-col',
    'grid-flow-dense',
    'grid-flow-row-dense',
    'grid-flow-col-dense',
    ...Array.from({ length: 12 }, (_, i) => `col-span-${i + 1}`),
    ...Array.from({ length: 12 }, (_, i) => `row-span-${i + 1}`),
    'col-span-full',
    'row-span-full',
  ],
  alignment: [
    'items-start',
    'items-end',
    'items-center',
    'items-baseline',
    'items-stretch',
    'justify-normal',
    'justify-start',
    'justify-end',
    'justify-center',
    'justify-between',
    'justify-around',
    'justify-evenly',
    'justify-stretch',
    'justify-items-start',
    'justify-items-end',
    'justify-items-center',
    'justify-items-stretch',
    'content-normal',
    'content-start',
    'content-end',
    'content-center',
    'content-between',
    'content-around',
    'content-evenly',
    'content-baseline',
    'content-stretch',
    'self-auto',
    'self-start',
    'self-end',
    'self-center',
    'self-stretch',
    'self-baseline',
    'place-items-start',
    'place-items-end',
    'place-items-center',
    'place-items-stretch',
    'place-content-start',
    'place-content-end',
    'place-content-center',
    'place-content-between',
    'place-content-around',
    'place-content-evenly',
    'place-content-stretch',
    'place-self-auto',
    'place-self-start',
    'place-self-end',
    'place-self-center',
    'place-self-stretch',
    'order-first',
    'order-last',
    'order-none',
    ...Array.from({ length: 13 }, (_, i) => `order-${i}`),
  ],
  spacing: [
    ...[
      'p',
      'px',
      'py',
      'pt',
      'pe',
      'pb',
      'ps',
      'pl',
      'pr',
      'm',
      'mx',
      'my',
      'mt',
      'me',
      'mb',
      'ms',
      'ml',
      'mr',
      'gap',
      'gap-x',
      'gap-y',
      'space-x',
      'space-y',
    ].flatMap((prefix) => spacing.map((n) => `${prefix}-${n}`)),
    ...['m', 'mx', 'my', 'mt', 'me', 'mb', 'ms', 'ml', 'mr'].map((prefix) => `${prefix}-auto`),
  ],
  sizing: [
    ...['w', 'h', 'min-w', 'min-h', 'max-w', 'max-h', 'size'].flatMap((prefix) =>
      dimension.map((n) => `${prefix}-${n}`)
    ),
  ],
  position: [
    'static',
    'fixed',
    'absolute',
    'relative',
    'sticky',
    ...['inset', 'inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end'].flatMap(
      (prefix) => [...spacing.map((n) => `${prefix}-${n}`), `${prefix}-auto`, `${prefix}-full`]
    ),
  ],
  overflow: [
    'overflow-auto',
    'overflow-hidden',
    'overflow-clip',
    'overflow-visible',
    'overflow-scroll',
    'overflow-x-auto',
    'overflow-x-hidden',
    'overflow-x-clip',
    'overflow-x-visible',
    'overflow-x-scroll',
    'overflow-y-auto',
    'overflow-y-hidden',
    'overflow-y-clip',
    'overflow-y-visible',
    'overflow-y-scroll',
  ],
  zIndex: ['z-auto', 'z-0', 'z-10', 'z-20', 'z-30', 'z-40', 'z-50', 'z-60', 'z-70'],
  accessibility: ['sr-only', 'not-sr-only'],
};

/** Owner-approved layout utilities, represented as data so the policy is auditable. */
export const LOCKED_LAYOUT_UTILITY_RULES: Readonly<Record<string, readonly string[]>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(utilityRules).map(([key, values]) => [key, Object.freeze(values)])
    )
  );
const allowedUtilities = new Set(Object.values(LOCKED_LAYOUT_UTILITY_RULES).flat());
const spaceToken = /^var\(--tx-space-(?:[0-9]|1[0-2])\)$/;
const dimensionToken = /^var\(--tx-size-(?:control|icon|target)-(?:xs|sm|md|lg|min|touch)\)$/;
const zToken = /^var\(--tx-z-(?:base|sticky|popover|tooltip|overlay|modal|toast|top)\)$/;
const commonValues = new Set([
  '0',
  'none',
  'auto',
  'normal',
  'initial',
  'inherit',
  'unset',
  'revert',
  'min-content',
  'max-content',
  'fit-content',
  '100%',
  '100vh',
  '100vw',
]);
const propertyValues: Readonly<Record<string, (value: string) => boolean>> = Object.freeze({
  display: (v) =>
    /^(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|none|contents)$/.test(v),
  'flex-direction': (v) => /^(?:row|row-reverse|column|column-reverse)$/.test(v),
  'flex-wrap': (v) => /^(?:wrap|wrap-reverse|nowrap)$/.test(v),
  'flex-grow': (v) => /^(?:0|1)$/.test(v),
  'flex-shrink': (v) => /^(?:0|1)$/.test(v),
  flex: (v) => /^(?:none|auto|initial|1)$/.test(v),
  'flex-basis': (v) => commonValues.has(v) || spaceToken.test(v) || dimensionToken.test(v),
  'grid-template-columns': (v) =>
    /^(?:repeat\((?:1[0-2]|[1-9]),\s*minmax\(0,\s*1fr\)\)|none)$/.test(v),
  'grid-template-rows': (v) =>
    /^(?:repeat\((?:1[0-2]|[1-9]),\s*minmax\(0,\s*1fr\)\)|none)$/.test(v),
  'grid-column': (v) => /^(?:span (?:1[0-2]|[1-9])|1 \/ -1|auto)$/.test(v),
  'grid-row': (v) => /^(?:span (?:1[0-2]|[1-9])|1 \/ -1|auto)$/.test(v),
  'grid-auto-flow': (v) => /^(?:row|column|dense|row dense|column dense)$/.test(v),
  'align-items': (v) => /^(?:start|end|center|baseline|stretch)$/.test(v),
  'align-self': (v) => /^(?:auto|start|end|center|stretch|baseline)$/.test(v),
  'justify-content': (v) => /^(?:normal|start|end|center|between|around|evenly|stretch)$/.test(v),
  'justify-items': (v) => /^(?:start|end|center|stretch)$/.test(v),
  'justify-self': (v) => /^(?:auto|start|end|center|stretch)$/.test(v),
  'place-items': (v) => /^(?:start|end|center|stretch|baseline)$/.test(v),
  'place-content': (v) => /^(?:start|end|center|between|around|evenly|stretch|baseline)$/.test(v),
  'place-self': (v) => /^(?:auto|start|end|center|stretch)$/.test(v),
  order: (v) => /^(?:0|[1-9]|1[0-2])$/.test(v),
  gap: (v) => spaceToken.test(v) || v === '0',
  'row-gap': (v) => spaceToken.test(v) || v === '0',
  'column-gap': (v) => spaceToken.test(v) || v === '0',
  padding: (v) => spaceToken.test(v) || v === '0',
  'padding-inline': (v) => spaceToken.test(v) || v === '0',
  'padding-block': (v) => spaceToken.test(v) || v === '0',
  'padding-inline-start': (v) => spaceToken.test(v) || v === '0',
  'padding-inline-end': (v) => spaceToken.test(v) || v === '0',
  'padding-block-start': (v) => spaceToken.test(v) || v === '0',
  'padding-block-end': (v) => spaceToken.test(v) || v === '0',
  margin: (v) => spaceToken.test(v) || v === '0' || v === 'auto',
  'margin-inline': (v) => spaceToken.test(v) || v === '0' || v === 'auto',
  'margin-block': (v) => spaceToken.test(v) || v === '0' || v === 'auto',
  'margin-inline-start': (v) => spaceToken.test(v) || v === '0' || v === 'auto',
  'margin-inline-end': (v) => spaceToken.test(v) || v === '0' || v === 'auto',
  'margin-block-start': (v) => spaceToken.test(v) || v === '0' || v === 'auto',
  'margin-block-end': (v) => spaceToken.test(v) || v === '0' || v === 'auto',
  width: (v) => commonValues.has(v) || spaceToken.test(v) || dimensionToken.test(v),
  height: (v) => commonValues.has(v) || spaceToken.test(v) || dimensionToken.test(v),
  'min-width': (v) => commonValues.has(v) || spaceToken.test(v) || dimensionToken.test(v),
  'min-height': (v) => commonValues.has(v) || spaceToken.test(v) || dimensionToken.test(v),
  'max-width': (v) => commonValues.has(v) || spaceToken.test(v) || dimensionToken.test(v),
  'max-height': (v) => commonValues.has(v) || spaceToken.test(v) || dimensionToken.test(v),
  position: (v) => /^(?:static|fixed|absolute|relative|sticky)$/.test(v),
  inset: (v) => commonValues.has(v) || spaceToken.test(v),
  'inset-inline': (v) => commonValues.has(v) || spaceToken.test(v),
  'inset-block': (v) => commonValues.has(v) || spaceToken.test(v),
  'inset-inline-start': (v) => commonValues.has(v) || spaceToken.test(v),
  'inset-inline-end': (v) => commonValues.has(v) || spaceToken.test(v),
  'inset-block-start': (v) => commonValues.has(v) || spaceToken.test(v),
  'inset-block-end': (v) => commonValues.has(v) || spaceToken.test(v),
  top: (v) => commonValues.has(v) || spaceToken.test(v),
  right: (v) => commonValues.has(v) || spaceToken.test(v),
  bottom: (v) => commonValues.has(v) || spaceToken.test(v),
  left: (v) => commonValues.has(v) || spaceToken.test(v),
  overflow: (v) => /^(?:auto|hidden|clip|visible|scroll)$/.test(v),
  'overflow-x': (v) => /^(?:auto|hidden|clip|visible|scroll)$/.test(v),
  'overflow-y': (v) => /^(?:auto|hidden|clip|visible|scroll)$/.test(v),
  'z-index': (v) => zToken.test(v),
});

const report = (errors: LockedCssIssue[]): LockedCssReport => {
  const bounded = errors.slice(0, 64);
  return {
    ok: bounded.length === 0,
    codes: [...new Set(bounded.map((e) => e.code))].sort(),
    errors: bounded,
  };
};
const issue = (
  code: LockedCssCode,
  path: string,
  value: string,
  message: string
): LockedCssIssue => ({ code, path, value, message });

export function checkLockedClassList(classList: string, path = '<class>'): LockedCssReport {
  const errors: LockedCssIssue[] = [];
  for (const token of classList.trim().split(/\s+/).filter(Boolean)) {
    if (/[[\]{}]/.test(token))
      errors.push(
        issue(
          'css-arbitrary-value',
          path,
          token,
          'Arbitrary utility values are not allowed in locked mode.'
        )
      );
    else if (!allowedUtilities.has(token))
      errors.push(
        issue(
          'css-utility-not-allowed',
          path,
          token,
          'Utility is outside the locked layout-only allowlist.'
        )
      );
  }
  return report(errors);
}

function cssDeclarations(css: string, path: string): LockedCssIssue[] {
  const errors: LockedCssIssue[] = [];
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of cleaned.matchAll(/@import\b[^;]*;?/gi))
    errors.push(
      issue(
        'css-property-not-allowed',
        `${path}:${match.index ?? 0}`,
        match[0],
        'External CSS imports are not allowed in locked mode.'
      )
    );
  const blocks = [...cleaned.matchAll(/\{([^{}]*)\}/g)].map((m) => ({
    text: m[1] ?? '',
    offset: (m.index ?? 0) + 1,
  }));
  const candidates = blocks.length ? blocks : [{ text: cleaned, offset: 0 }];
  for (const block of candidates) {
    let cursor = 0;
    for (const declaration of block.text.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon < 0) {
        cursor += declaration.length + 1;
        continue;
      }
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration
        .slice(colon + 1)
        .trim()
        .replace(/\s*!important\s*$/i, '');
      const at = `${path}:${block.offset + cursor}`;
      cursor += declaration.length + 1;
      if (!property || !value || property.startsWith('@')) continue;
      if (/(?:#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\s*\()/i.test(value)) {
        errors.push(
          issue('css-literal-color', at, value, 'Literal colors are not allowed in locked mode.')
        );
        continue;
      }
      if (
        /^(?:color|background|border|outline|box-shadow|text-shadow|font|opacity|filter|transform|transition|animation|fill|stroke)/.test(
          property
        )
      ) {
        errors.push(
          issue(
            'css-property-not-allowed',
            at,
            property,
            'Visual CSS properties are not allowed in locked mode.'
          )
        );
        continue;
      }
      const validator = propertyValues[property];
      if (!validator) {
        errors.push(
          issue(
            'css-property-not-allowed',
            at,
            property,
            'CSS property is outside the layout-only policy.'
          )
        );
      } else if (
        /[[\]]/.test(value) ||
        (/(?:calc|url|var)\(/i.test(value) &&
          !/^(?:var\(--tx-(?:space|size|z)-[a-z0-9-]+\)|calc\(var\(--tx-space-unit\)\s*\*\s*(?:[0-9]|1[0-2])\))$/.test(
            value
          ))
      ) {
        errors.push(
          issue(
            'css-arbitrary-value',
            at,
            value,
            'Arbitrary CSS values are not allowed in locked mode.'
          )
        );
      } else if (!validator(value)) {
        errors.push(
          issue(
            'css-arbitrary-value',
            at,
            value,
            'Value is not a named layout value or approved token.'
          )
        );
      }
    }
  }
  return errors;
}

export function checkLockedCssDeclarations(css: string, path = '<style>'): LockedCssReport {
  if (css.length > 1_000_000)
    return report([
      issue('css-arbitrary-value', path, 'source-too-large', 'CSS source exceeds the scan limit.'),
    ]);
  return report(cssDeclarations(css, path));
}

/** Scan a Svelte or CSS source for static class lists, inline styles and CSS declarations. */
export function checkLockedCssSource(source: string, path = '<source>'): LockedCssReport {
  if (source.length > 1_000_000)
    return report([
      issue('css-arbitrary-value', path, 'source-too-large', 'Source exceeds the scan limit.'),
    ]);
  const errors: LockedCssIssue[] = [];
  for (const match of source.matchAll(/\bclass\s*=\s*(['"])(.*?)\1/g))
    errors.push(...checkLockedClassList(match[2] ?? '', `${path}:${match.index ?? 0}`).errors);
  for (const match of source.matchAll(/\bclass:([A-Za-z0-9_/-]+)/g))
    errors.push(...checkLockedClassList(match[1] ?? '', `${path}:${match.index ?? 0}`).errors);
  for (const match of source.matchAll(/\bclass\s*=\s*\{([^}]*)\}/g))
    errors.push(
      issue(
        'css-dynamic-class',
        `${path}:${match.index ?? 0}`,
        match[1] ?? '',
        'Dynamic class expressions cannot be verified statically.'
      )
    );
  for (const match of source.matchAll(/\bstyle\s*=/g))
    errors.push(
      issue(
        'css-inline-style',
        `${path}:${match.index ?? 0}`,
        'style',
        'Inline styles are not allowed in locked mode.'
      )
    );
  const styleBlocks = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)];
  if (styleBlocks.length)
    for (const block of styleBlocks)
      errors.push(...cssDeclarations(block[1] ?? '', `${path}:style@${block.index ?? 0}`));
  else if (/\.css$/i.test(path)) errors.push(...cssDeclarations(source, path));
  return report(errors);
}

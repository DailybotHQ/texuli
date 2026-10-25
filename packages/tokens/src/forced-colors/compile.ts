import { forcedColorsCssVariables } from './mapping.ts';

/**
 * Style tokens that keep chrome readable when the OS forces contrast.
 * Widths step up under prefers-contrast; colors come from system keywords.
 */
const CHROME_STYLE_VARS = {
  '--tx-border-width': '2px',
  '--tx-focus-ring-width': '3px',
  '--tx-focus-ring-offset': '2px',
  '--tx-focus-ring-style': 'solid',
} as const;

function declareBlock(vars: Record<string, string>, indent: string): string {
  return Object.entries(vars)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join('\n');
}

/**
 * Compile the forced-colors + prefers-contrast stylesheet body (no imports).
 * Lives in `@layer tx.base` so consumer and component layers can still win
 * for non-forced properties; under forced-colors the OS still maps paints.
 */
export function compileForcedColorsCss(): string {
  const colorVars = forcedColorsCssVariables();
  const colorBlock = declareBlock(colorVars, '    ');
  const chromeBlock = declareBlock(CHROME_STYLE_VARS, '    ');

  return `/*
 * Forced colors and prefers-contrast for @texuli/tokens.
 * Import after base.css, or use compileForcedColorsCss() to inject.
 *
 * @import '@texuli/tokens/forced-colors.css';
 */
@layer tx.base {
  @media (forced-colors: active) {
    :root,
    [data-tx-theme] {
${colorBlock}
${chromeBlock}
    }

    :focus-visible {
      outline: var(--tx-focus-ring-width, 3px) var(--tx-focus-ring-style, solid)
        var(--tx-ring, Highlight);
      outline-offset: var(--tx-focus-ring-offset, 2px);
    }

    ::selection {
      background-color: var(--tx-selection, Highlight);
      color: var(--tx-selection-foreground, HighlightText);
    }

    a,
    a:link {
      color: var(--tx-link, LinkText);
    }

    a:visited {
      color: var(--tx-link-visited, VisitedText);
    }

    button,
    [role='button'],
    input,
    select,
    textarea {
      border-color: var(--tx-border, ButtonBorder);
      color: var(--tx-foreground, ButtonText);
    }

    hr,
    [data-tx-divider] {
      border-color: var(--tx-border-strong, CanvasText);
      color: var(--tx-border-strong, CanvasText);
    }
  }

  @media (prefers-contrast: more) {
    :root,
    [data-tx-theme] {
${chromeBlock}
      --tx-border: var(--tx-border, CanvasText);
      --tx-border-strong: var(--tx-border-strong, CanvasText);
      --tx-ring: var(--tx-ring, Highlight);
      --tx-selection: var(--tx-selection, Highlight);
      --tx-selection-foreground: var(--tx-selection-foreground, HighlightText);
    }

    :focus-visible {
      outline-width: var(--tx-focus-ring-width, 3px);
      outline-color: var(--tx-ring, Highlight);
    }
  }
}
`;
}

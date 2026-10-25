/**
 * Pure formatters for copying tokens as CSS, JSON or Tailwind-style maps.
 * No DOM. Used by the explorer island and unit tests.
 */

import type { TailwindThemeEntry } from '@texuli/tokens/tailwind';
import type { ExplorerModePayload, ExplorerThemePayload } from './build.ts';

export type ExportFormat = 'css' | 'json' | 'tailwind';

export function cssVarsBlock(
  themeId: string,
  mode: 'light' | 'dark',
  vars: Readonly<Record<string, string>>
): string {
  const body = Object.entries(vars)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  return `/* ${themeId} · ${mode} */\n[data-tx-theme='${themeId}'][data-tx-mode='${mode}'] {\n${body}\n}\n`;
}

export function jsonTokenExport(theme: ExplorerThemePayload, mode: 'light' | 'dark'): string {
  const payload = mode === 'dark' ? theme.dark : theme.light;
  return `${JSON.stringify(
    {
      id: theme.id,
      name: theme.name,
      mode,
      contrastLevel: theme.contrastLevel,
      roles: Object.fromEntries(payload.roles.map((r) => [r.role, r.default])),
      scales: payload.scales,
      cssVars: payload.cssVars,
      pairs: payload.pairs.map((p) => ({
        id: p.id,
        kind: p.kind,
        ratio: p.ratio,
        minimum: p.minimum,
        pass: p.pass,
        foreground: p.foreground,
        background: p.background,
      })),
    },
    null,
    2
  )}\n`;
}

export function tailwindMapExport(
  entries: readonly TailwindThemeEntry[],
  vars: Readonly<Record<string, string>>
): string {
  const lines = entries.map((entry) => {
    const value = vars[entry.tokenVar] ?? `var(${entry.tokenVar})`;
    return `  '${entry.themeVar}': '${value}',`;
  });
  return `// Tailwind-oriented token map (values resolved for the active theme)\nexport const theme = {\n${lines.join('\n')}\n} as const;\n`;
}

export function buildExportText(
  format: ExportFormat,
  theme: ExplorerThemePayload,
  mode: 'light' | 'dark',
  tailwindEntries: readonly TailwindThemeEntry[]
): string {
  const payload: ExplorerModePayload = mode === 'dark' ? theme.dark : theme.light;
  if (format === 'css') return cssVarsBlock(theme.id, mode, payload.cssVars);
  if (format === 'json') return jsonTokenExport(theme, mode);
  return tailwindMapExport(tailwindEntries, payload.cssVars);
}

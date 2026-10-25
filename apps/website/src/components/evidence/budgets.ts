/**
 * Resolve gzip budgets from texuli.budgets.json (build-time read).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type BudgetRow = { gzip?: number; cssGzip?: number; note?: string };

type BudgetsFile = {
  budgets?: Record<string, BudgetRow>;
};

let cached: BudgetsFile | null = null;

function loadBudgets(): BudgetsFile {
  if (cached) return cached;
  // evidence → components → src → website → apps → repo root
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../../');
  const path = join(repoRoot, 'texuli.budgets.json');
  try {
    cached = JSON.parse(readFileSync(path, 'utf8')) as BudgetsFile;
  } catch {
    cached = { budgets: {} };
  }
  return cached;
}

/**
 * Exact id wins over `<package>/*` patterns (same rule as scripts/size.ts).
 */
export function resolveGzipBudget(entryId: string): number | undefined {
  const budgets = loadBudgets().budgets ?? {};
  if (budgets[entryId]?.gzip !== undefined) return budgets[entryId].gzip;

  // Pattern: @texuli/primitives/dialog -> try @texuli/primitives/*
  const slash = entryId.lastIndexOf('/');
  if (slash > 0) {
    const pattern = `${entryId.slice(0, slash)}/*`;
    if (budgets[pattern]?.gzip !== undefined) return budgets[pattern].gzip;
  }
  // Unscoped texuli/button
  if (entryId.startsWith('texuli/')) {
    if (budgets['texuli/*']?.gzip !== undefined) return budgets['texuli/*'].gzip;
  }
  return undefined;
}

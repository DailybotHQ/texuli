/**
 * Interactive-family block shapes: poll, quiz, calculator, checklist.
 * Wired into core `safeParseBlock` via `parseInteractiveBlock`.
 */
import {
  evaluateFormula,
  type FormulaUnit,
  formatFormulaValue,
  type NumberFormula,
  parseFormula,
} from '../core/formula/index.ts';
import {
  BLOCK_CONTENT_LIMITS,
  type BlockBase,
  fail,
  failMany,
  ok,
  type ParseResult,
  parseMultilineText,
  parsePlainText,
} from '../core/schema/primitives.ts';
import { type BlockTone, isBlockTone } from '../core/schema/vocabulary.ts';

const OPTION_ID = /^[a-z][a-z0-9-]{0,31}$/;
const VAR_NAME = /^[a-z][a-z0-9_]{0,31}$/;
const FORMULA_UNITS = ['number', 'compact', 'cents', 'percent'] as const;

export type PollOption = { id: string; label: string };

export type PollBlock = BlockBase & {
  type: 'poll';
  question: string;
  options: PollOption[];
  allowMultiple?: boolean;
};

export type QuizOption = { id: string; label: string };

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
  /** Single correct option id. */
  correctId: string;
  explanation?: string;
};

export type QuizBlock = BlockBase & {
  type: 'quiz';
  title?: string;
  questions: QuizQuestion[];
};

export type CalculatorInput = {
  name: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  default?: number;
};

export type CalculatorBlock = BlockBase & {
  type: 'calculator';
  title?: string;
  description?: string;
  inputs: CalculatorInput[];
  formula: NumberFormula;
  unit?: FormulaUnit;
  outputLabel?: string;
};

export type ChecklistItem = { id: string; label: string; done?: boolean };

export type ChecklistBlock = BlockBase & {
  type: 'checklist';
  title?: string;
  items: ChecklistItem[];
};

export type InteractiveBlock = PollBlock | QuizBlock | CalculatorBlock | ChecklistBlock;
export type InteractiveBlockType = 'poll' | 'quiz' | 'calculator' | 'checklist';

export const INTERACTIVE_BLOCK_TYPES = [
  'poll',
  'quiz',
  'calculator',
  'checklist',
] as const satisfies readonly InteractiveBlockType[];

function plainObject(
  value: unknown,
  path: (string | number)[]
): ParseResult<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, 'Expected an object');
  }
  return ok(value as Record<string, unknown>);
}

function parseOptionId(value: unknown, path: (string | number)[]): ParseResult<string> {
  if (typeof value !== 'string' || !OPTION_ID.test(value)) {
    return fail(path, 'Expected a stable option id (lowercase, max 32)');
  }
  return ok(value);
}

function parseOptions(
  value: unknown,
  path: (string | number)[],
  max: number
): ParseResult<PollOption[]> {
  if (!Array.isArray(value) || value.length < 2) {
    return fail(path, 'Expected at least two options');
  }
  if (value.length > max) return fail(path, `At most ${max} options`);
  const options: PollOption[] = [];
  const seen = new Set<string>();
  const issues: { path: (string | number)[]; message: string }[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const itemPath = [...path, i];
    const obj = plainObject(value[i], itemPath);
    if (!obj.success) {
      issues.push(...obj.issues);
      continue;
    }
    const id = parseOptionId(obj.data.id, [...itemPath, 'id']);
    const label = parsePlainText(
      obj.data.label,
      [...itemPath, 'label'],
      BLOCK_CONTENT_LIMITS.plain
    );
    if (!id.success) {
      issues.push(...id.issues);
      continue;
    }
    if (!label.success) {
      issues.push(...label.issues);
      continue;
    }
    if (seen.has(id.data)) {
      issues.push({ path: [...itemPath, 'id'], message: 'Duplicate option id' });
      continue;
    }
    seen.add(id.data);
    options.push({ id: id.data, label: label.data });
  }
  if (issues.length > 0) return failMany(issues);
  return ok(options);
}

function parsePollBlock(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<PollBlock> {
  const question = parseMultilineText(
    record.question,
    [...path, 'question'],
    BLOCK_CONTENT_LIMITS.shortMarkdown
  );
  if (!question.success) return question;
  const options = parseOptions(
    record.options,
    [...path, 'options'],
    BLOCK_CONTENT_LIMITS.pollOptions
  );
  if (!options.success) return options;
  const block: PollBlock = {
    ...base,
    type: 'poll',
    question: question.data,
    options: options.data,
  };
  if (record.allowMultiple === true) block.allowMultiple = true;
  if (record.tone !== undefined) {
    if (!isBlockTone(record.tone)) return fail([...path, 'tone'], 'Invalid tone');
    block.tone = record.tone as BlockTone;
  }
  return ok(block);
}

function parseQuizBlock(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<QuizBlock> {
  if (!Array.isArray(record.questions) || record.questions.length < 1) {
    return fail([...path, 'questions'], 'Expected at least one question');
  }
  if (record.questions.length > BLOCK_CONTENT_LIMITS.steps) {
    return fail([...path, 'questions'], `At most ${BLOCK_CONTENT_LIMITS.steps} questions`);
  }
  const questions: QuizQuestion[] = [];
  const seenQ = new Set<string>();
  const issues: { path: (string | number)[]; message: string }[] = [];
  for (let i = 0; i < record.questions.length; i += 1) {
    const qPath = [...path, 'questions', i];
    const obj = plainObject(record.questions[i], qPath);
    if (!obj.success) {
      issues.push(...obj.issues);
      continue;
    }
    const id = parseOptionId(obj.data.id, [...qPath, 'id']);
    const prompt = parseMultilineText(
      obj.data.prompt,
      [...qPath, 'prompt'],
      BLOCK_CONTENT_LIMITS.shortMarkdown
    );
    const options = parseOptions(
      obj.data.options,
      [...qPath, 'options'],
      BLOCK_CONTENT_LIMITS.pollOptions
    );
    if (!id.success || !prompt.success || !options.success) {
      if (!id.success) issues.push(...id.issues);
      if (!prompt.success) issues.push(...prompt.issues);
      if (!options.success) issues.push(...options.issues);
      continue;
    }
    if (seenQ.has(id.data)) {
      issues.push({ path: [...qPath, 'id'], message: 'Duplicate question id' });
      continue;
    }
    seenQ.add(id.data);
    const correctId = parseOptionId(obj.data.correctId, [...qPath, 'correctId']);
    if (!correctId.success) {
      issues.push(...correctId.issues);
      continue;
    }
    if (!options.data.some((o) => o.id === correctId.data)) {
      issues.push({
        path: [...qPath, 'correctId'],
        message: 'correctId must match an option id',
      });
      continue;
    }
    const q: QuizQuestion = {
      id: id.data,
      prompt: prompt.data,
      options: options.data,
      correctId: correctId.data,
    };
    if (obj.data.explanation !== undefined) {
      const explanation = parseMultilineText(
        obj.data.explanation,
        [...qPath, 'explanation'],
        BLOCK_CONTENT_LIMITS.shortMarkdown
      );
      if (!explanation.success) {
        issues.push(...explanation.issues);
        continue;
      }
      q.explanation = explanation.data;
    }
    questions.push(q);
  }
  if (issues.length > 0) return failMany(issues);
  const block: QuizBlock = { ...base, type: 'quiz', questions };
  if (record.title !== undefined) {
    const title = parsePlainText(record.title, [...path, 'title'], BLOCK_CONTENT_LIMITS.heading);
    if (!title.success) return title;
    block.title = title.data;
  }
  return ok(block);
}

function parseFiniteNumber(
  value: unknown,
  path: (string | number)[]
): ParseResult<number | undefined> {
  if (value === undefined) return ok(undefined);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(path, 'Expected a finite number');
  }
  return ok(value);
}

function parseCalculatorBlock(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<CalculatorBlock> {
  if (!Array.isArray(record.inputs) || record.inputs.length < 1) {
    return fail([...path, 'inputs'], 'Expected at least one input');
  }
  if (record.inputs.length > BLOCK_CONTENT_LIMITS.formFields) {
    return fail([...path, 'inputs'], `At most ${BLOCK_CONTENT_LIMITS.formFields} inputs`);
  }
  const inputs: CalculatorInput[] = [];
  const names = new Set<string>();
  const issues: { path: (string | number)[]; message: string }[] = [];
  for (let i = 0; i < record.inputs.length; i += 1) {
    const iPath = [...path, 'inputs', i];
    const obj = plainObject(record.inputs[i], iPath);
    if (!obj.success) {
      issues.push(...obj.issues);
      continue;
    }
    if (typeof obj.data.name !== 'string' || !VAR_NAME.test(obj.data.name)) {
      issues.push({ path: [...iPath, 'name'], message: 'Invalid input name' });
      continue;
    }
    if (names.has(obj.data.name)) {
      issues.push({ path: [...iPath, 'name'], message: 'Duplicate input name' });
      continue;
    }
    names.add(obj.data.name);
    const label = parsePlainText(obj.data.label, [...iPath, 'label'], BLOCK_CONTENT_LIMITS.plain);
    if (!label.success) {
      issues.push(...label.issues);
      continue;
    }
    const input: CalculatorInput = { name: obj.data.name, label: label.data };
    for (const key of ['min', 'max', 'step', 'default'] as const) {
      if (obj.data[key] === undefined) continue;
      const n = parseFiniteNumber(obj.data[key], [...iPath, key]);
      if (!n.success) {
        issues.push(...n.issues);
        continue;
      }
      if (n.data !== undefined) input[key] = n.data;
    }
    inputs.push(input);
  }
  if (issues.length > 0) return failMany(issues);

  const formulaResult = parseFormula(record.formula, {
    variables: [...names],
  });
  if (!formulaResult.success) {
    return fail([...path, 'formula'], formulaResult.diagnostics[0]?.message ?? 'Invalid formula');
  }

  const block: CalculatorBlock = {
    ...base,
    type: 'calculator',
    inputs,
    formula: formulaResult.formula,
  };
  if (record.title !== undefined) {
    const title = parsePlainText(record.title, [...path, 'title'], BLOCK_CONTENT_LIMITS.heading);
    if (!title.success) return title;
    block.title = title.data;
  }
  if (record.description !== undefined) {
    const description = parseMultilineText(
      record.description,
      [...path, 'description'],
      BLOCK_CONTENT_LIMITS.shortMarkdown
    );
    if (!description.success) return description;
    block.description = description.data;
  }
  if (record.outputLabel !== undefined) {
    const outputLabel = parsePlainText(
      record.outputLabel,
      [...path, 'outputLabel'],
      BLOCK_CONTENT_LIMITS.plain
    );
    if (!outputLabel.success) return outputLabel;
    block.outputLabel = outputLabel.data;
  }
  if (record.unit !== undefined) {
    if (
      typeof record.unit !== 'string' ||
      !(FORMULA_UNITS as readonly string[]).includes(record.unit)
    ) {
      return fail([...path, 'unit'], 'Invalid formula unit');
    }
    block.unit = record.unit as FormulaUnit;
  }
  return ok(block);
}

function parseChecklistBlock(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<ChecklistBlock> {
  if (!Array.isArray(record.items) || record.items.length < 1) {
    return fail([...path, 'items'], 'Expected at least one item');
  }
  if (record.items.length > BLOCK_CONTENT_LIMITS.listItems) {
    return fail([...path, 'items'], `At most ${BLOCK_CONTENT_LIMITS.listItems} items`);
  }
  const items: ChecklistItem[] = [];
  const seen = new Set<string>();
  const issues: { path: (string | number)[]; message: string }[] = [];
  for (let i = 0; i < record.items.length; i += 1) {
    const iPath = [...path, 'items', i];
    const obj = plainObject(record.items[i], iPath);
    if (!obj.success) {
      issues.push(...obj.issues);
      continue;
    }
    const id = parseOptionId(obj.data.id, [...iPath, 'id']);
    const label = parsePlainText(obj.data.label, [...iPath, 'label'], BLOCK_CONTENT_LIMITS.plain);
    if (!id.success || !label.success) {
      if (!id.success) issues.push(...id.issues);
      if (!label.success) issues.push(...label.issues);
      continue;
    }
    if (seen.has(id.data)) {
      issues.push({ path: [...iPath, 'id'], message: 'Duplicate item id' });
      continue;
    }
    seen.add(id.data);
    const item: ChecklistItem = { id: id.data, label: label.data };
    if (obj.data.done === true) item.done = true;
    items.push(item);
  }
  if (issues.length > 0) return failMany(issues);
  const block: ChecklistBlock = { ...base, type: 'checklist', items };
  if (record.title !== undefined) {
    const title = parsePlainText(record.title, [...path, 'title'], BLOCK_CONTENT_LIMITS.heading);
    if (!title.success) return title;
    block.title = title.data;
  }
  return ok(block);
}

/**
 * Parse an interactive-family block, or `null` when `type` is not interactive.
 */
export function parseInteractiveBlock(
  type: string,
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<InteractiveBlock> | null {
  switch (type) {
    case 'poll':
      return parsePollBlock(record, path, base);
    case 'quiz':
      return parseQuizBlock(record, path, base);
    case 'calculator':
      return parseCalculatorBlock(record, path, base);
    case 'checklist':
      return parseChecklistBlock(record, path, base);
    default:
      return null;
  }
}

/** Evaluate a calculator block against current input values (finite numbers only). */
export function evaluateCalculator(
  block: CalculatorBlock,
  values: Readonly<Record<string, number | null | undefined>>
): { ok: true; value: number | null; formatted: string } | { ok: false; message: string } {
  const result = evaluateFormula(block.formula, values);
  const formatted = formatFormulaValue(result, block.unit ?? 'number');
  return { ok: true, value: result, formatted };
}

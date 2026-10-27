/**
 * The `skills/texuli/evals` sub-skill: scenario evals scored offline by the
 * golden scorer. Registered from `skill.test.ts`.
 *
 * - every golden task has a scenario whose rules are quoted from build-ui;
 * - the recorded skill-following trees pass all six checks, axe included;
 * - each recorded rule break fails the check that guards that rule;
 * - every command in the sub-skill runs.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateBlueprint } from '../../packages/spec/src/validate.ts';
import { validateWorkflowGraph } from '../../packages/spec/src/workflow.ts';
import { runGoldenCli } from '../../packages/tools/src/golden/cli.ts';
import {
  type AxeLike,
  createAxeRunner,
  GOLDEN_CHECKS,
  GOLDEN_TASKS,
  goldenTask,
  scoreGoldenTree,
} from '../../packages/tools/src/golden/index.ts';
import { repositoryRootFromHere } from '../check-skill.ts';

const root = repositoryRootFromHere();
const evals = join(root, 'skills', 'texuli', 'evals');
const read = (rel: string) => readFileSync(join(evals, rel), 'utf8');
const json = <T>(rel: string) => JSON.parse(read(rel)) as T;

interface Scenario {
  task: string;
  title: string;
  follow: string;
  stages: string[];
  rules: string[];
  traps: string[];
  mustInclude: string[];
  recorded: boolean;
}
interface RuleBreak {
  rule: string;
  check: string;
  why: string;
  task: string;
  tree: unknown;
}

const scenarioFile = json<{
  version: number;
  scenarios: Scenario[];
  interactive: (Scenario & { reference: string })[];
}>('scenarios.json');
const scenarios = scenarioFile.scenarios;
const following = json<Record<string, unknown>>('runs/skill-following.json');
const breaks = json<RuleBreak[]>('runs/rule-breaks.json');

// axe-core comes with the root's @axe-core/playwright; resolve it from there.
const req = createRequire(import.meta.url);
const axe = req(createRequire(req.resolve('@axe-core/playwright')).resolve('axe-core')) as AxeLike;
const scoreOptions = () => ({ axe: createAxeRunner(axe), document });

describe('skills/texuli/evals: scenario evals', () => {
  afterEach(() => document.body.replaceChildren());

  it('has one scenario per golden task, matching its traps and needs', () => {
    expect(scenarios.map((scenario) => scenario.task)).toEqual(GOLDEN_TASKS.map((task) => task.id));
    for (const scenario of scenarios) {
      const task = goldenTask(scenario.task);
      expect(task, scenario.task).toBeDefined();
      expect(scenario.traps).toEqual(task?.traps);
      expect(scenario.mustInclude).toEqual(task?.mustInclude);
      expect(scenario.recorded).toBe(scenario.task in following);
      const skill = readFileSync(join(root, 'skills', 'texuli', scenario.follow), 'utf8');
      for (const rule of scenario.rules) expect(skill, `${scenario.task}: ${rule}`).toContain(rule);
      for (const stage of scenario.stages) expect(skill).toContain(`### ${stage} —`);
    }
  });

  it('records skill-following trees for every trap task, and only for golden tasks', () => {
    for (const task of GOLDEN_TASKS.filter((entry) => entry.traps.length > 0)) {
      expect(Object.keys(following), task.id).toContain(task.id);
    }
    for (const id of Object.keys(following)) expect(goldenTask(id), id).toBeDefined();
    expect(Object.keys(following).length).toBeGreaterThanOrEqual(10);
  });

  it('passes all six checks, axe included, for every skill-following tree', async () => {
    for (const [id, tree] of Object.entries(following)) {
      const score = await scoreGoldenTree(
        goldenTask(id) as NonNullable<ReturnType<typeof goldenTask>>,
        tree,
        scoreOptions()
      );
      const notPassed = score.checks
        .filter((check) => check.status !== 'pass')
        .map((check) => `${check.check}: ${check.status} ${check.issues.join('; ')}`);
      expect(notPassed, id).toEqual([]);
      expect(score.checks.map((check) => check.check)).toEqual([...GOLDEN_CHECKS]);
      document.body.replaceChildren();
    }
  }, 120_000);

  it('catches every recorded rule break with the check that guards the rule', async () => {
    const buildUi = readFileSync(join(root, 'skills', 'texuli', 'build-ui', 'SKILL.md'), 'utf8');
    for (const entry of breaks) {
      expect(buildUi, entry.rule).toContain(entry.rule);
      expect(GOLDEN_CHECKS).toContain(entry.check);
      const task = goldenTask(entry.task);
      expect(task, entry.task).toBeDefined();
      const score = await scoreGoldenTree(
        task as NonNullable<typeof task>,
        entry.tree,
        scoreOptions()
      );
      const failed = score.checks
        .filter((check) => check.status === 'fail')
        .map((check) => check.check);
      expect(failed, `${entry.task}: ${entry.why}`).toContain(entry.check);
      expect(score.passed).toBe(false);
      document.body.replaceChildren();
    }
    // Between them, the breaks exercise four rules and five checks.
    expect(new Set(breaks.map((entry) => entry.rule)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(breaks.map((entry) => entry.check)).size).toBeGreaterThanOrEqual(5);
  }, 120_000);

  it('runs every command in the sub-skill', async () => {
    const out: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      out.push(String(chunk));
      return true;
    });
    try {
      const text = read('SKILL.md');
      const commands = [...text.matchAll(/^```bash\n([\s\S]*?)^```$/gm)]
        .flatMap((block) => (block[1] ?? '').split('\n'))
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
      expect(commands.length).toBeGreaterThanOrEqual(3);
      for (const line of commands) {
        const words = line.split(/\s+/);
        if (words.slice(0, 3).join(' ') === 'pnpm vitest run') {
          expect(readFileSync(join(root, words[3] as string), 'utf8').length, line).toBeGreaterThan(
            0
          );
          continue;
        }
        expect(words.slice(0, 4).join(' '), line).toBe(
          'pnpm exec tsx packages/tools/src/golden/cli.ts'
        );
        const args = words.slice(4).map((arg) => (arg.startsWith('--') ? arg : join(root, arg)));
        expect(await runGoldenCli(args), line).toBe(0);
      }
      expect(out.join('')).toContain('g03-onboarding-handbook');
    } finally {
      vi.restoreAllMocks();
    }
  });
});

/** Collect every node id of a blueprint tree. */
function nodeIds(node: unknown, out = new Set<string>()): Set<string> {
  if (node && typeof node === 'object') {
    const bag = node as { id?: unknown; children?: unknown };
    if (typeof bag.id === 'string') out.add(bag.id);
    if (Array.isArray(bag.children)) for (const child of bag.children) nodeIds(child, out);
  }
  return out;
}

describe('skills/texuli/evals: interactive scenarios (drag, workflows, stateful JSON)', () => {
  const spec = (rel: string) => JSON.parse(readFileSync(join(root, 'packages/spec', rel), 'utf8'));
  const documents = {
    blueprintSchema: spec('schemas/blueprint.schema.json'),
    catalog: spec('catalog/components.json'),
    workflowSchema: spec('schemas/workflow.schema.json'),
    validateWorkflowGraph,
  } as Parameters<typeof validateBlueprint>[1];

  it('quotes its rules and stages from the followed sub-skill, and its reference holds what it needs', () => {
    const interactive = scenarioFile.interactive;
    expect(interactive.length).toBeGreaterThanOrEqual(3);
    const ids = interactive.map((scenario) => scenario.task);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(goldenTask(id), id).toBeUndefined();
    const text = JSON.stringify(interactive);
    for (const needle of ['drag', 'sortable', 'workflow', 'reorder'])
      expect(text).toContain(needle);
    for (const scenario of interactive) {
      const skill = readFileSync(join(root, 'skills', 'texuli', scenario.follow), 'utf8');
      for (const rule of scenario.rules) expect(skill, `${scenario.task}: ${rule}`).toContain(rule);
      for (const stage of scenario.stages)
        expect(skill, `${scenario.task}: ${stage}`).toMatch(new RegExp(`^#{2,3} ${stage} —`, 'm'));
      expect(scenario.recorded).toBe(false);
      const reference = readFileSync(join(root, scenario.reference), 'utf8');
      if (scenario.reference.endsWith('.json')) {
        // A JSON scenario's reference is a spec golden: it validates and uses every needed id.
        const blueprint = JSON.parse(reference) as { tree: unknown };
        expect(validateBlueprint(blueprint, documents).diagnostics, scenario.task).toEqual([]);
        const used = nodeIds(blueprint.tree);
        for (const id of scenario.mustInclude)
          expect([...used], `${scenario.task}: ${id}`).toContain(id);
      } else {
        // A Svelte scenario's reference imports every needed entry.
        for (const entry of scenario.mustInclude)
          expect(reference, `${scenario.task}: ${entry}`).toContain(`'${entry}'`);
      }
    }
  });
});

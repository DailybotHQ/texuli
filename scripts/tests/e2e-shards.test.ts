// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const E2E = join(process.cwd(), 'tests/e2e');

it('assigns every website e2e spec to exactly one CI shard', () => {
  const { shards } = JSON.parse(readFileSync(join(E2E, 'shards.json'), 'utf8')) as {
    shards: string[][];
  };
  const specs = readdirSync(E2E)
    .filter((name) => name.endsWith('.spec.ts'))
    .sort();
  const assigned = shards.flat();
  // A spec in no shard would silently never run in CI; one in two would run twice.
  expect([...assigned].sort(), 'shards.json lists each spec once').toEqual(specs);
  expect(new Set(assigned).size).toBe(assigned.length);
  // .github/workflows/ci.yml runs one matrix job per shard.
  const ci = readFileSync(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
  const matrix = /shard: \[([\d, ]+)\]/
    .exec(ci)?.[1]
    ?.split(',')
    .map((n) => Number(n.trim()));
  expect(matrix).toEqual(shards.map((_, index) => index + 1));
});

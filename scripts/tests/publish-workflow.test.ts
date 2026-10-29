/**
 * The npm publish workflow (`.github/workflows/publish.yml`, docs/RELEASE.md):
 * the 0.0.0 placeholder refusal runs as a pre-flight step over the whole
 * publish list before the first `npm publish`, so a forgotten bump fails the
 * job with nothing published instead of halfway through a wave.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { repositoryRootFromHere } from '../check-skill.ts';

const root = repositoryRootFromHere();
const workflow = readFileSync(join(root, '.github', 'workflows', 'publish.yml'), 'utf8');

type Step = { name: string; run: string };

/** The job's steps in order: each `- name:`/`- run:`/`- uses:` item and its run script. */
function steps(source: string): Step[] {
  const lines = source.split('\n');
  const out: Step[] = [];
  let current: Step | null = null;
  let inRun = false;
  for (const line of lines) {
    const item = /^ {6}- (?:name: (.*)|run: (.*)|uses: (.*))$/.exec(line);
    if (item) {
      current = { name: item[1] ?? item[3] ?? '', run: item[2] && item[2] !== '|' ? item[2] : '' };
      inRun = item[2] === '|';
      out.push(current);
      continue;
    }
    if (!current) continue;
    if (/^ {8}run: \|$/.test(line)) {
      inRun = true;
      continue;
    }
    if (inRun && (line.startsWith('          ') || line.trim() === '')) {
      current.run += `${line.slice(10)}\n`;
    } else if (/^ {0,8}\S/.test(line)) {
      inRun = false;
    }
  }
  return out;
}

const all = steps(workflow);
const preflightIndex = all.findIndex((step) => step.name.includes('Refuse unreleased'));
const publishIndex = all.findIndex((step) => /\bnpm publish\b/.test(step.run));
const preflight = all[preflightIndex] as Step;
const publish = all[publishIndex] as Step;
const loopDirs = (run: string) =>
  (/for dir in ([^;]+); do/.exec(run)?.[1] ?? '').trim().split(/\s+/);

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('publish workflow pre-flight', () => {
  it('checks every package in the publish list for 0.0.0 before the first npm publish', () => {
    expect(preflightIndex).toBeGreaterThan(-1);
    expect(publishIndex).toBeGreaterThan(preflightIndex);
    // No step before the pre-flight publishes anything.
    for (const step of all.slice(0, preflightIndex)) expect(step.run).not.toMatch(/npm publish/);
    // The pre-flight list is the publish list, in wave order (and the dist-tag loop's).
    const waves = [...publish.run.matchAll(/^publish packages\/(\S+)$/gm)].map((match) => match[1]);
    expect(waves.length).toBeGreaterThan(10);
    expect(loopDirs(preflight.run)).toEqual(waves);
    const latest = all.find((step) => step.name.includes('Point latest')) as Step;
    expect(loopDirs(latest.run)).toEqual(waves);
    // The refusal no longer lives inside publish(), mid-wave.
    expect(publish.run).not.toContain('0.0.0');
    // Provenance and the next dist-tag stay on every publish.
    expect(publish.run).toContain('npm publish "$tarball" --tag next --access public --provenance');
  });

  it('fails when any listed package is 0.0.0 and passes when every one is released', () => {
    // A stand-in `node -p "require('./…/package.json').field"`: forty real Node
    // starts per run take minutes on a loaded host.
    const bin = mkdtempSync(join(tmpdir(), 'tx-publish-bin-'));
    scratch.push(bin);
    writeFileSync(
      join(bin, 'node'),
      String.raw`#!/bin/sh
file=$(printf '%s' "$2" | sed -E "s/.*require\('([^']+)'\).*/\1/")
field=$(printf '%s' "$2" | sed -E "s/.*\)\.([a-z]+).*/\1/")
sed -nE 's/.*"'"$field"'":"([^"]*)".*/\1/p' "$file"
`
    );
    chmodSync(join(bin, 'node'), 0o755);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` };
    const run = (placeholder: string | null) => {
      const dir = mkdtempSync(join(tmpdir(), 'tx-publish-'));
      scratch.push(dir);
      for (const name of loopDirs(preflight.run)) {
        mkdirSync(join(dir, 'packages', name), { recursive: true });
        writeFileSync(
          join(dir, 'packages', name, 'package.json'),
          JSON.stringify({
            name: `@texuli/${name}`,
            version: name === placeholder ? '0.0.0' : '0.5.0',
          })
        );
      }
      return spawnSync('bash', ['-c', preflight.run], { cwd: dir, encoding: 'utf8', env });
    };
    const refused = run('editor');
    expect(refused.status).not.toBe(0);
    expect(refused.stdout).toContain('Refusing to publish @texuli/editor@0.0.0');
    // The last package in the list is checked too (the loop does not stop early).
    const last = loopDirs(preflight.run).at(-1) as string;
    expect(run(last).status).not.toBe(0);
    const released = run(null);
    expect(released.status, released.stderr).toBe(0);
  }, 30000);
});

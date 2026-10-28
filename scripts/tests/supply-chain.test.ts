// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ALLOWED_LICENSES,
  BANNED_RUNTIME_PACKAGES,
  buildCycloneDxBom,
  checkBannedRuntime,
  checkLifecycleScripts,
  checkRuntimeAllowlist,
  collectFindings,
  FORBIDDEN_LIFECYCLE_SCRIPTS,
  licenseAllowed,
  REPO_ROOT,
  readWorkspace,
  runSupplyChain,
  type WorkspacePackage,
} from '../supply-chain.ts';

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function fakePkg(
  name: string,
  manifest: Record<string, unknown>,
  dir = name.replace('@texuli/', '').replace('texuli-workspace', '.')
): WorkspacePackage {
  return {
    name,
    dir,
    absDir: `/virtual/${dir}`,
    manifest: { name, version: '0.0.0', license: 'MIT', ...manifest },
  };
}

describe('licenseAllowed', () => {
  it('accepts SPDX allowlist entries and simple OR expressions', () => {
    expect(licenseAllowed('MIT')).toBe(true);
    expect(licenseAllowed('Apache-2.0')).toBe(true);
    expect(licenseAllowed('MIT OR Apache-2.0')).toBe(true);
    expect(licenseAllowed('GPL-3.0')).toBe(false);
    expect(licenseAllowed(undefined)).toBe(false);
    expect(ALLOWED_LICENSES.has('MIT')).toBe(true);
  });
});

describe('lifecycle and banned packages (unit)', () => {
  it('flags install lifecycle scripts; flags banned runtime dependencies; enforces the runtime external allowlist', () => {
    // flags install lifecycle scripts
    {
      const findings = checkLifecycleScripts([
        fakePkg('bad', { scripts: { postinstall: 'node evil.js', typecheck: 'tsc' } }),
      ]);
      expect(findings.map((f) => f.code)).toEqual(['lifecycle-script']);
      expect(FORBIDDEN_LIFECYCLE_SCRIPTS).toContain('postinstall');
    }
    // flags banned runtime dependencies
    {
      const findings = checkBannedRuntime([
        fakePkg('bad', { dependencies: { 'tailwind-merge': '^2.0.0', clsx: '^2.0.0' } }),
      ]);
      expect(findings.some((f) => f.message.includes('tailwind-merge'))).toBe(true);
      expect(findings.some((f) => f.message.includes('clsx'))).toBe(true);
      expect(BANNED_RUNTIME_PACKAGES).toContain('clsx');
    }
    // enforces the runtime external allowlist
    {
      const findings = checkRuntimeAllowlist([
        fakePkg('@texuli/core', { dependencies: { lodash: '^4.0.0' } }, 'packages/core'),
        fakePkg(
          '@texuli/primitives',
          { dependencies: { '@texuli/date': '0.4.0', '@texuli/core': 'workspace:*' } },
          'packages/primitives'
        ),
        fakePkg(
          '@texuli/date',
          { dependencies: { '@internationalized/date': '^3.12.4' } },
          'packages/date'
        ),
      ]);
      expect(
        findings.some((f) => f.package === '@texuli/core' && f.code === 'runtime-not-allowed')
      ).toBe(true);
      expect(findings.some((f) => f.package === '@texuli/primitives')).toBe(false);
      expect(findings.some((f) => f.package === '@texuli/date')).toBe(true);
    }
  });
});

describe('CycloneDX SBOM builder', () => {
  it('emits bomFormat 1.5 with workspace and external components', () => {
    const packages = [
      fakePkg(
        'texuli-workspace',
        {
          dependencies: {},
          devDependencies: { vitest: '^5.0.0' },
        },
        '.'
      ),
      fakePkg('@texuli/core', { dependencies: {} }, 'packages/core'),
      fakePkg('@texuli/date', { dependencies: {} }, 'packages/date'),
      fakePkg(
        '@texuli/primitives',
        {
          dependencies: {
            '@texuli/core': 'workspace:*',
            '@texuli/date': '0.4.0',
          },
          peerDependencies: { svelte: '^5.57.2' },
        },
        'packages/primitives'
      ),
    ];
    const bom = buildCycloneDxBom(packages, REPO_ROOT, { timestamp: '2026-10-23T00:00:00.000Z' });
    expect(bom.bomFormat).toBe('CycloneDX');
    expect(bom.specVersion).toBe('1.5');
    expect(bom.metadata.timestamp).toBe('2026-10-23T00:00:00.000Z');
    expect(bom.components.some((c) => c.name === '@texuli/core')).toBe(true);
    expect(bom.components.some((c) => c.name === '@texuli/date')).toBe(true);
    expect(bom.components.some((c) => c.name === '@internationalized/date')).toBe(false);
    expect(bom.components.some((c) => c.name === 'svelte')).toBe(true);
    const prim = bom.dependencies.find((d) => d.ref.startsWith('workspace:@texuli/primitives'));
    expect(prim?.dependsOn.some((r) => r.includes('@texuli/core'))).toBe(true);
  });
});

describe('repo supply chain gate', () => {
  it('reads the real workspace and finds no supply-chain violations; writes a CycloneDX SBOM under tmp/supply-chain/; does not leave install lifecycle scripts in any workspace manifest', () => {
    // reads the real workspace and finds no supply-chain violations
    {
      const packages = readWorkspace(REPO_ROOT);
      expect(packages.length).toBeGreaterThan(8);
      expect(packages.some((p) => p.name === '@texuli/core')).toBe(true);
      expect(packages.some((p) => p.dir === '.')).toBe(true);

      const core = packages.find((p) => p.name === '@texuli/core');
      expect(core?.manifest.dependencies ?? {}).toEqual({});

      const findings = collectFindings(packages, REPO_ROOT);
      expect(findings, JSON.stringify(findings, null, 2)).toEqual([]);
    }
    // writes a CycloneDX SBOM under tmp/supply-chain/
    {
      const { findings, bom, sbomPath } = runSupplyChain(REPO_ROOT);
      expect(findings).toEqual([]);
      expect(existsSync(sbomPath)).toBe(true);
      expect(sbomPath.replace(/\\/g, '/')).toMatch(/tmp\/supply-chain\/sbom\.cdx\.json$/);
      const written = JSON.parse(readFileSync(sbomPath, 'utf8')) as typeof bom;
      expect(written.bomFormat).toBe('CycloneDX');
      expect(written.specVersion).toBe('1.5');
      expect(written.components.length).toBeGreaterThan(packagesLengthHint());
      // Root dev tooling is listed, in the excluded scope.
      expect(written.components.some((c) => c.name === 'vitest' && c.scope === 'excluded')).toBe(
        true
      );
    }
    for (const pkg of readWorkspace(REPO_ROOT)) {
      for (const name of FORBIDDEN_LIFECYCLE_SCRIPTS) {
        expect(pkg.manifest.scripts?.[name], `${pkg.name} ${name}`).toBeUndefined();
      }
    }
  });
});

function packagesLengthHint(): number {
  // Workspace packages alone; external deps push the total higher.
  return readWorkspace(REPO_ROOT).length;
}

describe('isolation fixture', () => {
  it('detects a planted postinstall and banned dep in a temp workspace', () => {
    const dir = mkdtempSync(join(tmpdir(), 'texuli-sc-'));
    scratch.push(dir);
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'texuli-workspace',
        version: '0.0.0',
        license: 'MIT',
        private: true,
        scripts: { postinstall: 'echo no' },
        dependencies: { clsx: '1.0.0' },
      })
    );
    const packages = readWorkspace(dir);
    const findings = [...checkLifecycleScripts(packages), ...checkBannedRuntime(packages)];
    expect(findings.map((f) => f.code).sort()).toEqual(['banned-runtime', 'lifecycle-script']);
  });
});

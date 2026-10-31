/**
 * Deterministic structure checks for native/ that run without a JDK, Gradle
 * or network (the Kotlin build itself is deferred until the toolchain is
 * available offline; see native/README.md):
 *   pnpm exec tsx native/conformance/web/structure.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { canonicalJson } from '../../../packages/spec/src/canonical.ts';
import type { SpecCatalog } from '../../../packages/spec/src/catalog.ts';
import { SPEC_PATTERNS } from '../../../packages/spec/src/contract.ts';
import type { Schema } from '../../../packages/spec/src/dialect.ts';
import type { SpecSourceDescriptor } from '../../../packages/spec/src/source.ts';
import { SPEC_CONTROL_STATE_TYPES } from '../../../packages/spec/src/surface.ts';
import { validateBlueprint } from '../../../packages/spec/src/validate.ts';
import { validateWorkflowGraph } from '../../../packages/spec/src/workflow.ts';
import { traceNode } from './trace-rules.ts';

const NATIVE = join(import.meta.dirname, '../..');
const REPO = join(NATIVE, '..');
const SPEC_KT = join(REPO, 'packages/spec/generated/kotlin');
const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  if (!ok) failures.push(message);
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'build' || name === '.gradle' || name === 'node_modules') return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Kotlin with strings, chars and comments blanked (one pass, raw strings too). */
export function kotlinCode(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('//', i)) {
      while (i < text.length && text[i] !== '\n') i += 1;
    } else if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else if (text.startsWith('"""', i)) {
      const end = text.indexOf('"""', i + 3);
      i = end === -1 ? text.length : end + 3;
      out += '""';
    } else if (text[i] === '"' || text[i] === "'") {
      const quote = text[i];
      i += 1;
      while (i < text.length && text[i] !== quote) i += text[i] === '\\' ? 2 : 1;
      i += 1;
      out += '""';
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

// 1. The Gradle shell.
check(
  existsSync(join(NATIVE, 'gradlew')) && (statSync(join(NATIVE, 'gradlew')).mode & 0o111) !== 0,
  'gradlew is executable'
);
check(existsSync(join(NATIVE, 'gradle/wrapper/gradle-wrapper.jar')), 'gradle-wrapper.jar exists');
check(
  readFileSync(join(NATIVE, 'gradle/wrapper/gradle-wrapper.properties'), 'utf8').includes(
    'gradle-8.14.3-bin.zip'
  ),
  'the wrapper pins Gradle 8.14.3'
);
const settings = readFileSync(join(NATIVE, 'settings.gradle.kts'), 'utf8');
check(settings.includes('rootProject.name = "texuli-native"'), 'settings names the texuli build');
for (const module of ['texuli-spec', 'texuli-compose', 'conformance']) {
  check(settings.includes(`":${module}"`), `settings includes :${module}`);
  check(existsSync(join(NATIVE, module, 'build.gradle.kts')), `${module} has a build script`);
}

// 2. The spec's generated Kotlin is consumed in place, never copied.
const specBuild = readFileSync(join(NATIVE, 'texuli-spec/build.gradle.kts'), 'utf8');
check(
  specBuild.includes('../packages/spec/generated/kotlin'),
  'texuli-spec reads packages/spec/generated/kotlin'
);
check(existsSync(join(SPEC_KT, 'com/texuli/spec/Blueprint.kt')), 'the generated Kotlin exists');
const kotlinFiles = walk(NATIVE).filter((f) => f.endsWith('.kt'));
check(
  !kotlinFiles.some((f) =>
    /\/com\/texuli\/spec\/(Blueprint|CatalogSchema|Diagnostics|Json|Manifest|Vocabulary|Workflow)\.kt$/.test(
      f
    )
  ),
  'no generated spec file is copied into native/'
);

// 3. Every Kotlin file: package matches its path, brackets balance, no tabs.
const allKotlin = [...kotlinFiles, ...walk(SPEC_KT).filter((f) => f.endsWith('.kt'))];
const declared = new Set<string>();
for (const file of allKotlin) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(REPO, file);
  const pkg = /^package ([\w.]+)$/m.exec(text)?.[1];
  const dir = /\/kotlin\/(.+)\/[^/]+\.kt$/.exec(file)?.[1]?.replaceAll('/', '.');
  check(pkg !== undefined && pkg === dir, `${rel}: package matches its directory`);
  check(!text.includes('\t'), `${rel}: no tabs`);
  const code = kotlinCode(text);
  for (const [open, close] of [
    ['{', '}'],
    ['(', ')'],
    ['[', ']'],
  ] as const) {
    check(code.split(open).length === code.split(close).length, `${rel}: balanced ${open}${close}`);
  }
  for (const m of code.matchAll(
    /(?:class|interface|object|typealias|fun)\s+(?:[A-Za-z.<>, ]+\.)?([A-Za-z][A-Za-z0-9]*)/g
  )) {
    declared.add(`${pkg}.${m[1]}`);
  }
}

// 4. Every import of the spec or the compose module names something declared.
for (const file of kotlinFiles) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/^import (com\.texuli\.[\w.]+)$/gm)) {
    check(declared.has(m[1] as string), `${relative(REPO, file)}: import ${m[1]} is declared`);
  }
}

// 5. Data-level parity: simulating the native plan (spec validation, then
// portable props only) reproduces the web traces, so the traces do not
// depend on the renderer. This is a TypeScript simulation, not a Kotlin run.
const catalog = JSON.parse(
  readFileSync(join(REPO, 'packages/spec/catalog/components.json'), 'utf8')
) as SpecCatalog;
const blueprintSchema = JSON.parse(
  readFileSync(join(REPO, 'packages/spec/schemas/blueprint.schema.json'), 'utf8')
) as Schema;
// Goldens with a workflow-graph need the workflow schema and its validator.
const workflowSchema = JSON.parse(
  readFileSync(join(REPO, 'packages/spec/schemas/workflow.schema.json'), 'utf8')
) as Schema;
// Goldens with `$source` bindings need the host's data sources (spec 0.8.0+).
const sources = (
  JSON.parse(readFileSync(join(REPO, 'packages/spec/fixtures/sources.json'), 'utf8')) as {
    sources: SpecSourceDescriptor[];
  }
).sources;
const portable = new Map(
  catalog.components.map((c) => [
    c.id,
    new Set(c.props.filter((p) => !p.extension).map((p) => p.name)),
  ])
);
interface Node {
  id: string;
  props?: Record<string, unknown>;
  children?: Node[];
}
const plan = (node: Node): Parameters<typeof traceNode>[0] => {
  const names = portable.get(node.id);
  if (!names) return { kind: 'placeholder', id: node.id, label: node.id, reason: 'unknown-id' };
  return {
    kind: 'component',
    id: node.id,
    props: Object.fromEntries(Object.entries(node.props ?? {}).filter(([k]) => names.has(k))),
    children: (node.children ?? []).map(plan),
  };
};
const goldenDir = join(REPO, 'packages/spec/fixtures/golden');
for (const file of readdirSync(goldenDir).filter((f) => f.endsWith('.json'))) {
  const envelope = JSON.parse(readFileSync(join(goldenDir, file), 'utf8')) as { tree: Node };
  check(
    validateBlueprint(envelope, {
      blueprintSchema,
      catalog,
      workflowSchema,
      validateWorkflowGraph,
      sources,
    }).ok,
    `${file}: valid under the spec validator`
  );
  const expected = JSON.parse(
    readFileSync(join(NATIVE, 'conformance/expected', file.replace('.json', '.trace.json')), 'utf8')
  );
  const simulated = [plan(envelope.tree)].map(traceNode);
  check(
    canonicalJson(simulated) === canonicalJson(expected.trace),
    `${file}: the native plan's trace equals the web trace`
  );
}

// 6. KMP chat migration parity: the chat-thread forms the Kotlin migration
// tests load (KmpAiChatMigrationTest, KmpVoiceChatMigrationTest) validate
// under the TypeScript validator too, and the transcript as the app models it
// (no author, role "assistant") is refused with the same pinned diagnostics.
const kmpFixture = (name: string) =>
  readFileSync(join(NATIVE, 'conformance/fixtures', `${name}.json`), 'utf8');
for (const name of ['kmp-aichat-thread', 'kmp-voicechat-thread']) {
  const result = validateBlueprint(JSON.parse(kmpFixture(name)), { blueprintSchema, catalog });
  check(
    result.ok,
    `${name}.json: valid under the spec validator (${result.diagnostics.map((d) => d.code).join(', ')})`
  );
}
const unmapped = kmpFixture('kmp-voicechat-thread')
  .replace('"author": "Fictional Person",', '')
  .replace('"author": "Fictional Agent",', '')
  .replace('"role": "agent"', '"role": "assistant"');
check(
  canonicalJson(
    validateBlueprint(JSON.parse(unmapped), { blueprintSchema, catalog }).diagnostics.map((d) => [
      d.code,
      d.path,
      d.id,
    ])
  ) ===
    canonicalJson([
      ['missing-required', '$.tree.children[1].children[0].props.author', 'chat-message'],
      ['enum-value', '$.tree.children[1].children[1].props.role', 'chat-message'],
      ['missing-required', '$.tree.children[1].children[1].props.author', 'chat-message'],
    ]),
  'the unmapped voice-chat transcript is refused with the diagnostics the Kotlin test pins'
);

// 7. The hand-written Kotlin contract compiles the spec's patterns verbatim,
// and its control state types are the spec's (state surface parity).
const contractKt = readFileSync(
  join(NATIVE, 'texuli-spec/src/commonMain/kotlin/com/texuli/spec/runtime/Contract.kt'),
  'utf8'
);
const ktRegex = (name: string): string | undefined => {
  const match = new RegExp(`val ${name}: Regex = Regex\\("((?:[^"\\\\]|\\\\.)*)"\\)`).exec(
    contractKt
  );
  return match?.[1]?.replace(/\\\$/g, '$').replace(/\\\\/g, '\\');
};
for (const [kt, pattern] of [
  ['ITEM_KEY', SPEC_PATTERNS.itemKey],
  ['INTENT_NAME', SPEC_PATTERNS.intentName],
  ['WORKFLOW_LABEL', SPEC_PATTERNS.workflowLabel],
  ['WORKFLOW_TEXT', SPEC_PATTERNS.workflowText],
  ['LIST_TEXT', SPEC_PATTERNS.listText],
] as const) {
  check(ktRegex(kt) === pattern, `Contract.kt ${kt} is the spec pattern ${pattern}`);
}
const surfaceKt = readFileSync(
  join(NATIVE, 'texuli-spec/src/commonMain/kotlin/com/texuli/spec/runtime/Surface.kt'),
  'utf8'
);
for (const [id, type] of Object.entries(SPEC_CONTROL_STATE_TYPES)) {
  check(surfaceKt.includes(`"${id}" to "${type}"`), `Surface.kt maps ${id} to ${type}`);
}

if (failures.length > 0) {
  console.error(failures.map((f) => `✗ ${f}`).join('\n'));
  process.exit(1);
}
console.log(
  `✓ native structure: ${kotlinFiles.length} Kotlin files, ${allKotlin.length - kotlinFiles.length} generated spec files consumed in place, traces target-independent`
);

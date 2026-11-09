/**
 * Build the Native compatibility view-model from the generated parity data
 * and checked-in conformance traces. Per-component statuses are computed
 * from those sources; this file contains no hand-maintained status rows.
 */
type CompatibilityStatus =
  | 'Supported'
  | 'Partial'
  | 'Experimental'
  | 'Planned'
  | 'Unsupported'
  | 'Not applicable';

interface ParityComponent {
  readonly id: string;
  readonly group: string;
  readonly capability: string;
  readonly agentEmittable: boolean;
  readonly web: string;
  readonly native: 'painted' | 'placeholder';
  readonly readOnly: boolean;
  readonly semanticRule: boolean;
  readonly golden: boolean;
  readonly parityTrace: boolean;
}

interface ParityData {
  readonly specVersion: string;
  readonly totals: {
    readonly catalog: number;
    readonly painted: number;
    readonly placeholder: number;
  };
  readonly components: readonly ParityComponent[];
}

interface TraceNode {
  readonly id?: string;
  readonly children?: readonly TraceNode[];
}

interface TraceData {
  readonly golden?: string;
  readonly fixture?: string;
  readonly trace: readonly TraceNode[];
}

export interface NativeComponentCompatibility {
  readonly id: string;
  readonly group: string;
  readonly capability: string;
  readonly agentEmittable: boolean;
  readonly web: CompatibilityStatus;
  readonly composeDesktop: CompatibilityStatus;
  readonly conformance: CompatibilityStatus;
  readonly evidence: {
    readonly parity: 'native/docs/parity.json';
    readonly traces: readonly string[];
  };
}

export interface NativePlatformCompatibility {
  readonly target: string;
  readonly status: CompatibilityStatus;
  readonly detail: string;
  readonly evidence: readonly string[];
}

export interface NativeCompatibilityData {
  readonly specVersion: string;
  readonly totals: Readonly<{ catalog: number; painted: number; placeholder: number }>;
  readonly platforms: readonly NativePlatformCompatibility[];
  readonly components: readonly NativeComponentCompatibility[];
}

const PARITY_RAW = import.meta.glob<string>('../../../../../native/docs/parity.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const TRACES_RAW = import.meta.glob<string>(
  '../../../../../native/conformance/expected/**/*.trace.json',
  { query: '?raw', import: 'default', eager: true }
);
const SPEC_BUILD_RAW = import.meta.glob<string>(
  '../../../../../native/texuli-spec/build.gradle.kts',
  { query: '?raw', import: 'default', eager: true }
);
const COMPOSE_BUILD_RAW = import.meta.glob<string>(
  '../../../../../native/texuli-compose/build.gradle.kts',
  { query: '?raw', import: 'default', eager: true }
);
const IOS_UI_RAW = import.meta.glob<string>(
  '../../../../../native/texuli-compose/src/iosMain/**/*.kt',
  { query: '?raw', import: 'default', eager: true }
);
const ANDROID_UI_RAW = import.meta.glob<string>(
  '../../../../../native/texuli-compose/src/androidMain/**/*.kt',
  { query: '?raw', import: 'default', eager: true }
);

function onlySource(sources: Record<string, string>, description: string): string {
  const source = Object.values(sources)[0];
  if (!source) throw new Error(`Native compatibility source missing: ${description}`);
  return source;
}

function repoPath(globPath: string): string {
  return globPath.replace(/^\.\.\/\.\.\/\.\.\/\.\.\/\.\.\//, '');
}

function traceIds(node: TraceNode, out: Set<string>): void {
  if (node.id) out.add(node.id);
  for (const child of node.children ?? []) traceIds(child, out);
}

function statusForPaint(component: ParityComponent): CompatibilityStatus {
  if (component.native !== 'painted') return 'Unsupported';
  return component.readOnly ? 'Partial' : 'Supported';
}

function statusForTrace(component: ParityComponent, hasTrace: boolean): CompatibilityStatus {
  if (hasTrace) return 'Supported';
  return component.semanticRule ? 'Experimental' : 'Not applicable';
}

function platformStatus(
  target: string,
  status: CompatibilityStatus,
  detail: string,
  evidence: readonly string[]
): NativePlatformCompatibility {
  return { target, status, detail, evidence };
}

/** Pure generator; the build-time wrapper below supplies checked-in source data. */
export function buildNativeCompatibilityData(
  parity: ParityData,
  traces: Readonly<Record<string, TraceData>>,
  targets: {
    readonly specBuild: string;
    readonly composeBuild: string;
    readonly iosUiFiles: readonly string[];
    readonly androidUiFiles: readonly string[];
  }
): NativeCompatibilityData {
  const goldenIds = new Set<string>();
  const parityIds = new Set<string>();
  const conformanceById = new Map<string, string[]>();
  let goldenTraceCount = 0;
  let parityTraceCount = 0;

  for (const [path, trace] of Object.entries(traces)) {
    const ids = new Set<string>();
    for (const node of trace.trace) traceIds(node, ids);
    const evidencePath = repoPath(path);
    const isParityFixture = evidencePath.includes('/expected/parity/');
    if (isParityFixture) parityTraceCount += 1;
    else goldenTraceCount += 1;
    for (const id of ids) {
      (isParityFixture ? parityIds : goldenIds).add(id);
      const current = conformanceById.get(id) ?? [];
      current.push(evidencePath);
      conformanceById.set(id, current);
    }
  }

  const components = parity.components.map((component): NativeComponentCompatibility => {
    const hasGolden = goldenIds.has(component.id);
    const hasParityTrace = parityIds.has(component.id);
    if (component.golden !== hasGolden || component.parityTrace !== hasParityTrace) {
      throw new Error(`Native parity trace metadata is stale for ${component.id}`);
    }
    const tracePaths = (conformanceById.get(component.id) ?? []).sort();
    return {
      id: component.id,
      group: component.group,
      capability: component.capability,
      agentEmittable: component.agentEmittable,
      web: component.web === 'renders' ? 'Supported' : 'Unsupported',
      composeDesktop: statusForPaint(component),
      conformance: statusForTrace(component, tracePaths.length > 0),
      evidence: { parity: 'native/docs/parity.json', traces: tracePaths },
    };
  });

  if (
    components.length !== parity.totals.catalog ||
    components.filter((item) => item.composeDesktop !== 'Unsupported').length !==
      parity.totals.painted ||
    components.filter((item) => item.evidence.traces.length > 0).length !==
      parity.components.filter((item) => item.golden || item.parityTrace).length
  ) {
    throw new Error('Native compatibility totals do not match parity and conformance sources');
  }

  const specJvm = /jvm\s*\(/.test(targets.specBuild);
  const specIos = /iosArm64\s*\(/.test(targets.specBuild);
  const composeJvm = /jvm\s*\(/.test(targets.composeBuild);
  const composeAndroid = /androidTarget\s*\(/.test(targets.composeBuild);
  const composeIos = /iosArm64\s*\(/.test(targets.composeBuild);
  const anyPainted = parity.totals.painted > 0;
  const allPainted = parity.totals.painted === parity.totals.catalog;

  const platforms = [
    platformStatus(
      'KMP shared spec (JVM + iOS targets)',
      specJvm && specIos ? 'Experimental' : 'Unsupported',
      specJvm && specIos
        ? 'The shared contract compiles for the JVM and iOS; it is not a UI renderer.'
        : 'The shared spec is missing a configured JVM or iOS target.',
      [
        'native/texuli-spec/build.gradle.kts',
        'native/conformance/src/jvmTest/kotlin/com/texuli/conformance/GoldenConformanceTest.kt',
        'native/conformance/src/jvmTest/kotlin/com/texuli/conformance/ParityFixtureConformanceTest.kt',
      ]
    ),
    platformStatus(
      'Compose Desktop',
      !composeJvm || !anyPainted ? 'Unsupported' : allPainted ? 'Supported' : 'Partial',
      `${parity.totals.painted} of ${parity.totals.catalog} catalog components paint in the Compose renderer.`,
      [
        'native/texuli-compose/build.gradle.kts',
        'native/texuli-compose/src/commonMain/kotlin/com/texuli/compose/Registry.kt',
        'native/docs/parity.json',
      ]
    ),
    platformStatus(
      'iOS UI renderer',
      targets.iosUiFiles.length > 0 || composeIos ? 'Experimental' : 'Planned',
      targets.iosUiFiles.length > 0 || composeIos
        ? 'A Compose iOS renderer source/target exists; device readiness is not implied.'
        : 'No iOS UI renderer source or Compose iOS target is present.',
      [
        'native/texuli-compose/build.gradle.kts',
        'native/docs/ADOPTION.md',
        ...targets.iosUiFiles.map(repoPath),
      ]
    ),
    platformStatus(
      'Android UI renderer',
      targets.androidUiFiles.length > 0 || composeAndroid ? 'Experimental' : 'Planned',
      targets.androidUiFiles.length > 0 || composeAndroid
        ? 'An Android renderer source/target exists; device readiness is not implied.'
        : 'No Android UI renderer source or target is present.',
      [
        'native/texuli-compose/build.gradle.kts',
        'native/docs/ADOPTION.md',
        ...targets.androidUiFiles.map(repoPath),
      ]
    ),
  ];

  // Reading the counters above also makes missing trace inputs an obvious failure.
  if (goldenTraceCount === 0 || parityTraceCount === 0) {
    throw new Error('Native conformance trace evidence is incomplete');
  }

  return {
    specVersion: parity.specVersion,
    totals: { ...parity.totals },
    platforms,
    components,
  };
}

const parity = JSON.parse(onlySource(PARITY_RAW, 'native/docs/parity.json')) as ParityData;
const traces = Object.fromEntries(
  Object.entries(TRACES_RAW).map(([path, raw]) => [path, JSON.parse(raw) as TraceData])
);

export const NATIVE_COMPATIBILITY = buildNativeCompatibilityData(parity, traces, {
  specBuild: onlySource(SPEC_BUILD_RAW, 'native/texuli-spec/build.gradle.kts'),
  composeBuild: onlySource(COMPOSE_BUILD_RAW, 'native/texuli-compose/build.gradle.kts'),
  iosUiFiles: Object.keys(IOS_UI_RAW),
  androidUiFiles: Object.keys(ANDROID_UI_RAW),
});

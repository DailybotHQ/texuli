/** Server-side data for Demo A: checked-in spec fixture plus generated Native evidence. */

import { NATIVE_COMPATIBILITY } from '../../../../data/native/compatibility.ts';

// Repository data files are read as raw text (the layer guard forbids deep module imports).
const TRACE_RAW = import.meta.glob<string>(
  '../../../../../../../native/conformance/expected/report-on-demand.trace.json',
  { query: '?raw', import: 'default', eager: true }
);
const FIXTURE_RAW = import.meta.glob<string>(
  '../../../../../../../packages/spec/fixtures/golden/report-on-demand.json',
  { query: '?raw', import: 'default', eager: true }
);
const only = (files: Record<string, string>, name: string): string => {
  const text = Object.values(files)[0];
  if (text === undefined) throw new Error(`Native demo: ${name} is missing`);
  return text;
};
const trace = JSON.parse(only(TRACE_RAW, 'report-on-demand.trace.json'));
const fixture = JSON.parse(only(FIXTURE_RAW, 'report-on-demand.json'));

type BlueprintNode = {
  id: string;
  children?: readonly BlueprintNode[];
};

export const NATIVE_DEMO_FIXTURE = fixture;
export const NATIVE_DEMO_FIXTURE_JSON = JSON.stringify(fixture, null, 2);
export const NATIVE_DEMO_SPEC_VERSION = NATIVE_COMPATIBILITY.specVersion;

export const NATIVE_DEMO_TRACE = trace;
export const NATIVE_DEMO_TRACE_JSON = JSON.stringify(trace, null, 2);

function componentIds(node: BlueprintNode, ids: Set<string>): void {
  ids.add(node.id);
  for (const child of node.children ?? []) componentIds(child, ids);
}

const ids = new Set<string>();
componentIds(fixture.tree, ids);

/** Compose status comes from parity.json + trace metadata, never hand-maintained rows. */
export const NATIVE_DEMO_PARITY = [...ids].map((id) => {
  const item = NATIVE_COMPATIBILITY.components.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Native parity metadata is missing fixture component: ${id}`);
  const tracePath = item.evidence.traces.find((path) =>
    path.endsWith('/report-on-demand.trace.json')
  );
  if (!tracePath) throw new Error(`Native conformance trace is missing fixture component: ${id}`);
  return {
    id: item.id,
    web: item.web,
    composeDesktop: item.composeDesktop,
    conformance: item.conformance,
    tracePath,
    paritySource: item.evidence.parity,
  };
});

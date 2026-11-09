/**
 * View model for `SolutionHow` (ADR-030): the numbered "how it works" steps and the
 * "Built from Texuli" stack drawn from `entry.packages`. The stack has three tiers, top
 * down: the Solution itself, the entry's packages (highest layer first), and the Texuli
 * packages those depend on directly (from `PACKAGE_STACK`). Every tier is plain text,
 * so the diagram is its own text alternative; `summary` is the one-sentence caption.
 */
import { safeHref } from '@texuli/core/url-policy';
import type { SolutionEntry } from '../../../../data/solutions/schema.ts';
import type { SolutionHowProps } from '../types.ts';
import { PACKAGE_STACK } from './package-stack.ts';

export interface ArchitectureStepView {
  readonly index: number;
  readonly title: string;
  readonly body: string;
  readonly package?: string;
}

export interface ArchitecturePackageView {
  readonly name: string;
  readonly layer: number;
  /** "L8", the layer badge. */
  readonly layerLabel: string;
  readonly label: string;
  /** The entry's role for its own packages, the stack label for foundations. */
  readonly role: string;
  readonly subpaths: readonly string[];
  /** The npm page, resolved through the URL policy. */
  readonly href: string | undefined;
}

export interface ArchitectureView {
  /** `solution-how-<slug>`: the h2 id the section is labelled by. */
  readonly headingId: string;
  readonly title: string;
  readonly steps: readonly ArchitectureStepView[];
  readonly solution: string;
  readonly packages: readonly ArchitecturePackageView[];
  readonly foundation: readonly ArchitecturePackageView[];
  readonly summary: string;
}

function stackOf(name: string) {
  const stack = PACKAGE_STACK[name];
  if (!stack) throw new Error(`SolutionHow: "${name}" is missing from PACKAGE_STACK`);
  return stack;
}

function npmHref(name: string): string | undefined {
  return safeHref(`https://www.npmjs.com/package/${name}`, 'developer');
}

const byLayerThenName = (a: { layer: number; name: string }, b: { layer: number; name: string }) =>
  b.layer - a.layer || a.name.localeCompare(b.name);

function listText(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The entry's packages, highest layer first, then their direct Texuli dependencies. */
export function architectureStack(entry: SolutionEntry): {
  packages: ArchitecturePackageView[];
  foundation: ArchitecturePackageView[];
} {
  const own = new Set(entry.packages.map((p) => p.name));
  const packages = entry.packages
    .map((pkg) => {
      const stack = stackOf(pkg.name);
      return {
        name: pkg.name,
        layer: stack.layer,
        layerLabel: `L${stack.layer}`,
        label: stack.label,
        role: pkg.role,
        subpaths: pkg.subpaths,
        href: npmHref(pkg.name),
      };
    })
    .sort(byLayerThenName);
  const deps = new Set<string>();
  for (const pkg of entry.packages) {
    for (const dep of stackOf(pkg.name).dependsOn) if (!own.has(dep)) deps.add(dep);
  }
  const foundation = [...deps]
    .map((name) => {
      const stack = stackOf(name);
      return {
        name,
        layer: stack.layer,
        layerLabel: `L${stack.layer}`,
        label: stack.label,
        role: stack.label,
        subpaths: [] as readonly string[],
        href: npmHref(name),
      };
    })
    .sort(byLayerThenName);
  return { packages, foundation };
}

/** Builds the block view; throws when the props break the block contract. */
export function architectureView(props: SolutionHowProps): ArchitectureView {
  const { entry } = props;
  if (props.title.trim().length === 0) throw new Error('SolutionHow: title is empty');
  if (props.steps.length === 0) throw new Error('SolutionHow: needs at least one step');
  const own = new Set(entry.packages.map((p) => p.name));
  const steps = props.steps.map((step, i) => {
    if (step.title.trim().length === 0 || step.body.trim().length === 0) {
      throw new Error(`SolutionHow: step ${i + 1} needs a title and a body`);
    }
    if (step.package !== undefined && !own.has(step.package)) {
      throw new Error(`SolutionHow: step "${step.title}" names a package outside the entry`);
    }
    return { index: i + 1, title: step.title, body: step.body, package: step.package };
  });
  const { packages, foundation } = architectureStack(entry);
  const summary =
    `${entry.name} is built from ${listText(packages.map((p) => p.name))}` +
    (foundation.length > 0 ? `, on ${listText(foundation.map((p) => p.name))}.` : '.');
  return {
    headingId: `solution-how-${entry.slug}`,
    title: props.title,
    steps,
    solution: entry.name,
    packages,
    foundation,
    summary,
  };
}

/**
 * The demo's fictional brand inputs (PLAN_017 T-demo): one per input kind `texuli ds
 * generate` reads — a brief one-liner, a tiny DTCG token set and a short site stylesheet.
 * Harborline, Quillmark and Tumbletown are fictional. Each input keeps one value the
 * importer cannot place, so the generation report has something honest to show.
 */
export type DemoInputKind = 'brief' | 'tokens' | 'css';

export interface DemoBrandInput {
  readonly id: string;
  readonly name: string;
  readonly kind: DemoInputKind;
  /** The flag `texuli ds generate` takes for this input. */
  readonly flag: '--brief' | '--from-tokens' | '--from-css';
  /** One line about the brand, shown on its card. */
  readonly summary: string;
  /** The input as text: the brief, the token JSON or the stylesheet. */
  readonly source: string;
}

const QUILLMARK_TOKENS = {
  color: {
    brand: { $type: 'color', $value: '#9a3412' },
    ink: { $type: 'color', $value: '#1c1917' },
  },
  font: { body: { $type: 'fontFamily', $value: ['Georgia', 'serif'] } },
};

export const DEMO_BRAND_INPUTS: readonly DemoBrandInput[] = [
  {
    id: 'harborline',
    name: 'Harborline',
    kind: 'brief',
    flag: '--brief',
    summary: 'A calm, rounded teal brand, from a one-line brief.',
    source: 'name Harborline, brand #0e7490, rounded, calm, comfortable',
  },
  {
    id: 'quillmark',
    name: 'Quillmark',
    kind: 'tokens',
    flag: '--from-tokens',
    summary: 'An editorial rust brand, from a small DTCG token file.',
    source: JSON.stringify(QUILLMARK_TOKENS, null, 2),
  },
  {
    id: 'tumbletown',
    name: 'Tumbletown',
    kind: 'css',
    flag: '--from-css',
    summary: 'A playful pink brand, from its site stylesheet.',
    source:
      ':root {\n  --brand: #db2777;\n  --radius: 16px;\n  font-family: "Nunito", system-ui, sans-serif;\n}\n.btn { box-shadow: 0 4px 0 #9d174d; }',
  },
];

export const DEMO_INPUT_LABELS: Readonly<Record<DemoInputKind, string>> = {
  brief: 'Brief',
  tokens: 'Tokens',
  css: 'CSS',
};

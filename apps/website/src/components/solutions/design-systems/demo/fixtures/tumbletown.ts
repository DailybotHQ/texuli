/** Tumbletown (fictional): the stylesheet input of the demo. The `.btn` rule is not a global token rule, so the report lists it as dropped. */
import type { DemoBrandInput } from './brands.ts';

export const TUMBLETOWN: DemoBrandInput = {
  id: 'tumbletown',
  name: 'Tumbletown',
  kind: 'css',
  flag: '--from-css',
  summary: 'A playful pink brand, from its site stylesheet.',
  source:
    ':root {\n  --brand: #db2777;\n  --radius: 16px;\n  font-family: "Nunito", system-ui, sans-serif;\n}\n.btn { box-shadow: 0 4px 0 #9d174d; }',
};

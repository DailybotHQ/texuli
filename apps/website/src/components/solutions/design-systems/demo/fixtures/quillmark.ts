/** Quillmark (fictional): the DTCG token input of the demo. `$.color.ink` has no design-system field, so the report lists it as dropped. */
import type { DemoBrandInput } from './brands.ts';

const QUILLMARK_TOKENS = {
  color: {
    brand: { $type: 'color', $value: '#9a3412' },
    ink: { $type: 'color', $value: '#1c1917' },
  },
  font: { body: { $type: 'fontFamily', $value: ['Georgia', 'serif'] } },
};

export const QUILLMARK: DemoBrandInput = {
  id: 'quillmark',
  name: 'Quillmark',
  kind: 'tokens',
  flag: '--from-tokens',
  summary: 'An editorial rust brand, from a small DTCG token file.',
  source: JSON.stringify(QUILLMARK_TOKENS, null, 2),
};

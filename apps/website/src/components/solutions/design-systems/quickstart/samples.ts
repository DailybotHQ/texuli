/**
 * The Design systems quickstart: the install line and one command per step of the loop,
 * each with flags the published `texuli ds` CLI accepts (since Texuli 0.16.1; unchanged in 0.17.0). The CLI tests in
 * `packages/tools/tests/ds-*-cli.test.ts` run these commands; the paths are examples for
 * a fictional brand, Harborline.
 */
import type { SolutionEntry } from '../../../../data/solutions/schema.ts';
import type { SolutionQuickstartProps } from '../../shared/types.ts';

export const DESIGN_SYSTEMS_QUICKSTART_VERIFIED_BY = 'packages/tools/tests/ds-*-cli.test.ts';

export const DESIGN_SYSTEMS_INSTALL = `pnpm add texuli @texuli/tokens
pnpm add -D @texuli/tools`;

export const DESIGN_SYSTEMS_GENERATE = `# 1. Create: a draft and its report (harborline.ds.json.report.json)
texuli ds generate --from-tokens tokens/brand.tokens.json --from-css src/brand.css -o design-systems/harborline.ds.json`;

export const DESIGN_SYSTEMS_APPROVE = `# 3. Approve: a person stamps it, then commits it for the CODEOWNERS review
texuli ds approve design-systems/harborline.ds.json --by "Design reviewer" --version 1.0.0
texuli ds hash design-systems/harborline.ds.json   # exit 1 when an approved file changed`;

export const DESIGN_SYSTEMS_VALIDATE = `# 4. Lock: check every prototype against the allowed set (CI)
texuli ds validate design-systems/harborline.ds.json --locked --prototype ./src --json`;

export const DESIGN_SYSTEMS_PACK = `# 5. Share: one versioned bundle
texuli ds pack design-systems/harborline.ds.json --out dist/harborline-1.0.0.bundle.json`;

export function designSystemsQuickstart(entry: SolutionEntry): SolutionQuickstartProps {
  return {
    entry,
    title: 'Run the loop from your terminal',
    install: { label: 'Install', language: 'bash', code: DESIGN_SYSTEMS_INSTALL },
    samples: [
      { label: 'Create', language: 'bash', code: DESIGN_SYSTEMS_GENERATE },
      { label: 'Approve', language: 'bash', code: DESIGN_SYSTEMS_APPROVE },
      { label: 'Lock', language: 'bash', code: DESIGN_SYSTEMS_VALIDATE },
      { label: 'Share', language: 'bash', code: DESIGN_SYSTEMS_PACK },
    ],
    verifiedBy: DESIGN_SYSTEMS_QUICKSTART_VERIFIED_BY,
  };
}

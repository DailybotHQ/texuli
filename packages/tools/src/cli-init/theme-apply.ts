/// <reference types="node" />
/**
 * `texuli theme apply <id>`: switches an initialized project to another
 * theme. It rewrites the theme block of the generated stylesheet and
 * `data-tx-theme` on the document, then updates `texuli.config.json`.
 */
import { noFlashScript } from '@texuli/tokens/no-flash';
import { CONFIG_FILE, formatConfig, isId, parseConfig } from './config.ts';
import { openProject, readProjectFile } from './files.ts';
import { applyEdits } from './init.ts';
import { themeCss, themeExists } from './themes.ts';
import type { CommandResult, ThemeApplyOptions } from './types.ts';
import { isGeneratedStylesheet, stylesheet, withDocumentWiring, withTheme } from './wire.ts';

export async function applyProjectTheme(options: ThemeApplyOptions): Promise<CommandResult> {
  const dryRun = options.dryRun === true;
  const fail = (errors: string[]): CommandResult => ({
    ok: false,
    dryRun,
    files: [],
    errors,
    notes: [],
  });
  const opened = openProject(options.cwd);
  if (typeof opened === 'string') return fail([opened]);
  if (!isId(options.theme) || !(await themeExists(options.theme))) {
    return fail([`Unknown theme: ${options.theme}. Run \`texuli theme list\`.`]);
  }
  const configText = await readProjectFile(opened, CONFIG_FILE, CONFIG_FILE);
  if (configText === null) return fail([`No ${CONFIG_FILE}: run \`texuli init\` first.`]);
  if (typeof configText === 'object') return fail([configText.error]);
  const parsed = parseConfig(configText);
  if ('errors' in parsed) return fail(parsed.errors);
  const config = parsed.config;

  const css = await readProjectFile(opened, config.css, 'Stylesheet');
  if (css !== null && typeof css === 'object') return fail([css.error]);
  const compiled = await themeCss(options.theme);
  let cssAfter: string;
  if (css !== null && isGeneratedStylesheet(css))
    cssAfter = withTheme(css, options.theme, compiled);
  else if (options.force === true || css === null) cssAfter = stylesheet(options.theme, compiled);
  else return fail([`${config.css} lost its texuli markers: pass --force to regenerate it.`]);

  const document = await readProjectFile(opened, config.document, 'Document');
  if (document !== null && typeof document === 'object') return fail([document.error]);
  const edits = [{ path: config.css, before: css, after: cssAfter }];
  const notes: string[] = [];
  const documentAfter =
    document === null
      ? null
      : withDocumentWiring(
          document,
          options.theme,
          noFlashScript(config.namespace, 'system'),
          config.framework === 'astro'
        );
  if (document !== null && documentAfter !== null) {
    edits.push({ path: config.document, before: document, after: documentAfter });
  } else {
    notes.push(`Set data-tx-theme="${options.theme}" on <html> in ${config.document} yourself.`);
  }
  edits.push({
    path: CONFIG_FILE,
    before: configText,
    after: formatConfig({ ...config, theme: options.theme }),
  });
  const result = await applyEdits(opened, edits, dryRun);
  return { ...result, notes };
}

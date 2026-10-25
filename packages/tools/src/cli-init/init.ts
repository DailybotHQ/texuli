/// <reference types="node" />
/**
 * `texuli init`: wires Texuli's tokens and CSS into a Vite, Astro or
 * SvelteKit project. It writes the generated stylesheet (base styles and a
 * theme), imports it from the framework's entry, puts the no-flash
 * bootstrap and `data-tx-theme` on the document, and records the choices in
 * `texuli.config.json`. Re-running it changes nothing. No network.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { noFlashScript } from '@texuli/tokens/no-flash';
import { CONFIG_FILE, formatConfig, isId, parseConfig } from './config.ts';
import { DEFAULTS, detectFramework } from './detect.ts';
import { openProject, type Project, readProjectFile, writeProjectFile } from './files.ts';
import { projectPathError } from './safe-path.ts';
import { themeCss, themeExists } from './themes.ts';
import type { CommandResult, FileChange, InitOptions, InitResult, TexuliConfig } from './types.ts';
import {
  importSpecifier,
  isGeneratedStylesheet,
  stylesheet,
  withCssImport,
  withDocumentWiring,
  withTheme,
} from './wire.ts';

export const DEFAULT_THEME = 'enterprise-neutral';
export const DEFAULT_NAMESPACE = 'app';

const failed = (errors: string[], dryRun: boolean): InitResult => ({
  ok: false,
  dryRun,
  files: [],
  errors,
  notes: [],
});

function firstExisting(project: Project, candidates: readonly string[]): string {
  return candidates.find((rel) => existsSync(join(project.root, rel))) ?? (candidates[0] as string);
}

/** The edits for one project, in order: stylesheet, entry, document, config. */
interface Edit {
  path: string;
  before: string | null;
  after: string;
}

/** Writes the planned edits (or only reports them in a dry run). */
export async function applyEdits(
  project: Project,
  edits: Edit[],
  dryRun: boolean
): Promise<CommandResult> {
  const files: FileChange[] = [];
  const errors: string[] = [];
  for (const edit of edits) {
    const change = await writeProjectFile(project, edit.path, edit.before, edit.after, dryRun);
    if ('error' in change) {
      errors.push(change.error);
      break;
    }
    files.push(change);
  }
  return { ok: errors.length === 0, dryRun, files, errors, notes: [] };
}

export async function initProject(options: InitOptions): Promise<InitResult> {
  const dryRun = options.dryRun === true;
  const force = options.force === true;
  const opened = openProject(options.cwd);
  if (typeof opened === 'string') return failed([opened], dryRun);
  const project = opened;

  // The framework: explicit, or from package.json.
  let framework = options.framework;
  if (!framework) {
    const pkg = await readProjectFile(project, 'package.json', 'package.json');
    if (pkg !== null && typeof pkg === 'object') return failed([pkg.error], dryRun);
    if (pkg === null)
      return failed(['No package.json: pass --framework vite|astro|sveltekit.'], dryRun);
    let parsed: unknown;
    try {
      parsed = JSON.parse(pkg);
    } catch {
      return failed(['package.json is not valid JSON.'], dryRun);
    }
    framework = detectFramework(parsed) ?? undefined;
    if (!framework) {
      return failed(
        ['Could not detect Vite, Astro or SvelteKit in package.json: pass --framework.'],
        dryRun
      );
    }
  }
  const defaults = DEFAULTS[framework];
  const theme = options.theme ?? DEFAULT_THEME;
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const css = options.css ?? defaults.css;
  const errors: string[] = [];
  if (!isId(theme) || !(await themeExists(theme))) {
    errors.push(`Unknown theme: ${theme}. Run \`texuli theme list\`.`);
  }
  if (!isId(namespace)) errors.push(`--namespace must be a kebab-case id (got: ${namespace}).`);
  const cssError = projectPathError('--css', css);
  if (cssError) errors.push(cssError);
  else if (!css.endsWith('.css')) errors.push(`--css must name a .css file (got: ${css}).`);
  if (errors.length > 0) return failed(errors, dryRun);

  const config: TexuliConfig = {
    framework,
    css,
    entry: firstExisting(project, defaults.entries),
    document: firstExisting(project, defaults.document),
    theme,
    namespace,
  };

  // Read everything first: any refusal stops before a single write.
  const read = async (rel: string, name: string) => readProjectFile(project, rel, name);
  const sources = {
    css: await read(config.css, 'Stylesheet'),
    entry: await read(config.entry, 'Entry'),
    document: await read(config.document, 'Document'),
    config: await read(CONFIG_FILE, CONFIG_FILE),
  };
  for (const source of Object.values(sources)) {
    if (source !== null && typeof source === 'object') errors.push(source.error);
  }
  if (errors.length > 0) return failed(errors, dryRun);
  const text = (value: string | null | { error: string }) =>
    typeof value === 'string' ? value : null;

  const compiled = await themeCss(theme);
  const cssBefore = text(sources.css);
  let cssAfter: string;
  if (cssBefore === null) cssAfter = stylesheet(theme, compiled);
  else if (isGeneratedStylesheet(cssBefore)) cssAfter = withTheme(cssBefore, theme, compiled);
  else if (force) cssAfter = stylesheet(theme, compiled);
  else {
    return failed(
      [
        `${config.css} exists and was not generated by texuli: pass --force to replace it, or --css <path>.`,
      ],
      dryRun
    );
  }

  const configBefore = text(sources.config);
  if (configBefore !== null && 'errors' in parseConfig(configBefore) && !force) {
    return failed(
      [`${CONFIG_FILE} exists but is not a valid texuli config: pass --force to replace it.`],
      dryRun
    );
  }

  const entryBefore = text(sources.entry);
  const entryAfter = withCssImport(
    entryBefore,
    config.entry,
    importSpecifier(config.entry, config.css)
  );
  const astro = framework === 'astro';
  // In Astro the layout is both the entry and the document.
  const documentBefore = config.document === config.entry ? entryAfter : text(sources.document);
  const notes: string[] = [];
  const edits: Edit[] = [{ path: config.css, before: cssBefore, after: cssAfter }];
  const documentAfter =
    documentBefore === null
      ? null
      : withDocumentWiring(documentBefore, theme, noFlashScript(namespace, 'system'), astro);
  if (config.document === config.entry) {
    edits.push({ path: config.entry, before: entryBefore, after: documentAfter ?? entryAfter });
  } else {
    edits.push({ path: config.entry, before: entryBefore, after: entryAfter });
    if (documentAfter !== null) {
      edits.push({ path: config.document, before: text(sources.document), after: documentAfter });
    }
  }
  if (documentAfter === null) {
    notes.push(
      `No <html> and <head> in ${config.document}: add data-tx-theme="${theme}" to <html> and the no-flash script (texuli theme apply re-checks).`
    );
  }
  if (astro && entryBefore === null) {
    notes.push(`Created ${config.entry}: wrap your pages in it so they get the theme.`);
  }
  edits.push({ path: CONFIG_FILE, before: configBefore, after: formatConfig(config) });

  const result = await applyEdits(project, edits, dryRun);
  return { ...result, notes: [...notes, ...result.notes], config };
}

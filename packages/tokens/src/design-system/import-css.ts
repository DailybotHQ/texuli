/**
 * Import the small, declarative token surface of a site stylesheet. This
 * importer only reads bounded CSS text; it never resolves imports, fetches
 * font sources, evaluates values, or writes CSS into a live page.
 */

import { SEMANTIC_ROLES } from '../contract/semantic.ts';
import type { DesignSystemImportResultWithLosses } from './import.ts';
import {
  DESIGN_SYSTEM_IMPORT_LIMITS,
  type DesignSystemImportOptions,
  documentRoot,
  failInput,
  finalize,
  guard,
  identity,
  isObject,
  type Json,
  type JsonObject,
  ordered,
  setPath,
  toColor,
  toMs,
  toNumber,
  toPx,
  toStack,
  toWeight,
  Warnings,
} from './io.ts';
import { type DesignSystemImportLoss, withLossReport } from './token-formats.ts';

const CSS_DECLARATION_LIMIT = 5_000;
const LOSS_LIMIT = DESIGN_SYSTEM_IMPORT_LIMITS.warnings;
const COLOR_ROLE_ALIASES: Readonly<Record<string, string>> = {
  'primary-foreground': 'primaryForeground',
  'secondary-foreground': 'secondaryForeground',
  'accent-foreground': 'accentForeground',
  'destructive-foreground': 'destructiveForeground',
  'muted-foreground': 'mutedForeground',
  'surface-foreground': 'surfaceForeground',
  'elevated-foreground': 'elevatedForeground',
  'popover-foreground': 'elevatedForeground',
  'card-foreground': 'surfaceForeground',
  'sidebar-foreground': 'sidebarForeground',
  'sidebar-primary': 'sidebarPrimary',
  'sidebar-border': 'sidebarBorder',
  'sidebar-primary-foreground': 'sidebarPrimaryForeground',
  'primary-soft': 'primarySoft',
  'primary-soft-foreground': 'primarySoftForeground',
  'border-strong': 'borderStrong',
};
const COLOR_ROLES = new Set<string>(SEMANTIC_ROLES);
const MOTION_STEPS = new Set(['fast', 'base', 'slow']);
const FORBIDDEN_CSS = /@import\b|expression\s*\(|javascript\s*:|<\s*\/?\s*script\b/i;
const LOCAL_FONT = /^(?:\.\/)?[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.(?:woff2?|ttf|otf)$/i;

interface CssRule {
  selector: string;
  declarations: Map<string, string>;
}

const camel = (value: string) => value.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const cssPath = (selector: string, property: string) =>
  `$.rules[${JSON.stringify(selector)}].${property}`;

function stripComments(css: string): string | undefined {
  let out = '';
  let quote = '';
  for (let i = 0; i < css.length; i++) {
    const char = css[i] as string;
    if (quote) {
      out += char;
      if (char === '\\' && i + 1 < css.length) out += css[++i] as string;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      out += char;
    } else if (char === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end < 0) return;
      out += ' ';
      i = end + 1;
    } else out += char;
  }
  return quote ? undefined : out;
}

function parseDeclarations(body: string): Map<string, string> {
  const result = new Map<string, string>();
  let start = 0;
  let quote = '';
  let parens = 0;
  const read = (part: string) => {
    const colon = part.indexOf(':');
    if (colon < 1) return;
    const name = part.slice(0, colon).trim().toLowerCase();
    const value = part
      .slice(colon + 1)
      .trim()
      .replace(/\s*!important\s*$/i, '');
    if (name && value) result.set(name, value);
  };
  for (let i = 0; i < body.length; i++) {
    const char = body[i] as string;
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '(') parens++;
    else if (char === ')') parens = Math.max(0, parens - 1);
    else if (char === ';' && parens === 0) {
      read(body.slice(start, i));
      start = i + 1;
    }
  }
  read(body.slice(start));
  return result;
}

function parseRules(css: string): CssRule[] | undefined {
  const open = (css.match(/{/g) ?? []).length;
  const close = (css.match(/}/g) ?? []).length;
  if (open !== close) return;
  const rules: CssRule[] = [];
  const block = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of css.matchAll(block)) {
    const selector = (match[1] as string).trim();
    if (!selector) continue;
    rules.push({ selector, declarations: parseDeclarations(match[2] as string) });
    if (rules.length > CSS_DECLARATION_LIMIT) return;
  }
  return rules;
}

function customColorName(name: string): { mode: 'light' | 'dark'; role: string } | undefined {
  let value = name
    .toLowerCase()
    .replace(/^tx-/, '')
    .replace(/^(?:color|colors)-/, '');
  let mode: 'light' | 'dark' = 'light';
  if (value.startsWith('dark-')) {
    mode = 'dark';
    value = value.slice(5);
  } else if (value.startsWith('light-')) value = value.slice(6);
  value = value.replace(/^roles?-/, '');
  if (value === 'brand' || value === 'seed' || value === 'brand-seed')
    return { mode, role: 'brand.seed' };
  if (value.startsWith('brand-')) {
    const brand = value.slice(6);
    if (brand === 'secondary' || brand === 'accent') return { mode, role: `brand.${brand}` };
  }
  const role = COLOR_ROLE_ALIASES[value] ?? camel(value);
  return COLOR_ROLES.has(role) ? { mode, role: `roles.${mode}.${role}` } : undefined;
}

function fontRoleFor(value: string, selector = ''): string {
  const text = `${value} ${selector}`.toLowerCase();
  if (/\b(?:mono|monospace|code)\b/.test(text)) return 'mono';
  if (/\bserif\b/.test(text) && !/\bsans-serif\b/.test(text)) return 'serif';
  if (/\b(?:heading|display|title|h[1-6])\b/.test(text)) return 'heading';
  return 'sans';
}

function safeFontSource(value: string): string | undefined {
  const match = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/i.exec(value);
  const source = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!source || !LOCAL_FONT.test(source) || source.split('/').includes('..')) return;
  return source;
}

function transitionTimes(value: string): number[] {
  const times: number[] = [];
  for (const match of value.matchAll(/\b\d+(?:\.\d+)?\s*(?:ms|s)\b/gi)) {
    const raw = match[0]?.replace(/\s+/g, '');
    const converted = toMs(raw);
    if (converted.ok && !times.includes(converted.value)) times.push(converted.value);
  }
  return times.sort((a, b) => a - b);
}

function themeRole(selector: string): 'light' | 'dark' {
  return /(?:^|[\s.:#-])dark(?:$|[\s.:#-])/i.test(selector) ? 'dark' : 'light';
}

/** Import supported design tokens from a stylesheet string without loading or executing it. */
export function importSiteCss(
  cssText: unknown,
  options: DesignSystemImportOptions = {}
): DesignSystemImportResultWithLosses {
  const warnings = new Warnings();
  const losses: DesignSystemImportLoss[] = [];
  let lossOverflow = false;
  const lose = (path: string, reason: string, value?: string) => {
    if (losses.length >= LOSS_LIMIT) {
      lossOverflow = true;
      return;
    }
    losses.push({ path, reason, ...(value === undefined ? {} : { value }) });
  };
  const result = guard(warnings, () => {
    if (typeof cssText !== 'string') return failInput(warnings, 'A site stylesheet must be text.');
    if (cssText.length > (options.maxBytes ?? DESIGN_SYSTEM_IMPORT_LIMITS.bytes))
      return failInput(warnings, 'The stylesheet exceeds the import text limit.', 'input-limit');
    const withoutComments = stripComments(cssText);
    if (withoutComments === undefined)
      return failInput(warnings, 'The stylesheet has an unterminated comment or string.');
    if (FORBIDDEN_CSS.test(withoutComments))
      return failInput(warnings, 'The stylesheet contains a forbidden import or executable value.');
    const rules = parseRules(withoutComments);
    if (!rules)
      return failInput(
        warnings,
        'The stylesheet is malformed or has too many rules.',
        'input-limit'
      );

    const doc = documentRoot(identity({}, options, warnings, 'Imported site CSS'));
    const set = (path: string, value: Json, sourcePath: string, sourceValue: string) => {
      const keys = path.split('.');
      let node: Json | undefined = doc;
      for (const key of keys.slice(0, -1)) {
        if (!isObject(node)) {
          node = undefined;
          break;
        }
        node = node[key];
      }
      const previous = isObject(node) ? node[keys[keys.length - 1] as string] : undefined;
      if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(value))
        lose(sourcePath, 'A later stylesheet value replaced an earlier token.', sourceValue);
      setPath(doc, keys, value);
    };
    let declarationCount = 0;
    const fontStacks = new Map<string, string[]>();
    let declaredSansToken: { property: string; stack: string[] } | undefined;
    for (const rule of rules) {
      for (const [property, value] of rule.declarations) {
        if (!property.startsWith('--')) continue;
        const name = property.slice(2).toLowerCase().replace(/_/g, '-');
        if (!/^(?:tx-)?(?:font-family-?|font-)sans$/.test(name)) continue;
        const stack = toStack(value);
        if (stack.ok) declaredSansToken = { property, stack: stack.value };
      }
    }

    for (const rule of rules) {
      const isFace = /^@font-face$/i.test(rule.selector);
      for (const [property, value] of rule.declarations) {
        if (++declarationCount > CSS_DECLARATION_LIMIT)
          return failInput(
            warnings,
            'The stylesheet exceeds the declaration limit.',
            'input-limit'
          );
        const sourcePath = cssPath(rule.selector, property);
        if (isFace) continue;
        if (property.startsWith('--')) {
          const name = property.slice(2).toLowerCase().replace(/_/g, '-');
          const color = customColorName(name);
          if (color) {
            const converted = toColor(value);
            if (converted.ok) set(`color.${color.role}`, converted.value, sourcePath, value);
            else lose(sourcePath, converted.message, value);
            continue;
          }
          const fontMatch = /^(?:tx-)?(?:font-family-?|font-)(sans|heading|mono|serif)$/.exec(name);
          const genericFont = /^(?:tx-)?font-family$/.test(name);
          if (fontMatch || genericFont) {
            const role = fontMatch?.[1] ?? 'sans';
            const stack = toStack(value);
            if (stack.ok) {
              if (stack.dropped)
                lose(sourcePath, 'Some unsafe or unsupported font names were dropped.', value);
              const merged = stack.value;
              for (const family of fontStacks.get(role) ?? [])
                if (!merged.includes(family)) merged.push(family);
              fontStacks.set(role, merged);
              set(`typography.families.${role}.stack`, merged, sourcePath, value);
            } else lose(sourcePath, stack.message, value);
            continue;
          }
          const typeMatch =
            /^(?:tx-)?(?:font-)?(size|weight|line-height|line|tracking|letter-spacing)-(display|title|heading|body|label|caption|code)$/.exec(
              name
            );
          if (typeMatch) {
            const field = typeMatch[1] as string;
            const role = typeMatch[2] as string;
            const converter = field === 'size' ? toPx : field === 'weight' ? toWeight : toNumber;
            const normalized = field === 'letter-spacing' ? value.replace(/em$/, '') : value;
            const converted = converter(normalized);
            const key =
              field === 'line-height' ? 'line' : field === 'letter-spacing' ? 'tracking' : field;
            if (converted.ok)
              set(`typography.roles.${role}.${key}`, converted.value, sourcePath, value);
            else lose(sourcePath, converted.message, value);
            continue;
          }
          if (/^(?:tx-)?(?:shape-)?(?:border-)?radius(?:-[a-z0-9-]+)?$/.test(name)) {
            const converted = toPx(value);
            if (converted.ok) set('shape.radius', converted.value, sourcePath, value);
            else lose(sourcePath, converted.message, value);
            continue;
          }
          if (/^(?:tx-)?(?:border-width|shape-border-width)$/.test(name)) {
            const converted = toPx(value);
            if (converted.ok) set('shape.borderWidth', converted.value, sourcePath, value);
            else lose(sourcePath, converted.message, value);
            continue;
          }
          if (/^(?:tx-)?(?:space|spacing)(?:-base|-\d+)?$/.test(name)) {
            const converted = toPx(value);
            if (converted.ok) set('space.base', converted.value, sourcePath, value);
            else lose(sourcePath, converted.message, value);
            continue;
          }
          if (/^(?:tx-)?(?:space|spacing)-density$/.test(name)) {
            const converted = toNumber(value);
            if (converted.ok) set('space.density', converted.value, sourcePath, value);
            else lose(sourcePath, converted.message, value);
            continue;
          }
          const duration =
            /^(?:tx-)?(?:(?:motion|transition)-)?(?:duration|transition)(?:-duration)?(?:-(fast|base|slow))?$/.exec(
              name
            );
          if (duration) {
            const converted = toMs(value);
            const step = duration[1] && MOTION_STEPS.has(duration[1]) ? duration[1] : 'base';
            if (converted.ok) set(`motion.durations.${step}`, converted.value, sourcePath, value);
            else lose(sourcePath, converted.message, value);
            continue;
          }
          const personality = /^(?:tx-)?motion-personality$/.test(name);
          if (personality && ['none', 'subtle', 'standard', 'expressive'].includes(value)) {
            set('motion.personality', value, sourcePath, value);
            continue;
          }
          lose(sourcePath, 'No design-system field takes this custom property.', value);
          continue;
        }
        const selector = rule.selector.toLowerCase();
        if (property === 'font-family') {
          const role = fontRoleFor(value, selector);
          const stack = toStack(value);
          if (stack.ok) {
            if (stack.dropped)
              lose(sourcePath, 'Some unsafe or unsupported font names were dropped.', value);
            if (
              role === 'sans' &&
              declaredSansToken &&
              JSON.stringify(stack.value) !== JSON.stringify(declaredSansToken.stack)
            ) {
              lose(
                sourcePath,
                `Kept ${declaredSansToken.property} over this body font-family stack.`,
                value
              );
              continue;
            }
            fontStacks.set(role, stack.value);
            set(`typography.families.${role}.stack`, stack.value, sourcePath, value);
          } else lose(sourcePath, stack.message, value);
        } else if (property === 'border-radius') {
          const converted = toPx(value);
          if (converted.ok) set('shape.radius', converted.value, sourcePath, value);
          else lose(sourcePath, converted.message, value);
        } else if (property === 'transition-duration' || property === 'transition') {
          const times = transitionTimes(value);
          if (times.length === 0)
            lose(sourcePath, 'Expected one or more CSS transition times.', value);
          else if (times.length === 1)
            set('motion.durations.base', times[0] as number, sourcePath, value);
          else {
            set('motion.durations.fast', times[0] as number, sourcePath, value);
            const middle = times[Math.floor((times.length - 1) / 2)] as number;
            set('motion.durations.base', middle, sourcePath, value);
            set('motion.durations.slow', times[times.length - 1] as number, sourcePath, value);
            for (const time of times.slice(1, -1))
              if (time !== middle)
                lose(
                  sourcePath,
                  'An intermediate transition time has no design-system duration slot.',
                  `${time}ms`
                );
          }
        } else if (
          property === 'font-size' ||
          property === 'font-weight' ||
          property === 'line-height' ||
          property === 'letter-spacing'
        ) {
          const role = /h[1-6]|heading|title/.test(selector) ? 'heading' : 'body';
          const key =
            property === 'font-size'
              ? 'size'
              : property === 'font-weight'
                ? 'weight'
                : property === 'line-height'
                  ? 'line'
                  : 'tracking';
          const normalized = property === 'letter-spacing' ? value.replace(/em$/, '') : value;
          const converted =
            property === 'font-size'
              ? toPx(normalized)
              : property === 'font-weight'
                ? toWeight(normalized)
                : toNumber(normalized);
          if (converted.ok)
            set(`typography.roles.${role}.${key}`, converted.value, sourcePath, value);
          else lose(sourcePath, converted.message, value);
        } else if (
          (property === 'color' || property === 'background-color') &&
          /:root|html|body/.test(selector)
        ) {
          const role = property === 'color' ? 'foreground' : 'background';
          const converted = toColor(value);
          if (converted.ok)
            set(`color.roles.${themeRole(selector)}.${role}`, converted.value, sourcePath, value);
          else lose(sourcePath, converted.message, value);
        } else if (property === 'src' && isFace) {
          // Font sources are handled below; the importer never fetches them.
        } else if (property !== 'src') {
          lose(sourcePath, 'This stylesheet declaration is not imported.', value);
        }
      }
      if (isFace) {
        const familyValue = rule.declarations.get('font-family');
        const familyResult = toStack(familyValue);
        if (!familyValue || !familyResult.ok) {
          lose(
            cssPath(rule.selector, 'font-family'),
            familyResult.ok ? 'Missing family name.' : familyResult.message,
            familyValue
          );
          continue;
        }
        const familyName = familyResult.value[0] as string;
        if (familyResult.dropped)
          lose(
            cssPath(rule.selector, 'font-family'),
            'Some unsafe or unsupported font names were dropped.',
            familyValue
          );
        const role =
          [...fontStacks.entries()].find(([, stack]) => stack.includes(familyName))?.[0] ??
          fontRoleFor(familyName);
        const currentStack = fontStacks.get(role) ?? [familyName];
        if (!currentStack.includes(familyName)) currentStack.push(familyName);
        fontStacks.set(role, currentStack);
        set(
          `typography.families.${role}.stack`,
          currentStack,
          cssPath(rule.selector, 'font-family'),
          familyValue
        );
        const file: JsonObject = {};
        const weightValue = rule.declarations.get('font-weight');
        if (weightValue) {
          const range = weightValue.trim().replace(/\s+/g, ' ');
          if (/^[1-9]00(?: [1-9]00)?$/.test(range)) {
            file.weight = range;
            set(
              'typography.roles.body.weight',
              Number(range.split(' ')[0]),
              cssPath(rule.selector, 'font-weight'),
              weightValue
            );
          } else {
            const weight = toWeight(weightValue);
            if (weight.ok) {
              file.weight = String(weight.value);
              set(
                'typography.roles.body.weight',
                weight.value,
                cssPath(rule.selector, 'font-weight'),
                weightValue
              );
            } else lose(cssPath(rule.selector, 'font-weight'), weight.message, weightValue);
          }
        }
        const sourceValue = rule.declarations.get('src');
        if (sourceValue) {
          const source = safeFontSource(sourceValue);
          if (source) file.src = source;
          else
            lose(
              cssPath(rule.selector, 'src'),
              'Font source is not a safe local relative path; it was not loaded.',
              sourceValue
            );
        }
        if (file.src) {
          const existingTypography = doc.typography;
          const existingFamilies = isObject(existingTypography)
            ? existingTypography.families
            : undefined;
          const existingFamily = isObject(existingFamilies) ? existingFamilies[role] : undefined;
          const files =
            isObject(existingFamily) && Array.isArray(existingFamily.files)
              ? (existingFamily.files as Json[])
              : [];
          files.push(file);
          setPath(doc, ['typography', 'families', role, 'files'], files);
        }
      } else if (
        !/^@/.test(rule.selector) &&
        !/:root|html|body|^[a-z][a-z0-9-]*$/i.test(rule.selector)
      ) {
        lose(
          cssPath(rule.selector, '*'),
          'Declarations outside a global token rule were not imported.'
        );
      }
    }
    if (lossOverflow)
      return failInput(
        warnings,
        'The stylesheet has too many values to report safely.',
        'input-limit'
      );
    return finalize(ordered(doc), warnings, options);
  });
  const reported = withLossReport(result);
  return { ...reported, losses: [...reported.losses, ...losses] };
}

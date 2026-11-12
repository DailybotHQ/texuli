/**
 * Output checks for the Markdown stack's security suite. HTML output is re-read with the stack's
 * own DOM-free tokenizer (`core/html`), so a check never depends on a browser.
 */
import { tokenizeHtml } from '../../../src/html/index.ts';
import type { MdNode, MdRoot } from '../../../src/markdown/ast.ts';
import type { MarkdownDialect } from '../../../src/markdown-dialects/index.ts';
import { safeHref, safeImageSrc } from '../../../src/url-policy/index.ts';

type Trust = 'developer' | 'untrusted';

/** Elements and attributes `core/markdown-html` may write: the contract the fuzz test holds it to. */
export const WRITER_ALLOWLIST: Readonly<Record<string, readonly string[]>> = {
  p: [],
  h1: [],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
  hr: [],
  br: [],
  blockquote: [],
  ul: [],
  ol: ['start'],
  li: ['class', 'data-task', 'id'],
  pre: [],
  code: ['class'],
  table: [],
  thead: [],
  tbody: [],
  tr: [],
  th: ['align'],
  td: ['align'],
  em: [],
  strong: [],
  del: [],
  u: [],
  sup: [],
  span: ['class', 'data-spoiler', 'data-mention', 'data-mention-id'],
  a: ['href', 'title', 'rel', 'id', 'data-footnote-ref', 'data-footnote-backref', 'aria-label'],
  img: ['src', 'alt', 'title'],
  section: ['data-footnotes', 'class'],
};

/** Tags a Telegram HTML message may carry (Bot API formatting options). */
const TELEGRAM_TAGS: Readonly<Record<string, readonly string[]>> = {
  b: [],
  strong: [],
  i: [],
  em: [],
  u: [],
  ins: [],
  s: [],
  strike: [],
  del: [],
  'tg-spoiler': [],
  span: ['class'],
  a: ['href'],
  code: ['class'],
  pre: [],
  blockquote: ['expandable'],
};

const ATTRIBUTE = /\s([^\s"'>/=]+)(?:="([^"]*)")?/g;

function decodeAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

/**
 * Problems in an HTML string, checked against `allow` (element → attributes). Every `<` must open
 * a tag the tokenizer reads; no element is dropped raw text; every attribute is allowed for its
 * element; every `href`/`src` passes the URL policy at `trust` unchanged.
 */
export function htmlProblems(
  html: string,
  trust: Trust,
  allow: Readonly<Record<string, readonly string[]>> = WRITER_ALLOWLIST,
  urlOk: (name: string, value: string) => boolean = (name, value) =>
    name === 'src' ? safeImageSrc(value, trust) === value : safeHref(value, trust) === value
): string[] {
  const problems: string[] = [];
  const tokens = tokenizeHtml(html);
  let tags = 0;
  for (const token of tokens) {
    if (token.kind === 'dropped') problems.push(`raw element <${token.name}>`);
    if (token.kind === 'end') {
      tags += 1;
      if (!Object.hasOwn(allow, token.name)) problems.push(`end tag </${token.name}>`);
    }
    if (token.kind !== 'start') continue;
    tags += 1;
    const allowed = allow[token.name];
    if (!allowed) {
      problems.push(`element <${token.name}>`);
      continue;
    }
    const raw = html.slice(token.start, token.end);
    const body = raw.slice(1 + token.name.length, raw.endsWith('/>') ? -2 : -1);
    for (const match of body.matchAll(ATTRIBUTE)) {
      const name = (match[1] ?? '').toLowerCase();
      if (!allowed.includes(name)) {
        problems.push(`attribute ${name} on <${token.name}>`);
        continue;
      }
      if ((name === 'href' || name === 'src') && !urlOk(name, decodeAttribute(match[2] ?? '')))
        problems.push(`${name}=${JSON.stringify(match[2])}`);
    }
  }
  const opens = html.split('<').length - 1;
  if (opens !== tags) problems.push(`${opens - tags} '<' outside a tag`);
  return problems;
}

/** A Telegram link target the writer may emit: the URL policy's, or a `tg://user?id=` mention. */
const telegramUrlOk = (trust: Trust) => (_: string, value: string) =>
  safeHref(value, trust) === value || /^tg:\/\/user\?id=[A-Za-z0-9._:-]{1,128}$/.test(value);

/**
 * A URL as a browser reads its scheme: leading and trailing C0 controls and spaces trimmed, tab and
 * newline removed anywhere (WHATWG URL). Spaces and zero-width characters inside stay, and keep a
 * scheme from parsing.
 */
const browserUrl = (value: string) =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the C0 controls are the target.
  value.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '').replace(/[\t\n\r]/g, '');

/** Schemes that execute or smuggle a document: refused at every tier. */
const EXECUTING = /^(?:javascript|vbscript|data):/i;

/**
 * The text outside code, with code spans and fences replaced by one space and backslash-escaped
 * characters by two spaces. Outside code a backslash escapes the next character; a run of n
 * backticks opens code that closes at the next run of exactly n, inside which a backslash is
 * literal (CommonMark) or escapes the next character (Telegram MarkdownV2, `escapesInCode`); an
 * unmatched run is text.
 */
function outsideCode(value: string, escapesInCode: boolean): string {
  let out = '';
  let i = 0;
  while (i < value.length) {
    const char = value[i] as string;
    if (char === '\\') {
      out += '  ';
      i += 2;
      continue;
    }
    if (char !== '`') {
      out += char;
      i += 1;
      continue;
    }
    let end = i;
    while (value[end] === '`') end += 1;
    const length = end - i;
    // Find the closing run of exactly `length` backticks.
    let j = end;
    let close = -1;
    while (j < value.length) {
      if (escapesInCode && value[j] === '\\') {
        j += 2;
        continue;
      }
      if (value[j] !== '`') {
        j += 1;
        continue;
      }
      let runEnd = j;
      while (value[runEnd] === '`') runEnd += 1;
      if (runEnd - j === length) {
        close = runEnd;
        break;
      }
      j = runEnd;
    }
    if (close === -1) {
      out += value.slice(i, end);
      i = end;
      continue;
    }
    out += ' ';
    i = close;
  }
  return out;
}

/** Dialects with a `[label](url)` masked link. */
const MASKED_LINK_DIALECTS = new Set<MarkdownDialect>([
  'discord',
  'telegram-markdown-v2',
  'teams',
  'mattermost',
]);

/**
 * Problems in a dialect writer's output. Telegram HTML is tokenized and held to the Telegram tag
 * set and the URL policy. For the other dialects every live link in the dialect's own syntax
 * (`[label](url)` where it exists, `<url|label>` in Slack and Google Chat) must pass the URL
 * policy at the `untrusted` tier, or carry no executing scheme at the `developer` tier.
 */
export function dialectProblems(output: string, dialect: MarkdownDialect, trust: Trust): string[] {
  if (dialect === 'telegram-html')
    return htmlProblems(output, trust, TELEGRAM_TAGS, telegramUrlOk(trust));
  const targets: string[] = [];
  // Code spans and fences are literal in every dialect: nothing inside them links.
  // Code spans and fences are literal in every dialect: nothing inside them links.
  // Slack and Google Chat escape `<` inside code (F4), so every raw `<` there is real syntax.
  const outside =
    dialect === 'slack' || dialect === 'google-chat'
      ? output
      : outsideCode(output, dialect === 'telegram-markdown-v2');
  if (MASKED_LINK_DIALECTS.has(dialect))
    for (const match of outside.matchAll(/(?<!\\)\]\(((?:\\.|[^)\\])*)\)/g))
      targets.push((match[1] ?? '').replace(/\\(.)/g, '$1'));
  if (dialect === 'slack' || dialect === 'google-chat')
    for (const match of outside.matchAll(/<([^|>@#!][^|>]*)[|>]/g)) targets.push(match[1] ?? '');
  const problems: string[] = [];
  for (const target of targets) {
    if (/^tg:\/\/user\?id=[A-Za-z0-9._:-]{1,128}$/.test(target) || target.startsWith('users/'))
      continue;
    const url = browserUrl(target);
    const ok =
      trust === 'untrusted' ? safeHref(url, 'untrusted') !== undefined : !EXECUTING.test(url);
    if (!ok) problems.push(`live link to ${JSON.stringify(target)}`);
  }
  return problems;
}

/** Every link and image URL in a tree (iterative). */
export function treeUrls(tree: MdRoot): string[] {
  const out: string[] = [];
  const stack: MdNode[] = [tree];
  while (stack.length > 0) {
    const node = stack.pop() as MdNode;
    if (node.type === 'link' || node.type === 'image') out.push(node.url);
    if ('children' in node) for (const child of node.children) stack.push(child as MdNode);
  }
  return out;
}

/** The deepest nesting in a tree (iterative). */
export function treeDepth(tree: MdRoot): number {
  let deepest = 0;
  const stack: [MdNode, number][] = [[tree, 0]];
  while (stack.length > 0) {
    const [node, depth] = stack.pop() as [MdNode, number];
    if (depth > deepest) deepest = depth;
    if ('children' in node)
      for (const child of node.children) stack.push([child as MdNode, depth + 1]);
  }
  return deepest;
}

/** Deterministic PRNG (mulberry32): the same seed always gives the same sequence. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * This thread's CPU time in milliseconds. Not wall-clock: time spent waiting for a core while
 * parallel test files or lanes run is not the code's cost (the same choice as markup.test.ts).
 */
export function cpuMs(): number {
  const { user, system } = process.threadCpuUsage();
  return (user + system) / 1000;
}

/** Best-of-`runs` CPU time of `fn` in milliseconds. */
export function bestTime(fn: () => unknown, runs = 3): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < runs; i += 1) {
    const started = cpuMs();
    fn();
    best = Math.min(best, cpuMs() - started);
  }
  return best;
}

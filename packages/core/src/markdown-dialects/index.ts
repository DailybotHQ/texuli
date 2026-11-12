/** Chat-platform Markdown dialects over the shared `texuli-md/v1` tree. */
import type {
  MarkdownDiagnostic,
  MarkdownReadResult,
  MdBlock,
  MdInline,
  MdRoot,
} from '../markdown/ast.ts';
import { MARKDOWN_AST_VERSION, MARKDOWN_LIMITS } from '../markdown/ast.ts';
import { type HrefTrust, safeHref } from '../url/safe-href.ts';

export const MARKDOWN_DIALECTS = [
  'slack',
  'discord',
  'whatsapp',
  'telegram-markdown-v2',
  'telegram-html',
  'teams',
  'google-chat',
  'mattermost',
  'plain-text',
] as const;

export type MarkdownDialect = (typeof MARKDOWN_DIALECTS)[number];
export interface MarkdownDialectWriteResult {
  readonly value: string;
  readonly diagnostics: readonly MarkdownDiagnostic[];
}
export interface MarkdownDialectWriteOptions {
  /** URL trust tier. User and agent content should keep the default `untrusted`. */
  readonly trust?: HrefTrust;
  /** Permit explicit MdMention broadcasts. Literal text triggers remain escaped. */
  readonly allowBroadcastMentions?: boolean;
}

const plain = (value: string): MdInline => ({ type: 'text', value });
const root = (children: readonly MdBlock[]): MdRoot => ({
  type: 'root',
  version: MARKDOWN_AST_VERSION,
  children,
});
const text = (value: string) => value.replace(/\r\n?/g, '\n');
const maxSource = MARKDOWN_LIMITS.source;
const inlineTokenWindow = 128;
const maxDialectInlineNodes = 10_000;

function escaped(
  value: string,
  dialect: MarkdownDialect,
  context: 'text' | 'code' | 'url' | 'attribute' = 'text'
): string {
  if (
    context === 'text' &&
    (dialect === 'whatsapp' || dialect === 'telegram-markdown-v2' || dialect === 'telegram-html')
  )
    value = value.replace(/@(?=[A-Za-z0-9_])/g, '@\u200b');
  if (dialect === 'telegram-html')
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(context === 'attribute' ? /"/g : /$^/, '&quot;');
  if (dialect === 'telegram-markdown-v2') {
    const reserved =
      context === 'code' ? /[`\\]/g : context === 'url' ? /[)\\]/g : /[_*[\]()~`>#+\-=|{}.!\\]/g;
    return value.replace(reserved, '\\$&');
  }
  if (context === 'code') return value;
  if (dialect === 'slack' && context === 'url')
    return value.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\|/g, '%7C');
  if ((dialect === 'teams' || dialect === 'google-chat') && context === 'url')
    return value.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\|/g, '%7C');
  if (dialect === 'slack')
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (dialect === 'plain-text')
    return value
      .replace(/@(?=everyone\b|here\b|channel\b|all\b)/gi, '@\u200b')
      .replace(/<(?=[@#])/g, '<\u200b');
  if (dialect === 'whatsapp') return value;
  let safe =
    dialect === 'teams' || dialect === 'google-chat'
      ? value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      : value;
  if (dialect === 'discord')
    safe = safe.replace(/@(?=everyone\b|here\b)/gi, '@\u200b').replace(/<(?=[@#])/g, '<\u200b');
  if (dialect === 'mattermost') safe = safe.replace(/@(channel|all|here)\b/gi, '@\u200b$1');
  safe = safe.replace(/(^|\n)(?=[#>]|[-*+] |\d+[.)] )/g, '$1\u200b');
  return safe
    .replace(/([\\*_`~|])/g, '\\$1')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function inline(
  source: string,
  dialect: MarkdownDialect,
  depth = 0,
  diagnostics?: MarkdownDiagnostic[]
): MdInline[] {
  if (dialect === 'plain-text') return source ? [plain(source)] : [];
  if (depth >= MARKDOWN_LIMITS.inlineDepth) return source ? [plain(source)] : [];
  const nodes: MdInline[] = [];
  const failedDelimiters = new Set<string>();
  const hasLinkCloser = source.includes('](');
  const htmlClosers =
    dialect === 'telegram-html'
      ? new Set(
          [
            'tg-spoiler',
            'b',
            'strong',
            'i',
            'em',
            's',
            'strike',
            'del',
            'u',
            'ins',
            'code',
            'a',
          ].filter((tag) => source.toLowerCase().includes(`</${tag}>`))
        )
      : new Set<string>();
  let cursor = 0;
  while (cursor < source.length) {
    if (nodes.length >= maxDialectInlineNodes) {
      nodes.push(plain(source.slice(cursor)));
      diagnostics?.push({
        code: 'node-limit',
        message: 'Input exceeded the dialect inline node limit.',
      });
      break;
    }
    const rest = source.slice(cursor, cursor + inlineTokenWindow);
    if (dialect === 'telegram-markdown-v2' && rest.startsWith('\\') && rest.length > 1) {
      nodes.push(plain(rest[1] ?? '\\'));
      cursor += 2;
      continue;
    }
    if (
      (dialect === 'discord' ||
        dialect === 'teams' ||
        dialect === 'google-chat' ||
        dialect === 'mattermost') &&
      rest.startsWith('\\') &&
      rest.length > 1
    ) {
      nodes.push(plain(rest[1] ?? '\\'));
      cursor += 2;
      continue;
    }
    if (dialect === 'slack') {
      const escapedAngle = /^&lt;[^\n]{0,256}&gt;/.exec(rest);
      if (escapedAngle) {
        nodes.push(plain(escapedAngle[0].replace(/^&lt;/, '<').replace(/&gt;$/, '>')));
        cursor += escapedAngle[0].length;
        continue;
      }
      const entity = /^&(amp|lt|gt);/.exec(rest);
      if (entity) {
        nodes.push(
          plain(({ '&amp;': '&', '&lt;': '<', '&gt;': '>' } as const)[entity[0] as '&amp;'])
        );
        cursor += entity[0].length;
        continue;
      }
    }
    const mention =
      dialect === 'slack'
        ? (/^<!(everyone|here)>/.exec(rest) ?? /^<(@|#)([A-Za-z0-9._-]+)(?:\|([^>]*))?>/.exec(rest))
        : dialect === 'discord'
          ? (/^@(everyone|here)\b/.exec(rest) ?? /^<(@!?|@&|#)([A-Za-z0-9._-]+)>/.exec(rest))
          : dialect === 'teams'
            ? /^<at>([^<]{1,128})<\/at>/.exec(rest)
            : dialect === 'google-chat'
              ? /^<users\/([^>]+)>/.exec(rest)
              : dialect === 'whatsapp' || dialect === 'mattermost'
                ? /^@([A-Za-z0-9._-]{1,64})/.exec(rest)
                : null;
    if (mention) {
      const marker = mention[1] ?? '';
      const kind =
        marker === 'everyone'
          ? 'everyone'
          : marker === 'here'
            ? 'here'
            : marker === '#'
              ? 'channel'
              : marker === '@&'
                ? 'role'
                : 'user';
      nodes.push({
        type: 'mention',
        kind,
        ...(marker === 'everyone' ||
        marker === 'here' ||
        dialect === 'whatsapp' ||
        dialect === 'mattermost'
          ? {}
          : { id: mention[2] }),
        ...(dialect === 'whatsapp' || dialect === 'mattermost' ? { label: mention[1] } : {}),
        ...(mention[3] ? { label: mention[3] } : {}),
      });
      cursor += mention[0].length;
      continue;
    }
    if ((dialect === 'slack' || dialect === 'discord') && source[cursor] === '<') {
      let end = cursor;
      while (
        source.startsWith('<@', end) ||
        source.startsWith('<#', end) ||
        source.startsWith('<!', end)
      )
        end += 2;
      if (end > cursor) {
        nodes.push(plain(source.slice(cursor, end)));
        cursor = end;
        continue;
      }
    }
    if (dialect === 'telegram-html') {
      const tag =
        /^<(tg-spoiler|b|strong|i|em|s|strike|del|u|ins|code|a)(?:\s+href="([^"]*)")?>([\s\S]*?)<\/\1>/i.exec(
          rest
        );
      if (tag) {
        const children = inline(tag[3] ?? '', dialect, depth + 1, diagnostics);
        const name = tag[1]?.toLowerCase();
        const userMention = /^tg:\/\/user\?id=([^&]+)$/.exec(tag[2] ?? '');
        const node: MdInline = userMention
          ? { type: 'mention', kind: 'user', id: userMention[1], label: tag[3] ?? undefined }
          : name === 'b' || name === 'strong'
            ? { type: 'strong', children }
            : name === 'i' || name === 'em'
              ? { type: 'emphasis', children }
              : name === 's' || name === 'strike' || name === 'del'
                ? { type: 'delete', children }
                : name === 'u' || name === 'ins'
                  ? { type: 'underline', children }
                  : name === 'tg-spoiler'
                    ? { type: 'spoiler', children }
                    : name === 'code'
                      ? { type: 'inlineCode', value: tag[3] ?? '' }
                      : { type: 'link', url: tag[2] ?? '', children };
        nodes.push(node);
        cursor += tag[0].length;
        continue;
      }
      const openTag = /^<(tg-spoiler|b|strong|i|em|s|strike|del|u|ins|code|a)(?:\s|>)/i
        .exec(rest)?.[1]
        ?.toLowerCase();
      if (openTag && !htmlClosers.has(openTag)) {
        const opener = `<${openTag}>`;
        let end = cursor;
        while (source.startsWith(opener, end)) end += opener.length;
        if (end > cursor) {
          nodes.push(plain(source.slice(cursor, end)));
          cursor = end;
          continue;
        }
      }
      const entity = /^&(amp|lt|gt|quot);/.exec(rest);
      if (entity) {
        nodes.push(
          plain(
            ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' } as const)[
              entity[0] as '&amp;'
            ] ?? entity[0]
          )
        );
        cursor += entity[0].length;
        continue;
      }
    }
    if (source[cursor] === '[' && !hasLinkCloser) {
      let end = cursor;
      while (source[end] === '[') end++;
      nodes.push(plain(source.slice(cursor, end)));
      cursor = end;
      continue;
    }
    const link =
      (source[cursor] === '[' &&
        (dialect === 'discord' ||
          dialect === 'telegram-markdown-v2' ||
          dialect === 'teams' ||
          dialect === 'mattermost')) ||
      (source[cursor] === '<' && (dialect === 'slack' || dialect === 'google-chat'))
        ? dialect === 'slack' || dialect === 'google-chat'
          ? /^<((?:https?:\/\/|mailto:)[^|>]+)(?:\|([^>]*))?>/.exec(rest)
          : /^\[([^\]]{0,128})\]\(([^\s)]{0,128})(?:\s+"([^"]{0,128})")?\)/.exec(rest)
        : null;
    if (link) {
      const slackLink = dialect === 'slack' || dialect === 'google-chat';
      nodes.push({
        type: 'link',
        url: slackLink ? (link[1] ?? '') : (link[2] ?? ''),
        children: inline(
          slackLink ? link[2] || link[1] || '' : (link[1] ?? ''),
          dialect,
          depth + 1,
          diagnostics
        ),
        ...(link[3] && !slackLink ? { title: link[3] } : {}),
      });
      cursor += link[0].length;
      continue;
    }
    if (rest.startsWith('`')) {
      let runLength = 1;
      while (runLength < rest.length && rest[runLength] === '`') runLength++;
      const marker = '`'.repeat(runLength);
      let closing = rest.indexOf(marker, runLength);
      if (dialect === 'telegram-markdown-v2') {
        while (closing >= 0) {
          let slashes = 0;
          for (let back = closing - 1; back >= runLength && rest[back] === '\\'; back--) slashes++;
          if (slashes % 2 === 0) break;
          closing = rest.indexOf(marker, closing + runLength);
        }
      }
      if (closing > runLength) {
        const raw = rest.slice(runLength, closing);
        const value = dialect === 'telegram-markdown-v2' ? raw.replace(/\\([`\\])/g, '$1') : raw;
        nodes.push({ type: 'inlineCode', value });
        cursor += closing + runLength;
        continue;
      }
    }
    const delimiter: readonly (readonly [string, string])[] =
      dialect === 'slack'
        ? [
            ['*', 'strong'],
            ['_', 'emphasis'],
            ['~', 'delete'],
          ]
        : dialect === 'whatsapp'
          ? [
              ['*', 'strong'],
              ['_', 'emphasis'],
              ['~', 'delete'],
            ]
          : [
              ['**', 'strong'],
              ['__', 'underline'],
              ['~~', 'delete'],
              ['||', 'spoiler'],
              ['*', 'emphasis'],
              ['_', 'emphasis'],
            ];
    let matched = false;
    for (const [mark, kind] of delimiter) {
      if (!rest.startsWith(mark) || failedDelimiters.has(mark)) continue;
      const relativeEnd = source
        .slice(cursor + mark.length, cursor + inlineTokenWindow)
        .indexOf(mark);
      if (relativeEnd < 1) {
        failedDelimiters.add(mark);
        continue;
      }
      const end = cursor + mark.length + relativeEnd;
      const body = source.slice(cursor + mark.length, end);
      nodes.push({
        type: kind as 'strong',
        children: inline(body, dialect, depth + 1, diagnostics),
      } as MdInline);
      cursor = end + mark.length;
      matched = true;
      break;
    }
    if (matched) continue;
    let failed: string | undefined;
    for (const marker of failedDelimiters) {
      if (source.startsWith(marker, cursor)) {
        failed = marker;
        break;
      }
    }
    if (failed) {
      const character = failed[0];
      let end = cursor + 1;
      while (source[end] === character) end++;
      nodes.push(plain(source.slice(cursor, end)));
      cursor = end;
      continue;
    }
    let end = cursor + 1;
    while (end < source.length && !/[<*_[~`|\\]/.test(source[end] ?? '')) end++;
    nodes.push(plain(source.slice(cursor, end)));
    cursor = end;
  }
  const merged: MdInline[] = [];
  for (const node of nodes) {
    const previous = merged.at(-1);
    if (node.type === 'text' && previous?.type === 'text')
      merged[merged.length - 1] = { type: 'text', value: previous.value + node.value };
    else merged.push(node);
  }
  return merged;
}

/** Parse one chat dialect into the bounded shared AST. Malformed input is retained as text. */
export function readMarkdownDialect(source: string, dialect: MarkdownDialect): MarkdownReadResult {
  const diagnostics: MarkdownDiagnostic[] = [];
  const bounded = source.slice(0, maxSource);
  if (source.length > maxSource)
    diagnostics.push({
      code: 'source-truncated',
      message: 'Input exceeded the Markdown source limit.',
    });
  const normalized = text(bounded);
  const lines = normalized.split('\n');
  const blocks: MdBlock[] = [];
  let paragraph: string[] = [];
  let index = 0;
  const flush = () => {
    if (paragraph.length) {
      blocks.push({
        type: 'paragraph',
        children: inline(paragraph.join('\n'), dialect, 0, diagnostics),
      });
      paragraph = [];
    }
  };
  while (index < lines.length && blocks.length < MARKDOWN_LIMITS.nodes) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      flush();
      index++;
      continue;
    }
    if (dialect === 'telegram-html' && /^<(?:pre|blockquote)>/.test(line)) {
      flush();
      const match = /^<(pre|blockquote)>([\s\S]*?)<\/\1>$/.exec(line);
      if (match?.[1] === 'pre') blocks.push({ type: 'code', value: match[2] ?? '', fenced: true });
      else
        blocks.push({
          type: 'blockquote',
          children: [
            { type: 'paragraph', children: inline(match?.[2] ?? line, dialect, 0, diagnostics) },
          ],
        });
      index++;
      continue;
    }
    const fence = /^(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence && dialect !== 'whatsapp') {
      flush();
      const code: string[] = [];
      index++;
      while (index < lines.length) {
        const current = lines[index] ?? '';
        if (
          current.startsWith(fence[1] ?? '') &&
          current.slice((fence[1] ?? '').length).trim() === ''
        )
          break;
        code.push(current);
        index++;
      }
      if (index < lines.length) index++;
      const lang = (fence[2] ?? '').trim().split(/\s+/)[0];
      blocks.push({
        type: 'code',
        value:
          dialect === 'telegram-markdown-v2'
            ? code.join('\n').replace(/\\([`\\])/g, '$1')
            : code.join('\n'),
        fenced: true,
        ...(lang && /^[a-z][a-z0-9+-]{0,31}$/i.test(lang) ? { lang } : {}),
      });
      continue;
    }
    const heading =
      dialect === 'discord' || dialect === 'mattermost' ? /^(#{1,6})\s+(.+)$/.exec(line) : null;
    if (heading) {
      flush();
      blocks.push({
        type: 'heading',
        depth: Math.min(6, heading[1]?.length ?? 1) as 1 | 2 | 3 | 4 | 5 | 6,
        children: inline(heading[2] ?? '', dialect, 0, diagnostics),
      });
      index++;
      continue;
    }
    if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush();
      blocks.push({ type: 'thematicBreak' });
      index++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      flush();
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? ''))
        quote.push((lines[index++] ?? '').replace(/^>\s?/, ''));
      blocks.push({
        type: 'blockquote',
        children: [
          { type: 'paragraph', children: inline(quote.join('\n'), dialect, 0, diagnostics) },
        ],
      });
      continue;
    }
    const list = /^(\s*)([-*+] |\d+[.)] )(.*)$/.exec(line);
    if (
      list &&
      (dialect === 'discord' ||
        dialect === 'whatsapp' ||
        dialect === 'mattermost' ||
        dialect === 'google-chat')
    ) {
      flush();
      const ordered = /^\d/.test(list[2] ?? '');
      const items = [];
      while (index < lines.length) {
        const item = /^(\s*)([-*+] |\d+[.)] )(.*)$/.exec(lines[index] ?? '');
        if (!item || /^\d/.test(item[2] ?? '') !== ordered) break;
        items.push({
          type: 'listItem' as const,
          spread: false,
          children: [
            {
              type: 'paragraph' as const,
              children: inline(item[3] ?? '', dialect, 0, diagnostics),
            },
          ],
        });
        index++;
      }
      blocks.push({
        type: 'list',
        ordered,
        spread: false,
        ...(ordered ? { start: Number.parseInt(list[2] ?? '1', 10) } : {}),
        children: items,
      });
      continue;
    }
    paragraph.push(line);
    index++;
  }
  flush();
  if (blocks.length >= MARKDOWN_LIMITS.nodes)
    diagnostics.push({ code: 'node-limit', message: 'Input exceeded the Markdown node limit.' });
  return { tree: root(blocks), diagnostics };
}

function writeInline(
  nodes: readonly MdInline[],
  dialect: MarkdownDialect,
  diagnostics: MarkdownDiagnostic[],
  trust: HrefTrust,
  allowBroadcastMentions: boolean
): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return escaped(node.value, dialect);
        case 'emphasis':
          return dialect === 'telegram-html'
            ? `<i>${writeInline(node.children, dialect, diagnostics, trust, allowBroadcastMentions)}</i>`
            : wrap(
                writeInline(node.children, dialect, diagnostics, trust, allowBroadcastMentions),
                dialect === 'slack' || dialect === 'whatsapp' ? '_' : '*'
              );
        case 'strong':
          return dialect === 'telegram-html'
            ? `<b>${writeInline(node.children, dialect, diagnostics, trust, allowBroadcastMentions)}</b>`
            : wrap(
                writeInline(node.children, dialect, diagnostics, trust, allowBroadcastMentions),
                dialect === 'slack' || dialect === 'whatsapp' ? '*' : '**'
              );
        case 'delete':
          return dialect === 'telegram-html'
            ? `<s>${writeInline(node.children, dialect, diagnostics, trust, allowBroadcastMentions)}</s>`
            : wrap(
                writeInline(node.children, dialect, diagnostics, trust, allowBroadcastMentions),
                dialect === 'slack' || dialect === 'whatsapp' ? '~' : '~~'
              );
        case 'underline':
          return dialect === 'telegram-html'
            ? `<u>${writeInline(node.children, dialect, diagnostics, trust, allowBroadcastMentions)}</u>`
            : dialect === 'discord' || dialect === 'telegram-markdown-v2'
              ? `__${writeInline(node.children, dialect, diagnostics, trust, allowBroadcastMentions)}__`
              : loss(
                  writeInline(node.children, dialect, diagnostics, trust, allowBroadcastMentions),
                  'Underline is unsupported by this dialect.',
                  diagnostics
                );
        case 'spoiler':
          return dialect === 'telegram-html'
            ? `<tg-spoiler>${writeInline(node.children, dialect, diagnostics, trust, allowBroadcastMentions)}</tg-spoiler>`
            : dialect === 'discord' || dialect === 'telegram-markdown-v2'
              ? `||${writeInline(node.children, dialect, diagnostics, trust, allowBroadcastMentions)}||`
              : loss(
                  writeInline(node.children, dialect, diagnostics, trust, allowBroadcastMentions),
                  'Spoilers are unsupported by this dialect.',
                  diagnostics
                );
        case 'inlineCode':
          return writeInlineCode(node.value, dialect, diagnostics);
        case 'break':
          return '\n';
        case 'link': {
          const label = writeInline(
            node.children,
            dialect,
            diagnostics,
            trust,
            allowBroadcastMentions
          );
          const href = safeHref(node.url, trust);
          if (!href) {
            diagnostics.push({
              code: 'url-refused',
              message: 'A link URL was refused by the URL policy.',
            });
            return flattenInline(node.children);
          }
          if (dialect === 'slack' || dialect === 'google-chat')
            return `<${escaped(href, dialect, 'url')}${href === label ? '' : `|${label}`}>`;
          if (dialect === 'whatsapp' || dialect === 'plain-text')
            return loss(
              `${label} (${escaped(href, dialect)})`,
              'Links have no native label syntax.',
              diagnostics
            );
          if (dialect === 'telegram-html')
            return `<a href="${escaped(href, dialect, 'attribute')}">${label}</a>`;
          return `[${label}](${escaped(href, dialect, 'url')})`;
        }
        case 'mention':
          return mentionText(node, dialect, diagnostics, allowBroadcastMentions);
        case 'image':
          return loss(
            escaped(node.alt, dialect),
            'Images are unsupported by this text dialect.',
            diagnostics
          );
        case 'footnoteReference':
          return loss(
            escaped(`[${node.label}]`, dialect),
            'Footnotes are unsupported by this dialect.',
            diagnostics
          );
        case 'html':
          return loss(
            escaped(node.value, dialect),
            'Raw HTML is emitted as escaped text.',
            diagnostics
          );
        default:
          return '';
      }
    })
    .join('');
}

function wrap(value: string, marker: string): string {
  return `${marker}${value}${marker}`;
}

function codeDelimiter(value: string, minimum: number): string {
  let longest = 0;
  let current = 0;
  for (const character of value) {
    if (character === '`') {
      current++;
      longest = Math.max(longest, current);
    } else current = 0;
  }
  return '`'.repeat(Math.max(minimum, longest + 1));
}

function writeInlineCode(
  value: string,
  dialect: MarkdownDialect,
  diagnostics: MarkdownDiagnostic[]
): string {
  if (dialect === 'telegram-html') return `<code>${escaped(value, dialect, 'code')}</code>`;
  if (dialect === 'telegram-markdown-v2') return `\`${escaped(value, dialect, 'code')}\``;
  if (dialect === 'slack' || dialect === 'whatsapp') {
    if (!value.includes('`')) return `\`${value}\``;
    diagnostics.push({
      code: 'dialect-loss',
      message: 'Inline code backticks were joined to prevent delimiter breakout.',
    });
    return `\`${value.replace(/`/g, '`\u200d')}\``;
  }
  const delimiter = codeDelimiter(value, 1);
  return `${delimiter}${value}${delimiter}`;
}

function writeCodeBlock(
  value: string,
  lang: string | undefined,
  dialect: MarkdownDialect,
  diagnostics: MarkdownDiagnostic[]
): string {
  if (dialect === 'telegram-html') return `<pre>${escaped(value, dialect, 'code')}</pre>`;
  if (dialect === 'slack' || dialect === 'whatsapp') {
    if (value.includes('```')) {
      diagnostics.push({
        code: 'dialect-loss',
        message: 'Code fence runs were joined to prevent delimiter breakout.',
      });
      value = value.replace(/```/g, '``\u200d`');
    }
    return `\`\`\`${value}\`\`\``;
  }
  const delimiter = codeDelimiter(value, 3);
  const info = lang && /^[a-z][a-z0-9+-]{0,31}$/i.test(lang) ? lang : '';
  const body = dialect === 'telegram-markdown-v2' ? escaped(value, dialect, 'code') : value;
  return `${delimiter}${info}\n${body}\n${delimiter}`;
}

function loss(value: string, message: string, diagnostics: MarkdownDiagnostic[]): string {
  diagnostics.push({ code: 'dialect-loss', message });
  return value;
}

function flattenInline(nodes: readonly MdInline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.value;
        case 'emphasis':
        case 'strong':
        case 'delete':
        case 'underline':
        case 'spoiler':
          return flattenInline(node.children);
        case 'inlineCode':
          return node.value;
        case 'break':
          return '\n';
        case 'link':
          return `${flattenInline(node.children)} (${node.url})`;
        case 'mention':
          return `@${node.label ?? node.id ?? node.kind}`;
        case 'image':
          return node.alt;
        case 'footnoteReference':
          return `[${node.label}]`;
        case 'html':
          return node.value;
        default:
          return '';
      }
    })
    .join('');
}

function flattenPlainInline(
  nodes: readonly MdInline[],
  trust: HrefTrust,
  diagnostics: MarkdownDiagnostic[]
): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return escaped(node.value, 'plain-text');
        case 'emphasis':
        case 'strong':
        case 'delete':
        case 'underline':
        case 'spoiler':
          return flattenPlainInline(node.children, trust, diagnostics);
        case 'inlineCode':
          return escaped(node.value, 'plain-text');
        case 'break':
          return '\n';
        case 'link': {
          const label = flattenPlainInline(node.children, trust, diagnostics);
          const href = safeHref(node.url, trust);
          if (!href) {
            diagnostics.push({
              code: 'url-refused',
              message: 'A link URL was refused by the URL policy.',
            });
            return label;
          }
          return `${label} (${escaped(href, 'plain-text')})`;
        }
        case 'mention':
          return escaped(`@${node.label ?? node.id ?? node.kind}`, 'plain-text');
        case 'image':
          return escaped(node.alt, 'plain-text');
        case 'footnoteReference':
          return `[${node.label}]`;
        case 'html':
          return escaped(node.value, 'plain-text');
        default:
          return '';
      }
    })
    .join('');
}
function mentionText(
  node: Extract<MdInline, { type: 'mention' }>,
  dialect: MarkdownDialect,
  diagnostics: MarkdownDiagnostic[],
  allowBroadcastMentions: boolean
): string {
  const label = node.label ?? node.id ?? node.kind;
  if (node.kind === 'everyone' || node.kind === 'here') {
    if (!allowBroadcastMentions)
      return loss(
        escaped(`@${node.kind}`, dialect),
        'Broadcast mention was downgraded to text; opt in to preserve it.',
        diagnostics
      );
    if (dialect === 'slack') return node.kind === 'everyone' ? '<!everyone>' : '<!here>';
    if (dialect === 'discord') return node.kind === 'everyone' ? '@everyone' : '@here';
    if (dialect === 'mattermost') return node.kind === 'everyone' ? '@all' : '@here';
    return loss(
      escaped(`@${node.kind}`, dialect),
      'Broadcast mentions are unsupported.',
      diagnostics
    );
  }
  const usableId = node.id && /^[A-Za-z0-9._:-]{1,128}$/.test(node.id) ? node.id : undefined;
  if (dialect === 'slack' && usableId)
    return node.kind === 'channel' ? `<#${usableId}|${escaped(label, dialect)}>` : `<@${usableId}>`;
  if (dialect === 'discord' && usableId)
    return node.kind === 'channel'
      ? `<#${usableId}>`
      : node.kind === 'role'
        ? `<@&${usableId}>`
        : `<@${usableId}>`;
  if (dialect === 'teams') return `<at>${escaped(label, dialect)}</at>`;
  if (dialect === 'google-chat' && usableId) return `<users/${usableId}>`;
  if (dialect === 'telegram-html' && usableId)
    return `<a href="tg://user?id=${escaped(usableId, dialect, 'attribute')}">${escaped(label, dialect)}</a>`;
  if (dialect === 'telegram-markdown-v2' && usableId)
    return `[${escaped(label, dialect)}](tg://user?id=${escaped(usableId, dialect, 'url')})`;
  return loss(
    escaped(`@${label}`, dialect),
    'Platform mention identity is unavailable in the target dialect.',
    diagnostics
  );
}

/** Serialize an AST to a chat dialect and report every construct that needs a fallback. */
export function writeMarkdownDialect(
  tree: MdRoot,
  dialect: MarkdownDialect,
  options: MarkdownDialectWriteOptions = {}
): MarkdownDialectWriteResult {
  const diagnostics: MarkdownDiagnostic[] = [];
  const trust = options.trust ?? 'untrusted';
  const allowBroadcastMentions = options.allowBroadcastMentions ?? false;
  const writeBlock = (block: MdBlock): string => {
    switch (block.type) {
      case 'paragraph':
        return dialect === 'plain-text'
          ? loss(
              flattenPlainInline(block.children, trust, diagnostics),
              'Inline formatting is flattened to plain text.',
              diagnostics
            )
          : writeInline(block.children, dialect, diagnostics, trust, allowBroadcastMentions);
      case 'heading':
        if (dialect === 'plain-text')
          return loss(
            flattenPlainInline(block.children, trust, diagnostics),
            'Heading structure is omitted in plain text.',
            diagnostics
          );
        return dialect === 'discord' || dialect === 'mattermost'
          ? `${'#'.repeat(block.depth)} ${writeInline(block.children, dialect, diagnostics, trust, allowBroadcastMentions)}`
          : loss(
              writeInline(block.children, dialect, diagnostics, trust, allowBroadcastMentions),
              'Headings are unsupported by this dialect.',
              diagnostics
            );
      case 'thematicBreak':
        return dialect === 'plain-text' || dialect === 'whatsapp' || dialect === 'slack'
          ? loss('---', 'Thematic breaks are unsupported by this dialect.', diagnostics)
          : '---';
      case 'blockquote':
        return block.children
          .map(writeBlock)
          .join('\n')
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n');
      case 'list':
        if (dialect === 'plain-text')
          return loss(
            block.children.map((item) => item.children.map(writeBlock).join(' ')).join('\n'),
            'List markers are omitted in plain text.',
            diagnostics
          );
        return block.children
          .map(
            (item, index) =>
              `${block.ordered ? `${(block.start ?? 1) + index}.` : '-'} ${item.children.map(writeBlock).join('\n')}`
          )
          .join('\n');
      case 'code':
        if (dialect === 'plain-text')
          return loss(
            escaped(block.value, dialect),
            'Code formatting is omitted in plain text.',
            diagnostics
          );
        return writeCodeBlock(block.value, block.lang, dialect, diagnostics);
      case 'html':
        return loss(
          escaped(block.value, dialect),
          'Raw HTML is emitted as escaped text.',
          diagnostics
        );
      case 'table':
        return loss(
          block.children
            .map((row) =>
              row.children
                .map((cell) =>
                  dialect === 'plain-text'
                    ? flattenPlainInline(cell.children, trust, diagnostics)
                    : writeInline(
                        cell.children,
                        dialect,
                        diagnostics,
                        trust,
                        allowBroadcastMentions
                      )
                )
                .join(' | ')
            )
            .join('\n'),
          'Tables are unsupported; rows are flattened with separators.',
          diagnostics
        );
      case 'definition':
        return loss(
          `[${escaped(block.label, dialect)}]: ${escaped(block.url, dialect)}`,
          'Reference definitions are unsupported.',
          diagnostics
        );
      case 'footnoteDefinition':
        return loss(
          block.children.map(writeBlock).join('\n'),
          'Footnote definitions are unsupported.',
          diagnostics
        );
    }
    return '';
  };
  const separator = dialect === 'plain-text' ? '\n\n' : '\n\n';
  return { value: tree.children.map(writeBlock).join(separator), diagnostics };
}

/** Parse and write a source in one dialect as another, preserving loss diagnostics. */
export function convertMarkdownDialect(
  source: string,
  from: MarkdownDialect,
  to: MarkdownDialect,
  options: MarkdownDialectWriteOptions = {}
): MarkdownDialectWriteResult {
  const read = readMarkdownDialect(source, from);
  const write = writeMarkdownDialect(read.tree, to, options);
  return { value: write.value, diagnostics: [...read.diagnostics, ...write.diagnostics] };
}

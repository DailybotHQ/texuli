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
}

const plain = (value: string): MdInline => ({ type: 'text', value });
const root = (children: readonly MdBlock[]): MdRoot => ({
  type: 'root',
  version: MARKDOWN_AST_VERSION,
  children,
});
const text = (value: string) => value.replace(/\r\n?/g, '\n');
const maxSource = MARKDOWN_LIMITS.source;
const inlineTokenWindow = 16_384;

function escaped(
  value: string,
  dialect: MarkdownDialect,
  context: 'text' | 'code' | 'url' | 'attribute' = 'text'
): string {
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
  if (dialect === 'slack' && context === 'url')
    return value.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\|/g, '%7C');
  if ((dialect === 'teams' || dialect === 'google-chat') && context === 'url')
    return value.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\|/g, '%7C');
  if (dialect === 'slack')
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (dialect === 'plain-text') return value;
  if (dialect === 'whatsapp') return value;
  if (dialect === 'teams' || dialect === 'google-chat')
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return value.replace(/([\\*_`~|])/g, '\\$1');
}

function inline(source: string, dialect: MarkdownDialect, depth = 0): MdInline[] {
  if (dialect === 'plain-text') return source ? [plain(source)] : [];
  if (depth >= MARKDOWN_LIMITS.inlineDepth) return source ? [plain(source)] : [];
  const nodes: MdInline[] = [];
  let cursor = 0;
  while (cursor < source.length) {
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
    if (dialect === 'telegram-html') {
      const tag =
        /^<(tg-spoiler|b|strong|i|em|s|strike|del|u|ins|code|a)(?:\s+href="([^"]*)")?>([\s\S]*?)<\/\1>/i.exec(
          rest
        );
      if (tag) {
        const children = inline(tag[3] ?? '', dialect, depth + 1);
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
    const link =
      dialect === 'slack' || dialect === 'google-chat'
        ? /^<((?:https?:\/\/|mailto:)[^|>]+)(?:\|([^>]*))?>/.exec(rest)
        : dialect === 'discord' ||
            dialect === 'telegram-markdown-v2' ||
            dialect === 'teams' ||
            dialect === 'mattermost'
          ? /^\[([^\]]*)\]\(([^\s)]*)(?:\s+"([^"]*)")?\)/.exec(rest)
          : null;
    if (link) {
      const slackLink = dialect === 'slack' || dialect === 'google-chat';
      nodes.push({
        type: 'link',
        url: slackLink ? (link[1] ?? '') : (link[2] ?? ''),
        children: inline(
          slackLink ? link[2] || link[1] || '' : (link[1] ?? ''),
          dialect,
          depth + 1
        ),
        ...(link[3] && !slackLink ? { title: link[3] } : {}),
      });
      cursor += link[0].length;
      continue;
    }
    const delimiter: readonly (readonly [string, string])[] =
      dialect === 'slack'
        ? [
            ['*', 'strong'],
            ['_', 'emphasis'],
            ['~', 'delete'],
            ['`', 'inlineCode'],
          ]
        : dialect === 'whatsapp'
          ? [
              ['*', 'strong'],
              ['_', 'emphasis'],
              ['~', 'delete'],
              ['```', 'inlineCode'],
              ['`', 'inlineCode'],
            ]
          : [
              ['**', 'strong'],
              ['__', 'underline'],
              ['~~', 'delete'],
              ['||', 'spoiler'],
              ['*', 'emphasis'],
              ['_', 'emphasis'],
              ['`', 'inlineCode'],
            ];
    let matched = false;
    for (const [mark, kind] of delimiter) {
      if (!rest.startsWith(mark)) continue;
      const relativeEnd = source
        .slice(cursor + mark.length, cursor + inlineTokenWindow)
        .indexOf(mark);
      if (relativeEnd < 1) continue;
      const end = cursor + mark.length + relativeEnd;
      const body = source.slice(cursor + mark.length, end);
      nodes.push(
        kind === 'inlineCode'
          ? { type: 'inlineCode', value: body }
          : ({ type: kind as 'strong', children: inline(body, dialect, depth + 1) } as MdInline)
      );
      cursor = end + mark.length;
      matched = true;
      break;
    }
    if (matched) continue;
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
      blocks.push({ type: 'paragraph', children: inline(paragraph.join('\n'), dialect) });
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
          children: [{ type: 'paragraph', children: inline(match?.[2] ?? line, dialect) }],
        });
      index++;
      continue;
    }
    const fence = /^(?:```|~~~)(.*)$/.exec(line);
    if (fence && dialect !== 'whatsapp') {
      flush();
      const code: string[] = [];
      index++;
      while (index < lines.length && !/^(?:```|~~~)\s*$/.test(lines[index] ?? ''))
        code.push(lines[index++] ?? '');
      if (index < lines.length) index++;
      const lang = (fence[1] ?? '').trim().split(/\s+/)[0];
      blocks.push({
        type: 'code',
        value: code.join('\n'),
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
        children: inline(heading[2] ?? '', dialect),
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
        children: [{ type: 'paragraph', children: inline(quote.join('\n'), dialect) }],
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
          children: [{ type: 'paragraph' as const, children: inline(item[3] ?? '', dialect) }],
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
  trust: HrefTrust
): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return escaped(node.value, dialect);
        case 'emphasis':
          return dialect === 'telegram-html'
            ? `<i>${writeInline(node.children, dialect, diagnostics, trust)}</i>`
            : wrap(
                writeInline(node.children, dialect, diagnostics, trust),
                dialect === 'slack' || dialect === 'whatsapp' ? '_' : '*'
              );
        case 'strong':
          return dialect === 'telegram-html'
            ? `<b>${writeInline(node.children, dialect, diagnostics, trust)}</b>`
            : wrap(
                writeInline(node.children, dialect, diagnostics, trust),
                dialect === 'slack' || dialect === 'whatsapp' ? '*' : '**'
              );
        case 'delete':
          return dialect === 'telegram-html'
            ? `<s>${writeInline(node.children, dialect, diagnostics, trust)}</s>`
            : wrap(
                writeInline(node.children, dialect, diagnostics, trust),
                dialect === 'slack' || dialect === 'whatsapp' ? '~' : '~~'
              );
        case 'underline':
          return dialect === 'telegram-html'
            ? `<u>${writeInline(node.children, dialect, diagnostics, trust)}</u>`
            : dialect === 'discord' || dialect === 'telegram-markdown-v2'
              ? `__${writeInline(node.children, dialect, diagnostics, trust)}__`
              : loss(
                  writeInline(node.children, dialect, diagnostics, trust),
                  'Underline is unsupported by this dialect.',
                  diagnostics
                );
        case 'spoiler':
          return dialect === 'telegram-html'
            ? `<tg-spoiler>${writeInline(node.children, dialect, diagnostics, trust)}</tg-spoiler>`
            : dialect === 'discord' || dialect === 'telegram-markdown-v2'
              ? `||${writeInline(node.children, dialect, diagnostics, trust)}||`
              : loss(
                  writeInline(node.children, dialect, diagnostics, trust),
                  'Spoilers are unsupported by this dialect.',
                  diagnostics
                );
        case 'inlineCode':
          return dialect === 'telegram-html'
            ? `<code>${escaped(node.value, dialect, 'code')}</code>`
            : `\u0060${escaped(node.value, dialect, 'code')}\u0060`;
        case 'break':
          return '\n';
        case 'link': {
          const label = writeInline(node.children, dialect, diagnostics, trust);
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
          return mentionText(node, dialect, diagnostics);
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
function mentionText(
  node: Extract<MdInline, { type: 'mention' }>,
  dialect: MarkdownDialect,
  diagnostics: MarkdownDiagnostic[]
): string {
  const label = node.label ?? node.id ?? node.kind;
  const usableId = node.id && /^[A-Za-z0-9._:-]{1,128}$/.test(node.id) ? node.id : undefined;
  if (dialect === 'slack' && usableId)
    return node.kind === 'channel'
      ? `<#${usableId}|${escaped(label, dialect)}>`
      : node.kind === 'everyone'
        ? '<!everyone>'
        : node.kind === 'here'
          ? '<!here>'
          : `<@${usableId}>`;
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
  const writeBlock = (block: MdBlock): string => {
    switch (block.type) {
      case 'paragraph':
        return dialect === 'plain-text'
          ? loss(
              flattenInline(block.children),
              'Inline formatting is flattened to plain text.',
              diagnostics
            )
          : writeInline(block.children, dialect, diagnostics, trust);
      case 'heading':
        if (dialect === 'plain-text')
          return loss(
            flattenInline(block.children),
            'Heading structure is omitted in plain text.',
            diagnostics
          );
        return dialect === 'discord' || dialect === 'mattermost'
          ? `${'#'.repeat(block.depth)} ${writeInline(block.children, dialect, diagnostics, trust)}`
          : loss(
              writeInline(block.children, dialect, diagnostics, trust),
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
          return loss(block.value, 'Code formatting is omitted in plain text.', diagnostics);
        return dialect === 'telegram-html'
          ? `<pre>${escaped(block.value, dialect, 'code')}</pre>`
          : dialect === 'whatsapp'
            ? `\`\`\`${escaped(block.value, dialect, 'code')}\`\`\``
            : `\`\`\`${block.lang ?? ''}\n${escaped(block.value, dialect, 'code')}\n\`\`\``;
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
                    ? flattenInline(cell.children)
                    : writeInline(cell.children, dialect, diagnostics, trust)
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

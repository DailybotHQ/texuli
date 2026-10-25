/**
 * Build-time HTML to Markdown for "Copy page" (FIX-site-sidebar-nav): turns a
 * page's rendered main content into Markdown an agent can read. Runs only in
 * the Astro build on the site's own HTML. Text only: scripts, styles,
 * templates, SVG, navigation, forms and hidden content are dropped; nothing
 * is executed, and the result goes back into the page only as escaped text
 * (`integration.ts`).
 */

const DROP =
  /<(script|style|template|svg|noscript|button|select|textarea|input|dialog|nav)\b[^>]*>[\s\S]*?<\/\1>|<(input|img|br|hr|meta|link)\b[^>]*\/?>/gi;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value =
        code[1] === 'x' || code[1] === 'X'
          ? Number.parseInt(code.slice(2), 16)
          : Number(code.slice(1));
      return Number.isFinite(value) && value > 0 && value < 0x110000
        ? String.fromCodePoint(value)
        : '';
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/**
 * Inline markup to Markdown. Entities stay encoded here, so text such as
 * `&lt;Button&gt;` is never mistaken for a tag by a later pass; `htmlToMarkdown`
 * decodes once at the end.
 */
function inline(html: string): string {
  return html
    .replace(
      /<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_m, href: string, text: string) => {
        const label = inline(text).trim();
        return label ? `[${label}](${href})` : '';
      }
    )
    .replace(
      /<code\b[^>]*>([\s\S]*?)<\/code>/gi,
      (_m, text: string) => `\`${text.replace(/<[^>]+>/g, '')}\``
    )
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '_$2_')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t\r\n]+/g, ' ');
}

/** Converts rendered HTML (a page's main content) to Markdown. */
export function htmlToMarkdown(html: string): string {
  let text = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+\b(hidden|aria-hidden="true")[^>]*>[\s\S]*?<\/(span|div|p)>/gi, '')
    .replace(DROP, '');
  const blocks: string[] = [];
  // Code blocks first, so their whitespace survives.
  text = text.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_m, code: string) => {
    blocks.push(
      `\n\n\`\`\`\n${decode(code.replace(/<[^>]+>/g, '')).replace(/\n+$/, '')}\n\`\`\`\n\n`
    );
    return `\uE000${blocks.length - 1}\uE000`;
  });
  text = text
    .replace(
      /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
      (_m, level: string, body: string) =>
        `\n\n${'#'.repeat(Number(level))} ${inline(body).trim()}\n\n`
    )
    .replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (_m, row: string) => {
      const cells = [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) =>
        inline(cell[1] ?? '')
          .trim()
          .replace(/\|/g, '\\|')
      );
      const header = /<th\b/i.test(row);
      return `\n| ${cells.join(' | ')} |${header ? `\n|${cells.map(() => ' --- |').join('')}` : ''}`;
    })
    .replace(/<\/table>/gi, '\n\n')
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, body: string) => `\n- ${inline(body).trim()}`)
    .replace(/<\/(ul|ol)>/gi, '\n\n')
    .replace(
      /<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi,
      (_m, body: string) => `\n\n> ${inline(body).trim()}\n\n`
    )
    .replace(
      /<(p|dt|dd|figcaption|caption|summary)\b[^>]*>([\s\S]*?)<\/\1>/gi,
      (_m, _tag: string, body: string) => `\n\n${inline(body).trim()}\n\n`
    )
    .replace(/<\/(div|section|article|header|footer|nav|aside|figure|details|dl)>/gi, '\n');
  text = decode(inline(text.replace(/\n/g, '\uE001')).replace(/\uE001/g, '\n'));
  text = text.replace(/\uE000(\d+)\uE000/g, (_m, index: string) => blocks[Number(index)] ?? '');
  return `${text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}

/**
 * Build-time HTML to Markdown for "Copy page" (FIX-site-sidebar-nav): turns a
 * page's rendered main content into Markdown an agent can read. Runs only in
 * the Astro build on the site's own HTML. Text only: scripts, styles,
 * templates, SVG, navigation, forms, the copy-page hint and hidden content
 * are dropped; nothing is executed, and the result goes back into the page only as escaped text
 * (`integration.ts`).
 */

// The copy-page hint matches by class token, whatever else the tag carries:
// the build adds Astro's scope attribute (`data-astro-cid-…`) after it.
const DROP =
  /<(script|style|template|svg|noscript|button|select|textarea|input|dialog|nav)\b[^>]*>[\s\S]*?<\/\1>|<(input|img|br|hr|meta|link)\b[^>]*\/?>|<p\b[^>]*\sclass="(?:[^"]*\s)?copy-page__hint(?:\s[^"]*)?"[^>]*>[\s\S]*?<\/p>/gi;

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

/** One attribute of a tag's source, or `''`. */
function attribute(tag: string, name: string): string {
  return new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag)?.[1] ?? '';
}

/**
 * An image as text (PLAN_011 T-ar-twins: no fact may live only in an
 * image). An informative image (non-empty `alt`, not `aria-hidden`) becomes
 * `![alt](src)` when its source is a site path or an https URL, or its alt
 * text alone otherwise; a decorative one (`alt=""`) disappears. A labelled
 * SVG (`role="img"` with `aria-label`) keeps its label the same way.
 */
function imageText(tag: string): string {
  if (/\saria-hidden="true"/i.test(tag)) return '';
  const alt = attribute(tag, tag.startsWith('<svg') ? 'aria-label' : 'alt')
    .replace(/[[\]]/g, '')
    .trim();
  if (!alt) return '';
  const src = attribute(tag, 'src');
  const linkable = (src.startsWith('/') && !src.startsWith('//')) || src.startsWith('https://');
  return linkable && !/[\s()]/.test(src) ? ` ![${alt}](${src}) ` : ` ${alt} `;
}

/**
 * Layout tables (`role="presentation"`, as email HTML uses them) become plain
 * blocks, so only data tables turn into Markdown tables. A stack follows the
 * nesting, so a data table inside a layout table keeps its rows and cells.
 */
function unwrapLayoutTables(html: string): string {
  const stack: boolean[] = [];
  return html.replace(
    /<(\/?)(table|thead|tbody|tfoot|tr|td|th)\b([^>]*)>/gi,
    (tag, close: string, name: string, attributes: string) => {
      const element = name.toLowerCase();
      if (element === 'table') {
        if (close) return stack.pop() ? '</div>' : tag;
        const layout = /\srole="(?:presentation|none)"/i.test(attributes);
        stack.push(layout);
        return layout ? '<div>' : tag;
      }
      if (!stack.at(-1)) return tag;
      if (element === 'td' || element === 'th' || element === 'tr')
        return close ? '</div>' : '<div>';
      return '';
    }
  );
}

/** Converts rendered HTML (a page's main content) to Markdown. */
export function htmlToMarkdown(html: string): string {
  let text = unwrapLayoutTables(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+\b(hidden|aria-hidden="true")[^>]*>[\s\S]*?<\/(span|div|p)>/gi, '')
    .replace(/<img\b[^>]*>/gi, imageText)
    .replace(/(<svg\b[^>]*\srole="img"[^>]*>)[\s\S]*?<\/svg>/gi, (_m, open: string) =>
      imageText(open)
    )
    .replace(DROP, '');
  const blocks: string[] = [];
  // Code blocks first, so their whitespace survives.
  text = text.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_m, code: string) => {
    blocks.push(
      `\n\n\`\`\`\n${decode(code.replace(/<[^>]+>/g, '')).replace(/\n+$/, '')}\n\`\`\`\n\n`
    );
    return `\uE000${blocks.length - 1}\uE000`;
  });
  // Tables next, as one Markdown table per `<table>`: the separator belongs
  // after the header row only, even when body rows use `th` row headers.
  text = text.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_m, table: string) => {
    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...(row[1] ?? '').matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((cell) =>
        inline(cell[2] ?? '')
          .trim()
          .replace(/\|/g, '\\|')
      )
    );
    if (!rows.length) return '\n\n';
    const width = Math.max(...rows.map((cells) => cells.length));
    const pad = (cells: string[]) => {
      const copy = [...cells];
      while (copy.length < width) copy.push('');
      return copy;
    };
    const separator = `|${Array.from({ length: width }, () => ' --- |').join('')}`;
    const lines = [
      `| ${pad(rows[0] ?? []).join(' | ')} |`,
      separator,
      ...rows.slice(1).map((cells) => `| ${pad(cells).join(' | ')} |`),
    ];
    return `\n\n${lines.join('\n')}\n\n`;
  });
  text = text
    .replace(
      /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
      (_m, level: string, body: string) =>
        `\n\n${'#'.repeat(Number(level))} ${inline(body).trim()}\n\n`
    )
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

/**
 * Root-relative links to absolute ones for the served `.md` twins (T-23):
 * an agent fetching `guides/theming.md` from anywhere must be able to follow
 * links without resolving a base. Fenced code is left untouched, so a code
 * sample that shows Markdown keeps its shape.
 */
export function absolutizeMarkdownLinks(markdown: string, origin: string): string {
  return markdown
    .split(/(```[\s\S]*?```)/g)
    .map((chunk) =>
      chunk.startsWith('```') ? chunk : chunk.replace(/\]\((\/[^)]*)\)/g, `](${origin}$1)`)
    )
    .join('');
}

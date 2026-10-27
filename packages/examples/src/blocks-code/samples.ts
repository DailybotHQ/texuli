// biome-ignore-all lint/suspicious/noTemplateCurlyInString: samples are source code text that contains ${…}.
/** Code family samples (T-blocks-code). Fictional example.com content only. */

export const CODE_SAMPLES: readonly { label: string; block: unknown }[] = [
  {
    label: 'TypeScript with a filename',
    block: {
      type: 'code',
      lang: 'ts',
      filename: 'harbor/notes.ts',
      caption: 'Line numbers and two highlight steps come from the block data.',
      lineNumbers: true,
      highlights: ['1-4', '7-9'],
      code: [
        'interface Note {',
        '  id: string;',
        '  title: string;',
        '}',
        '',
        '// Fetch one note from the fictional API.',
        'export async function getNote(id: string): Promise<Note> {',
        '  const response = await fetch(`https://api.example.com/notes/${id}`);',
        '  return (await response.json()) as Note;',
        '}',
      ].join('\n'),
    },
  },
  {
    label: 'Python',
    block: {
      type: 'code',
      lang: 'python',
      code: 'def total(items):\n    """Sum the prices in cents."""\n    return sum(item["cents"] for item in items)  # integer math\n',
    },
  },
  {
    label: 'SQL',
    block: {
      type: 'code',
      lang: 'sql',
      code: "SELECT id, title\nFROM notes\nWHERE owner = 'ada@example.com'\nORDER BY created_at DESC\nLIMIT 10;",
    },
  },
  {
    label: 'JSON',
    block: {
      type: 'code',
      lang: 'json',
      filename: 'settings.json',
      code: '{\n  "theme": "enterprise-neutral",\n  "density": 1,\n  "beta": false\n}',
    },
  },
  {
    label: 'Shell',
    block: {
      type: 'code',
      lang: 'bash',
      code: '# install and run\npnpm install\npnpm dev --port 4810',
    },
  },
  {
    label: 'Plain text (no language)',
    block: { type: 'code', code: 'Harbor Notes v1.4.2\nAll systems normal.' },
  },
  {
    label: 'Long line (horizontal scroll)',
    block: {
      type: 'code',
      lang: 'text',
      code: 'deployment-note: this deliberately long line demonstrates that code remains readable in a horizontally scrollable region at narrow viewport widths without wrapping or clipping its contents',
    },
  },
];

const RLO = '\u202e';

export const CODE_HOSTILE: readonly { label: string; block: unknown }[] = [
  {
    label: 'Markup in code stays text',
    block: {
      type: 'code',
      lang: 'html',
      code: '<script>alert(1)</script>\n<img src="x" onerror="alert(1)">\n<a href="javascript:alert(1)">link</a>',
    },
  },
  {
    label: 'A bidi override is rejected',
    block: { type: 'code', lang: 'js', code: `const access = "user${RLO} // admin";` },
  },
  {
    label: 'An injected language token is rejected',
    block: { type: 'code', lang: 'ts" onload="alert(1)', code: 'const a = 1;' },
  },
  {
    label: 'A foreign block type is rejected',
    block: { type: 'script', code: 'alert(1)' },
  },
];

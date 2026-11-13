export {};

const form = document.querySelector<HTMLFormElement>('[data-emoji-converter]');
const input = document.querySelector<HTMLTextAreaElement>('[data-converter-input]');
const output = document.querySelector<HTMLElement>('[data-converter-output]');
const status = document.querySelector<HTMLElement>('[data-converter-status]');
const diagnostics = document.querySelector<HTMLUListElement>('[data-converter-diagnostics]');

if (form && input && output && status && diagnostics) {
  const render = async () => {
    status.textContent = 'Converting with the local Unicode catalog…';
    const [canonical, legacy] = await Promise.all([
      import('@texuli/emojis'),
      import('@texuli/emojis/legacy-engine'),
    ]);
    const values = new FormData(form);
    const direction = String(values.get('direction'));
    const dialect = String(values.get('dialect'));
    const mode = String(values.get('mode')) === 'permissive' ? 'permissive' : 'strict';
    const source = input.value;
    let result = source;
    const notes: string[] = [];
    if (direction === 'shortcode-to-unicode') {
      if (dialect === 'legacy') {
        const converted = legacy.toUnicodeLegacy(source, { mode });
        result = converted.text;
        const conflicts =
          mode === 'permissive'
            ? legacy.toUnicodeLegacy(source, { mode: 'strict' }).conflicts
            : converted.conflicts;
        for (const conflict of conflicts) {
          notes.push(
            `:${conflict.alias}: has conflicting legacy meanings (${conflict.candidates.join(', ')}). ${mode === 'strict' ? 'It was preserved.' : 'The documented fallback was used.'}`
          );
        }
        for (const alias of converted.unknown)
          notes.push(`:${alias}: is not a known legacy alias and was preserved.`);
      } else {
        result = canonical.toUnicode(source);
        if (/:([a-z0-9_+-]{1,80}):/.test(source) && result === source)
          notes.push(
            'Unrecognized and legacy-only shortcodes are preserved in the Texuli canonical dialect.'
          );
      }
    } else {
      result =
        dialect === 'legacy' ? legacy.toShortcodesLegacy(source) : canonical.toShortcodes(source);
    }
    output.textContent = result;
    diagnostics.replaceChildren(
      ...notes.map((note) => {
        const item = document.createElement('li');
        item.textContent = note;
        return item;
      })
    );
    status.textContent = notes.length
      ? `${notes.length} diagnostic${notes.length === 1 ? '' : 's'}.`
      : 'Conversion complete. Unknown text is preserved.';
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void render();
  });
}

export {};

const form = document.querySelector<HTMLFormElement>('[data-emoji-search]');
const input = form?.querySelector<HTMLInputElement>('input[name="q"]');
const results = document.querySelector<HTMLOListElement>('[data-search-results]');
const status = document.querySelector<HTMLElement>('[data-search-status]');

if (form && input && results && status) {
  let pendingSearch: Promise<typeof import('@texuli/emojis/search')> | undefined;
  const render = async () => {
    const query = input.value.trim();
    if (!query) {
      status.textContent = 'Search the Unicode 18.0 catalog. Results use CLDR names and keywords.';
      return;
    }
    status.textContent = 'Searching the local Unicode catalog…';
    pendingSearch ??= import('@texuli/emojis/search');
    const { searchEmojis } = await pendingSearch;
    if (query !== input.value.trim()) return;
    const matches = searchEmojis(query, { limit: 30 });
    status.textContent = matches.length
      ? `${matches.length} matching emoji shown${matches.length === 30 ? ' (up to 30)' : ''}.`
      : 'No matches. Try another name or keyword.';
    const items = matches.map(({ emoji }) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'emoji-card';
      link.href = `/emoji/${emoji.id}/`;
      const glyph = document.createElement('span');
      glyph.className = 'emoji-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = emoji.unicode;
      const details = document.createElement('span');
      const name = document.createElement('span');
      name.className = 'emoji-name';
      name.textContent = emoji.name;
      const shortcode = document.createElement('span');
      shortcode.className = 'emoji-code';
      shortcode.textContent = emoji.shortcode;
      details.append(name, shortcode);
      link.append(glyph, details);
      item.append(link);
      return item;
    });
    results.replaceChildren(...items);
  };
  input.addEventListener('input', render);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    render();
  });
}

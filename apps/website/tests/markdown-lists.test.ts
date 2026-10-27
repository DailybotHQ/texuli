/**
 * List items in the Markdown rendition ("Copy page" and the served `.md`
 * twins). Commit 08c5ebcf dropped the `<li>` rule while rewriting tables,
 * so lists came out as run-together text ("One**Two**"); the e2e check in
 * tests/e2e/site-docs-nav.spec.ts caught it only once CI ran the suite.
 */
import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../src/components/docs/markdown.ts';

describe('htmlToMarkdown lists', () => {
  it('renders each list item as a "- " line, inline markup kept', () => {
    const markdown = htmlToMarkdown(
      '<ul><li>One</li><li><strong>Two</strong></li></ul><p>After</p>'
    );
    expect(markdown).toContain('- One\n- **Two**');
    expect(markdown).toContain('After');
  });

  it('keeps ordered-list items on their own lines too', () => {
    expect(htmlToMarkdown('<ol><li>First</li><li>Second</li></ol>')).toContain('- First\n- Second');
  });
});

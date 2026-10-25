<script lang="ts">
/**
 * Footer: brand, link columns and the legal line. Plain markup on tokens, so
 * nothing to add. Paste it as the page's last child to make it the
 * `contentinfo` landmark.
 */
const columns = [
  { title: 'Product', links: ['Features', 'Pricing', 'Changelog'] },
  { title: 'Company', links: ['About', 'Careers', 'Contact'] },
  { title: 'Resources', links: ['Docs', 'Status', 'Privacy'] },
];
const slug = (text: string) => text.toLowerCase().replace(/\s+/g, '-');
</script>

<footer class="footer">
  <div class="footer__brand">
    <p class="footer__name">Harbor Notes</p>
    <p class="footer__tagline">Notes your whole harbor crew can trust.</p>
  </div>
  <div class="footer__columns">
    {#each columns as column (column.title)}
      <nav class="footer__column" aria-label={`Footer: ${column.title}`}>
        <p class="footer__heading" id={`footer-heading-${slug(column.title)}`}>{column.title}</p>
        <ul class="footer__links" aria-labelledby={`footer-heading-${slug(column.title)}`}>
          {#each column.links as link (link)}<li><a href={`#${slug(link)}`}>{link}</a></li>{/each}
        </ul>
      </nav>
    {/each}
  </div>
  <p class="footer__legal">© 2026 Harbor Notes, a fictional company.</p>
</footer>

<style>
  .footer {
    display: grid;
    gap: 1.5rem;
    padding-block: 1.5rem;
    border-block-start: var(--tx-border-width, 1px) solid var(--tx-border, currentColor);
  }
  .footer__name {
    margin: 0;
    font-weight: 700;
  }
  .footer__tagline,
  .footer__legal {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }
  .footer__columns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
    gap: 1.5rem;
  }
  .footer__heading {
    margin: 0 0 0.5rem;
    font-weight: 600;
  }
  .footer__links {
    display: grid;
    gap: 0.375rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .footer__links a {
    color: var(--tx-link, LinkText);
  }
  .footer__links a:focus-visible {
    outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>

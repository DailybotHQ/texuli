<script lang="ts">
import { Code, CopyButton, Kbd } from 'texuli/kbd-code';

const sample = "import { Kbd } from 'texuli/kbd-code';\n// fictional example.com only";
</script>

<section data-example="texuli-kbd-code" aria-labelledby="tx-kbd-code-title">
  <h2 id="tx-kbd-code-title">Kbd, Code and CopyButton</h2>
  <p>
    Keyboard keys, escaped inline and block code, and copy with feedback. Fictional
    example.com only.
  </p>

  <h3>Keyboard</h3>
  <p class="row" data-axis="kbd">
    Press <Kbd>⌘</Kbd> + <Kbd>K</Kbd> to open the command palette, or
    <Kbd>Esc</Kbd> to dismiss.
  </p>

  <h3>Inline code</h3>
  <p data-axis="code-inline">
    Install with <Code value="pnpm add texuli" /> then import
    <Code value="texuli/kbd-code" />.
  </p>

  <h3>Block code</h3>
  <div data-axis="code-block">
    <Code variant="block" language="ts" value={sample} />
  </div>

  <h3>Hostile text stays text</h3>
  <p data-axis="code-escape">
    <Code value={'<img src=x onerror=alert(1)>'} />
  </p>

  <h3>Copy</h3>
  <div class="row" data-axis="copy">
    <CopyButton value="https://example.com/docs" label="Copy link" copiedLabel="Link copied" />
    <CopyButton value={sample} size="sm" label="Copy snippet" copiedLabel="Snippet copied" />
  </div>

  <h3>RTL</h3>
  <div class="row" dir="rtl" lang="ar" data-axis="rtl">
    <Kbd>Ctrl</Kbd>
    <Code value="مثال" />
    <CopyButton value="مثال" label="نسخ" copiedLabel="تم النسخ" />
  </div>

  <h3>Dark</h3>
  <div class="row dark-panel" data-tx-mode="dark" data-axis="dark">
    <Kbd>⇧</Kbd>
    <Code value="const mode = 'dark'" />
    <CopyButton value="const mode = 'dark'" label="Copy" copiedLabel="Copied" />
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 1rem;
    padding: 1rem;
    max-inline-size: 48rem;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .dark-panel {
    padding: 0.75rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background, #0a0a0a);
    color: var(--tx-foreground, #fafafa);
  }
</style>

<script lang="ts">
import { Accordion } from 'texuli/tabs-accordion';

/**
 * FAQ: questions as an accordion (one open at a time, keyboard operable).
 * Copy-ready: `texuli add tabs-accordion`, then replace the questions.
 */
const questions = [
  {
    value: 'offline',
    title: 'Does Harbor Notes work without signal?',
    content: 'Yes. Notes are saved on the device and sync when a connection returns.',
  },
  {
    value: 'crew',
    title: 'How many crew members can share a notebook?',
    content: 'Deckhand allows three; Captain and Harbor have no limit.',
  },
  {
    value: 'export',
    title: 'Can I export the logs?',
    content: 'Captain and Harbor export any date range to PDF or CSV.',
  },
  {
    value: 'cancel',
    title: 'Can I cancel at any time?',
    content: 'Yes. Your notes stay readable on the free plan.',
  },
];
</script>

<section class="faq" aria-labelledby="faq-title">
  <h3 id="faq-title" class="faq__title">Frequently asked questions</h3>
  <Accordion items={questions} type="single" headingLevel={4} />
</section>

<style>
  .faq {
    display: grid;
    gap: 1rem;
    max-inline-size: 48rem;
  }
  .faq__title {
    margin: 0;
    font-size: 1.5rem;
  }
</style>

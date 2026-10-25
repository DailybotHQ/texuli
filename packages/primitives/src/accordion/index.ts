/**
 * Accordion: owned, headless WAI-ARIA APG Accordion (T-prim-accordion): Root,
 * Item, Header, Trigger and Content, composed as `Accordion.*`.
 */
import Content from './AccordionContent.svelte';
import Header from './AccordionHeader.svelte';
import Item from './AccordionItem.svelte';
import Root from './AccordionRoot.svelte';
import Trigger from './AccordionTrigger.svelte';

export const Accordion = { Root, Item, Header, Trigger, Content };

export type {
  AccordionContentProps,
  AccordionHeaderProps,
  AccordionHeadingLevel,
  AccordionItemProps,
  AccordionMultipleRootProps,
  AccordionOrientation,
  AccordionRootProps,
  AccordionSingleRootProps,
  AccordionTriggerProps,
  AccordionType,
} from './types.ts';

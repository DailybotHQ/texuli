import type { CarouselItem } from 'texuli';

/** A fictional slide: the carousel item plus what the demo card shows. */
export interface DemoSlide extends CarouselItem {
  text: string;
  tone: 'dawn' | 'night' | 'forest' | 'sea';
}

/** Fictional travel destinations; no real places or people. */
export const DESTINATIONS: readonly DemoSlide[] = [
  {
    id: 'harbor',
    label: 'Harbor at dawn',
    text: 'Fishing boats leave Port Example before sunrise; the café on pier 3 opens at five.',
    tone: 'dawn',
  },
  {
    id: 'market',
    label: 'Night market',
    text: 'Forty stalls, one long street, and lanterns until midnight every Friday.',
    tone: 'night',
  },
  {
    id: 'ridge',
    label: 'Ridge trail',
    text: 'A six-kilometre loop with two lookouts and a shaded rest stop halfway.',
    tone: 'forest',
  },
  {
    id: 'cove',
    label: 'Quiet cove',
    text: 'Calm water, a small library kiosk and kayaks for hire by the hour.',
    tone: 'sea',
  },
];

/** The same destinations with Arabic labels, for the right-to-left example. */
export const DESTINATIONS_AR: readonly DemoSlide[] = [
  {
    id: 'harbor',
    label: 'ميناء عند الفجر',
    text: 'تغادر قوارب الصيد قبل شروق الشمس.',
    tone: 'dawn',
  },
  { id: 'market', label: 'سوق ليلي', text: 'أربعون كشكًا في شارع طويل واحد.', tone: 'night' },
  { id: 'ridge', label: 'مسار الجبل', text: 'حلقة بطول ستة كيلومترات مع مطلّين.', tone: 'forest' },
];

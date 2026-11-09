/**
 * Copy for the /native/ FAQ (§50.4). Answers are derived from
 * `NATIVE_COMPATIBILITY` and the native README: no typed catalog counts, no
 * Android or iOS SDK, no “write once, run anywhere”. Links point only at
 * pages that exist.
 */
import { NATIVE_COMPATIBILITY } from '../../../../data/native/compatibility.ts';
import { REPOSITORY_URL } from '../../../foundation/site.ts';
import { nativeHeroStatus } from '../hero/hero-content.ts';

export interface NativeFaqLink {
  readonly label: string;
  readonly href: string;
}

export interface NativeFaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly links?: readonly NativeFaqLink[];
}

type CompatibilityData = typeof NATIVE_COMPATIBILITY;

export const NATIVE_FAQ = {
  ids: { heading: 'native-faq-title' },
  title: 'Questions',
  lede: 'Short answers with the same status the rest of this page uses.',
  tryCommand: './native/gradlew -p native check',
  jdk: 'JDK 21',
} as const;

function statusOf(
  data: CompatibilityData,
  id: 'compose-desktop' | 'android' | 'ios'
): ReturnType<typeof nativeHeroStatus>[number] {
  const row = nativeHeroStatus(data).find((item) => item.id === id);
  if (!row) throw new Error(`Native FAQ: missing status row "${id}"`);
  return row;
}

/** The §50.4 questions, with counts filled from the compatibility data. */
export function nativeFaqItems(data: CompatibilityData = NATIVE_COMPATIBILITY): NativeFaqItem[] {
  const { painted, catalog } = data.totals;
  const desktop = statusOf(data, 'compose-desktop');
  const android = statusOf(data, 'android');
  const ios = statusOf(data, 'ios');
  const nativeSource = `${REPOSITORY_URL}/tree/main/native`;
  return [
    {
      id: 'available',
      question: 'Is native available?',
      answer: `No. There is no Android or iOS SDK. Compose Desktop paints a read-only slice of the catalog (${painted} of ${catalog} components) and is ${desktop.status}. Android is ${android.status}. iOS is ${ios.status}. Web packages are on npm, pre-1.0.`,
    },
    {
      id: 'react-native',
      question: 'Is this React Native?',
      answer:
        'No. Texuli Native is a Kotlin Multiplatform twin of the blueprint spec, with a Jetpack Compose renderer. It is not React Native, Flutter or SwiftUI.',
    },
    {
      id: 'svelte',
      question: 'Does Texuli Native reuse Svelte components?',
      answer:
        'No. Web and native share the blueprint contract and design tokens. Each target has its own renderer. Svelte components do not run on a phone.',
      links: [{ label: 'Why Svelte and Kotlin', href: '/guides/why-svelte-kotlin/' }],
    },
    {
      id: 'webview',
      question: 'Is it a WebView?',
      answer:
        'No. Compose Desktop paints native widgets from a validated blueprint. It does not wrap the website in a WebView.',
    },
    {
      id: 'ios',
      question: 'Can I use it in iOS today?',
      answer: `No. An iOS UI renderer is ${ios.status}. ${ios.detail}`,
    },
    {
      id: 'android',
      question: 'Can I use it in Android today?',
      answer: `No. An Android UI renderer is ${android.status}. ${android.detail}`,
    },
    {
      id: 'all-components',
      question: 'Are all Web components available natively?',
      answer: `No. Compose Desktop paints ${painted} of ${catalog} catalog components. Interactive web views (forms, chat, editors) paint read-only. The rest stay placeholders.`,
      links: [{ label: 'What exists today', href: '/web-and-native/#what-exists-today' }],
    },
    {
      id: 'a11y',
      question: 'How are accessibility and native navigation handled?',
      answer:
        'Compose semantics expose headings, image alternatives, chart summaries, table cells, lists and boards. Heading rank is visual only: Compose does not expose numeric rank to assistive technology. There are no live regions or blueprint-bound interactive controls. Linked images send navigate intents to the host.',
    },
    {
      id: 'agents',
      question: 'Can agents generate interfaces for both?',
      answer:
        'Agents emit a blueprint (a catalog tree). The web player paints it. The native twin validates the same JSON and paints the slice that Compose supports. There is no deployed agent service that writes native apps.',
    },
    {
      id: 'blueprints',
      question: 'How do blueprints travel?',
      answer:
        'A JSON tree is checked against @texuli/spec. TypeScript and Kotlin share that contract. The web player and the Compose renderer each paint what they support. Nothing is compiled from Svelte to Kotlin.',
    },
    {
      id: 'compatibility',
      question: 'Where can I see compatibility and limitations?',
      answer: `The compatibility view lists ${painted} painted of ${catalog} catalog components, plus Android and iOS as planned until a renderer exists.`,
      links: [{ label: 'Web and native', href: '/web-and-native/' }],
    },
    {
      id: 'try',
      question: 'How do I try it?',
      answer: `From the repository root, with ${NATIVE_FAQ.jdk}: ${NATIVE_FAQ.tryCommand}. The native tree is not a pnpm package and is not published to Maven Central.`,
      links: [{ label: 'Native source', href: nativeSource }],
    },
    {
      id: 'contribute',
      question: 'How do I contribute?',
      answer:
        'Work in the native Gradle project in this repository. Issues and pull requests go to the public GitHub project. Contribution is the same as the rest of Texuli: English, tests, honest status.',
      links: [{ label: 'Native source', href: nativeSource }],
    },
  ];
}

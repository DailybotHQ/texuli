import {
  EDITOR_AGENTS,
  EDITOR_NEXT,
  EDITOR_PLATFORMS,
  EDITOR_RECIPES,
} from '../../../components/solutions/editor/extras/extras-content.ts';
import { EDITOR_HERO } from '../../../components/solutions/editor/hero/hero-content.ts';
import { EDITOR_HOW } from '../../../components/solutions/editor/how/how-content.ts';
import { editorQuickstart } from '../../../components/solutions/editor/quickstart/samples.ts';
import { EDITOR_STORIES } from '../../../components/solutions/editor/stories/stories-content.ts';
import type {
  SolutionDemoFrameProps,
  SolutionLandingContent,
} from '../../../components/solutions/shared/types.ts';
import { getSolution } from '../../../data/solutions/index.ts';

export const EDITOR_ENTRY = getSolution('editor');

export const EDITOR_DEMO: Omit<SolutionDemoFrameProps, 'entry'> = {
  title: 'Write, paste and send',
  label: 'Rich text editor demo',
  tryThis: [
    'Pick “Support macro”, then open the text style menu and turn a step into a heading; undo puts it back.',
    'Press “Paste the HTML”: the safe link arrives, the javascript: link stays as text, the script is gone.',
    'Type :tada: or open the emoji button, then read the document as Markdown below.',
    'Export the note for Slack, Discord or Telegram and read what each format changes.',
  ],
};

const { entry: _entry, ...quickstart } = editorQuickstart(EDITOR_ENTRY);

export const EDITOR_LANDING: SolutionLandingContent = {
  hero: EDITOR_HERO,
  demo: EDITOR_DEMO,
  stories: EDITOR_STORIES,
  how: EDITOR_HOW,
  quickstart,
  recipes: EDITOR_RECIPES,
  agents: EDITOR_AGENTS,
  platforms: EDITOR_PLATFORMS,
  next: EDITOR_NEXT,
};

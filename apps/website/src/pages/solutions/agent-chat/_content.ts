import {
  AGENT_CHAT_AGENTS,
  AGENT_CHAT_NEXT,
  AGENT_CHAT_PLATFORMS,
  AGENT_CHAT_RECIPES,
} from '../../../components/solutions/agent-chat/extras/extras-content.ts';
import { AGENT_CHAT_HERO } from '../../../components/solutions/agent-chat/hero/hero-content.ts';
import { AGENT_CHAT_HOW } from '../../../components/solutions/agent-chat/how/how-content.ts';
import { agentChatQuickstart } from '../../../components/solutions/agent-chat/quickstart/samples.ts';
import { AGENT_CHAT_STORIES } from '../../../components/solutions/agent-chat/stories/stories-content.ts';
import type {
  SolutionDemoFrameProps,
  SolutionLandingContent,
} from '../../../components/solutions/shared/types.ts';
import { getSolution } from '../../../data/solutions/index.ts';

export const AGENT_CHAT_ENTRY = getSolution('agent-chat');

export const AGENT_CHAT_DEMO: Omit<SolutionDemoFrameProps, 'entry'> = {
  title: 'Ask the demo agent',
  label: 'Agent chat demo',
  tryThis: [
    'Run “Support triage” and press Stop before the reply ends: the text so far stays, marked as stopped.',
    'Run “Weekly report”, open the report preview, and read why the forecast attachment was refused.',
    'Type @ or / in the composer, choose with the arrow keys and press Enter.',
    'Copy the last reply as Slack, Discord, Teams or WhatsApp text.',
  ],
};

const { entry: _entry, ...quickstart } = agentChatQuickstart(AGENT_CHAT_ENTRY);

export const AGENT_CHAT_LANDING: SolutionLandingContent = {
  hero: AGENT_CHAT_HERO,
  demo: AGENT_CHAT_DEMO,
  stories: AGENT_CHAT_STORIES,
  how: AGENT_CHAT_HOW,
  quickstart,
  recipes: AGENT_CHAT_RECIPES,
  agents: AGENT_CHAT_AGENTS,
  platforms: AGENT_CHAT_PLATFORMS,
  next: AGENT_CHAT_NEXT,
};

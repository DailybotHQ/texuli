import { type DocBlock, docSource, parseDocMarkdown } from '../parse.ts';

export const AGENT_CHAT_DOC_FILES = [
  'install',
  'streaming',
  'markdown',
  'autocomplete',
  'attachments',
] as const;

export type AgentChatDocFile = (typeof AGENT_CHAT_DOC_FILES)[number];

export interface AgentChatDocSection {
  readonly id: AgentChatDocFile;
  readonly source: string;
  readonly blocks: readonly DocBlock[];
}

const FILES: Readonly<Record<string, string>> = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Load every Agent chat docs Markdown file, in reading order. */
export function loadAgentChatDocs(): readonly AgentChatDocSection[] {
  return AGENT_CHAT_DOC_FILES.map((id) => {
    const source = docSource(FILES, id);
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}

/**
 * `@texuli/data/activity` — day-grouped activity feed with avatars, reactions
 * and pagination. Feed math lives in the framework-free engine
 * (`../engines/activity`).
 */

export {
  type DayGroup,
  type DayGroupOptions,
  dayLabel,
  groupByDay,
  whenLabel,
} from '../engines/activity/days.ts';
export {
  type ActivitySegment,
  decodeMentions,
  encodeMentions,
  type MentionCandidate,
  type MentionLookups,
  mentionedIds,
  plainText,
  tokenize,
} from '../engines/activity/mentions.ts';
export {
  ACTIVITY_KINDS,
  type ActivityFilter,
  type ActivityItem,
  type ActivityKind,
  type AuditRowLike,
  auditToActivity,
  describeChange,
  type FieldChange,
  filterActivity,
  REDACTED,
  type SummaryOptions,
  sortActivity,
  summarizeChanges,
  valueText,
} from '../engines/activity/summary.ts';
export {
  type ActivityComment,
  buildThreads,
  type CommentInput,
  CommentInputSchema,
  type CommentThreadNode,
  toggleReaction,
} from '../engines/activity/threads.ts';
export { default as ActivityFeed } from './ActivityFeed.svelte';
export {
  DEFAULT_PAGE_SIZE,
  DEFAULT_REACTION_EMOJIS,
  kindVerb,
  pageItems,
  type ReactionChip,
  reactionChips,
} from './model.ts';
export type { ActivityFeedLabels } from './types.ts';

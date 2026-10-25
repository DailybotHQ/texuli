import type { ActivityKind } from '../engines/activity/summary.ts';

/** Translatable labels for the activity feed chrome and live region. */
export interface ActivityFeedLabels {
  feed: string;
  empty: string;
  loadMore: string;
  loading: string;
  loadError: string;
  retry: string;
  exhausted: string;
  reactions: string;
  react: (emoji: string) => string;
  kind: (kind: ActivityKind) => string;
  actorFallback: string;
  filterGroup: string;
  filterAll: string;
  announcement: (message: string) => string;
}

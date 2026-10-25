/** Host-facing slide change details for URL, history, or application state. */
export interface SlideNavigationIntent {
  index: number;
  slideId: string;
}

/** Host-facing position details, sent on every slide or reveal step change. */
export interface SlideStepIntent extends SlideNavigationIntent {
  /** The reveal step now shown (0 to `stepCount`). */
  step: number;
  /** The slide's last reveal step. */
  stepCount: number;
}

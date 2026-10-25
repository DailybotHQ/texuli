/** Every string the tags input announces or puts in an accessible name. Pass translations to override. */
export interface TagsInputLabels {
  /** Accessible name of a tag's remove button. */
  remove: (tag: string) => string;
  added: (tag: string) => string;
  removed: (tag: string) => string;
  duplicate: (tag: string) => string;
  max: (max: number) => string;
  invalid: (tag: string) => string;
}

export const DEFAULT_TAGS_INPUT_LABELS: Readonly<TagsInputLabels> = Object.freeze({
  remove: (tag: string) => `Remove ${tag}`,
  added: (tag: string) => `${tag} added`,
  removed: (tag: string) => `${tag} removed`,
  duplicate: (tag: string) => `${tag} is already added`,
  max: (max: number) => `You can add up to ${max} tags`,
  invalid: (tag: string) => `${tag} is not valid`,
});

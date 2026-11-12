import type { EditorIssueCode } from '@texuli/core/editor-model';
import type { EditorBlockKindChoice } from '@texuli/core/editor-transforms';

/** Every visible and announced string of the editor. Pass a partial object to translate. */
export interface EditorLabels {
  /** The textbox name when neither `label` nor `aria-labelledby` is given. */
  textbox: string;
  toolbar: string;
  strong: string;
  em: string;
  strike: string;
  code: string;
  paragraph: string;
  heading: (level: number) => string;
  bulletList: string;
  orderedList: string;
  todoList: string;
  quote: string;
  codeBlock: string;
  divider: string;
  link: string;
  undo: string;
  redo: string;
  /** Todo checkbox names. */
  done: string;
  notDone: string;
  /** The keyboard help the textbox is described by. `keys` lists each chord. */
  help: (keys: { bold: string; italic: string; link: string; undo: string }) => string;
  // Link dialog
  linkDialog: string;
  linkAddress: string;
  linkText: string;
  linkApply: string;
  linkRemove: string;
  linkCancel: string;
  /** Shown next to the field when the URL policy refuses the address. */
  linkRejected: string;
  /** Shown inside a media block the host could not resolve. */
  mediaFallback: (alt: string) => string;
  // Announcements
  markOn: (mark: string) => string;
  markOff: (mark: string) => string;
  level: (depth: number) => string;
  undone: string;
  redone: string;
  pasted: (blocks: number, linksRemoved: number) => string;
  refused: (code: EditorIssueCode) => string;
  // Block-type menu
  /** The block-type menu button's name; `current` is the kind at the caret. */
  blockMenu: (current: string) => string;
  // Paste as Markdown
  /** Announced when "Paste as Markdown" could not read the clipboard and waits for a paste. */
  pasteMarkdownNext: string;
  /** Announced when a paste was read as Markdown. */
  pastedMarkdown: (blocks: number, linksRemoved: number) => string;
  // Emoji
  /** The emoji button's name. */
  emoji: string;
  /** The emoji popover and picker. */
  emojiPicker: string;
  // Export to chat
  exportTitle: string;
  exportFormat: string;
  exportOutput: (format: string) => string;
  exportCopy: string;
  exportCopied: string;
  exportCopyFailed: string;
  /** The heading over the losses a format reports. */
  exportLosses: (count: number) => string;
  exportNoLosses: string;
}

export const DEFAULT_EDITOR_LABELS: EditorLabels = {
  textbox: 'Rich text',
  toolbar: 'Formatting',
  strong: 'Bold',
  em: 'Italic',
  strike: 'Strikethrough',
  code: 'Inline code',
  paragraph: 'Paragraph',
  heading: (level) => `Heading ${level}`,
  bulletList: 'Bulleted list',
  orderedList: 'Numbered list',
  todoList: 'Checklist',
  quote: 'Quote',
  codeBlock: 'Code block',
  divider: 'Divider',
  link: 'Link',
  undo: 'Undo',
  redo: 'Redo',
  done: 'Done',
  notDone: 'Not done',
  help: (keys) =>
    `${keys.bold} bold, ${keys.italic} italic, ${keys.link} link, ${keys.undo} undo. Tab indents list items. Press Escape, then Tab, to leave the editor.`,
  linkDialog: 'Edit link',
  linkAddress: 'Link address',
  linkText: 'Link text',
  linkApply: 'Apply',
  linkRemove: 'Remove link',
  linkCancel: 'Cancel',
  linkRejected: 'This address is not allowed. Use an https or mailto link.',
  mediaFallback: (alt) => (alt ? `Media: ${alt}` : 'Media'),
  markOn: (mark) => `${mark} on`,
  markOff: (mark) => `${mark} off`,
  level: (depth) => `Level ${depth}`,
  undone: 'Undone',
  redone: 'Redone',
  pasted: (blocks, linksRemoved) => {
    const pasted = `Pasted ${blocks} ${blocks === 1 ? 'block' : 'blocks'}`;
    return linksRemoved > 0
      ? `${pasted}; ${linksRemoved} ${linksRemoved === 1 ? 'link' : 'links'} removed`
      : pasted;
  },
  blockMenu: (current) => `Text style: ${current}`,
  pasteMarkdownNext: 'Paste now to insert the text as Markdown.',
  pastedMarkdown: (blocks, linksRemoved) => {
    const pasted = `Pasted ${blocks} ${blocks === 1 ? 'block' : 'blocks'} from Markdown`;
    return linksRemoved > 0
      ? `${pasted}; ${linksRemoved} ${linksRemoved === 1 ? 'link' : 'links'} removed`
      : pasted;
  },
  emoji: 'Emoji',
  emojiPicker: 'Insert emoji',
  exportTitle: 'Export for chat',
  exportFormat: 'Format',
  exportOutput: (format) => `${format} text`,
  exportCopy: 'Copy',
  exportCopied: 'Copied',
  exportCopyFailed: 'Copy failed: select the text and copy it.',
  exportLosses: (count) => `${count} ${count === 1 ? 'change' : 'changes'} in this format`,
  exportNoLosses: 'Nothing changes in this format.',
  refused: (code) => {
    switch (code) {
      case 'limit-reached':
        return 'The document is full.';
      case 'link-rejected':
        return 'That link is not allowed.';
      case 'not-allowed-here':
        return 'That is not available here.';
      default:
        return 'That edit was not applied.';
    }
  },
};

/** The visible name of a block-type menu choice. */
export function blockKindLabel(labels: EditorLabels, kind: EditorBlockKindChoice): string {
  switch (kind) {
    case 'paragraph':
      return labels.paragraph;
    case 'bullet':
      return labels.bulletList;
    case 'ordered':
      return labels.orderedList;
    case 'todo':
      return labels.todoList;
    case 'quote':
      return labels.quote;
    case 'code':
      return labels.codeBlock;
    default:
      return labels.heading(Number(kind.slice('heading-'.length)));
  }
}

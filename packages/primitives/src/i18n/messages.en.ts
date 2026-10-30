import type { MessageCatalog } from '@texuli/core/i18n';

/**
 * Every primitive label id with its English default (ADR-016): the
 * source a translation starts from. Components keep their English defaults
 * inline (so tree shaking works); a test keeps this catalog equal to them.
 * Function labels take their arguments as `{0}`, `{1}`…
 */
export const PRIMITIVES_MESSAGES_EN: MessageCatalog = /* @__PURE__ */ Object.freeze({
  locale: 'en',
  messages: /* @__PURE__ */ Object.freeze({
    'primitives.calendar.next-label': 'Next month',
    'primitives.calendar.previous-label': 'Previous month',
    'primitives.color-picker.label': 'Choose color',
    'primitives.combobox.chips.selected-options': 'Selected options',
    'primitives.combobox.error.failed-to-load-options': 'Failed to load options',
    'primitives.combobox.error.retry-label': 'Retry',
    'primitives.combobox.trigger.show-options': 'Show options',
    'primitives.command.label': 'Commands',
    'primitives.date-field.date-field.label': 'Date',
    'primitives.date-field.time-field.am-or-pm': 'AM or PM',
    'primitives.date-field.time-field.hour': 'Hour',
    'primitives.date-field.time-field.label': 'Time',
    'primitives.date-field.time-field.minute': 'Minute',
    'primitives.date-picker.dialog': 'Choose date',
    'primitives.date-picker.end': 'End date',
    'primitives.date-picker.next-month': 'Next month',
    'primitives.date-picker.previous-month': 'Previous month',
    'primitives.date-picker.start': 'Start date',
    'primitives.date-picker.too-long': 'Choose a range of {max} days or fewer.',
    'primitives.date-picker.trigger': 'Choose date',
    'primitives.date-picker.trigger-with-value': 'Choose date, selected date is {date}',
    'primitives.file-drop.browse-label': 'Choose files',
    'primitives.file-drop.label': 'Upload files',
    'primitives.number-field.decrement-label': 'Decrease',
    'primitives.number-field.increment-label': 'Increase',
    'primitives.pagination.label': 'Pagination',
    'primitives.pagination.next-button.label': 'Next page',
    'primitives.pagination.next-label': 'Next page',
    'primitives.pagination.page-label': 'Page {page}',
    'primitives.pagination.previous-button.label': 'Previous page',
    'primitives.pagination.previous-label': 'Previous page',
    'primitives.tags-input.added': '{0} added',
    'primitives.tags-input.duplicate': '{0} is already added',
    'primitives.tags-input.invalid': '{0} is not valid',
    'primitives.tags-input.max': 'You can add up to {0} tags',
    'primitives.tags-input.remove': 'Remove {0}',
    'primitives.tags-input.removed': '{0} removed',
    'primitives.toast.close.dismiss-notification': 'Dismiss notification',
    'primitives.toast.toaster.label': 'Notifications',
    'primitives.tree.load-error-label': 'Children could not be loaded',
    'primitives.tree.loading-label': 'Loading children',
  }),
});

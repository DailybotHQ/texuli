# TimeField

> A labelled time of day typed or stepped by segment (hour, minute, AM/PM), with a 24-hour HH:mm value.

- **id:** `time-field`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- A time of day on its own, such as a reminder or an opening hour

### Don't use when

- A date, or a date and time (use the date pickers)
- A duration (use a number field)

### Accessibility

- A labelled group of native number inputs (hour, minute) and an AM/PM select; arrows step the segments
- Description and error are linked to the group; an error marks it invalid

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | — | — | Visible label and accessible name |
| `description` | string | no | — | — | Help text under the field |
| `error` | string | no | — | — | Error text; also marks the field invalid |
| `value` | string | no | — | — | The time as HH:mm (24-hour), or null when empty (bind:value) |
| `onValueChange` | event | no | — | — | — |
| `locale` | string | no | — | `"en-US"` | — |
| `hourCycle` | number | no | — | — | 12 shows AM/PM, 24 does not; default the locale cycle |
| `minuteStep` | number | no | — | `1` | Minutes the arrow keys move on the minute segment |
| `disabled` | boolean | no | — | `false` | — |
| `required` | boolean | no | — | `false` | — |
| `name` | string | no | — | — | Form field name: submits the value |
| `size` | enum(sm | md) | no | — | `"md"` | — |
| `labels` | object | no | — | — | Segment names (hour, minute, dayPeriod) for translation |
| `class` | string | no | — | — | — |

### Examples

#### Reminder time (`reminder`)

```json
{
  "label": "Reminder",
  "value": "09:30",
  "minuteStep": 15,
  "name": "reminder"
}
```

### Related

- [`field`](field.md)
- [`input`](input.md)
- [`form`](form.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._

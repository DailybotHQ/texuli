# Document

> A block document (a brief, a report, notes or a page) as data: headings, paragraphs, lists, callouts, columns, content blocks and embedded components.

- **id:** `document`
- **package:** `@texuli/pages`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `documents`

### Use when

- Write a document people read, export (Markdown, DOCX, PDF) or keep editing
- Edit an existing document with a bounded patch (patchDocument) instead of rewriting it

### Don't use when

- An interface with controls, state or flows: use layout-page or layout-doc with catalog nodes
- A slide presentation: use layout-deck

### Accessibility

- Painted as an article named by the document title, with anchored headings and an outline
- Text is data, never HTML; links and media pass the URL policy at the host tier
- Embedded components are validated again as catalog nodes at the same tier

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `doc` | object | yes | — | — | A Texuli document: { format: "texuli-document", formatVersion: 1, meta: { title }, blocks }. Blocks: paragraph, heading, code, list, quote, divider, media, callout, toggle, columns, page-link, block ({ family, block, props }: a @texuli/blocks block) and embed ({ kind: "component", inline: { id, props } }: one catalog node). |
| `label` | string | no | untrusted | — | Accessible name; defaults to the document title. |
| `outline` | boolean | no | — | `true` | Show the "On this page" outline when the document has two or more headings. |

### Examples

#### Project brief (`brief`)

```json
{
  "doc": {
    "format": "texuli-document",
    "formatVersion": 1,
    "meta": {
      "title": "Project brief",
      "locale": "en"
    },
    "blocks": [
      {
        "id": "title",
        "type": "heading",
        "level": 1,
        "content": [
          {
            "type": "text",
            "text": "Project brief",
            "marks": []
          }
        ]
      },
      {
        "id": "intro",
        "type": "paragraph",
        "content": [
          {
            "type": "text",
            "text": "A fictional plan for the example.com launch.",
            "marks": []
          }
        ]
      },
      {
        "id": "risk",
        "type": "callout",
        "tone": "warning",
        "blocks": [
          {
            "id": "risk-text",
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "The beta ends on Friday.",
                "marks": []
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### Related

- [`layout-doc`](layout-doc.md)
- [`layout-page`](layout-page.md)
- [`blocks-text`](blocks-text.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._

/**
 * FIX-consumer-ids: every IDREF attribute in the document must point at an
 * element that exists. A closed popup's trigger (`aria-expanded="false"`)
 * may name content that is not rendered yet, so its `aria-controls` is
 * skipped.
 */
const REF_ATTRIBUTES = [
  'for',
  'aria-controls',
  'aria-labelledby',
  'aria-describedby',
  'aria-activedescendant',
  'aria-owns',
  'aria-errormessage',
  'aria-details',
] as const;

/** `tag[attr=id]` for every reference that resolves to nothing. */
export function brokenIdRefs(doc: Document = document): string[] {
  const broken: string[] = [];
  for (const element of doc.querySelectorAll('*')) {
    for (const attribute of REF_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      if (attribute === 'aria-controls' && element.getAttribute('aria-expanded') === 'false') {
        continue;
      }
      for (const id of value.split(/\s+/)) {
        if (id && !doc.getElementById(id)) {
          broken.push(`${element.tagName.toLowerCase()}[${attribute}=${id}]`);
        }
      }
    }
  }
  return broken;
}

# Core URL policy

`@texuli/core` exports framework-free URL policies for links, images and
media. Pass `developer` only for values authored by the consuming application;
content from users, agents or snapshots uses the default `untrusted` tier.
Every policy fails closed with `undefined`.

The tier is resolved the same way at every entry point (`safeHref`,
`safeImageSrc`, `safeImageSrcset`, `safeMediaSrc`) by `resolveTrust(value)`:
only the exact string `developer` is the developer tier. Any other value
(`Developer`, `admin`, an empty string, `null`, a value read from config) is
judged as `untrusted`. Before this rule, `safeHref` gave such a value the
developer policy, and the image and media policies refused every URL for
it; now all four apply the untrusted policy.

## Links

`safeHref(value, trust?)` keeps the existing link contract:

- Both tiers reject executable or content-smuggling schemes (`javascript:`,
  `vbscript:` and `data:`), protocol-relative URLs and backslash-prefixed URLs.
  A value whose first two characters are any mix of `/` and `\` (`//host`,
  `/\host`, `\/host`, `\\host`) counts as protocol-relative, because browsers
  read `\` as `/` and `/\evil.example` opens `https://evil.example/`; the
  check runs after the trim and control-character strip, so `/\t\host` is
  caught too.
- Untrusted links allow HTTPS, `mailto:` and same-document fragments.
- Developer links may use other non-blocked schemes and relative URLs.
- ASCII controls are removed before scheme inspection so split executable
  schemes cannot pass.
- Untrusted links are stricter still: no invisible formatting characters
  anywhere (bidi overrides and isolates, zero-width characters, the soft
  hyphen, a BOM inside the value), no credentials before the host, and an
  `https:` link must use the authority form (`https://`) and name a host.

## Images

`safeImageSrc(value, trust?)` validates one image source:

- Both tiers accept HTTPS URLs and relative asset paths; HTTP is developer
  only. Protocol-relative URLs, credentials, whitespace inside a URL, control
  characters, quotes, angle brackets, backticks and backslashes are rejected.
- An untrusted relative path may not contain invisible formatting
  characters, or a colon before its first `/` or `?` (it would read as a
  scheme).
- Valid blob URLs are developer only.
- Data URLs are developer only and must be base64 PNG, JPEG, GIF, WebP or AVIF.
  The decoded payload cannot exceed `MAX_DATA_IMAGE_BYTES` (1 MiB). SVG and
  other data MIME types are rejected.
- Other schemes, fragments, malformed URLs and inputs over the URL length cap
  are rejected.

`safeImageSrcset(value, trust?)` validates a comma-separated image candidate
list. Each candidate has one URL and optionally a positive density descriptor
(`1.5x`) or positive integer width descriptor (`640w`). One set cannot mix
density and width descriptors; a candidate without a descriptor is treated
as density mode. Commas inside URLs and data URLs are unsupported. Any empty,
malformed or unsafe candidate rejects the complete `srcset`.

## Untrusted-tier decisions (catalog security review)

The hostile corpus (`@texuli/catalog`, `render/hostile`) found four values
the untrusted tier accepted. Each was tightened for `untrusted` only. The
`developer` tier is unchanged: app-authored values are trusted by contract,
and its examples and goldens stay as they were.

| Gap | Decision | Why |
| --- | --- | --- |
| Credentials before the host (`https://bank.example@evil.example/`) | Tightened: refused | The link shows a trusted name but opens another origin, a phishing pattern. The image and media policies already refused credentials, so links now match them. |
| Bidi and invisible characters in a host or path | Tightened: refused anywhere, fragments included | A right-to-left override or a zero-width character makes the shown URL differ from where the link goes. Agent output has no legitimate use for them in a URL. |
| `https:evil.example` (no `//`) | Tightened: `https://` and a non-empty host required | Browsers resolve it to a host, but it slips past readers and simple filters that look for `https://`. The authority form is the only one an agent needs. |
| Zero-width or look-alike relative image paths (`java` + zero-width space + `script:…`, fullwidth letters) | Tightened: refused | They were never executable: an image source never runs script, and the browser loads them as same-origin relative paths. Refusing them costs nothing and keeps the image policy as strict as the link policy. |

Rendered output is policed twice: `validateDraft` reports a refused URL as a
`sink` diagnostic at the host's tier, and the player passes every URL-bearing
prop through the untrusted policy again at paint, whatever tier validated it.

## Audio and video

`safeMediaSrc(value, trust?, options?)` validates audio or video sources:

- Developer media may use HTTP(S), relative assets and valid blob URLs.
- Untrusted media may use valid blob URLs or HTTPS URLs whose exact origin is
  listed in `options.allowedOrigins`. An origin entry must be a canonical
  HTTPS origin such as `https://media.example.test`, with no path, credentials
  or trailing slash. Invalid entries are ignored.
- Data URLs and all other schemes are rejected in both tiers.

Example:

```ts
import { safeImageSrc, safeImageSrcset, safeMediaSrc } from '@texuli/core';

const image = safeImageSrc('./avatars/person.webp');
const imageSet = safeImageSrcset('/small.webp 1x, /large.webp 2x');
const video = safeMediaSrc('https://media.example.test/demo.mp4', 'untrusted', {
  allowedOrigins: ['https://media.example.test'],
});
```

Render a link or media element only when the corresponding function returns a
string. Do not use `safeHref` as a substitute for an element-specific image or
media policy.

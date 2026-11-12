# Emoji generator source lock

The generator reads only these committed sources from `sources/`. Its lock is `sources/sources.lock.json`; every input is checked against SHA-256 before parsing. This lock was copied from the PLAN_023 audit and extended with the exact legacy JSON digest. Run the Unicode/CLDR upgrade as a reviewed change; normal generation never accesses the network.

Unicode and CLDR notices are retained in the source-file headers and `sources/NOTICE.md`. The legacy catalog's MIT license is at `sources/legacy/LICENSE`.

**Escaped invisible characters.** The repository's Trojan Source gate forbids literal zero-width,
variation-selector, tag and bidi characters in tracked text. The committed copies therefore spell those
code points as `\u{XXXX}` escapes. The generator decodes every escape before hashing, so each SHA-256 in
the lock is the digest of the exact upstream file. To verify a copy by hand, decode the escapes first
(for example with the generator's `read` function) and hash the result; `sha256sum` on the committed
file will not match the URL.

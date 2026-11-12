# Emoji generator source lock

The generator reads only these committed sources from `sources/`. Its lock is `sources/sources.lock.json`; every input is checked against SHA-256 before parsing. This lock was copied from the PLAN_023 audit and extended with the exact legacy JSON digest. Run the Unicode/CLDR upgrade as a reviewed change; normal generation never accesses the network.

Unicode and CLDR notices are retained in the source-file headers and `sources/NOTICE.md`. The legacy catalog's MIT license is at `sources/legacy/LICENSE`.

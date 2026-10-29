# Core ZIP writer

`@texuli/core/zip` writes ZIP archives for export packages (ADR-016): DOCX
today, PPTX when `@texuli/slides` moves onto it. Output is deterministic:
entries keep their order, names are UTF-8, and every timestamp is
1980-01-01, so the same input always gives the same bytes. ZIP64 is not
supported (at most 65,535 entries and 4 GiB).

```ts
import { writeZip, writeZipAsync } from '@texuli/core/zip';

const stored = writeZip([{ path: 'hello.txt', data: 'Hello' }]);
const packed = await writeZipAsync([
  { path: 'word/document.xml', data: xml },
  { path: 'word/media/image1.png', data: png, compress: false },
]);
```

- `writeZip(entries)`: a stored (uncompressed) archive, synchronously;
  byte-identical to the `@texuli/slides` writer.
- `writeZipAsync(entries, options)`: deflates each entry through the
  platform `CompressionStream('deflate-raw')` and keeps it only when it is
  smaller; an entry with `compress: false` stays stored. Without
  compression streams (or with `ZipOptions` `compress: false`) it falls
  back to the stored archive.
- A `ZipEntry` is a `path` and `data` (bytes, or a string written as
  UTF-8). `assertZipPath(path)` refuses empty, absolute, backslashed,
  dot-segment and control-character paths, so no entry can traverse on
  extract; duplicates throw too.
- `crc32(bytes)`: the IEEE CRC-32 (ZIP and PNG).
- `compressBytes(bytes, format)`: one `CompressionFormatName` (`deflate`,
  the zlib wrapper PDF's `FlateDecode` reads, or `deflate-raw`), or `null`
  without compression streams; `canCompress(format)` tells which.

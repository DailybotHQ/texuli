import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSvg } from './art-svg.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = resolve(ROOT, 'artwork/emojis');
const PACK = resolve(ROOT, 'packages/emoji-assets');

interface Provenance {
  id: string;
  source: string;
  sha256: string;
  status: string;
}
interface Asset {
  id: string;
  path: string;
  sha256: string;
  status: string;
}

function main(): void {
  const provenance = JSON.parse(readFileSync(resolve(SOURCE, 'provenance.json'), 'utf8')) as {
    records: Provenance[];
  };
  const manifestModule = readFileSync(resolve(PACK, 'src/manifest.ts'), 'utf8');
  const match = /const manifestJson = `([\s\S]*?)`;\nexport const emojiAssetManifest/.exec(
    manifestModule
  );
  if (!match?.[1]) throw new Error('generated asset manifest is missing or malformed');
  const assets = JSON.parse(match[1]) as Asset[];
  const sources = new Map(provenance.records.map((item) => [item.id, item]));
  const byId = new Map(assets.map((item) => [item.id, item]));
  if (sources.size !== provenance.records.length || byId.size !== assets.length)
    throw new Error('duplicate source or manifest IDs');
  if (sources.size !== byId.size)
    throw new Error(`manifest has ${byId.size} entries; provenance has ${sources.size}`);
  const files = readdirSync(resolve(PACK, 'assets/svg'))
    .filter((file) => file.endsWith('.svg'))
    .sort();
  if (files.length !== assets.length)
    throw new Error(`manifest has ${assets.length} entries; package contains ${files.length} SVGs`);
  let totalBytes = 0;
  for (const row of assets) {
    const source = sources.get(row.id);
    if (!source) throw new Error(`manifest id has no provenance: ${row.id}`);
    if (row.status !== source.status) throw new Error(`status mismatch for ${row.id}`);
    const filename = `${row.id}.svg`;
    if (row.path !== `./assets/svg/${filename}` || !files.includes(filename))
      throw new Error(`manifest path missing or unexpected for ${row.id}`);
    const svg = readFileSync(resolve(PACK, row.path.slice(2)), 'utf8');
    if (createHash('sha256').update(svg).digest('hex') !== row.sha256)
      throw new Error(`package checksum mismatch for ${row.id}`);
    const info = validateSvg(svg);
    totalBytes += info.bytes;
  }
  for (const row of provenance.records) {
    const sourceSvg = readFileSync(resolve(SOURCE, row.source), 'utf8');
    if (createHash('sha256').update(sourceSvg).digest('hex') !== row.sha256)
      throw new Error(`source checksum mismatch for ${row.id}`);
    validateSvg(sourceSvg);
  }
  console.log(
    `validated ${assets.length} packaged SVGs and ${provenance.records.length} originals (${totalBytes} packaged bytes)`
  );
}

main();

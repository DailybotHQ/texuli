import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT = resolve(ROOT, 'packages/emoji-assets/data/art-coverage.json');
const COVERAGE_SOURCE = resolve(ROOT, 'packages/emoji-assets/src/data/art-coverage.json');
const CATALOG = resolve(ROOT, 'packages/emojis/src/data/catalog.json');
const MANIFEST = resolve(ROOT, 'packages/emoji-assets/src/manifest.ts');

function report(): object {
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8')) as { records: { id: string }[] };
  const source = readFileSync(MANIFEST, 'utf8');
  const manifestMatch = /const manifestJson = `([\s\S]*?)`;\nexport const emojiAssetManifest/.exec(
    source
  );
  if (!manifestMatch?.[1]) throw new Error('generated asset manifest is missing or malformed');
  const assets = JSON.parse(manifestMatch[1]) as { id: string; status: string }[];
  const unicodeIds = new Set(catalog.records.map((record) => record.id));
  const knownIds = new Set(assets.map((asset) => asset.id));
  for (const id of knownIds)
    if (!unicodeIds.has(id)) throw new Error(`art id is absent from Unicode catalog: ${id}`);
  const files = readdirSync(resolve(ROOT, 'packages/emoji-assets/assets/svg')).filter((file) =>
    file.endsWith('.svg')
  );
  const approvedArtCount = assets.filter((asset) => asset.status === 'approved').length;
  const reviewedCandidateCount = assets.filter(
    (asset) => asset.status === 'reviewed-candidate'
  ).length;
  const fullyQualifiedCount = catalog.records.length;
  const missingArtCount = Math.max(0, fullyQualifiedCount - approvedArtCount);
  return {
    schemaVersion: 'texuli-emoji-art-coverage/v1',
    unicodeEmojiVersion: '18.0',
    catalogSequenceCount: fullyQualifiedCount,
    unicodeSupportedCount: fullyQualifiedCount,
    fullyQualifiedCount,
    requiredArtCount: fullyQualifiedCount,
    compositeArtCount: 0,
    approvedArtCount,
    reviewedCandidateCount,
    missingArtCount,
    sourceDesignCount: readdirSync(resolve(ROOT, 'artwork/emojis/originals')).filter((file) =>
      file.endsWith('.svg')
    ).length,
    packagedSvgCount: files.length,
    missingCoveragePercent:
      Math.round((missingArtCount / Math.max(1, fullyQualifiedCount)) * 10000) / 100,
    approvalNote:
      'All seed designs are reviewed candidates. Approved count remains zero until the owner signs off the proposed CC BY 4.0 art license and independent art review.',
  };
}

const measured = report();
const expected = `${JSON.stringify(measured, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const actual = readFileSync(REPORT, 'utf8');
  if (actual !== expected)
    throw new Error('art coverage report is stale; run scripts/emojis/coverage-report.ts');
  const sourceActual = readFileSync(COVERAGE_SOURCE, 'utf8');
  if (sourceActual !== expected)
    throw new Error('coverage source is stale; run scripts/emojis/coverage-report.ts');
  console.log('checked art coverage report');
} else {
  mkdirSync(dirname(COVERAGE_SOURCE), { recursive: true });
  writeFileSync(REPORT, expected);
  writeFileSync(COVERAGE_SOURCE, expected);
  console.log('wrote measured art coverage report');
}

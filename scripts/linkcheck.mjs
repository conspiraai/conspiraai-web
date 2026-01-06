import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = process.cwd();
const htmlFiles = [
  'index.html',
  'weekly.html',
  'lunar-cycle.html',
  'lunar-3d.html',
  'signals.html'
].filter((file) => existsSync(resolve(root, file)));

const assetPatterns = [
  /<script[^>]+src=(["'])([^"']+)\1/gi,
  /<img[^>]+src=(["'])([^"']+)\1/gi,
  /<link[^>]+href=(["'])([^"']+)\1/gi
];

const isExternal = (value) =>
  /^(https?:)?\/\//i.test(value) ||
  value.startsWith('mailto:') ||
  value.startsWith('data:') ||
  value.startsWith('#');

const normalizeAsset = (value) => {
  const trimmed = value.split('#')[0].split('?')[0].trim();
  if (!trimmed) return null;
  return trimmed;
};

const missingAssets = [];

for (const file of htmlFiles) {
  const filePath = resolve(root, file);
  const html = await readFile(filePath, 'utf8');
  const baseDir = dirname(filePath);

  for (const pattern of assetPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const asset = normalizeAsset(match[2]);
      if (!asset || isExternal(asset)) {
        continue;
      }
      const resolved = asset.startsWith('/')
        ? resolve(root, asset.slice(1))
        : resolve(baseDir, asset);
      const exists = existsSync(resolved);
      if (!exists) {
        missingAssets.push(`${file}: ${asset}`);
      } else {
        try {
          await stat(resolved);
        } catch {
          missingAssets.push(`${file}: ${asset}`);
        }
      }
    }
  }
}

if (missingAssets.length) {
  const unique = [...new Set(missingAssets)];
  console.error('Missing referenced assets:\n', unique.map((asset) => `- ${asset}`).join('\n'));
  process.exit(1);
} else {
  console.log(`Linkcheck passed for ${htmlFiles.length} page(s).`);
}

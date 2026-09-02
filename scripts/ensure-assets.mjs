// Fetches the lakes dataset and icons from the v2.5 repo when they are missing locally
// (used by manual Vercel deploys that ship source without binary assets).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const RAW = 'https://raw.githubusercontent.com/Supaman45/wa-crappie-lakes/main/';
async function get(path) { const r = await fetch(RAW + path); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r; }
if (!existsSync('src/data/lakes.json')) {
  const html = await (await get('index.html')).text();
  const line = html.split('\n').find(l => l.startsWith('const LAKES'));
  if (!line) throw new Error('LAKES array not found');
  const json = line.replace(/^const LAKES\s*=\s*/, '').replace(/;\s*$/, '');
  const arr = JSON.parse(json);
  if (!Array.isArray(arr) || arr.length < 100) throw new Error('unexpected lakes data');
  mkdirSync('src/data', { recursive: true });
  writeFileSync('src/data/lakes.json', JSON.stringify(arr));
  console.log(`lakes.json restored (${arr.length} lakes)`);
}
mkdirSync('public', { recursive: true });
for (const f of ['icon-192.png', 'icon-512.png']) {
  if (existsSync('public/' + f)) continue;
  const buf = Buffer.from(await (await get(f)).arrayBuffer());
  writeFileSync('public/' + f, buf);
  console.log(`${f} restored (${buf.length} bytes)`);
}

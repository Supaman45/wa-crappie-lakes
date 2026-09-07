// Fetches the app icons from the v2.5 repo when they are missing locally
// (used by manual Vercel deploys that ship source without binary assets).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const RAW = 'https://raw.githubusercontent.com/Supaman45/wa-crappie-lakes/main/';
async function get(path) { const r = await fetch(RAW + path); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r; }
if (!existsSync('src/data/lakes.json')) throw new Error('src/data/lakes.json is missing. It is part of the repo (WDFW lowland and high lakes); restore it from git.');
mkdirSync('public', { recursive: true });
for (const f of ['icon-192.png', 'icon-512.png']) {
  if (existsSync('public/' + f)) continue;
  const buf = Buffer.from(await (await get(f)).arrayBuffer());
  writeFileSync('public/' + f, buf);
  console.log(`${f} restored (${buf.length} bytes)`);
}

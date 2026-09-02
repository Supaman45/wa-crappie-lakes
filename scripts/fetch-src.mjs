// One-time bootstrap for manual Vercel deploys: pulls the source tree from a staging table
// in the app's own Supabase project when src/ is absent. A normal git checkout already has
// src/ and this script exits at once. Uses the same public key as src/lib/supabase.ts.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
if (existsSync('src/App.tsx')) { console.log('src present, skipping fetch'); process.exit(0); }
const URL = 'https://ptdsxxttsyfczoacyyqg.supabase.co/rest/v1/deploy_files?select=path,content&order=path';
const KEY = 'sb_publishable_BrWe4LtnNnAI1_v_evwP3w_aBUIOmEz';
const r = await fetch(URL, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
if (!r.ok) throw new Error('fetch source ' + r.status);
const rows = await r.json();
if (!Array.isArray(rows) || rows.length < 40) throw new Error('unexpected file count ' + rows.length);
for (const f of rows) { mkdirSync(dirname(f.path), { recursive: true }); writeFileSync(f.path, f.content); }
console.log(`restored ${rows.length} files`);

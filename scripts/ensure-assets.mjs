// Pre-build sanity check: fail fast with a clear message when a required
// asset is missing, instead of a confusing Vite or TypeScript error later.
import { existsSync } from 'node:fs';
const required = ['src/data/lakes.json', 'public/icon-192.png', 'public/icon-512.png', 'public/apple-touch-icon.png', 'public/push-sw.js'];
const missing = required.filter(f => !existsSync(f));
if (missing.length) throw new Error(`Missing required files: ${missing.join(', ')}. Restore them from git.`);

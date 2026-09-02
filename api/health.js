import { json } from './_util.js';
export default function handler(req, res) { json(res, { ok: true, at: new Date().toISOString(), node: process.version }, 0); }

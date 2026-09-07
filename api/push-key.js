import { json } from './_util.js';
import { pushReady, missingEnv } from './_push.js';

/** Public VAPID key for the browser, plus whether the server side is set up at all. */
export default function handler(req, res) {
  json(res, { key: process.env.VAPID_PUBLIC_KEY || null, ready: pushReady(), missing: missingEnv() }, 0);
}

export const R_EARTH_MI = 3958.8;

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const t = Math.PI / 180;
  const dLat = (lat2 - lat1) * t, dLng = (lng2 - lng1) * t;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(dLng / 2) ** 2;
  return R_EARTH_MI * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function acreFmt(n: number | null | undefined): string {
  if (n == null) return 'n/a';
  return n >= 1000 ? Math.round(n).toLocaleString() : n.toFixed(n < 10 ? 1 : 0);
}

export function todayStr(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  const p = s.slice(0, 10).split('-');
  if (p.length < 3) return s;
  return `${p[1]}/${p[2]}/${p[0].slice(2)}`;
}

export function pad2(n: number): string { return (n < 10 ? '0' : '') + n; }

export function fmtClock(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${pad2(m)} ${ap}`;
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0; const v = c === 'x' ? r : (r & 0x3) | 0x8; return v.toString(16);
  });
}

export function dirUrl(lat: number, lng: number): string { return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`; }
export function mapUrl(lat: number, lng: number): string { return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`; }
export function wdfwLakeUrl(slug: string): string { return `https://wdfw.wa.gov/fishing/locations/lowland-lakes/${slug}`; }

export function scoreColor(s: number): string { return s >= 70 ? '#4fb477' : s >= 50 ? '#eaa24c' : '#7a8a99'; }

export function lsGet(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
export function lsSet(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

export function isOnline(): boolean { return typeof navigator === 'undefined' ? true : navigator.onLine !== false; }

/** Resize an image file in the browser before upload. */
export function downscale(file: File | Blob, max = 1500, q = 0.82): Promise<Blob> {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w >= h) { if (w > max) { h = Math.round(h * max / w); w = max; } }
      else if (h > max) { w = Math.round(w * max / h); h = max; }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d'); if (!ctx) { rej(new Error('canvas')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      cv.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
}

export function debounce<T extends (...a: any[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | undefined;
  return ((...a: any[]) => { if (t) clearTimeout(t); t = setTimeout(() => fn(...a), ms); }) as T;
}

export function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }

export function cToF(c: number): number { return c * 9 / 5 + 32; }

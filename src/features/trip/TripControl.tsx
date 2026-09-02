import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import { useData, currentUserId } from '@/store/data';
import { LAKES } from '@/data/lakes';
import { haversine, lsGet, lsSet } from '@/lib/util';
import { toast } from '@/lib/toast';
import type { TrackPoint, Trip } from '@/lib/types';

const LS_LIVE = 'wff-trip-live';
const MIN_MOVE_MI = 8 / 1609.344;     // 8 m
const LAKE_RADIUS_MI = 0.6;
const SPOT_RADIUS_MI = 0.3;
const MAX_TRACK = 400;

interface LiveTrip { start: number; track: TrackPoint[]; }

function lsRemove(k: string): void { try { localStorage.removeItem(k); } catch { /* ignore */ } }

function loadLive(): LiveTrip | null {
  try {
    const raw = lsGet(LS_LIVE); if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LiveTrip>;
    if (typeof v.start !== 'number' || !Array.isArray(v.track)) return null;
    return { start: v.start, track: v.track.filter(p => p && typeof p.lat === 'number' && typeof p.lng === 'number') };
  } catch { return null; }
}

/** Evenly spaced subset of at most max points, keeping the first and last. */
function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr.slice();
  const out: T[] = [];
  const step = (arr.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(arr[Math.round(i * step)]);
  return out;
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = (h ? String(m).padStart(2, '0') : String(m)) + ':' + String(sec).padStart(2, '0');
  return h ? `${h}:${mm}` : mm;
}

export function TripControl() {
  const saveTrip = useData(s => s.saveTrip);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dist, setDist] = useState(0);
  const [nPts, setNPts] = useState(0);

  const startRef = useRef(0);
  const ptsRef = useRef<TrackPoint[]>([]);
  const distRef = useRef(0);
  const watchRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockRef = useRef<WakeLockSentinel | null>(null);
  const savingRef = useRef(false);
  const runningRef = useRef(false);
  const gpsWarned = useRef(false);

  const persist = useCallback(() => {
    lsSet(LS_LIVE, JSON.stringify({ start: startRef.current, track: ptsRef.current } satisfies LiveTrip));
  }, []);

  const requestLock = useCallback(async () => {
    try {
      const wl = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock;
      if (!wl || lockRef.current) return;
      lockRef.current = await wl.request('screen');
      lockRef.current.addEventListener('release', () => { lockRef.current = null; });
    } catch { /* wake lock is a nicety */ }
  }, []);
  const releaseLock = useCallback(() => {
    const l = lockRef.current; lockRef.current = null;
    if (l) l.release().catch(() => {});
  }, []);

  const stopSensors = useCallback(() => {
    if (watchRef.current != null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    releaseLock();
  }, [releaseLock]);

  const startSensors = useCallback(() => {
    if (!('geolocation' in navigator)) { toast('Location is not available here', 'warn'); return false; }
    runningRef.current = true;
    setElapsed(Date.now() - startRef.current);
    timerRef.current = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    watchRef.current = navigator.geolocation.watchPosition(p => {
      const pt: TrackPoint = { t: Date.now(), lat: p.coords.latitude, lng: p.coords.longitude };
      const pts = ptsRef.current;
      const last = pts[pts.length - 1];
      if (last) {
        const d = haversine(last.lat, last.lng, pt.lat, pt.lng);
        if (d <= MIN_MOVE_MI) return;
        distRef.current += d;
      }
      pts.push(pt);
      setDist(distRef.current); setNPts(pts.length);
      if (pts.length % 10 === 0) persist();
    }, err => {
      if (err.code === err.PERMISSION_DENIED) { toast('Location permission denied. The trip will record time only.', 'warn'); return; }
      if (!gpsWarned.current) { gpsWarned.current = true; toast('Waiting for GPS'); }
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    requestLock();
    return true;
  }, [persist, requestLock]);

  // Restore a trip that was running before a reload.
  useEffect(() => {
    const live = loadLive();
    if (live) {
      startRef.current = live.start;
      ptsRef.current = live.track;
      let d = 0; for (let i = 1; i < live.track.length; i++) d += haversine(live.track[i - 1].lat, live.track[i - 1].lng, live.track[i].lat, live.track[i].lng);
      distRef.current = d; setDist(d); setNPts(live.track.length);
      setRunning(true);
      startSensors();
    }
    return () => { runningRef.current = false; stopSensors(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The screen wake lock drops whenever the page is hidden; take it again on return.
  useEffect(() => {
    if (!running) return;
    const onVis = () => { if (document.visibilityState === 'visible') requestLock(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [running, requestLock]);

  const start = () => {
    if (runningRef.current) return;
    startRef.current = Date.now();
    ptsRef.current = [];
    distRef.current = 0; setDist(0); setNPts(0);
    gpsWarned.current = false;
    if (!startSensors()) return;
    persist();
    setRunning(true);
    toast('Trip started');
  };

  const end = async () => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    runningRef.current = false;
    stopSensors();
    const startAt = startRef.current;
    const endAt = Date.now();
    const pts = ptsRef.current;
    try {
      const duration_min = Math.max(0, Math.round((endAt - startAt) / 60000));
      if (pts.length < 2) {
        toast(`Trip ended, ${duration_min} min, no track recorded`, 'warn');
        return;
      }
      const track = downsample(pts, MAX_TRACK).map(p => ({ t: p.t, lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5) }));
      const lakes: string[] = [];
      for (const l of LAKES) if (track.some(p => haversine(p.lat, p.lng, l.lat, l.lng) < LAKE_RADIUS_MI)) lakes.push(l.slug);
      for (const s of useData.getState().spots) if (track.some(p => haversine(p.lat, p.lng, s.lat, s.lng) < SPOT_RADIUS_MI)) lakes.push(s.id);
      const me = currentUserId();
      const sIso = new Date(startAt).toISOString(), eIso = new Date(endAt).toISOString();
      const catch_ids = useData.getState().catches.filter(c => c.user_id === me && c.created_at >= sIso && c.created_at <= eIso).map(c => c.id);
      const trip: Partial<Trip> = {
        started_at: sIso, ended_at: eIso, duration_min,
        distance_mi: +distRef.current.toFixed(1),
        track, lakes, catch_ids, note: null,
      };
      await saveTrip(trip);
      toast(`Trip saved, ${duration_min} min, ${distRef.current.toFixed(1)} mi`);
    } catch (e) {
      toast(String((e as Error)?.message || e || 'Trip did not save'), 'err');
    } finally {
      lsRemove(LS_LIVE);
      ptsRef.current = []; distRef.current = 0;
      savingRef.current = false; setSaving(false);
      setRunning(false); setElapsed(0); setDist(0); setNPts(0);
    }
  };

  return (
    <div className="mapfab br" style={{ bottom: 'calc(90px + var(--safe-b))' }}>
      {running ? (
        <div className="hud" style={{ position: 'static', transform: 'none', alignItems: 'center', gap: 10, padding: '5px 6px 5px 14px' }} aria-live="polite">
          <span><b>{fmtElapsed(elapsed)}</b></span>
          <span>{dist.toFixed(1)} mi</span>
          {nPts === 0 && <span className="c-low">no fix</span>}
          <button type="button" className="btn sm danger" onClick={end} disabled={saving}>{saving ? <span className="spinner" /> : null}End trip</button>
        </div>
      ) : (
        <button type="button" className="btn" onClick={start}><Icon name="trip" />Start trip</button>
      )}
    </div>
  );
}

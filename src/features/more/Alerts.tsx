import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/ui';
import { isStandalone } from '@/features/more/Install';

/**
 * Coast alerts: web push to this device. A daily server job watches beach driving dates, coast
 * emergency rules, razor clam digs, and Ocean Shores notices, and pushes when something is new.
 */
type Support = 'yes' | 'ios-needs-install' | 'no';

function support(): Support {
  if (typeof window === 'undefined') return 'no';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const has = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (has) return 'yes';
  if (ios && !isStandalone()) return 'ios-needs-install';
  return 'no';
}

function b64ToBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Device';
  const br = /CriOS|Chrome/.test(ua) && !/Edg/.test(ua) ? 'Chrome' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Edg/.test(ua) ? 'Edge' : /Safari/.test(ua) ? 'Safari' : 'browser';
  return `${os} ${br}${isStandalone() ? ' (installed)' : ''}`;
}

interface ServerInfo { key: string | null; ready: boolean; missing: string[] }

export function AlertsSection() {
  const userId = useAuth(s => s.userId);
  const session = useAuth(s => s.session);
  const [sup] = useState<Support>(support);
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [subbed, setSubbed] = useState<boolean | null>(null);
  const [perm, setPerm] = useState<NotificationPermission>(() => (typeof Notification !== 'undefined' ? Notification.permission : 'default'));
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<{ id: string; label: string | null; created_at: string; last_ok: string | null }[]>([]);

  useEffect(() => {
    fetch('/api/push-key').then(r => r.json()).then(setServer).catch(() => setServer({ key: null, ready: false, missing: ['server'] }));
  }, []);

  useEffect(() => {
    if (sup !== 'yes') { setSubbed(false); return; }
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(s => setSubbed(!!s)).catch(() => setSubbed(false));
  }, [sup]);

  const loadDevices = async () => {
    if (!userId) return;
    const { data } = await sb.from('push_subscriptions').select('id,label,created_at,last_ok').eq('user_id', userId).order('created_at');
    setDevices(data || []);
  };
  useEffect(() => { loadDevices(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const turnOn = async () => {
    if (!server?.key) { toast('Push is not set up on the server yet.'); return; }
    if (!userId) { toast('Sign in first so alerts follow your account.'); return; }
    setBusy(true);
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p !== 'granted') { toast('Notifications are blocked for this site. Allow them in your browser settings.'); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(server.key) as BufferSource });
      const j = sub.toJSON();
      const { error } = await sb.from('push_subscriptions').upsert({ user_id: userId, endpoint: sub.endpoint, p256dh: j.keys?.p256dh || '', auth: j.keys?.auth || '', topics: ['coast'], label: deviceLabel() }, { onConflict: 'endpoint' });
      if (error) throw error;
      setSubbed(true);
      toast('Coast alerts are on for this device.');
      await loadDevices();
    } catch (e) {
      toast('Could not turn on alerts: ' + String((e as Error)?.message || e));
    } finally { setBusy(false); }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setSubbed(false);
      toast('Alerts are off on this device.');
      await loadDevices();
    } catch (e) {
      toast('Could not turn off alerts: ' + String((e as Error)?.message || e));
    } finally { setBusy(false); }
  };

  const test = async () => {
    if (!session?.access_token) { toast('Sign in first.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/push-test', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      toast(`Test sent to ${j.devices} device${j.devices === 1 ? '' : 's'}${j.gone ? `, ${j.gone} stale removed` : ''}.`);
      await loadDevices();
    } catch (e) {
      toast('Test failed: ' + String((e as Error)?.message || e));
    } finally { setBusy(false); }
  };

  const removeDevice = async (id: string) => {
    await sb.from('push_subscriptions').delete().eq('id', id);
    await loadDevices();
  };

  return (
    <div className="section" style={{ marginBottom: 12 }}>
      <h3>Coast alerts <small>push to this device</small></h3>
      <div className="note" style={{ lineHeight: 1.6, paddingBottom: 8 }}>
        Once a day the app checks beach driving dates, emergency rules for Marine Area 2 and Grays Harbor, razor clam digs, and Ocean Shores notices. When something is new you get a notification, even with the app closed.
      </div>

      {server && !server.ready && (
        <div className="note" style={{ color: 'var(--amber)', paddingBottom: 8 }}>
          Server side is not finished: missing {server.missing.join(', ')} in the Vercel project settings. Alerts turn on here once those are set.
        </div>
      )}

      {sup === 'ios-needs-install' && (
        <div className="note" style={{ lineHeight: 1.6, paddingBottom: 8 }}>
          On iPhone, alerts only work after the app is on your home screen. Open this page in Safari, tap Share, then Add to Home Screen, open it from the icon, and come back here.
        </div>
      )}
      {sup === 'no' && <div className="note" style={{ paddingBottom: 8 }}>This browser does not support push notifications. Try Chrome on Android, or the installed app on iPhone.</div>}

      {sup === 'yes' && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {subbed ? (
            <>
              <button className="btn" onClick={turnOff} disabled={busy}><Icon name="close" size={16} />Turn off on this device</button>
              <button className="btn primary" onClick={test} disabled={busy || !server?.ready}>Send a test</button>
            </>
          ) : (
            <button className="btn primary" onClick={turnOn} disabled={busy || !server?.ready || !userId}><Icon name="plus" size={16} />Turn on coast alerts</button>
          )}
        </div>
      )}
      {sup === 'yes' && perm === 'denied' && <div className="note" style={{ paddingTop: 8, color: 'var(--amber)' }}>Notifications are blocked for this site in your browser settings.</div>}
      {!userId && <div className="note" style={{ paddingTop: 8 }}>Sign in so alerts stay tied to your account across devices.</div>}

      {devices.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="note" style={{ paddingBottom: 4 }}>Devices getting alerts</div>
          <div className="list">
            {devices.map(d => (
              <div key={d.id} className="item" style={{ cursor: 'default', gridTemplateColumns: '1fr auto', padding: '7px 10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="nm" style={{ fontSize: 13 }}>{d.label || 'Device'}</div>
                  <div className="sub">Added {new Date(d.created_at).toLocaleDateString()}{d.last_ok ? `, last alert ${new Date(d.last_ok).toLocaleDateString()}` : ', no alert sent yet'}</div>
                </div>
                <button className="iconbtn" aria-label="Remove device" onClick={() => removeDevice(d.id)}><Icon name="trash" size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

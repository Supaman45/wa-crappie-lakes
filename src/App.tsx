import { useEffect, useState } from 'react';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { useUI, type Tab } from '@/store/ui';
import { useLakes } from '@/features/lakes/store';
import { Toasts } from '@/lib/toast';
import { Icon } from '@/components/ui';
import { Wx } from '@/components/Wx';
import { Gate } from '@/features/auth/Gate';
import { MapView } from '@/features/map/MapView';
import { TripControl } from '@/features/trip/TripControl';
import { LakesPanel } from '@/features/lakes/LakesPanel';
import { CreeksPanel } from '@/features/creeks/CreeksPanel';
import { PlanPanel } from '@/features/plan/PlanPanel';
import { LogPanel } from '@/features/log/LogPanel';
import { MorePanel } from '@/features/more/MorePanel';
import { LakeSheet } from '@/features/lakes/LakeSheet';
import { CatchSheet } from '@/features/log/CatchSheet';
import { CatchView } from '@/features/log/CatchView';
import { TripSheet } from '@/features/log/TripSheet';
import { StreamSheet } from '@/features/creeks/StreamSheet';
import { SpotSheet } from '@/features/creeks/SpotSheet';
import { ProfileSheet } from '@/features/more/ProfileSheet';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'lakes', label: 'Lakes', icon: 'map' },
  { id: 'creeks', label: 'Creeks', icon: 'creek' },
  { id: 'plan', label: 'Plan', icon: 'plan' },
  { id: 'log', label: 'Log', icon: 'log' },
  { id: 'more', label: 'More', icon: 'more' },
];

function TabBar({ className, island = false }: { className: string; island?: boolean }) {
  const tab = useUI(s => s.tab); const setTab = useUI(s => s.setTab); const setMobileView = useUI(s => s.setMobileView);
  const go = (id: Tab) => { setTab(id); setMobileView('panel'); };
  const btn = (t: { id: Tab; label: string; icon: string }) => (
    <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => go(t.id)}>
      <Icon name={t.icon} />{t.label}
    </button>
  );
  if (island) {
    return (
      <nav className={className} role="tablist">
        {TABS.filter(t => t.id === 'lakes' || t.id === 'creeks').map(btn)}
        <button role="tab" aria-selected={tab === 'log'} className="logfab" onClick={() => go('log')} aria-label="Log, one tap to record a catch">
          <Icon name="plus" />
        </button>
        {TABS.filter(t => t.id === 'plan' || t.id === 'more').map(btn)}
      </nav>
    );
  }
  return <nav className={className} role="tablist">{TABS.map(btn)}</nav>;
}

const REDUCED = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function splashWanted(): boolean {
  try { if (sessionStorage.getItem('wff-splash')) return false; } catch { /* private mode */ }
  return !REDUCED;
}
function Splash() {
  return (
    <div className="splash" aria-hidden="true">
      <div className="ring" />
      <svg viewBox="0 0 48 48">
        <path className="fishp" d="M6 24c6.5-9 17-13 27-9 4.2 1.7 7.4 4.9 9 9-1.6 4.1-4.8 7.3-9 9-10 4-20.5 0-27-9z" />
        <path className="tailp" d="M42 24l-8-7M42 24l-8 7" />
        <circle className="eye" cx="15" cy="22" r="1.6" fill="#fff" stroke="none" />
      </svg>
      <b>WA Fish Finder</b>
      <small>FIND. FISH. LOG.</small>
    </div>
  );
}

function Sheets() {
  const sheet = useUI(s => s.sheet);
  if (!sheet) return null;
  switch (sheet.kind) {
    case 'lake': return <LakeSheet lake={sheet.lake} />;
    case 'catch': return <CatchSheet lakeId={sheet.lakeId} lakeName={sheet.lakeName} waterType={sheet.waterType} spotId={sheet.spotId ?? null} />;
    case 'catchView': return <CatchView catchId={sheet.catchId} />;
    case 'trip': return <TripSheet tripId={sheet.tripId} />;
    case 'stream': return <StreamSheet pick={sheet.pick} />;
    case 'spot': return <SpotSheet spot={sheet.spot} />;
    case 'profile': return <ProfileSheet />;
    default: return null;
  }
}

function BootScreen() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, []);
  return (
    <div className="gate">
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ width: 22, height: 22 }} />
        <div className="note" style={{ marginTop: 12, letterSpacing: '.08em', textTransform: 'uppercase', fontSize: 11 }}>Starting</div>
        {slow && (
          <div style={{ marginTop: 16 }}>
            <div className="note" style={{ marginBottom: 8 }}>Taking longer than usual.</div>
            <button className="btn" onClick={async () => { try { const regs = await navigator.serviceWorker?.getRegistrations(); for (const r of regs || []) await r.unregister(); const keys = await caches.keys(); for (const k of keys) await caches.delete(k); } catch { /* ignore */ } location.reload(); }}>Clear cache and reload</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const status = useAuth(s => s.status);
  const userId = useAuth(s => s.userId);
  const init = useAuth(s => s.init);
  const boot = useData(s => s.boot);
  const teardown = useData(s => s.teardown);
  const tab = useUI(s => s.tab);
  const mobileView = useUI(s => s.mobileView);
  const loadLaunches = useLakes(s => s.loadLaunches);
  const outbox = useData(s => s.outboxCount);
  const online = useData(s => s.online);

  const [splash, setSplash] = useState(splashWanted);
  useEffect(() => {
    if (!splash) return;
    const tm = setTimeout(() => { setSplash(false); try { sessionStorage.setItem('wff-splash', '1'); } catch { /* fine */ } }, 2600);
    return () => clearTimeout(tm);
  }, [splash]);

  useEffect(() => { init(); }, [init]);
  useEffect(() => { if (userId) { boot(userId); loadLaunches(); } return () => { if (userId) teardown(); }; }, [userId, boot, teardown, loadLaunches]);

  if (status === 'booting') return <BootScreen />;
  if (status === 'signed_out') return <><Gate /><Toasts /></>;

  return (
    <div className={`app${splash ? ' cascade' : ''}`} data-view={mobileView} data-tab={tab}>
      <aside className="panel">
        <header className="hdr">
          <div className="brand"><h1>WA Fish Finder</h1><span className="ver">v{__APP_VERSION__}</span></div>
          <div className="stats">{!online ? 'offline' : outbox > 0 ? `${outbox} to sync` : ''}</div>
          <Wx />
          <button className="iconbtn mapbtn" onClick={() => useUI.getState().setMobileView('map')} aria-label="Show map"><Icon name="map" /></button>
        </header>
        <TabBar className="tabs" />
        <div className="panel-scroll">
          {tab === 'lakes' && <LakesPanel />}
          {tab === 'creeks' && <CreeksPanel />}
          {tab === 'plan' && <PlanPanel />}
          {tab === 'log' && <LogPanel />}
          {tab === 'more' && <MorePanel />}
        </div>
      </aside>
      <div className="mapwrap">
        <MapView />
        <TripControl />
      </div>
      <TabBar className="bottomnav" island />
      <Sheets />
      {splash && <Splash />}
      <Toasts />
    </div>
  );
}

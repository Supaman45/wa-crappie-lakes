import { useEffect } from 'react';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { useUI, type Tab } from '@/store/ui';
import { useLakes } from '@/features/lakes/store';
import { Toasts } from '@/lib/toast';
import { Icon } from '@/components/ui';
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

function TabBar({ className }: { className: string }) {
  const tab = useUI(s => s.tab); const setTab = useUI(s => s.setTab); const setMobileView = useUI(s => s.setMobileView);
  return (
    <nav className={className} role="tablist">
      {TABS.map(t => (
        <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => { setTab(t.id); setMobileView('panel'); }}>
          <Icon name={t.icon} />{t.label}
        </button>
      ))}
    </nav>
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

  useEffect(() => { init(); }, [init]);
  useEffect(() => { if (userId) { boot(userId); loadLaunches(); } return () => { if (userId) teardown(); }; }, [userId, boot, teardown, loadLaunches]);

  if (status === 'booting') return <div className="gate"><div className="spinner" /></div>;
  if (status === 'signed_out') return <><Gate /><Toasts /></>;

  return (
    <div className="app" data-view={mobileView} data-tab={tab}>
      <aside className="panel">
        <header className="hdr">
          <div className="brand"><h1>WA Fish Finder</h1><span className="ver">v{__APP_VERSION__}</span></div>
          <div className="stats">{!online ? 'offline' : outbox > 0 ? `${outbox} to sync` : ''}</div>
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
      <TabBar className="bottomnav" />
      <Sheets />
      <Toasts />
    </div>
  );
}

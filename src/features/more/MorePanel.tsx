declare const __APP_VERSION__: string;

import { useMemo, useState } from 'react';
import { useAuth } from '@/store/auth';
import { useData, currentUserId } from '@/store/data';
import { useUI } from '@/store/ui';
import { CREEK_SPECIES, speciesColor, speciesLabel } from '@/data/species';
import { catchesCsv, visitsCsv, shareText } from '@/domain/journal';
import { toast } from '@/lib/toast';
import { Chip, Empty } from '@/components/ui';
import { useFeeds } from '@/store/feeds';
import { useFeedLoads, RulesList } from '@/features/feeds/FeedBits';

type RuleWater = 'all' | 'river' | 'lake' | 'salt';

function RulesSection() {
  useFeedLoads(['rules']);
  const rules = useFeeds(s => s.rules);
  const status = useFeeds(s => s.rulesStatus);
  const loadRules = useFeeds(s => s.loadRules);
  const [water, setWater] = useState<RuleWater>('all');
  const [showAll, setShowAll] = useState(false);
  const list = useMemo(() => rules.filter(r => water === 'all' || r.water === water || (water === 'river' && r.water === 'other')), [rules, water]);
  const shown = showAll ? list : list.slice(0, 8);
  return (
    <div className="section">
      <h3>Emergency rules <small>{status === 'ok' ? `${rules.length} posted` : status === 'loading' ? 'loading' : status === 'err' ? 'offline' : ''}</small></h3>
      <div className="chips" style={{ marginBottom: 8 }}>
        {(['all', 'river', 'lake', 'salt'] as RuleWater[]).map(w => <Chip key={w} on={water === w} onClick={() => setWater(w)}>{w === 'all' ? 'All' : w === 'salt' ? 'Saltwater' : w === 'river' ? 'Rivers' : 'Lakes'}</Chip>)}
      </div>
      {status === 'err' && <div className="row" style={{ justifyContent: 'space-between', paddingBottom: 8 }}><div className="note">Could not load the WDFW feed.</div><button className="btn sm" onClick={loadRules}>Retry</button></div>}
      <RulesList rules={shown} compact empty={status === 'loading' ? 'Loading WDFW emergency rules' : 'No rules in this group.'} />
      {list.length > 8 && <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setShowAll(v => !v)}>{showAll ? 'Show fewer' : `Show all ${list.length}`}</button>}
      <div className="note" style={{ paddingTop: 8 }}>Newest first, from the WDFW emergency rules feed. Matching rules also show on lake, river, and stream sheets.</div>
    </div>
  );
}

const SOURCES = [
  'WDFW SWIFD (statewide integrated fish distribution)',
  'WDFW fish passage barriers',
  'WDFW water access sites',
  'WDFW emergency fishing rules feed',
  'WDFW trout stocking reports',
  'WDFW weekly hatchery escapement report',
  'USGS stream gauges',
  'Open-Meteo weather, sun, and marine model',
  'NOAA CO-OPS tide predictions',
  'OpenStreetMap map tiles and data',
];

export function MorePanel() {
  const email = useAuth(s => s.email);
  const signOut = useAuth(s => s.signOut);
  const profiles = useData(s => s.profiles);
  const catches = useData(s => s.catches);
  const visits = useData(s => s.visits);
  const online = useData(s => s.online);
  const syncing = useData(s => s.syncing);
  const outboxCount = useData(s => s.outboxCount);
  const stuckCount = useData(s => s.stuckCount);
  const refresh = useData(s => s.refresh);
  const flush = useData(s => s.flush);
  const openSheet = useUI(s => s.openSheet);
  const creekSpecies = useUI(s => s.creekSpecies);
  const setCreekSpecies = useUI(s => s.setCreekSpecies);
  const me = currentUserId();

  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  const myProfile = (me && profiles[me]) || { id: me || '', name: (email || 'You').split('@')[0], color: '#eaa24c' };

  const crew = useMemo(() => {
    const counts: Record<string, { catches: number; visits: number }> = {};
    const get = (id: string) => counts[id] || (counts[id] = { catches: 0, visits: 0 });
    for (const c of catches) get(c.user_id).catches += c.qty || 1;
    for (const v of visits) get(v.user_id).visits++;
    return Object.values(profiles)
      .map(p => ({ p, ...get(p.id) }))
      .sort((a, b) => (a.p.id === me ? -1 : b.p.id === me ? 1 : b.catches - a.catches || a.p.name.localeCompare(b.p.name)));
  }, [profiles, catches, visits, me]);

  const syncNow = async () => { setBusy(true); try { await flush(); await refresh(); toast('Sync done'); } finally { setBusy(false); } };
  const reload = async () => { setBusy(true); try { await refresh(); toast('Data reloaded'); } finally { setBusy(false); } };

  const exportCatches = () => { if (!catches.length) { toast('No catches logged yet'); return; } shareText('catches.csv', catchesCsv(catches, profiles)); };
  const exportVisits = () => { if (!visits.length) { toast('No visits logged yet'); return; } shareText('visits.csv', visitsCsv(visits, profiles)); };

  const toggleSpecies = (id: string) => {
    if (creekSpecies.includes(id)) setCreekSpecies(creekSpecies.filter(s => s !== id));
    else setCreekSpecies([...creekSpecies, id]);
  };

  return (
    <div>
      <div className="section" style={{ marginTop: 12 }}>
        <h3>You</h3>
        <div className="item" style={{ cursor: 'default' }}>
          <span className="pin" style={{ background: myProfile.color }} />
          <div style={{ minWidth: 0 }}>
            <div className="nm">{myProfile.name}</div>
            <div className="sub">{email || 'Signed in offline'}</div>
          </div>
          <button className="btn sm" onClick={() => openSheet({ kind: 'profile' })}>Edit profile</button>
        </div>
      </div>

      <div className="section">
        <h3>Crew <small>{crew.length} angler{crew.length === 1 ? '' : 's'}</small></h3>
        {!crew.length && <Empty>No crew profiles loaded yet.</Empty>}
        <div className="list">
          {crew.map(r => (
            <div key={r.p.id} className="item" style={{ cursor: 'default' }}>
              <span className="pin" style={{ background: r.p.color }} />
              <div style={{ minWidth: 0 }}>
                <div className="nm">{r.p.name}{r.p.id === me ? ' (you)' : ''}</div>
              </div>
              <div className="right"><b>{r.catches} catch{r.catches === 1 ? '' : 'es'}</b>{r.visits} visit{r.visits === 1 ? '' : 's'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3>Sync <small>{syncing ? 'syncing' : online ? 'online' : 'offline'}</small></h3>
        <div className="kv" style={{ marginBottom: 8 }}>
          <div className="k">Connection</div><div className="v">{online ? 'Online' : 'Offline'}</div>
          <div className="k">Pending</div><div className="v">{outboxCount}</div>
          <div className="k">Stuck</div><div className="v">{stuckCount}</div>
        </div>
        {stuckCount > 0 && <div className="note" style={{ paddingBottom: 8 }}>{stuckCount} saved item{stuckCount === 1 ? '' : 's'} could not sync after several tries. Check that you are signed in with the right account, then tap Sync now.</div>}
        {!online && <div className="note" style={{ paddingBottom: 8 }}>Saves are kept on this device and sync when you have a signal.</div>}
        <div className="row">
          <button className="btn primary" onClick={syncNow} disabled={busy || !online}>Sync now</button>
          <button className="btn" onClick={reload} disabled={busy || !online}>Reload data</button>
        </div>
      </div>

      <div className="section">
        <h3>Data</h3>
        <div className="row">
          <button className="btn" onClick={exportCatches}>Catches CSV</button>
          <button className="btn" onClick={exportVisits}>Visits CSV</button>
        </div>
      </div>

      <RulesSection />

      <div className="section">
        <h3>Creek finder settings</h3>
        <div className="chips">
          {CREEK_SPECIES.map(id => <Chip key={id} on={creekSpecies.includes(id)} color={speciesColor(id)} onClick={() => toggleSpecies(id)}>{speciesLabel(id)}</Chip>)}
        </div>
        <div className="note" style={{ paddingTop: 8 }}>Streams on the map show only these species.</div>
      </div>

      <div className="section">
        <h3>About <small>v{__APP_VERSION__}</small></h3>
        <div className="note">Data sources</div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          {SOURCES.map(s => <div key={s}>{s}</div>)}
        </div>
        <div className="divider" />
        <div className="row">
          {!confirmOut
            ? <button className="btn" onClick={() => setConfirmOut(true)}>Sign out</button>
            : <>
              <button className="btn danger" onClick={() => { setConfirmOut(false); signOut(); }}>Confirm sign out</button>
              <button className="btn ghost" onClick={() => setConfirmOut(false)}>Cancel</button>
            </>}
        </div>
        <div className="note" style={{ paddingTop: 8 }}>Offline saves are kept on this device and sync the next time you sign in.</div>
      </div>

      <div className="section" style={{ marginBottom: 12 }}>
        <h3>Install</h3>
        <div className="note">On iPhone, open this page in Safari, tap Share, then Add to Home Screen. On Android, open the browser menu and tap Install app.</div>
      </div>
    </div>
  );
}

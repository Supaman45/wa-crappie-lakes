import { useMemo, useState } from 'react';
import { useData } from '@/store/data';
import { speciesLabel, spById } from '@/data/species';
import { cardRows, cardTotals, licenseYear, unwritten, daysToDeadline, cardCsv, rowText, type CardRow } from '@/domain/crc';
import { Empty, Icon } from '@/components/ui';
import { toast } from '@/lib/toast';

const WDFW_CRC = 'https://wdfw.wa.gov/licenses/fishing/catch-record-card';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The Catch Record Card view.
 *
 * WDFW requires a card for salmon, steelhead, sturgeon and halibut, and a retained fish has to be
 * written down before you carry on fishing. This is a mirror of that card, not a replacement:
 * WDFW runs its own electronic card in the MyWDFW and Fish Washington apps, and a paper card is
 * still legal and still due back April 30. What this gives you is the same rows in the same order,
 * so copying across takes seconds, and a season's record that survives a card left in a wet coat.
 *
 * The card is filed on the license year, April 1 to March 31, so totals are counted on those
 * boundaries rather than the calendar year.
 */
export function CrcCard({ userId }: { userId: string | null }) {
  const catches = useData(s => s.catches);
  const updateCatch = useData(s => s.updateCatch);
  const [showAll, setShowAll] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);

  const yr = useMemo(() => licenseYear(), []);
  const mine = useMemo(() => userId ? catches.filter(c => c.user_id === userId) : catches, [catches, userId]);
  const rows = useMemo(() => cardRows(mine, yr), [mine, yr]);
  const tot = useMemo(() => cardTotals(rows), [rows]);
  const fresh = useMemo(() => unwritten(rows), [rows]);
  const due = daysToDeadline();

  // Card species caught but never answered kept or released: they belong on the card or nowhere,
  // and the app has no business guessing which.
  const undecided = useMemo(
    () => mine.filter(c => (c.species === 'chinook' || c.species === 'coho' || c.species === 'steelhead') && c.kept == null),
    [mine],
  );

  const shown = showAll ? rows : rows.slice(0, 12);

  return (
    <div className="section" style={{ marginTop: 8 }}>
      <div className="readout" style={{ padding: '0 0 6px' }}>
        <h2 style={{ fontSize: 22 }}>Catch Record Card</h2>
        <div className="rd">License year {yr.label}<b style={{ color: 'var(--amber)' }}>{tot.total} kept</b></div>
      </div>

      <div className="note" style={{ paddingBottom: 8 }}>
        A mirror of your paper card, not a replacement for it. WDFW takes the official record on paper
        or through its own app, and a paper card is due back April 30. Keep writing in ink; this is here
        so nothing is lost and copying across is quick.
      </div>

      {due != null && tot.total > 0 && (
        <div className="stat" style={{ borderColor: 'rgba(234,162,76,.5)' }}>
          <div className="l">Card due</div>
          <div style={{ fontSize: 13.5, marginTop: 4 }}>
            {due === 0 ? 'Your card is due back today.' : `Your card is due back in ${due} day${due === 1 ? '' : 's'}, on April 30.`} You have {tot.total} fish on it.
          </div>
        </div>
      )}

      {undecided.length > 0 && (
        <div className="stat" style={{ borderColor: 'rgba(255,90,79,.45)', marginTop: 8 }}>
          <div className="l">Needs an answer</div>
          <div style={{ fontSize: 13.5, marginTop: 4, lineHeight: 1.5 }}>
            {undecided.length} salmon or steelhead {undecided.length === 1 ? 'is' : 'are'} logged without kept or released, so {undecided.length === 1 ? 'it is' : 'they are'} not on the card yet.
          </div>
          <div className="list" style={{ marginTop: 8 }}>
            {undecided.slice(0, 5).map(c => (
              <div key={c.id} className="item" style={{ cursor: 'default', gridTemplateColumns: '1fr', padding: '7px 10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="nm" style={{ fontSize: 13 }}>{speciesLabel(c.species)} · {c.lake_name || c.lake_id} · {c.date}</div>
                  <div className="row" style={{ marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
                    <button type="button" className="btn sm primary" disabled={fixing === c.id} onClick={async () => { setFixing(c.id); await updateCatch(c.id, { kept: true, clipped: true }); setFixing(null); }}>Kept, clipped</button>
                    <button type="button" className="btn sm primary" disabled={fixing === c.id} onClick={async () => { setFixing(c.id); await updateCatch(c.id, { kept: true, clipped: false }); setFixing(null); }}>Kept, wild</button>
                    <button type="button" className="btn sm" disabled={fixing === c.id} onClick={async () => { setFixing(c.id); await updateCatch(c.id, { kept: false, clipped: null }); setFixing(null); }}>Released</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fresh.length > 0 && (
        <div className="stat" style={{ marginTop: 8, borderColor: 'rgba(95,227,138,.4)' }}>
          <div className="l">Write these in</div>
          <div className="note" style={{ paddingTop: 4 }}>From today and yesterday. Copy each line onto the paper card in ink.</div>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, marginTop: 8, lineHeight: 1.9 }}>
            {fresh.map(r => <div key={r.id}>{rowText(r)}</div>)}
          </div>
        </div>
      )}

      {/* The card itself */}
      {!rows.length && <Empty>No salmon or steelhead kept this license year. Release a fish and nothing goes on the card.</Empty>}
      {rows.length > 0 && (
        <>
          <div className="item" style={{ cursor: 'default', gridTemplateColumns: '1fr', marginTop: 10, background: 'transparent', borderStyle: 'dashed' }}>
            <div className="row" style={{ gap: 0, fontSize: 10.5, letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 700 }}>
              <span style={{ width: '20%' }}>AREA</span>
              <span style={{ width: '18%' }}>DATE</span>
              <span style={{ flex: 1 }}>SPECIES</span>
              <span style={{ width: '24%', textAlign: 'right' }}>CLIP</span>
            </div>
          </div>
          <div className="list">
            {shown.map(r => <Row key={r.id} r={r} onArea={async (code) => { await updateCatch(r.id, { catch_area: code }); }} />)}
          </div>
          {rows.length > shown.length && (
            <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setShowAll(true)}>Show all {rows.length}</button>
          )}
        </>
      )}

      {/* Season totals. Some fisheries cap you by the year, not the day. */}
      {tot.total > 0 && (
        <div className="item" style={{ cursor: 'default', gridTemplateColumns: '1fr', marginTop: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div className="nm" style={{ fontSize: 13 }}>Season totals, {yr.label}</div>
            <div className="row" style={{ marginTop: 6, flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(tot.bySpecies).sort((a, b) => b[1] - a[1]).map(([sp, n]) => (
                <span key={sp} className="badge" style={{ borderColor: spById[sp]?.color }}>{speciesLabel(sp)} {n}</span>
              ))}
            </div>
            {(tot.missingArea > 0 || tot.missingClip > 0) && (
              <div className="note" style={{ paddingTop: 8 }}>
                {tot.missingArea > 0 && `${tot.missingArea} row${tot.missingArea === 1 ? '' : 's'} with no catch area code. `}
                {tot.missingClip > 0 && `${tot.missingClip} with no clip recorded. `}
                Fill those in before you send the card.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn" disabled={!rows.length} onClick={() => { download(`catch-record-card-${yr.label}.csv`, cardCsv(rows)); toast('Card exported'); }}>
          <Icon name="share" size={16} />Export CSV
        </button>
        <a className="btn ghost" href={WDFW_CRC} target="_blank" rel="noopener">WDFW card rules</a>
      </div>
    </div>
  );
}

function Row({ r, onArea }: { r: CardRow; onArea: (code: string) => void }) {
  const [edit, setEdit] = useState(false);
  const def = spById[r.species];
  return (
    <div className="item" style={{ cursor: 'default', gridTemplateColumns: '1fr', padding: '8px 10px' }}>
      <div className="row" style={{ gap: 0, alignItems: 'center' }}>
        <span style={{ width: '20%', fontWeight: 700, color: r.area ? undefined : 'var(--amber)' }}>
          {edit ? (
            <input
              className="in"
              autoFocus
              defaultValue={r.area || ''}
              placeholder="804"
              inputMode="numeric"
              style={{ minHeight: 28, fontSize: 13, padding: '2px 6px' }}
              onBlur={e => { const v = e.target.value.trim(); setEdit(false); if (v && v !== r.area) onArea(v); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          ) : (
            <button type="button" className="linky" onClick={() => setEdit(true)} style={{ font: 'inherit', color: 'inherit' }}>{r.area || 'set'}</button>
          )}
        </span>
        <span style={{ width: '18%' }}>{r.month}/{r.day}</span>
        <span style={{ flex: 1, minWidth: 0, color: def?.color, fontWeight: 600 }}>{def?.short || r.species}</span>
        <span style={{ width: '24%', textAlign: 'right' }}>
          <span className={`badge ${r.clipped === true ? 'ok' : r.clipped === false ? 'water' : 'warn'}`}>
            {r.clipped === true ? 'Hatchery' : r.clipped === false ? 'Wild' : 'set'}
          </span>
        </span>
      </div>
      <div className="sub" style={{ marginTop: 4 }}>{r.water}</div>
    </div>
  );
}

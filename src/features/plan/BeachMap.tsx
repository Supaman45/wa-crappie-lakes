import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { driveStatus } from '@/domain/coast';
import { BANDS, bandState, bandText, shoreBetween, approachPins, nearestApproaches, wazeUrl, type BandState } from '@/domain/coastMap';
import { dirUrl, dirUrlQ } from '@/lib/util';

const COLOR: Record<BandState, string> = { drive: '#0e9c52', closed: '#d93b30', foot: '#64798a' };

/** Small DOM builder so popups never go through innerHTML. */
function h(tag: string, attrs: Record<string, string> = {}, ...kids: (Node | string)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of kids) el.append(c);
  return el;
}

function navLinks(p: ReturnType<typeof approachPins>[number]): HTMLElement {
  const g = p.exact ? dirUrl(p.lat, p.lng) : dirUrlQ(p.place || `${p.name}, ${p.town}, WA`);
  return h('div', { class: 'bm-nav' },
    h('a', { href: wazeUrl(p), target: '_blank', rel: 'noopener', class: 'bm-btn waze' }, 'Waze'),
    h('a', { href: g, target: '_blank', rel: 'noopener', class: 'bm-btn' }, 'Google Maps'),
  );
}

/**
 * North Beach on one screen: every WAC 352-37-060 segment drawn as a band on the sand, colored for
 * today. Green you can drive, red closed to vehicles this season, grey closed all year (walk in).
 * Colors come from the same driveStatus() as the Coast Watch card, so the map recolors itself on
 * April 15 and the day after Labor Day with no update and no signal.
 */
export function BeachMap({ focus }: { focus?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [view, setView] = useState<'approach' | 'all'>(focus ? 'approach' : 'all');
  const WHOLE: L.LatLngBoundsExpression = [[46.93, -124.25], [47.247, -124.15]];
  const showAll = () => { setView('all'); mapRef.current?.fitBounds(WHOLE, { padding: [10, 10] }); };
  const showMine = () => {
    const pin = focus && approachPins().find(p => p.id === focus);
    if (!pin) return;
    setView('approach'); mapRef.current?.setView([pin.lat, pin.lng - 0.006], 14);
  };

  useEffect(() => {
    if (!box.current) return;
    const st = driveStatus();
    const map = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, tap: true } as L.MapOptions);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri, Maxar', maxZoom: 19 }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);

    for (const b of BANDS) {
      const state = bandState(b, st);
      const line = shoreBetween(b.from, b.to);
      L.polyline(line, { color: '#ffffff', weight: 13, opacity: 0.9, lineCap: 'butt' }).addTo(map);
      const band = L.polyline(line, { color: COLOR[state], weight: 9, opacity: 1, lineCap: 'butt', dashArray: state === 'foot' ? '10 6' : undefined }).addTo(map);
      const ends = nearestApproaches(b);
      const pop = h('div', { class: 'bm-pop' },
        h('b', {}, b.name),
        h('div', { class: `bm-state ${state}` }, bandText(b, st)),
        ...(b.approx ? [h('div', { class: 'bm-note' }, 'One end of this stretch is approximate. Read the posted signs.')] : []),
        ...(ends.length ? [h('div', { class: 'bm-k' }, 'Get on the sand at')] : []),
        ...ends.map(p => h('div', { class: 'bm-ap' }, h('span', {}, `${p.name}${p.walk ? ' (walk-in)' : ''}`), navLinks(p))),
      );
      band.bindPopup(pop, { maxWidth: 260 });
    }

    for (const p of approachPins()) {
      const m = L.circleMarker([p.lat, p.lng], { radius: p.walk ? 6 : 7, color: '#0e5f82', weight: 3, fillColor: '#ffffff', fillOpacity: 1 }).addTo(map);
      m.bindTooltip(p.name, { direction: 'right', offset: [8, 0], permanent: true, className: 'bm-label' });
      m.bindPopup(h('div', { class: 'bm-pop' },
        h('b', {}, p.name),
        h('div', { class: 'bm-note' }, `${p.town}${p.walk ? '. Walk-in: park at the end of the pavement.' : '. Drive-on approach.'}${p.exact ? '' : ' Location approximate.'}`),
        navLinks(p),
      ), { maxWidth: 240 });
    }

    mapRef.current = map;
    // Names pile up at whole-beach zoom; show them once the approaches have room.
    const labelToggle = () => box.current?.classList.toggle('bm-far', map.getZoom() < 13);
    map.on('zoomend', labelToggle);
    const pick = focus && approachPins().find(p => p.id === focus);
    if (pick) map.setView([pick.lat, pick.lng - 0.006], 14);
    else map.fitBounds(WHOLE, { padding: [10, 10] });

    // The card can mount while its tab is hidden; size the map once it is actually laid out.
    labelToggle();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(box.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  return (
    <div className="beachmap">
      {focus && (
        <div className="seg" role="tablist" aria-label="Map view">
          <button type="button" role="tab" aria-selected={view === 'approach'} className={view === 'approach' ? 'on' : ''} onClick={showMine}>Your approach</button>
          <button type="button" role="tab" aria-selected={view === 'all'} className={view === 'all' ? 'on' : ''} onClick={showAll}>Whole beach</button>
        </div>
      )}
      <div ref={box} className="bm-map" role="application" aria-label="North Beach driving map" />
      <div className="bm-legend">
        <span><i style={{ background: COLOR.drive }} />Drive today</span>
        <span><i style={{ background: COLOR.closed }} />Closed this season</span>
        <span><i className="dash" style={{ background: COLOR.foot }} />Walk only, all year</span>
        <span><i className="pin" />Approach</span>
      </div>
      <div className="note">Tap a band for its rule and the nearest approach. Seasons flip April 15 and the day after Labor Day.</div>
    </div>
  );
}

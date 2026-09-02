import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { LAKES } from '@/data/lakes';
import { speciesColor, spById } from '@/data/species';
import { useUI } from '@/store/ui';
import { useData, currentUserId } from '@/store/data';
import { useLakes, filterLakes } from '@/features/lakes/store';
import { useCreeks, CREEK_MIN_ZOOM } from '@/features/creeks/store';
import { tagKey } from '@/lib/db';
import { acreFmt, cToF, debounce, dirUrl, normTrack } from '@/lib/util';
import type { Lake } from '@/lib/types';
import type { StreamSeg } from '@/api/wdfw';
import { Icon } from '@/components/ui';
import { toast } from '@/lib/toast';

const WA_CENTER: L.LatLngExpression = [47.35, -121.9];

function pinSvg(color: string, ring?: string | null): string {
  return `<svg width="26" height="34" viewBox="0 0 26 34"><path d="M13 33s11-11 11-20A11 11 0 0 0 2 13c0 9 11 20 11 20z" fill="${color}" stroke="${ring || '#0d1614'}" stroke-width="${ring ? 3 : 1.5}"/><circle cx="13" cy="13" r="4.5" fill="#0d1614" opacity=".85"/></svg>`;
}
function pinIcon(color: string, ring?: string | null): L.DivIcon {
  return L.divIcon({ html: pinSvg(color, ring), className: '', iconSize: [26, 34], iconAnchor: [13, 33], popupAnchor: [0, -30] });
}
function dotIcon(color: string, size = 12, stroke = '#0d1614'): L.DivIcon {
  return L.divIcon({ html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid ${stroke};box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}
function squareIcon(color: string): L.DivIcon {
  return L.divIcon({ html: `<div style="width:12px;height:12px;background:${color};border:2px solid #0d1614;transform:rotate(45deg);box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`, className: '', iconSize: [12, 12], iconAnchor: [6, 6] });
}
const launchIcon = L.divIcon({ html: `<div style="width:14px;height:14px;border-radius:3px;background:#3fae6b;border:2px solid #0d1614"></div>`, className: '', iconSize: [14, 14], iconAnchor: [7, 7] });

function el(tag: string, cls: string, text?: string): HTMLElement { const e = document.createElement(tag); e.className = cls; if (text != null) e.textContent = text; return e; }

function lakePopup(l: Lake, launch: { name: string; dist?: number } | undefined, onOpen: () => void): HTMLElement {
  const root = el('div', '');
  root.appendChild(el('div', 'pop-nm', l.name));
  root.appendChild(el('div', 'pop-co', `${l.counties.join(', ')} · ${acreFmt(l.acres)} ac · ${l.elev.toLocaleString()} ft`));
  const sp = el('div', 'pill-row'); sp.style.marginTop = '6px';
  for (const s of l.sp) { const b = el('span', 'badge', spById[s]?.short || s); b.style.color = speciesColor(s); sp.appendChild(b); }
  root.appendChild(sp);
  if (launch) root.appendChild(el('div', 'note', `Launch: ${launch.name}${launch.dist != null ? ` (${launch.dist.toFixed(1)} mi)` : ''}`));
  const act = el('div', 'pop-actions');
  const open = el('button', 'btn primary sm', 'Open'); open.onclick = onOpen; act.appendChild(open);
  const dir = document.createElement('a'); dir.className = 'btn sm'; dir.href = dirUrl(l.lat, l.lng); dir.target = '_blank'; dir.rel = 'noopener'; dir.textContent = 'Directions'; act.appendChild(dir);
  root.appendChild(act);
  return root;
}

export function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Record<number, L.Marker>>({});
  const launchLayer = useRef<L.LayerGroup>(L.layerGroup());
  const originMarker = useRef<L.Marker | null>(null);
  const streamLayer = useRef<L.LayerGroup>(L.layerGroup());
  const barrierLayer = useRef<L.LayerGroup>(L.layerGroup());
  const gaugeLayer = useRef<L.LayerGroup>(L.layerGroup());
  const accessLayer = useRef<L.LayerGroup>(L.layerGroup());
  const spotLayer = useRef<L.LayerGroup>(L.layerGroup());
  const trackLayer = useRef<L.LayerGroup>(L.layerGroup());
  const [tileFail, setTileFail] = useState(false);

  const mapMode = useUI(s => s.mapMode);
  const flyTo = useUI(s => s.flyTo);
  const origin = useUI(s => s.origin);
  const activeLakeId = useUI(s => s.activeLakeId);
  const creekSpecies = useUI(s => s.creekSpecies);
  const openSheet = useUI(s => s.openSheet);
  const setActiveLake = useUI(s => s.setActiveLake);
  const tags = useData(s => s.tags);
  const index = useData(s => s.index);
  const spots = useData(s => s.spots);
  const trips = useData(s => s.trips);
  const launches = useLakes(s => s.launches);
  const fq = useLakes(s => s.q); const fcounty = useLakes(s => s.county); const fspecies = useLakes(s => s.species); const fcat = useLakes(s => s.cat); const fflags = useLakes(s => s.flags); const fsort = useLakes(s => s.sort);
  const creeks = useCreeks();

  // Init map once
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { center: WA_CENTER, zoom: 7, zoomControl: false, attributionControl: true, preferCanvas: true });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const base = {
      'Dark': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri, HERE, Garmin, OpenStreetMap contributors', maxZoom: 16, maxNativeZoom: 16 }),
      'Streets': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }),
      'Topo': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap, © OpenTopoMap', maxZoom: 17 }),
      'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri', maxZoom: 19 }),
    };
    base['Dark'].addTo(map);
    let failed = 0; base['Dark'].on('tileerror', () => { failed++; if (failed > 6) setTileFail(true); });
    base['Dark'].on('tileload', () => setTileFail(false));
    const cluster = L.markerClusterGroup({ maxClusterRadius: 38, showCoverageOnHover: false, spiderfyOnMaxZoom: true, disableClusteringAtZoom: 11 });
    clusterRef.current = cluster;
    map.addLayer(cluster);
    map.addLayer(launchLayer.current);
    map.addLayer(spotLayer.current);
    map.addLayer(trackLayer.current);
    L.control.layers(base, { 'Boat launches': launchLayer.current, 'Saved spots': spotLayer.current, 'Trip tracks': trackLayer.current }, { position: 'topright', collapsed: true }).addTo(map);
    mapRef.current = map;

    for (const l of LAKES) {
      const m = L.marker([l.lat, l.lng], { icon: pinIcon(speciesColor(l.sp[0] || 'crappie')) });
      m.on('click', () => setActiveLake(l.id));
      markersRef.current[l.id] = m;
    }
    const onMove = debounce(() => {
      const b = map.getBounds();
      useCreeks.getState().setViewport([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], map.getZoom());
    }, 350);
    map.on('moveend zoomend', onMove);
    onMove();
    setTimeout(() => map.invalidateSize(), 50);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(divRef.current);
    return () => { ro.disconnect(); };
  }, [setActiveLake]);

  // Lake markers: filter + colors + popups
  useEffect(() => {
    const map = mapRef.current, cluster = clusterRef.current; if (!map || !cluster) return;
    const me = currentUserId();
    const visible = mapMode === 'lakes' ? filterLakes() : [];
    const visSet = new Set(visible.map(l => l.id));
    cluster.clearLayers();
    for (const l of LAKES) {
      const m = markersRef.current[l.id];
      if (!visSet.has(l.id)) continue;
      const tag = me ? tags[tagKey(me, l.slug)] : undefined;
      const st = index[l.slug];
      const color = tag?.color || (st?.top ? speciesColor(st.top) : speciesColor(l.sp[0] || 'crappie'));
      const ring = tag?.fav ? '#eaa24c' : tag?.wish ? '#52c9e2' : null;
      m.setIcon(pinIcon(color, ring));
      m.bindPopup(() => lakePopup(l, launches[l.slug], () => openSheet({ kind: 'lake', lake: l })), { maxWidth: 260 });
      cluster.addLayer(m);
    }
    // launches
    launchLayer.current.clearLayers();
    if (mapMode === 'lakes') for (const l of visible) {
      const s = launches[l.slug]; if (!s) continue;
      const mk = L.marker([s.lat, s.lng], { icon: launchIcon, zIndexOffset: -100 });
      mk.bindPopup(() => { const r = el('div', ''); r.appendChild(el('div', 'pop-nm', s.name)); r.appendChild(el('div', 'pop-co', `Boat launch · ${l.name}`)); r.appendChild(el('div', 'note', [s.type, s.motor ? 'motors OK' : 'no motors', s.ada ? 'ADA' : null, s.hp || null].filter(Boolean).join(' · '))); const a = document.createElement('a'); a.className = 'btn primary sm'; a.style.marginTop = '8px'; a.href = dirUrl(s.lat, s.lng); a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Directions to ramp'; r.appendChild(a); return r; });
      launchLayer.current.addLayer(mk);
    }
  }, [mapMode, tags, index, launches, fq, fcounty, fspecies, fcat, fflags, fsort, origin, openSheet]);

  // Active lake: open its popup
  useEffect(() => {
    const map = mapRef.current, cluster = clusterRef.current; if (!map || !cluster || activeLakeId == null) return;
    const m = markersRef.current[activeLakeId]; if (!m) return;
    if (cluster.hasLayer(m)) cluster.zoomToShowLayer(m, () => m.openPopup());
    else { map.setView(m.getLatLng(), Math.max(map.getZoom(), 12)); }
  }, [activeLakeId]);

  // Fly requests
  useEffect(() => {
    const map = mapRef.current; if (!map || !flyTo) return;
    map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom ?? Math.max(map.getZoom(), 12), { duration: .8 });
    setTimeout(() => map.invalidateSize(), 100);
  }, [flyTo]);

  // Origin marker
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (originMarker.current) { originMarker.current.remove(); originMarker.current = null; }
    if (origin) {
      originMarker.current = L.marker([origin.lat, origin.lng], { icon: dotIcon('#eaa24c', 16, '#fff'), zIndexOffset: 500 }).addTo(map).bindTooltip(origin.label);
      map.flyTo([origin.lat, origin.lng], Math.max(map.getZoom(), 9), { duration: .8 });
    }
  }, [origin]);

  // Saved spots
  useEffect(() => {
    try {
    spotLayer.current.clearLayers();
    for (const s of spots) {
      const col = s.status === 'producing' ? '#3fae6b' : s.status === 'dead' ? '#5f7770' : s.status === 'scouted' ? '#eaa24c' : '#52c9e2';
      const mk = L.marker([s.lat, s.lng], { icon: squareIcon(col), zIndexOffset: 200 });
      mk.bindTooltip(s.name);
      mk.on('click', () => openSheet({ kind: 'spot', spot: s }));
      spotLayer.current.addLayer(mk);
    }
    } catch (e) { console.warn('spot layer', e); }
  }, [spots, openSheet]);

  // Trip tracks (last 10)
  useEffect(() => {
    try {
    trackLayer.current.clearLayers();
    for (const t of trips.slice(0, 10)) {
      const pts = normTrack(t.track);
      if (pts.length < 2) continue;
      const line = L.polyline(pts.map(p => [p.lat, p.lng] as [number, number]), { color: '#eaa24c', weight: 3, opacity: .55, dashArray: '2 6' });
      line.bindTooltip(`Trip ${t.started_at ? new Date(t.started_at).toLocaleDateString() : ''} · ${t.distance_mi?.toFixed(1) ?? '?'} mi`);
      line.on('click', () => openSheet({ kind: 'trip', tripId: t.id }));
      trackLayer.current.addLayer(line);
    }
    } catch (e) { console.warn('track layer', e); }
  }, [trips, openSheet]);

  // Creek layers on/off with mode
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const layers = [streamLayer.current, barrierLayer.current, gaugeLayer.current, accessLayer.current];
    if (mapMode === 'creeks') { layers.forEach(l => map.addLayer(l)); }
    else { layers.forEach(l => map.removeLayer(l)); }
  }, [mapMode]);

  // Load creek data when viewport changes in creeks mode
  useEffect(() => {
    if (mapMode !== 'creeks' || !creeks.bbox) return;
    if (creeks.zoom < CREEK_MIN_ZOOM) return;
    const b = creeks.bbox;
    // skip absurdly large boxes
    if ((b[2] - b[0]) * (b[3] - b[1]) > 0.6) return;
    creeks.load(b, creekSpecies);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMode, creeks.bbox, creeks.zoom, creekSpecies]);

  // Draw streams
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    streamLayer.current.clearLayers();
    if (mapMode !== 'creeks') return;
    const byLlid = new Map<string, StreamSeg[]>();
    for (const s of creeks.streams) { if (creeks.onlyDocumented && !/documented/i.test(s.dist)) continue; const arr = byLlid.get(s.llid) || []; arr.push(s); byLlid.set(s.llid, arr); }
    for (const seg of creeks.streams) {
      if (creeks.onlyDocumented && !/documented/i.test(seg.dist)) continue;
      const documented = /documented/i.test(seg.dist);
      const line = L.polyline(seg.coords, { color: speciesColor(seg.species), weight: documented ? 3.5 : 2, opacity: documented ? .85 : .55, dashArray: documented ? undefined : '4 6', interactive: true, bubblingMouseEvents: false });
      line.on('click', (e: L.LeafletMouseEvent) => {
        const rows = byLlid.get(seg.llid) || [seg];
        const uniq = new Map<string, StreamSeg>(); for (const r of rows) uniq.set(`${r.swifd}|${r.dist}|${r.use}|${r.run}`, r);
        const species = Array.from(uniq.values()).map(r => ({ species: r.species, swifd: r.swifd, dist: r.dist, use: r.use, run: r.run, miles: r.miles }));
        const totalMiles = Math.max(...rows.map(r => r.miles), 0);
        openSheet({ kind: 'stream', pick: { llid: seg.llid, name: seg.name, lat: e.latlng.lat, lng: e.latlng.lng, species, totalMiles } });
      });
      line.bindTooltip(`${seg.name} · ${spById[seg.species]?.short || seg.swifd} · ${seg.dist}${seg.use ? ' · ' + seg.use : ''}`, { sticky: true });
      streamLayer.current.addLayer(line);
    }
  }, [mapMode, creeks.streams, creeks.onlyDocumented, openSheet]);

  // Draw barriers, gauges, access
  useEffect(() => {
    barrierLayer.current.clearLayers(); gaugeLayer.current.clearLayers(); accessLayer.current.clearLayers();
    if (mapMode !== 'creeks') return;
    if (creeks.showBarriers) for (const b of creeks.barriers) {
      const col = b.kind === 'total' ? '#e0533d' : b.kind === 'partial' ? '#eaa24c' : b.kind === 'natural' ? '#8fa79e' : '#5f7770';
      const mk = L.marker([b.lat, b.lng], { icon: dotIcon(col, 10) });
      mk.bindTooltip(`${b.kind === 'natural' ? 'Natural barrier' : b.kind === 'total' ? 'Total barrier' : b.kind === 'partial' ? 'Partial barrier' : b.kind === 'diversion' ? 'Diversion' : 'Barrier (unknown)'}: ${b.feature || 'site'}${b.stream ? ' on ' + b.stream : ''}${b.owner ? ' · ' + b.owner : ''}${b.gainMi != null ? ` · ${b.gainMi.toFixed(1)} mi upstream gain` : ''}`);
      barrierLayer.current.addLayer(mk);
    }
    if (creeks.showGauges) for (const g of creeks.gauges) {
      const mk = L.marker([g.lat, g.lng], { icon: dotIcon('#52c9e2', 14, '#08181d'), zIndexOffset: 300 });
      const parts = [g.cfs != null ? `${Math.round(g.cfs).toLocaleString()} cfs` : null, g.tempC != null ? `${Math.round(cToF(g.tempC))}°F` : null].filter(Boolean).join(' · ');
      mk.bindTooltip(`${g.name}${parts ? ' · ' + parts : ''}`);
      mk.bindPopup(() => { const r = el('div', ''); r.appendChild(el('div', 'pop-nm', g.name)); r.appendChild(el('div', 'pop-co', `USGS ${g.id}`)); r.appendChild(el('div', 'note', parts || 'no current reading')); if (g.at) r.appendChild(el('div', 'note', 'as of ' + new Date(g.at).toLocaleString())); const a = document.createElement('a'); a.className = 'btn sm'; a.style.marginTop = '8px'; a.href = `https://waterdata.usgs.gov/monitoring-location/${g.id}/`; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'USGS page'; r.appendChild(a); return r; });
      gaugeLayer.current.addLayer(mk);
    }
    if (creeks.showAccess) for (const a of creeks.access) {
      const mk = L.marker([a.lat, a.lng], { icon: a.kind === 'launch' ? launchIcon : dotIcon('#3fae6b', 10) });
      mk.bindTooltip(`${a.name}${a.kind === 'shore' ? ' · shore access' : a.launchType ? ' · ' + a.launchType : ' · water access'}${a.motor === false ? ' · no motors' : ''}${a.restrooms ? ' · restrooms' : ''}`);
      accessLayer.current.addLayer(mk);
    }
  }, [mapMode, creeks.barriers, creeks.gauges, creeks.access, creeks.showBarriers, creeks.showGauges, creeks.showAccess]);

  const setMapMode = useUI(s => s.setMapMode);
  const setMobileView = useUI(s => s.setMobileView);
  const needZoom = mapMode === 'creeks' && creeks.zoom < CREEK_MIN_ZOOM;

  return (
    <>
      <div ref={divRef} className="map" role="application" aria-label="Map" />
      <div className="mapfab tl">
        <button className="btn listbtn" onClick={() => setMobileView('panel')} aria-label="Show list"><Icon name="list" size={16} /> List</button>
        <div className="modebar" role="tablist">
          <button className={mapMode === 'lakes' ? 'on' : ''} onClick={() => setMapMode('lakes')}>Lakes</button>
          <button className={mapMode === 'creeks' ? 'on' : ''} onClick={() => setMapMode('creeks')}>Creeks</button>
        </div>
      </div>
      {mapMode === 'creeks' && (
        <div className="hud">
          {creeks.loading ? <><span className="spinner" /> loading streams</> : needZoom ? <>Zoom in to load streams (zoom {creeks.zoom} of {CREEK_MIN_ZOOM})</> : creeks.error ? <span style={{ color: '#eaa24c' }}>{creeks.error}</span> : <>{creeks.streams.length} segments · {creeks.gauges.length} gauges · {creeks.barriers.length} barriers</>}
        </div>
      )}
      <div className="mapfab bl">
        <button className="btn" onClick={() => {
          navigator.geolocation?.getCurrentPosition(p => { useUI.getState().setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'My location' }); }, () => toast('Location unavailable', 'warn'), { enableHighAccuracy: true, timeout: 10000 });
        }} aria-label="Locate me"><Icon name="locate" size={16} /></button>
      </div>
      {tileFail && <div className="tilewarn">Map tiles are not loading. Check your signal; cached tiles still show where you have been.</div>}
    </>
  );
}

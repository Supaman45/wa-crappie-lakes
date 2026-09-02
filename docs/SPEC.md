# WA Fish Finder: rebuild plan and creek-finder spec

Status: approved Sept 1, 2026. Replaces WA Crappie Lakes v2.5 (single-file PWA).
Owner: Seri. Built by Claude (Cowork). Deploy target: Vercel project wa-crappie-lakes, Supabase project ptdsxxttsyfczoacyyqg.

## Why rebuild

The v2.5 app is one 147 KB index.html with no build step. The audit found one missing function (toast) breaking three features, a non-idempotent offline outbox that double-inserts, stored XSS through crew names, a stale service worker version, and no offline read cache. Adding creeks, rivers, and saltwater on top of a single file would compound every one of those problems. The rebuild keeps every current feature, fixes the audit list, and gives each water type its own module.

## Product vision

One app for finding and logging fish across Washington waters. Modules ship in this order:

1. Lakes (ported from v2.5): 134 WDFW crappie lakes, launches, bite forecast, journal, trips, crew.
2. Creeks (new in v3): find creeks and small streams holding fish using WDFW and USGS data, save candidates, score them, log scouting visits.
3. Rivers (v3.x): steelhead and salmon rivers with escapement counts and emergency rule alerts.
4. Saltwater (v3.x): surf perch (ported Copalis module), marine areas, shore sites, crabbing.
5. Regs (v3.x): per-water rules from the WDFW pamphlet, season countdowns.

## Stack

Vite 8, React 18, TypeScript. Leaflet 1.9 with markercluster. Supabase JS v2 (auth, Postgres, storage, realtime). Dexie (IndexedDB) for offline cache and outbox. Zustand for state. vite-plugin-pwa for the service worker with a single version source. Custom CSS with the existing dark outdoor palette. No UI framework.

## Data sources (all live, no API key)

- WDFW SWIFD (Statewide Washington Integrated Fish Distribution): geodataservices.wdfw.wa.gov/arcgis/rest/services/MapServices/SWIFD/MapServer/0. Polylines keyed by LLID with SPECIES (23 values), DISTTYPE_DESC (Documented, Presumed, Modeled, Gradient Accessible, Potential, Historic, Artificial, Transported), USETYPE_DESC (Spawning, Rearing, Presence), RUNTIME_DESC, Length_mi. Query by bbox envelope at zoom 11+, paginated 2000 per page.
- WDFW Fish Passage sites: ApplicationServices/FP_Sites/MapServer layers 0 to 5 (not a barrier, partial, total, unknown, diversion, natural barrier). Fields include StreamName, FeatureType, PercentFishPassableCode, OwnerTypeCode, LinealGainMeasurement, PotentialSpecies.
- WDFW Water Access Sites: ApplicationServices/FishWA_2014_AllLakes_PROD/MapServer/0 (launch, motorized, restrooms). Lowland lakes layer 2 for future all-lakes expansion.
- WDFW Shore Fishing Sites: FP_FishMaps/ShoreFishingSites/MapServer/0.
- WDFW Major_Fishing_Area launches (existing, kept for lake ramp matching).
- USGS Water Services instantaneous values: waterservices.usgs.gov/nwis/iv/?format=json&stateCd=wa&parameterCd=00060,00010&siteType=ST for flow (cfs) and water temp (C) on every active WA stream gauge.
- Open-Meteo forecast and marine (existing). NOAA CO-OPS tides (existing). Nominatim and Zippopotam geocoding (existing).
- Phase 2 (server-side parsers): WDFW trout stocking plan and weekly catchable plants, hatchery escapement PDFs, emergency rules feed.

## Creek finder: how it works

Map mode "Creeks" draws SWIFD stream segments inside the viewport, colored by the species filter (default coastal cutthroat, rainbow, coho, steelhead) and styled by confidence (solid for Documented, dashed for Presumed or Modeled). Barriers draw as small markers (red total, amber partial, grey natural). USGS gauges draw as blue markers with live cfs and temp. Access sites and shore sites draw as green markers.

Tapping a segment opens the Stream sheet: stream name, every species and use type on this LLID, total documented miles, nearest gauge with flow and temp and a 7-day trend, upstream barrier count, nearest access sites within 3 miles, and a Creek Score (0 to 99).

Creek Score weights: species richness and documented spawning or rearing (35), cold-water signal from nearest gauge temp or elevation proxy (20), barrier isolation (a total barrier downstream of a documented reach means resident fish above it, +15), access within 3 miles of public land or a water access site (20), flow in fishable range vs 30-day median (10). Score explains itself in one line, same pattern as the lake bite score.

"Save as spot" writes a row to spots with the LLID, species, coordinates, and a default priority. Spots show in the Creeks list tab sorted by priority, with status (candidate, scouted, producing, dead), access type (public, timber permit, private, unknown), permit name, and notes. Visits and catches log against a spot the same way they log against a lake.

## Data model changes (Supabase)

New table spots: id uuid, user_id uuid default auth.uid(), kind text (creek, river, lake, salt), name text, lat, lng, llid text, species text[], meta jsonb, access text, permit text, priority int default 3, status text default 'candidate', notes text, created_at, updated_at. RLS: select for all authenticated (crew visibility), insert/update/delete own rows.

catches and visits gain water_type text default 'lake' and spot_id uuid null. lake_id stays for lakes. lake_tags select policy widens to all authenticated so crew tags show on pins. Realtime publication adds lake_tags, profiles, spots.

## Audit fixes carried into the rebuild

Toast component exists. Outbox rows carry client-generated UUIDs used as the row id, a single-flight flush with retry classification, and survive logout. Every string renders through React (no innerHTML). Service worker version derives from package.json. Forecast fetches are cancelled on sheet change and cached for one hour. Dexie caches lakes, launches, catches, visits, tags, trips, spots, and last forecasts so the app opens with data offline. Supabase reads page in 1000-row chunks. Bottom navigation on mobile with safe-area insets, pinch zoom allowed, no prompt() dialogs.

## Phased build

Phase A (this session): scaffold, design system, data layer, auth, lakes map and list, lake sheet, catch and visit logging, journal, plan, surf, trips, crew, creeks map mode, stream sheet, spots list, creek score, PWA, deploy to Vercel preview.
Phase B: stocking and escapement parsers as Vercel functions, regs module, rivers module, all-lakes expansion from the WDFW lowland lakes layer.
Phase C: push notifications for emergency rules and escapement spikes, shared crew trip planning.

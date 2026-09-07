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

## Phase B: shipped in v3.1.0 (Sept 2, 2026)

Three Vercel serverless functions live in the app repo under api/ and answer on the same origin, so the browser never has to reach wdfw.wa.gov (which blocks cross-origin reads). Each response carries s-maxage so Vercel's edge serves repeats, and the client caches every feed in IndexedDB (src/api/feeds.ts, src/store/feeds.ts) so lake, stream, and river sheets still show the last copy offline.

- /api/rules: parses the WDFW emergency rules RSS into structured items (title, link, action, effective date, species, location, rules text, reason, counties, kind open/close/change, water salt/lake/river/other). 22 items at ship time. Cached 30 min at the edge.
- /api/plants: parses the WDFW trout plants table (lake, county, region, date, species, number, fish per lb, hatchery). WDFW lists only the last few weeks, so the list is short (7 rows at ship). Cached 1 hour.
- /api/escapement: finds the newest two weekly escapement PDFs on the WDFW hatcheries page, extracts positioned text with pdfjs-dist (legacy build, includeFiles in vercel.json, 60 s and 1 GB function), and rebuilds the rotated table: species sections sit side by side along x, each anchored by a "Facility" label, facilities are columns, two-line row labels ("Adult" + "Total") merge by y proximity, comments sit between the Date row and the Comments label. Output: per species, per facility and stock rows with adult_total, jack_total, eggtake, on_hand adults and jacks, lethal and live spawned, released, live_shipped, mortality, surplus, date, comments, origin (H hatchery, W wild, M mixed, U unknown), plus prev_adult_total and delta against the prior week's PDF. Ship-time run: 153 rows, 16 species, 38 facilities, all 19 pages, every row dated. Cached 6 hours. debug=N returns raw text items for page N when the layout changes.

Client features in v3.1.0:

- Plan tab gains a Rivers segment (src/features/plan/RiversPlan.tsx) over a curated set of 45 Washington rivers (src/data/rivers.ts) with a USGS gauge id where one exists, the hatchery facility names that map to the escapement report, species, region (Puget Sound, Coast, Columbia, East), and a representative access point. The list sorts by distance from the Lakes start point, shows live cfs and water temperature from one batched USGS request, this week's top hatchery return with its weekly delta, and a count of emergency rules that name the river. Expanding a river shows the 30-day median and 7-day trend, all returns by species, matched rules, and Show on map / Directions / WDFW rules buttons.
- More tab gains an Emergency rules section with All / Rivers / Lakes / Saltwater chips.
- Lake sheet shows matching emergency rules and recent trout plants for that lake. Lakes list gains a "Stocked lately" filter chip.
- Stream sheet shows emergency rules that name the stream.
- Service worker: /api is NetworkOnly and excluded from the SPA navigate fallback.

Matching is by significant name words plus county (src/api/feeds.ts nameTokens, rulesFor, plantsFor). Facility names in rivers.ts must match the report text exactly (upper case, e.g. "MINTER CR HATCHERY"); add new ones when WDFW adds a facility.

Known limits: gauge ids in rivers.ts are curated by hand and resolve live, so a wrong or retired id shows "no gauge data" rather than a number. Rivers without a WDFW facility show no returns. The plants feed only covers what WDFW lists on its recent-plants page.

Deploy note: the sandbox cannot push to GitHub. Seri drags the repo folder onto github.com/Supaman45/wa-crappie-lakes/upload/main; Vercel builds main. API iteration happens on preview deployments in the same project (share links needed because previews are SSO protected).

Next (Phase C candidates): saltwater module (marine area rules from the same feed, shore sites, crabbing), all-lakes expansion from the WDFW lowland lakes layer, push alerts for rule changes and escapement jumps on favorite rivers, repo cleanup of stray v2 files.

## v3.2.0: every WDFW lake (Sept 7, 2026)

Seri looked for Ward Lake (Olympia) and the app did not have it, because the dataset was the 134 crappie lakes from v2.5. src/data/lakes.json now carries every lake in the WDFW FishWA service: 653 lowland lakes (layer 2, with species from the 15 per-species layers 4 to 18, ramp yes/no, shoreline access, management emphasis) and 1,080 high lakes (layer 21, hike-in alpine lakes with the stocking program label and species list). 1,733 lakes total, 276 KB compact JSON, loaded by src/data/lakes.ts. The original 134 keep their slugs (matched by normalized name and county, distance as fallback, all 134 verified) so existing catches, visits, and tags still resolve.

Lake fields added: kind (lowland or high), ramp, shore, mgmt, wdfw id. Species ids added: brown, tiger, golden, kokanee, laker, cutbow, walleye, muskie, perch, bluegill, pumpkinseed, bullhead.

Boat fit (src/domain/boatFit.ts) reads ramp, launch motor rules, and acres and answers which of Seri's boats fits: "17 ft gas boat" (ramp, motors not banned, 40+ acres), "Electric boat" (ramp but no gas motors or small water), "Shore or car-top", or "Hike-in". Lakes list gains chips for 17 ft boat, Electric boat, Hike-in lakes (high lakes are hidden until this is on), a size select (under 25, 25 to 200, 200+ acres), and lists the first 300 matches. Lake sheet gains a Your boats section with the fit, WDFW ramp, shore access, and management emphasis. Plan tab forecasts only lowland lakes.

Regenerating the dataset: query the ArcGIS layers listed above (no pagination support; page by OBJECTID ranges), then rebuild lakes.json with the compact keys documented in src/data/lakes.ts. scripts/ensure-assets.mjs no longer rebuilds lakes.json from the v2 repo.

## v3.3.0: basemaps, mobile-first pass, hikes to fishing lakes (Sept 7, 2026)

Basemaps: Topo (Esri World Topo, the new default), USGS Topo, Streets (OpenStreetMap), Terrain (OpenTopoMap), Satellite (Esri imagery with a place-label overlay), and Dark (Seri's least favorite, kept last). The choice is remembered per device (localStorage wff-basemap). All are keyless; USGS tiles are cached by the service worker like the others.

Mobile first: Lakes tab filters collapse behind a Filters button (count badge) on phones, with search, sort, and Near me always visible. Inputs use 16 px text so iOS does not zoom on focus; chips, buttons, tabs, list rows, and Leaflet controls meet a 36 to 44 px touch height; sheet footer buttons split into two columns; the Plan mode bar wraps on narrow screens. The existing bottom nav, panel/map toggle, and safe-area padding stay.

Hikes: src/api/trails.ts pulls named trails (highway=path or footway with a name, not informal) from OpenStreetMap through Overpass for a bounding box, merges ways by name, computes miles, and falls back to the USFS National Forest System trail layer if Overpass fails. src/domain/hikes.ts pairs trails with lakes whose shoreline (radius from acreage) is within 0.15 mi of a trail vertex and picks the trail end farthest from the lake as the trailhead. Effort: short (3 mi or less), moderate (6 or less), long. Plan tab gains a Hikes segment: trails to fishing lakes within about 35 miles of the start point, chips for Short, Under 6 mi, Any, High lakes only, with Map, Lake, and Trailhead directions. Map: a Trails overlay (on by default, Lakes mode, zoom 12 and up) draws trails, thicker where a trail reaches a lake, with a popup naming the lakes and a trailhead link. Lake sheet: hike-in lakes and lakes without a ramp get a Trails section that searches 2 km around the lake. Trail data is cached 7 days in IndexedDB.

Known limits: trail miles are the length inside the search box, so a through-trail overstates the walk to the lake; the trailhead is a geometric guess (far end of the trail); OSM sac_scale is shown when tagged. No elevation gain yet (would need a DEM lookup).

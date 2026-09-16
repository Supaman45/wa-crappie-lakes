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

## v3.4.0: Sonar design system (Sept 7, 2026)

Seri picked "Sonar" from eight theme mockups (two artifact pages: Fish Finder Four Ways, Fish Finder Four More Ways). The look is a marine electronics screen: ink-black water ground (#06101A), navy panels (#0C1B29), cyan (#3AD0FF) for labels and section titles, yellow (#FFD24A) for readouts and the active tab, one hot orange (#FF8A1F) for the primary action and selected filter chips, green (#5FE38A) for good, 4 to 6 px corners, 1 px rules. Type: IBM Plex Sans Condensed (uppercase names and buttons) and IBM Plex Mono (every number, label, and meta line), loaded from Google Fonts in index.html with system fallbacks. All tokens live in src/styles/app.css; class names did not change, so every component picked up the system.

Component changes: Lakes tab gets a readout header (LAKES plus the next solunar major as "bite window"); each lake row carries a readout (distance in miles when a start point is set, otherwise acres) with the boat fit under it, and a species color stripe instead of a dot; on phones tapping a row opens the lake sheet directly. The lake sheet gets a sonar-style seven-day bite strip (src/components/Sonar.tsx, a filled curve from yellow to orange to dark, peak day labeled) and four gauges (Bite, Wind, Rain, Boat) above the day rows. Legend moved inside the Filters block on phones, header shrinks on phones.

Bug fixed on the way: with a remembered account and no signal, the app signed itself out on cold start because Supabase's initial null session event fired after the optimistic offline sign-in; the handler now keeps the session when offline and a hint exists.

## v3.4.2: place and ZIP lookup, tab persistence (Sept 7, 2026)

ZIP and place lookups now go through /api/geocode (Zippopotam for ZIPs, Nominatim bounded to Washington for places) so the request carries a proper User-Agent; installed PWAs and some phone browsers send no Referer and Nominatim refuses those with a 403, which showed in the app as a lookup error. The client falls back to the direct calls if the function is unreachable. The ZIP or place field is now a form with a Go button, so phone keyboards submit it and there is a tap target besides the return key. Error text names the problem (no such place in Washington, ZIP not found, location permission denied).

The active tab is written to the URL hash (#lakes, #creeks, #plan, #log, #more), so a refresh, a bookmark, or the back button lands on the same tab. The Plan tab remembers its segment (Lakes, Rivers, Hikes, Surf) in localStorage.

## v3.4.3 and v3.5.0: boot guard, home-screen install (Sept 7, 2026)

Boot guard: sb.auth.getSession() races a 7 s timeout; on timeout with a remembered account the app opens on cached data and picks up the real session from onAuthStateChange. The boot screen reads "Starting" and offers "Clear cache and reload" after 4 s. index.html carries a plain-script fallback: if the bundle has not replaced #boot-fallback in 10 s, it shows the same reset button (unregisters service workers, clears caches, reloads with a cache-busting query).

Install: new icons in the Sonar palette (public/icon-192.png, icon-512.png, apple-touch-icon.png 180 px opaque; square so iOS and Android maskable both look right), manifest start_url /#lakes with id "/". src/features/more/Install.tsx captures beforeinstallprompt and shows a real Install button on Chrome, Edge, Samsung, and desktop Chrome; on iPhone it gives the exact Safari taps (Share, Add to Home Screen, Add); it hides once running standalone. The Lakes tab shows a one-time dismissable banner on phones; More has the full guide.

## v3.5.1: phone crash on ZIP, place, and Near me (Sept 7, 2026)

Cause: on phones the map container is display:none while the list shows, so its size is 0 by 0. Setting a start point (ZIP, place, Near me on Lakes or Plan Hikes) made the map flyTo the origin on that hidden container; Leaflet computed NaN coordinates and threw "Invalid LatLng object: (NaN, NaN)", which the error boundary showed as "Something broke". Fix in MapView: every view change goes through goTo(), which animates when the map has a size and otherwise stores a pending view that the ResizeObserver applies the moment the map is shown; the viewport tracker, the active-lake popup, fly requests, and the origin marker are all guarded. Also: attribution bar restyled small and dark, zoom buttons hidden on phones (pinch to zoom) so they stop overlapping Start trip.

## v3.6.0: Coast Watch and push alerts (Sept 7, 2026)

Why: Seri fishes the drive-on beaches at Ocean Shores and Copalis and asked how to stay on top of changes there.

Coast Watch card, top of Plan > Surf:
- Beach driving status computed on the phone from WAC 352-37-060 (src/domain/coast.ts): seven North Beach segments, six closed to vehicles April 15 through the day after Labor Day, Benner Gap to the Copalis River closed all year. Shows open or closed today, the flip date, days left, the segment list (auto-collapsed when everything is open), and the strips you can drive all year. Works offline.
- Emergency rules that name Marine Area 2, Grays Harbor, the North Beach towns, or Grays Harbor County rivers, from the existing /api/rules feed.
- Razor clams: the latest WDFW release headline and date, the dig window note, Copalis and Mocrocks dig dates, and the season notes.
- WDFW newsroom RSS filtered to coast items, North Beach first.
- City of Ocean Shores top alert banner plus recent news flagged for beach, access, jetty, or closure words.
- "N new since your last look": ids of everything shown are kept in localStorage (wff-coast-seen); anything not in that set gets a New badge and the readout counts them.
- Links to WDFW email lists and the city alert sign-up.

Server: api/coast.js (razor page parser keyed on the first h2 after the h1, newsroom RSS, osgov.com newslist JSON dataSource, top_alert_detail post block; debug=razor|os|alert|news), cached 30 min, IndexedDB key feed:coast.

Push alerts (More > Coast alerts):
- Supabase tables push_subscriptions (RLS: own rows) and watch_state (service role only). Migration push_alerts applied.
- public/push-sw.js is pulled into the generated service worker with workbox importScripts; handles push and notificationclick (opens /#plan).
- Client (src/features/more/Alerts.tsx): support check (iPhone needs the home-screen install), permission, pushManager.subscribe with the VAPID key from /api/push-key, row upsert through the user's own Supabase session, device list with remove, Send a test (POST /api/push-test with the Supabase access token).
- api/watch.js runs daily by Vercel cron (0 15 UTC, 8am Pacific): collects the same items as the card, compares ids with watch_state, pushes "Coast Watch: N updates" with the top three, and beach driving alerts on April 15, the reopen day, and three days before each. First run only records state. ?dry=1 shows what it would send.
- Env vars the user sets in Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET. /api/push-key reports which are missing and the Alerts section says so.
- Note: Vercel deployment protection is "all except custom domains", so preview URLs need a share link.

## v3.6.1: your approach (Sept 10, 2026)

Coast Watch gains a "Your approach" picker (12 North Beach approaches, Damon Rd to Moclips 2nd St, remembered in localStorage wff-coast-approach, default Heath Rd at Copalis Beach, Seri's usual spot). For the chosen approach it says what you hit driving north and south off the ramp: open all year, the seasonal segment with its reopen date, or the all-year closure. Data in src/domain/coast.ts APPROACHES and approachWay().

## v3.6.2: approach coordinates and a Directions button (Sept 10, 2026)

The v3.6.1 approach list carried no coordinates and a first attempt at name-based Google Maps links ("Heath Rd Beach Approach, Copalis Beach, WA") failed on the phone with "Can't seem to find a way there" — Google does not resolve those names. Fix: every approach now carries the lat/lng of the seaward end of its approach road, read from OpenStreetMap way geometry through Overpass (westernmost node of the named way). Heath Rd resolves to 47.111291, -124.179592, which Google renders as 29 Heath Rd, Copalis Beach, 1 hr 49 min from Lakewood, and sits 344 m inland of the OSM coastline, so the pin is where the asphalt ends and the sand starts.

Coast Watch "Your approach" gains a Directions button that opens that point. Approaches with a verified pin: Marine View Dr, Taurus Blvd, Ocean Lake Approach, Pacific Blvd NW, Chance a la Mer (Ocean Shores); Heath Rd, Benner Rd (Copalis Beach); Roosevelt Beach Rd; Analyde Gap Rd (Pacific Beach); 2nd St (Moclips). The Ocean City access has no clean OSM road, so it falls back to the place name Ocean City State Park via the new dirUrlQ() helper. Butter Clam and Damon Rd were dropped rather than shipped with a guessed pin: OSM shows neither reaching the sand at the point the WAC describes.

## v3.6.3: walk-in approaches (Sept 10, 2026)

Heath Rd is not a drive-on. Street View and the OSM geometry both show the pavement barricaded at 47.1113, -124.1796 with a wooden boardwalk and a sand path running the last 150 yards to the beach, and Seri confirmed he parks there and walks in. Approach gains `access: 'drive' | 'walk'` plus `walkNote`, and Heath Rd is marked walk-in.

Behavior for a walk-in approach: approachWay() stops applying the WAC segments, because those close the sand to motor vehicles and not to people on foot; the card labels the two directions Right and Left instead of North and South, since that is how you read them standing on the beach facing the water; the Directions button says "Directions to the parking"; and a line under it says the beach driving dates above do not gate you there.

Heath Rd right-hand note carries the two distances worth knowing on foot, both measured from OSM geometry: Benner Gap is a quarter mile up the beach, and past it no vehicle is allowed all year for the 1.83 miles to the Copalis River mouth at 47.14085, -124.18541.

## v3.6.4: boat launch matching (Sept 14, 2026)

Seri reported Fivemile Lake and Trout Lake, two different King County lakes, both showing "Lake Killarney" as their boat launch, 1.2 and 1.7 miles from the lake.

Two bugs in matchLaunches, both from gates that ignored the size of the lake. The county-only rule scored any launch in the same county within 5 miles with no name check at all, so a small lake with no ramp of its own grabbed whatever ramp was nearest; that is the Killarney case. Separately the distance gate was bypassed entirely for a name match under 45 miles, and Washington repeats lake names, so Silver Lake in Pierce County was matched to a Silver Lake ramp 44.2 miles away, Fish Lake to Fish Lake E at 40.8, Cavanaugh Lake to Lake Cavanaugh at 39.2.

Fix: a launch has to plausibly sit on the water. gate = max(0.4, r*2 + 0.2) where r is the radius of a circle of the lake's acreage; a launch named after the lake and in the right county gets nameGate = max(gate, min(0.75 + r*3, 3.5)) because long skinny lakes put the ramp well off the centroid. A first pass marks every launch that a lake claims by name, and the county-only path skips those, so Riffe Lake stops claiming Swofford Pond and Lake Tapps stops claiming Bonney Lake.

Measured against the live WDFW launch layer (397 launches) across all 1,733 lakes: lakes showing a launch drop from 467 to 230, and matches further than a mile from their lake drop from 222 to 14. The 14 that remain are large waters where the ramp is genuinely on a distant arm (Banks Lake to Barker Canyon, Lake Pateros to Bridgeport Bar, Potholes to Medicare Beach). Verified that correct matches survive: American Lake, Ward Lake, Tanwax, Offutt, Black Lake, Clear Lake, Ohop, Silver Lake in Cowlitz. Both reported lakes now show no launch, which is right, since the WDFW layer has no launch on either.

## v3.6.5: non-WDFW ramps, trails on request (Sept 15, 2026)

Alder Lake showed no boat launch. Cause: every launch in the app came from the WDFW Major_Fishing_Area layer, which only covers WDFW's own water access sites. Alder's ramps all belong to Tacoma Power, so WDFW lists none, and the FishWA Water Access Sites layer returns nothing in that box either. This predates the v3.6.4 matcher change; the old matcher found nothing on Alder as well.

Two fixes. src/data/launchesExtra.ts holds ramps keyed by lake slug rather than matched by distance, because a long reservoir puts its ramp miles from the centroid: Alder Lake Park sits 4.0 miles out and Sunny Beach Point 3.1, both past any sane geometric gate. Keying by slug is an assertion that the ramp is on that lake, made by hand instead of by guess. Alder Lake Park (46.800368, -122.300309) and Sunny Beach Point (46.799404, -122.278613) are in, both Tacoma Power, both with the fee note. The lake sheet renders every curated ramp with its operator and its own Directions button.

Second, when a lake has no launch record but WDFW's lake layer flags a ramp, the sheet now says so plainly and offers Directions to the lake and the WDFW page, instead of the old flat "no launch matched". That covers every city and county ramp statewide, not only the ones curated.

Trails are opt-in. Opening a lake used to fire an Overpass query on any high lake or lake without a ramp; now the Trails section shows a "Look for trails to this lake" button and loads nothing until it is tapped, resetting per lake. The map's Trails overlay defaults off and remembers the choice in localStorage wff-show-trails, and the layer is no longer added to the map at startup. Verified with a phone-sized render: opening Alder Lake and Fivemile Lake makes zero trail requests.


## v3.6.6 and v3.6.7: city and utility ramps statewide (Sept 15, 2026)

v3.6.5 hand-entered Alder Lake only. This finishes the job for the whole state.

Source: OpenStreetMap slipways (leisure=slipway and waterway=slipway) pulled across all of Washington through Overpass in bands, 1,662 points inside the state after dropping the Oregon side of the Columbia. Overpass shed load repeatedly during the pull and had to be retried with backoff; v3.6.6 shipped with only the southern and central bands, and v3.6.7 completes it with north Puget Sound, the Olympic Peninsula, the San Juans, northeast Washington and the southeast corner.

Those points were matched against all 1,733 lakes with the same size-aware distance gates launchMatch uses, and the 141 lakes that matched are frozen into src/data/launchesExtra.ts keyed by slug. Freezing the match means no extra network call, no extra matching at runtime, and it works offline. Only the 122 points that matched a lake ship, so the file is 31 KB rather than the full 1,662.

Measured across all 1,733 lakes: lakes with a boat launch go from 230 to 360. Lakes WDFW flags as having a ramp but that had no launch record drop from 119 to 60, and those 60 fall back to the honest "WDFW lists a ramp but no site details" card from v3.6.5.

Alder Lake lists three ramps: the unnamed OSM ramp 0.4 miles off the centroid, which is the one actually on the water, plus Alder Lake Park and Sunny Beach Point, both Tacoma Power, both carrying the fee note.

Known limits. A few adjacent small ponds share one nearby ramp (Fort Borst and Hayes, Hanson Upper Pond and Kiwanis), which is geometrically defensible but worth a look if either is ever wrong. Most OSM ramps carry no name and render as "Boat ramp". Sixty ramp-flagged lakes still have no coordinates.

One bug caught during the work: the analysis script read the wrong property for lake acreage, so every lake got a flat 0.4 mile gate and the first measurement understated the gain. The shipped launchMatch was never affected.


## v3.7.0: River Watch, the Puyallup (Sept 16, 2026)

Seri fishes the Puyallup in Pierce County with friends. The river is co-managed with the Puyallup Tribe under the Boldt decision, the tribe nets the lower river on scheduled days, and the crew does not fish those days. Two calendars, and neither one is in the app. This card merges them.

### What it answers

One question, at the top of the Rivers tab: can I fish today, and are the nets in? The verdict is one of three.

- `go` open to you, no nets in the section you picked
- `nets` open to you, but the tribe is fishing the water you are standing in
- `closed` the sport season is shut that day

When the verdict is `nets`, the card names a section of the same river that is open and carries no nets, because on the Puyallup there always is one: nets are set only from the White River confluence down to the mouth, so everything above Sumner is clear.

### Where the numbers come from

Sport season, boundaries and limits are WAC 220-312-040, cross-checked line by line against the recreational rows of the 2026-2027 Co-Managers' List of Agreed Fisheries. Four sections, three sharing one calendar:

- 11th St Bridge to Clarks Creek, Clarks Creek to East Main Bridge, East Main Bridge to the Carbon: Aug 19 to Sept 30 Wednesday through Saturday only, Oct 1 to 31 daily, closed after Oct 31.
- Above the Carbon: Saturday before Memorial Day through Jan 15, selective gear.

The Sunday-through-Tuesday closure through Sept 30 is the tribal net window, so through September the two calendars do not collide at all. October is when they do, on Oct 4 to 6 and Oct 11 to 13.

Net windows come from Puyallup Tribe filing 12-2026/2027, "Puyallup River Coho 2nd", adopted Aug 20 and posted Sept 14: noon Sunday to noon Tuesday, five weeks, Sept 13 through Oct 13. Gear and catch area are in the same filing. The White River gillnet (Sunday through Friday, Aug 30 to Oct 11, confluence to R St Bridge) rides along as a side note.

### Why the windows are curated rather than parsed

The dates live inside PDFs, one per opening. Parsing those on Vercel means shipping a PDF text extractor and trusting it against a Word-generated file it has never seen, with silent garbage as the failure mode. Instead the windows ship as data in `src/domain/river.ts`, each tagged with the filing it was read from, and `/api/river` watches the page they came from.

`api/river.js` parses the tribe's Harvest and Regulations page. The page is one `<dl class="accordion">`: a `<dt>` with the filing's title, then a `<dd>` with the PDF link and a "Posted on:" line. Every anchor reads "View and Download PDF", so the title has to come from the `<dt>`, not the link text. The site links its own uploads over http, so URLs are upgraded to https. Marine and shellfish filings are filed on the same page and are dropped.

The page also keeps several seasons of archive, so `newFilings()` only counts a filing as news when it was posted on or after `readOn` (the day the windows were read by hand), or when it sits above every known filing in the page's reverse-chronological order. Without that rule, twelve 2025 filings would fire as new on first load.

When a new filing appears, the card says the schedule may have moved and links straight to it rather than pretending to know the new dates. `api/watch.js` applies the same rule and pushes "River Watch: the Puyallup schedule may have moved", separately from the Coast Watch notification, and also watches emergency rules naming the Puyallup, White, Carbon or Pierce County.

### Guards against going stale

- `netState().stale` is true once every shipped window and pending note is behind us. The card then says "Open to you. Net schedule unknown." rather than implying clear water. Verified for Dec 2026, Jan 2027 and Aug 2027.
- The above-Carbon opener is "the Saturday before Memorial Day", which moves. It is computed from the last Monday in May rather than hardcoded. Verified: 2026 opens May 23, 2027 opens May 29.
- The co-managers' chum fisheries (test one day a week from the week of Oct 18, commercial one to three days a week from the week of Nov 1 to the week of Dec 27) ship as `pending` notes with no invented dates, since the tribe files those week by week.

### Verification

The `filings()` parser was run in-page against the live tribe site: 33 items, 30 dated, titles correct, marine filings excluded, all URLs https. The same parser was then run from the repo against a fixture built from that live markup, confirming zero false alarms today and exactly one alert when a hypothetical chum filing goes up.

Domain logic was exercised at ten pinned timestamps covering the open, the nets, the overlap, the closed season and the year wrap. The card was rendered at 390x844 with the clock pinned twice: Sept 16 shows "Open, and the nets are out" with the next window flagged, and Oct 4 shows "Open, but nets are in your water" naming the upper section as the clear alternative.

### Known limits

- Net windows are hand-read from the filings and carry `readOn: '2026-09-16'`. Next season they need re-reading; the stale guard makes that visible rather than silent.
- Only the Puyallup is modeled. `WATCH_RIVERS` takes more, and the card takes a `riverId`.
- One pre-existing fragility surfaced while testing: `RiversPlan` reads `esc?.latest.species`, which throws if `/api/escapement` ever returns a body without `latest`. Not introduced here, not fixed here.


## v3.8.0: the log, rebuilt around one tap (Sept 16, 2026)

The old catch form asked for twelve fields. Nobody fills twelve fields standing in a river with a fish in one hand, so the log stayed empty and the app learned nothing from it. This rebuilds entry around the smallest thing that is still worth recording, and adds the two structures that make a log pay you back: trips, and a Catch Record Card.

### One tap logs a fish

`QuickCatch` renders species as chips. Tapping one saves a catch. Everything else the app already knows and fills silently: water, calendar day, clock time, the active trip, and a conditions snapshot. Length, weight, bait, depth, structure and photo are edits you make later from the couch through the existing form, which is still there behind a "Full form" button.

Chip order is the whole trick. What you logged most recently comes first, then what WDFW lists for that water, then the rest behind a "More" button. Six fit above the fold on a phone. The lake sheet passes `lake.sp`, the river detail passes `r.sp`, so the Puyallup opens on Chinook, Coho and Steelhead rather than on crappie.

Mounted in three places: the lake sheet, the river detail in Plan > Rivers, and the top of the Log tab while a trip is running.

### Trips

`src/store/trip.ts` holds the trip you are on right now, in localStorage rather than the database. A trip is worthless until it ends, the phone is usually out of signal while it runs, and a half-written row syncing to the crew mid-morning helps nobody. On End it goes through the normal `saveTrip` path so the offline outbox handles it like everything else.

Catches logged during a trip carry its `trip_id`. A trip with no fish still saves, and says so ("Trip saved, no fish. That counts too."), because three hours on Ohop with nothing is exactly what you want to know next year and it only exists if the blank session gets recorded.

A trip still open the next morning is stale. Rather than recording an eighteen hour session, the card says so and offers "End at last fish", using the timestamp of the last catch attached to it.

### Conditions snapshot

`src/api/conditions.ts` captures air temperature, wind speed and direction, surface pressure, the three hour pressure trend, cloud, precipitation and moon illumination at the moment of logging, plus flow and water temperature when the water has a USGS gauge.

Stored on the row rather than looked up later. Forecasts get revised and archives cost money; a fish logged in 2026 has to still carry the barometer it was caught on in 2029 or the pattern work is built on sand. The call is warmed when the panel mounts and re-warmed after each save, so the tap itself never waits on the network, and every failure path returns a partial snapshot instead of throwing. No signal means a fish with no conditions, which is still a fish.

### Catch Record Card

WDFW requires a card for salmon, steelhead, sturgeon and halibut, and a retained fish must be recorded before you carry on fishing. `src/domain/crc.ts` and `CrcCard.tsx` mirror that card.

This is a mirror, not a replacement, and the UI says so on the card itself. WDFW runs its own electronic card in the MyWDFW and Fish Washington apps as of the 2026-2027 license year, and a paper card is still legal and still due back April 30. What this adds is the same rows in the same order, so copying across takes seconds and a season's record survives a card left in a wet coat.

- Only a KEPT fish of a card species appears. Released fish are excluded, which is the actual rule.
- Logging a card species triggers the only extra prompt in the whole flow: kept clipped, kept wild, or released. It is a legal record, so the app asks rather than guesses.
- Catch area codes are filled from a table of WDFW's three-digit freshwater codes for the waters the app points at: Puyallup 804, White/Stuck 808, Carbon 802, Nisqually 786, Green/Duwamish 746. An unknown water leaves the field blank and tappable rather than guessing a code onto a legal document.
- Totals are counted on the license year, April 1 to March 31, not the calendar year, because that is how the card is filed.
- "Write these in" lists fish from today and yesterday in card column order. "Needs an answer" lists card species logged without kept or released. The season total flags rows still missing an area code or a clip.
- A due-date banner appears inside 45 days of April 30. CSV export for the whole year.

### Schema

One additive migration, `log_redesign_trips_crc_conditions`, applied to the live project. Every column is nullable or defaulted, so rows written by older clients stay valid and an older client still works against the new schema.

`catches` gained `trip_id`, `caught_at`, `cond`, `kept`, `clipped`, `catch_area`, `lat`, `lng`, `share_spot`. `trips` gained `water_id`, `water_name`, `water_type`, `spot_id`, `cond`, `open`. Indexes on `catches(trip_id)`, `catches(user_id, date desc)` and a partial index on open trips.

`share_spot` defaults to false, per Seri's call on privacy: the crew sees the water and the fish, not the pin, unless the person who caught it decides otherwise. The column ships now; the crew-facing read that honors it is the next piece of work.

`updateCatch` was added to the data store so details can be added after the fact. It rewrites a queued insert rather than stacking an update behind it when the catch is still in the outbox.

### Verification

CRC logic tested against a hand-built set covering a kept fish, a released fish, a non-card species, a fish from the previous license year, and a fish on a water with no known area code: three rows on the card, correct totals, correct missing-field counts, license year rolling correctly in February, deadline window firing only inside 45 days.

Rendered at 390x844 and driven end to end offline: open Plan > Rivers, open the Puyallup, tap Coho, the save goes to the outbox, the Catch Record Card prompt fires, answering "Kept, clipped" puts the fish on the card with area code 804 already filled in, and the Log tab shows it under "Write these in". No page errors.

### Known limits

- Patterns from the logged conditions are not built yet. The data is being captured now so that work has something to run on later.
- The crew view still shows what it always showed; `share_spot` is stored but not yet read.
- `RiversPlan` still reads `esc?.latest.species`, which throws if `/api/escapement` ever returns a body without `latest`. Noted in v3.7.0, still not fixed.


## v3.9.0: a public domain and an invite gate (Sept 16, 2026)

wafishfinder.app is live and pointed at the project. The Vercel project runs SSO protection at `all_except_custom_domains`, so the vercel.app URL stays behind Vercel's login and the custom domain does not. The app is now reachable by anyone with the link, which is the point, and which is why signup had to close the same day.

### The gate

Migration `invite_codes_gate`. A `public.invite_codes` table keyed by code, carrying a label, an expiry, a use count against `max_uses`, a revoked flag, and a `used_by` array for the audit trail. RLS gives the creator full access to their own rows and nobody else anything.

Two layers, and only one of them counts:

- `public.invite_is_valid(text)`, SECURITY DEFINER, granted to anon. The Gate calls it so a bad code fails in a second with a clear message instead of a round trip and a generic auth error. This is UX.
- A BEFORE INSERT trigger on `auth.users` running `public.enforce_invite()`. It reads the code out of `raw_user_meta_data->>'invite'`, locks the row `FOR UPDATE`, rejects on missing, unknown, revoked, expired or used-up, and otherwise increments `uses` and appends the email to `used_by`. Because it runs inside the signup transaction, an account cannot come into existence without a live code regardless of what the client does.

The client passes the code through `signUp(email, password, invite)` as `options.data.invite`.

Verified against the live database: signup with no code rejected, signup with an unknown code rejected, neither leaving a row behind; a valid code accepted, consuming exactly one use and flipping the code invalid afterwards, then rolled back. `invite_is_valid` is case-insensitive and trims, so a code read off a text message works.

### Handing codes out

`src/features/more/Invites.tsx`, in the More tab. Name a friend, tap New code, and it generates something readable but unguessable (a word plus six characters from an alphabet with I, O, 0 and 1 removed, drawn from `crypto.getRandomValues`), defaults to one use and 90 days, and opens the share sheet with the link and the code already written out. The list shows uses left, days left, who redeemed it, and a Revoke button that kills a code that went astray.

Two codes were seeded by hand to start: `ZAKI-PUYALLUP` for Zaki, one use, and `CREW-COPALIS`, three uses, both expiring in 90 days.

### Also

The Add to Home Screen card told people to open wa-crappie-lakes.vercel.app, which now lands on a Vercel login wall. It says wafishfinder.app.

### Known limits

- Rate limiting on `invite_is_valid` is whatever Supabase gives the anon role by default. The code space is large enough that this is not a practical concern at this scale, but it is not hardened against a determined attacker.
- Revoking a code does not remove an account already created with it. Delete the user in Supabase for that.
- The repo, the Vercel project and the Supabase project are all still named wa-crappie-lakes. Cosmetic, and renaming the Vercel project would change the vercel.app URL, so it was left alone.

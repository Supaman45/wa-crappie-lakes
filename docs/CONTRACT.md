# Feature build contract (read fully before writing code)

Project: /root/wa-fish-finder (Vite 7 + React 18 + TypeScript strict, Leaflet, Supabase, Dexie, Zustand 5).
Path alias: '@/...' maps to src/. No UI framework; use the CSS classes in src/styles/app.css (read it). No innerHTML anywhere; React renders all strings.
User preference for copy: plain, direct English, no em dashes anywhere (use commas or periods), no exclamation marks.

## Core modules you consume (do not modify these files; if you need a change, note it in your final report)
- src/lib/types.ts: Lake, Catch, Visit, Trip, LakeTag, Profile, Spot, Forecast, WaterType, SpeciesId
- src/lib/util.ts: haversine, acreFmt, todayStr, fmtDate, fmtClock, uuid, dirUrl, mapUrl, wdfwLakeUrl, scoreColor, downscale, cToF, clamp
- src/lib/supabase.ts: sb (client), photoUrl(path)
- src/lib/toast.tsx: toast(text, 'info'|'warn'|'err')
- src/lib/db.ts: tagKey(userId, lakeId), kvGet/kvSet
- src/data/lakes.ts: LAKES (Lake[] with id=index, slug), LAKE_BY_SLUG, COUNTIES
- src/data/species.ts: SPECIES, spById, speciesColor(id), speciesLabel(id), LAKE_SPECIES, CREEK_SPECIES, CATS, SWATCHES, BAITS, STRUCTURE
- src/store/auth.ts: useAuth (status, userId, email, signOut)
- src/store/data.ts: useData with catches, visits, trips, tags (Record key user:lake), profiles (Record id), spots, index (Record<lakeSlugOrSpotId, LogStats{visits,catches,sp,top,lastDate}>), outboxCount, stuckCount, online, syncing, and actions saveCatch(partial, photoBlob?), deleteCatch(id), logVisit(lakeId, lakeName, waterType?, spotId?, date?) -> boolean (false if already logged today), setTag(lakeId, patch), saveTrip(partial), saveSpot(partial), updateSpot(id, patch), deleteSpot(id), updateProfile(name, color?), myTag(lakeId), crewTags(lakeId), refresh(), flush(). Also currentUserId().
- src/store/ui.ts: useUI with tab, mobileView, mapMode, origin {lat,lng,label}, activeLakeId, sheet, creekSpecies (string[] of app species ids), and actions setTab, setMobileView, setMapMode, setOrigin, setActiveLake(id) (opens the lake popup on the map), openSheet(sheet), closeSheet(), fly(lat,lng,zoom?), setCreekSpecies. Sheet variants: {kind:'lake',lake} | {kind:'catch',lakeId,lakeName,waterType,spotId?} | {kind:'catchView',catchId} | {kind:'stream',pick:StreamPick} | {kind:'spot',spot} | {kind:'profile'} | {kind:'trip',tripId}.
- src/features/lakes/store.ts: useLakes (q, county, sort, species, cat, flags{fav,wish,ramp,motor,visited,caught,crew}, launches Record<slug,Launch>, launchStatus, setters, toggleFlag) and filterLakes() (returns Lake[] using current filters; call it inside a component that subscribes to the relevant store fields so it re-runs) and lakeDistance(lake).
- src/features/creeks/store.ts: useCreeks (bbox, zoom, streams, barriers, gauges, access, loading, error, showBarriers, showGauges, showAccess, onlyDocumented, toggle(k)), CREEK_MIN_ZOOM, swifdNamesFor(ids).
- src/api/openMeteo.ts: lakeForecast(lat,lng,signal) 3-day cached, multiForecast(points, signal) 7-day, sunWind(lat,lng,days)
- src/api/tides.ts: fetchNoaaTides(), fetchModelTides(), SURF_SITE, Tide
- src/api/geocode.ts: resolveZip(zip), geocodePlace(q), locateMe()
- src/api/usgs.ts: gaugesInBox(bbox), gaugeHistory(id, days) -> {dates, cfs, tempC}, Gauge
- src/api/wdfw.ts: streamSpecies(llid), StreamSeg, Barrier, AccessSite, BBox
- src/domain/scoring.ts: dayScore(forecast, i) -> {score,w,p,t,c,moon} | null, whyText(x), solunar(date), solunarSummary(date) -> {majors:string[], minors:string[], illum}
- src/domain/surf.ts: tideWindows(tides), surfScore(window, wxDaily, dayIdx), dayIdx(date)
- src/domain/creekScore.ts: creekScore({rows, lat, lng, gauge, gaugeDist, gaugeMedianCfs, barriers, access}) -> {score, why, parts}
- src/domain/journal.ts: totals, monthHeat, leaderboard, records, insights, pairSuggestions(lakes, statsFn, tagFn), catchesCsv, visitsCsv, lakeSub(lake), shareText(filename, text)
- src/components/ui.tsx: Icon name (map, creek, plan, log, more, close, nav, pin, star, heart, plus, check, locate, search, layers, refresh, trash, camera, external, user, wave, gauge, barrier, list, share, trip), Sheet({title, sub, onClose, children, footer, wide}), Chip({on,onClick,children,color}), Field({label,children,full}), Score({n}), Empty.

## Zustand rule
Select primitives or stable references: useData(s => s.catches). Never return a new object/array literal from a selector (it loops). Derive arrays with useMemo in the component.

## Conventions
- Sheets close with useUI.getState().closeSheet(). Opening the catch sheet: openSheet({kind:'catch', lakeId, lakeName, waterType:'lake'}).
- A lake's log key is its slug; a spot's key is its id. useData().index[key] gives stats.
- Use fmtDate for dates, acreFmt for acres. Distances in miles with one decimal.
- Mobile first: panels scroll inside .panel-scroll; keep controls compact. Buttons: className "btn", "btn primary", "btn sm", "btn ghost", "btn danger", "iconbtn".
- Never use window.prompt/alert/confirm. Inline confirm state instead (a second click "Confirm delete").
- Empty states use <Empty>text</Empty>.
- After writing, run: cd /root/wa-fish-finder && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "src/features/<your folder>" ; fix every error in your own files. Errors in other folders belong to other agents; ignore them.

import type { Launch } from '@/lib/types';

/**
 * Ramps the WDFW launch layer does not carry.
 *
 * WDFW's Major_Fishing_Area layer only lists WDFW's own water access sites, so every lake whose
 * ramp belongs to a city, county, state park, or utility came back empty. Alder Lake is the case
 * that started this: its ramps are all Tacoma Power, so WDFW lists none of them.
 *
 * Generated from OpenStreetMap slipways (leisure=slipway and waterway=slipway) pulled for the
 * whole state, 1,662 points inside Washington, matched against all 1,733 lakes with the same
 * size-aware distance gates launchMatch uses, then frozen here by lake slug. Freezing the match
 * means the app makes no extra network call and does no extra matching at runtime, and it works
 * offline. Only the 122 points that actually matched a lake ship.
 *
 * Effect: lakes with a boat launch go from 230 to 360. Lakes WDFW flags as having a ramp but with
 * no launch record drop from 119 to 60. Those 60 fall back to the honest card in LakeSheet.
 *
 * To add one by hand, confirm the coordinates first and put it under the lake's slug. To
 * regenerate, re-pull the slipways and re-run the same match.
 */
export const EXTRA_LAUNCHES: Record<string, Launch[]> = {
  // Alder Lake
  'alder-lake': [
    { name: 'Boat ramp', hay: '', county: 'Pierce', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.77356, lng: -122.21863, operator: 'OpenStreetMap' },
    { name: 'Alder Lake Park', hay: '', county: 'Pierce', type: 'Concrete ramp', motor: true, ada: false, hp: '', lat: 46.800368, lng: -122.300309, operator: 'Tacoma Power', note: 'Campground and day use, fee' },
    { name: 'Sunny Beach Point', hay: '', county: 'Pierce', type: 'Concrete ramp', motor: true, ada: false, hp: '', lat: 46.799404, lng: -122.278613, operator: 'Tacoma Power', note: 'Day use, fee' },
  ],
  // Alta Lake
  'alta-lake': [
    { name: 'Boat ramp', hay: '', county: 'Okanogan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.02748, lng: -119.93556, operator: 'OpenStreetMap' },
  ],
  // Anderson Lake
  'anderson-lake': [
    { name: 'Boat ramp', hay: '', county: 'Jefferson', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.01785, lng: -122.80373, operator: 'OpenStreetMap' },
  ],
  // Angle Lake
  'angle-lake': [
    { name: 'Boat ramp', hay: '', county: 'King', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.42735, lng: -122.29278, operator: 'OpenStreetMap' },
  ],
  // Baker Lake
  'baker-lake': [
    { name: 'Boat ramp', hay: '', county: 'Whatcom', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.72705, lng: -121.6564, operator: 'OpenStreetMap' },
  ],
  // Baker Lake
  'hl-baker-lake': [
    { name: 'Boat ramp', hay: '', county: 'Whatcom', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.72705, lng: -121.6564, operator: 'OpenStreetMap' },
  ],
  // Ballinger Lake
  'ballinger-lake': [
    { name: 'Lake Ballinger Boat Launch', hay: '', county: 'Snohomish', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.78446, lng: -122.32624, operator: 'OpenStreetMap' },
  ],
  // Banks Lake
  'banks-lake': [
    { name: 'Boat ramp', hay: '', county: 'Grant', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.8635, lng: -119.11839, operator: 'OpenStreetMap' },
  ],
  // Bead Lake
  'bead-lake': [
    { name: 'Boat ramp', hay: '', county: 'Pend Oreille', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.28894, lng: -117.1101, operator: 'OpenStreetMap' },
  ],
  // Beaver Lake - Sammamish
  'beaver-lake-sammamish': [
    { name: 'Boat ramp', hay: '', county: 'King', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.58677, lng: -122.00031, operator: 'OpenStreetMap' },
  ],
  // Bennington Lake
  'bennington-lake': [
    { name: 'Boat ramp', hay: '', county: 'Walla Walla', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.06525, lng: -118.26376, operator: 'OpenStreetMap' },
  ],
  // Blackbird Island Pond
  'blackbird-island-pond': [
    { name: 'Trout Unlimited Boat Launch', hay: '', county: 'Chelan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.59212, lng: -120.65924, operator: 'OpenStreetMap' },
  ],
  // Bonaparte Lake
  'bonaparte-lake': [
    { name: 'Boat ramp', hay: '', county: 'Okanogan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.79273, lng: -119.05957, operator: 'OpenStreetMap' },
  ],
  // Boundary Reservoir
  'boundary-reservoir': [
    { name: 'Boat ramp', hay: '', county: 'Pend Oreille', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.85278, lng: -117.38573, operator: 'OpenStreetMap' },
  ],
  // Box Canyon Reservoir
  'box-canyon-reservoir': [
    { name: 'Boat ramp', hay: '', county: 'Pend Oreille', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.23597, lng: -117.20487, operator: 'OpenStreetMap' },
  ],
  // Browns Lake
  'browns-lake': [
    { name: 'Boat ramp', hay: '', county: 'Pend Oreille', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.43662, lng: -117.19559, operator: 'OpenStreetMap' },
  ],
  // Bumping Lake
  'bumping-lake': [
    { name: 'Boat ramp', hay: '', county: 'Yakima', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.86335, lng: -121.3024, operator: 'OpenStreetMap' },
  ],
  // Bumping Lake
  'hl-bumping-lake': [
    { name: 'Boat ramp', hay: '', county: 'Yakima', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.86335, lng: -121.3024, operator: 'OpenStreetMap' },
  ],
  // Carlisle Lake
  'carlisle-lake': [
    { name: 'Boat ramp', hay: '', county: 'Lewis', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.57821, lng: -122.72659, operator: 'OpenStreetMap' },
  ],
  // Chopaka Lake
  'chopaka-lake': [
    { name: 'Boat ramp', hay: '', county: 'Okanogan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.91703, lng: -119.7017, operator: 'OpenStreetMap' },
  ],
  // Chopaka Lake
  'hl-chopaka-lake': [
    { name: 'Boat ramp', hay: '', county: 'Okanogan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.91703, lng: -119.7017, operator: 'OpenStreetMap' },
  ],
  // Cle Elum Lake
  'cle-elum-lake': [
    { name: 'Wish Poosh Boat Ramp', hay: '', county: 'Kittitas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.28183, lng: -121.09195, operator: 'OpenStreetMap' },
  ],
  // Clear Lake
  'clear-lake-4': [
    { name: 'Boat ramp', hay: '', county: 'Yakima', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.62592, lng: -121.27056, operator: 'OpenStreetMap' },
  ],
  // Clear Lake
  'hl-clear-lake': [
    { name: 'Boat ramp', hay: '', county: 'Yakima', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.62592, lng: -121.27056, operator: 'OpenStreetMap' },
  ],
  // Coffeepot Lake
  'coffeepot-lake': [
    { name: 'Boat ramp', hay: '', county: 'Lincoln', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.5004, lng: -118.55549, operator: 'OpenStreetMap' },
  ],
  // Coldwater Lake
  'coldwater-lake': [
    { name: 'Coldwater Lake Boat Ramp', hay: '', county: 'Skamania', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.29224, lng: -122.26608, operator: 'OpenStreetMap' },
  ],
  // Coldwater Lake
  'hl-coldwater-lake': [
    { name: 'Coldwater Lake Boat Ramp', hay: '', county: 'Skamania', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.29224, lng: -122.26608, operator: 'OpenStreetMap' },
  ],
  // Columbia Park Pond
  'columbia-park-pond': [
    { name: 'Boat ramp', hay: '', county: 'Benton', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.222, lng: -119.13876, operator: 'OpenStreetMap' },
  ],
  // Conconully Lake
  'conconully-lake': [
    { name: 'Conconully Lake Boat Launch', hay: '', county: 'Okanogan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.56457, lng: -119.73053, operator: 'OpenStreetMap' },
  ],
  // Conconully Reservoir
  'conconully-reservoir': [
    { name: 'Boat ramp', hay: '', county: 'Okanogan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.54958, lng: -119.74773, operator: 'OpenStreetMap' },
  ],
  // Cooper Lake
  'cooper-lake': [
    { name: 'Boat ramp', hay: '', county: 'Kittitas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.42572, lng: -121.17329, operator: 'OpenStreetMap' },
  ],
  // Cooper Lake
  'hl-cooper-lake': [
    { name: 'Boat ramp', hay: '', county: 'Kittitas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.42572, lng: -121.17329, operator: 'OpenStreetMap' },
  ],
  // Cranberry Lake
  'cranberry-lake': [
    { name: 'Boat ramp', hay: '', county: 'Island', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.39897, lng: -122.66205, operator: 'OpenStreetMap' },
  ],
  // Crawfish Lake
  'crawfish-lake': [
    { name: 'Boat ramp', hay: '', county: 'Okanogan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.48461, lng: -119.21691, operator: 'OpenStreetMap' },
  ],
  // Curlew Lake
  'curlew-lake': [
    { name: 'Curlew Lake Boat Launch', hay: '', county: 'Ferry', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.72116, lng: -118.66238, operator: 'OpenStreetMap' },
  ],
  // Dalton Lake
  'dalton-lake': [
    { name: 'Boat ramp', hay: '', county: 'Franklin', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.29544, lng: -118.80807, operator: 'OpenStreetMap' },
  ],
  // Deep Lake
  'deep-lake-3': [
    { name: 'Boat ramp', hay: '', county: 'Thurston', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.909, lng: -122.91578, operator: 'OpenStreetMap' },
  ],
  // Depression Lake
  'depression-lake': [
    { name: 'Boat ramp', hay: '', county: 'Whatcom', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.65657, lng: -121.68542, operator: 'OpenStreetMap' },
  ],
  // Duck Lake
  'duck-lake': [
    { name: 'Boat ramp', hay: '', county: 'Grays Harbor', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.97048, lng: -124.14162, operator: 'OpenStreetMap' },
  ],
  // Fish Lake
  'fish-lake-3': [
    { name: 'Boat ramp', hay: '', county: 'Chelan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.83701, lng: -120.71671, operator: 'OpenStreetMap' },
  ],
  // Fish Lake
  'hl-fish-lake': [
    { name: 'Boat ramp', hay: '', county: 'Chelan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.83701, lng: -120.71671, operator: 'OpenStreetMap' },
  ],
  // Fort Borst Lake
  'fort-borst-lake': [
    { name: 'Boat ramp', hay: '', county: 'Lewis', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.72367, lng: -122.97877, operator: 'OpenStreetMap' },
  ],
  // Franklin Roosevelt Lake (Lake Roosevelt)
  'franklin-roosevelt-lake': [
    { name: 'Boat ramp', hay: '', county: 'Stevens', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.89741, lng: -118.17443, operator: 'OpenStreetMap' },
  ],
  // Gorge Lake
  'gorge-lake': [
    { name: 'Boat ramp', hay: '', county: 'Whatcom', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.71588, lng: -121.15214, operator: 'OpenStreetMap' },
  ],
  // Grandy Lake
  'grandy-lake': [
    { name: 'Boat ramp', hay: '', county: 'Skagit', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.56703, lng: -121.80273, operator: 'OpenStreetMap' },
  ],
  // Green Lake
  'green-lake-2': [
    { name: 'Boat ramp', hay: '', county: 'King', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.68118, lng: -122.32923, operator: 'OpenStreetMap' },
  ],
  // Hanson - Upper Pond
  'hanson-upper-pond': [
    { name: 'Hudson Ponds Access', hay: '', county: 'Kittitas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.18587, lng: -120.92141, operator: 'OpenStreetMap' },
  ],
  // Hayes Lake
  'hayes-lake': [
    { name: 'Boat ramp', hay: '', county: 'Lewis', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.72367, lng: -122.97877, operator: 'OpenStreetMap' },
  ],
  // Heart Lake
  'heart-lake': [
    { name: 'Boat ramp', hay: '', county: 'Skagit', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.47518, lng: -122.62883, operator: 'OpenStreetMap' },
  ],
  // Hidden (Allen) Lake
  'hl-hidden-allen-lake': [
    { name: 'Boat ramp', hay: '', county: 'Chelan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.82414, lng: -120.8098, operator: 'OpenStreetMap' },
  ],
  // Hog Canyon Lake
  'hog-canyon-lake': [
    { name: 'Boat ramp', hay: '', county: 'Spokane', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.37384, lng: -117.80965, operator: 'OpenStreetMap' },
  ],
  // Horseshoe Lake
  'hl-horseshoe-4': [
    { name: 'Boat ramp', hay: '', county: 'Skamania', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.30996, lng: -121.56728, operator: 'OpenStreetMap' },
  ],
  // Horseshoe Lake (Cowlitz County)
  'horseshoe-lake-cowlitz': [
    { name: 'Boat ramp', hay: '', county: 'Cowlitz', type: 'Ramp', motor: true, ada: false, hp: '', lat: 45.90124, lng: -122.74428, operator: 'OpenStreetMap' },
  ],
  // Horsethief Lake
  'horsethief-lake': [
    { name: 'Columbia Hills State Park Boat Launch', hay: '', county: 'Klickitat', type: 'Ramp', motor: true, ada: false, hp: '', lat: 45.64273, lng: -121.10455, operator: 'OpenStreetMap' },
  ],
  // Kachess Lake
  'kachess-lake': [
    { name: 'Boat ramp', hay: '', county: 'Kittitas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.34752, lng: -121.25003, operator: 'OpenStreetMap' },
  ],
  // Kachess Lake
  'hl-kachess-lake': [
    { name: 'Boat ramp', hay: '', county: 'Kittitas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.34752, lng: -121.25003, operator: 'OpenStreetMap' },
  ],
  // Keechelus Lake
  'keechelus-lake': [
    { name: 'Lost Lake Boat Launch', hay: '', county: 'Kittitas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.33401, lng: -121.39396, operator: 'OpenStreetMap' },
  ],
  // Keechelus Lake
  'hl-keechelus-lake': [
    { name: 'Lost Lake Boat Launch', hay: '', county: 'Kittitas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.33401, lng: -121.39396, operator: 'OpenStreetMap' },
  ],
  // Kiwanis Pond
  'kiwanis-pond': [
    { name: 'Hudson Ponds Access', hay: '', county: 'Kittitas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.18587, lng: -120.92141, operator: 'OpenStreetMap' },
  ],
  // Lacamas Lake
  'lacamas-lake': [
    { name: 'Lacamas Lake Boat Access Ramp', hay: '', county: 'Clark', type: 'Ramp', motor: true, ada: false, hp: '', lat: 45.61553, lng: -122.42004, operator: 'OpenStreetMap' },
  ],
  // Lake Aberdeen
  'lake-aberdeen': [
    { name: 'Lake Aberdeen Boat Launch', hay: '', county: 'Grays Harbor', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.98125, lng: -123.74303, operator: 'OpenStreetMap' },
  ],
  // Lake Chelan
  'lake-chelan': [
    { name: 'Boat ramp', hay: '', county: 'Chelan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.99325, lng: -120.26115, operator: 'OpenStreetMap' },
  ],
  // Lake Cresent
  'lake-cresent': [
    { name: 'Boat ramp', hay: '', county: 'Clallam', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.05864, lng: -123.78717, operator: 'OpenStreetMap' },
  ],
  // Lake Cushman
  'lake-cushman': [
    { name: 'Boat ramp', hay: '', county: 'Mason', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.48314, lng: -123.24612, operator: 'OpenStreetMap' },
  ],
  // Lake Easton
  'lake-easton': [
    { name: 'Boat ramp', hay: '', county: 'Kittitas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.253, lng: -121.19581, operator: 'OpenStreetMap' },
  ],
  // Lake Entiat
  'lake-entiat': [
    { name: 'Boat ramp', hay: '', county: 'Douglas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.7537, lng: -120.19518, operator: 'OpenStreetMap' },
  ],
  // Lake Gillette
  'lake-gillette': [
    { name: 'Boat ramp', hay: '', county: 'Stevens', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.61332, lng: -117.54002, operator: 'OpenStreetMap' },
  ],
  // Lake Goodwin
  'lake-goodwin': [
    { name: 'Boat ramp', hay: '', county: 'Snohomish', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.13592, lng: -122.28931, operator: 'OpenStreetMap' },
  ],
  // Lake Ki
  'lake-ki': [
    { name: 'Boat ramp', hay: '', county: 'Snohomish', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.15666, lng: -122.26229, operator: 'OpenStreetMap' },
  ],
  // Lake Lenore
  'lake-lenore': [
    { name: 'Boat ramp', hay: '', county: 'Grant', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.47509, lng: -119.51827, operator: 'OpenStreetMap' },
  ],
  // Lake Merwin
  'lake-merwin': [
    { name: 'Boat ramp', hay: '', county: 'Cowlitz', type: 'Ramp', motor: true, ada: false, hp: '', lat: 45.9816, lng: -122.41882, operator: 'OpenStreetMap' },
  ],
  // Lake Padden
  'lake-padden': [
    { name: 'Boat launch for Lake Padden', hay: '', county: 'Whatcom', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.70564, lng: -122.44896, operator: 'OpenStreetMap' },
  ],
  // Lake Pateros
  'lake-pateros': [
    { name: 'Boat ramp', hay: '', county: 'Douglas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.09079, lng: -119.78606, operator: 'OpenStreetMap' },
  ],
  // Lake Pleasant
  'lake-pleasant': [
    { name: 'Boat ramp', hay: '', county: 'Clallam', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.06013, lng: -124.34451, operator: 'OpenStreetMap' },
  ],
  // Lake Sacajawea
  'lake-sacajawea': [
    { name: 'Canoe Launch', hay: '', county: 'Cowlitz', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.13743, lng: -122.95216, operator: 'OpenStreetMap' },
  ],
  // Lake Sammamish
  'lake-sammamish': [
    { name: 'Boat ramp', hay: '', county: 'King', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.57788, lng: -122.11159, operator: 'OpenStreetMap' },
  ],
  // Lake Sawyer
  'lake-sawyer': [
    { name: 'Boat ramp', hay: '', county: 'King', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.3368, lng: -122.04093, operator: 'OpenStreetMap' },
  ],
  // Lake Scanewa
  'lake-scanewa': [
    { name: 'Boat ramp', hay: '', county: 'Lewis', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.48143, lng: -122.09507, operator: 'OpenStreetMap' },
  ],
  // Lake Shannon
  'lake-shannon': [
    { name: 'Boat ramp', hay: '', county: 'Skagit', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.55577, lng: -121.72873, operator: 'OpenStreetMap' },
  ],
  // Lake Sherry
  'lake-sherry': [
    { name: 'Boat ramp', hay: '', county: 'Stevens', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.61332, lng: -117.54002, operator: 'OpenStreetMap' },
  ],
  // Lake Spokane
  'lake-spokane': [
    { name: 'Boat ramp', hay: '', county: 'Stevens', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.83408, lng: -117.76084, operator: 'OpenStreetMap' },
  ],
  // Lake Tapps
  'lake-tapps': [
    { name: 'Tapps Island Boat Launch', hay: '', county: 'Pierce', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.22911, lng: -122.15069, operator: 'OpenStreetMap' },
  ],
  // Lake Thomas
  'lake-thomas': [
    { name: 'Boat ramp', hay: '', county: 'Stevens', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.61332, lng: -117.54002, operator: 'OpenStreetMap' },
  ],
  // Lake Umatilla
  'lake-umatilla': [
    { name: 'Boat ramp', hay: '', county: 'Klickitat', type: 'Ramp', motor: true, ada: false, hp: '', lat: 45.81156, lng: -119.97052, operator: 'OpenStreetMap' },
  ],
  // Lake Union
  'lake-union': [
    { name: 'Waterway 23 Boat Launch', hay: '', county: 'King', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.64853, lng: -122.34672, operator: 'OpenStreetMap' },
  ],
  // Lake Wallula
  'lake-wallula': [
    { name: 'Boat ramp', hay: '', county: 'Benton', type: 'Ramp', motor: true, ada: false, hp: '', lat: 45.9201, lng: -119.16461, operator: 'OpenStreetMap' },
  ],
  // Lake Washington
  'lake-washington': [
    { name: 'Boat ramp', hay: '', county: 'King', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.59046, lng: -122.28586, operator: 'OpenStreetMap' },
  ],
  // Lake Whatcom
  'lake-whatcom': [
    { name: 'Boat ramp', hay: '', county: 'Whatcom', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.72942, lng: -122.34055, operator: 'OpenStreetMap' },
  ],
  // Leech Lake
  'leech-lake': [
    { name: 'White Pass Boat Launch', hay: '', county: 'Yakima', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.64474, lng: -121.38302, operator: 'OpenStreetMap' },
  ],
  // Leech Lake
  'hl-leech-lake': [
    { name: 'White Pass Boat Launch', hay: '', county: 'Yakima', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.64474, lng: -121.38302, operator: 'OpenStreetMap' },
  ],
  // Lost (Devil’s) Lake
  'lost-devils-lake': [
    { name: 'Boat ramp', hay: '', county: 'Snohomish', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.79984, lng: -122.04227, operator: 'OpenStreetMap' },
  ],
  // Lost Lake
  'lost-lake-2': [
    { name: 'Lost Lake Boat Launch', hay: '', county: 'Kittitas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.33401, lng: -121.39396, operator: 'OpenStreetMap' },
  ],
  // Lost Lake
  'hl-lost-lake-2': [
    { name: 'Lost Lake Boat Launch', hay: '', county: 'Kittitas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.33401, lng: -121.39396, operator: 'OpenStreetMap' },
  ],
  // Martha Alderwood Manor
  'martha-alderwood-manor': [
    { name: 'Boat ramp', hay: '', county: 'Snohomish', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.85101, lng: -122.243, operator: 'OpenStreetMap' },
  ],
  // Mayfield Lake
  'mayfield-lake': [
    { name: 'Mayfield Park - Boat Launch', hay: '', county: 'Lewis', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.53113, lng: -122.55809, operator: 'OpenStreetMap' },
  ],
  // Merrill Lake
  'merrill-lake': [
    { name: 'Boat ramp', hay: '', county: 'Cowlitz', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.09359, lng: -122.32045, operator: 'OpenStreetMap' },
  ],
  // Moses Lake
  'moses-lake': [
    { name: 'Boat ramp', hay: '', county: 'Grant', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.13889, lng: -119.31484, operator: 'OpenStreetMap' },
  ],
  // North Silver Lake
  'north-silver-lake': [
    { name: 'Boat ramp', hay: '', county: 'Spokane', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.57175, lng: -117.65578, operator: 'OpenStreetMap' },
  ],
  // Osoyoos Lake
  'osoyoos-lake': [
    { name: 'Boat ramp', hay: '', county: 'Okanogan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.98649, lng: -119.43126, operator: 'OpenStreetMap' },
  ],
  // Ozette Lake
  'ozette-lake': [
    { name: 'Boat ramp', hay: '', county: 'Clallam', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.10998, lng: -124.66324, operator: 'OpenStreetMap' },
  ],
  // Palmer Lake
  'palmer-lake': [
    { name: 'Boat ramp', hay: '', county: 'Okanogan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.87387, lng: -119.6193, operator: 'OpenStreetMap' },
  ],
  // Park Lake
  'park-lake': [
    { name: 'Boat ramp', hay: '', county: 'Grant', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.58749, lng: -119.39636, operator: 'OpenStreetMap' },
  ],
  // Pass Lake
  'pass-lake': [
    { name: 'Boat ramp', hay: '', county: 'Skagit', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.41703, lng: -122.64377, operator: 'OpenStreetMap' },
  ],
  // Petit Lake
  'petit-lake': [
    { name: 'Boat ramp', hay: '', county: 'Pend Oreille', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.63843, lng: -117.08789, operator: 'OpenStreetMap' },
  ],
  // Pierre Lake
  'pierre-lake': [
    { name: 'Boat ramp', hay: '', county: 'Stevens', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.90524, lng: -118.14058, operator: 'OpenStreetMap' },
  ],
  // Quigg Lake
  'quigg-lake': [
    { name: 'Boat ramp', hay: '', county: 'Grays Harbor', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.94592, lng: -123.64074, operator: 'OpenStreetMap' },
  ],
  // Reflection Pond
  'reflection-pond': [
    { name: 'Forde Lake', hay: '', county: 'Okanogan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.73709, lng: -119.66952, operator: 'OpenStreetMap' },
  ],
  // Rimrock Lake
  'rimrock-lake': [
    { name: 'Boat ramp', hay: '', county: 'Yakima', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.63497, lng: -121.14799, operator: 'OpenStreetMap' },
  ],
  // Rimrock Lake
  'hl-rimrock-lake': [
    { name: 'Boat ramp', hay: '', county: 'Yakima', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.63497, lng: -121.14799, operator: 'OpenStreetMap' },
  ],
  // Riparia Pond
  'riparia-pond': [
    { name: 'Primitive Boat Ramp', hay: '', county: 'Whitman', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.57649, lng: -118.09034, operator: 'OpenStreetMap' },
  ],
  // Rocky Lake
  'rocky-lake': [
    { name: 'Boat ramp', hay: '', county: 'Stevens', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.49585, lng: -117.87249, operator: 'OpenStreetMap' },
  ],
  // Ross Lake
  'ross-lake': [
    { name: 'Boat ramp', hay: '', county: 'Whatcom', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.98689, lng: -121.07224, operator: 'OpenStreetMap' },
  ],
  // Sage Lake - East
  'sage-lake-east': [
    { name: 'Long Lake Boat Launch', hay: '', county: 'Grant', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.92839, lng: -119.19765, operator: 'OpenStreetMap' },
  ],
  // Sage Lake - West
  'sage-lake-west': [
    { name: 'Long Lake Boat Launch', hay: '', county: 'Grant', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.92839, lng: -119.19765, operator: 'OpenStreetMap' },
  ],
  // Scooteney Reservoir
  'scooteney-reservoir': [
    { name: 'Boat ramp', hay: '', county: 'Franklin', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.70486, lng: -119.02493, operator: 'OpenStreetMap' },
  ],
  // Shiner Lake
  'shiner-lake': [
    { name: 'Boat ramp', hay: '', county: 'Adams', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.87726, lng: -119.29747, operator: 'OpenStreetMap' },
  ],
  // Silcott Pond
  'silcott-pond': [
    { name: 'Boat ramp', hay: '', county: 'Asotin', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.4159, lng: -117.1959, operator: 'OpenStreetMap' },
  ],
  // Skookumchuck Reservoir
  'skookumchuck-reservoir': [
    { name: 'WDFW Boat Launch', hay: '', county: 'Thurston', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.78832, lng: -122.70972, operator: 'OpenStreetMap' },
  ],
  // Snag Lake (Radar Hill Ponds)
  'snag-lake-radar-hill-ponds': [
    { name: 'Boat ramp', hay: '', county: 'Pacific', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.41939, lng: -123.81463, operator: 'OpenStreetMap' },
  ],
  // Soda Lake
  'soda-lake': [
    { name: 'Boat ramp', hay: '', county: 'Grant', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.95589, lng: -119.23964, operator: 'OpenStreetMap' },
  ],
  // South Lewis County Park Pond
  'south-lewis-county-park-pond': [
    { name: 'Boat ramp', hay: '', county: 'Lewis', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.43308, lng: -122.8426, operator: 'OpenStreetMap' },
  ],
  // South Skookum Lake
  'south-skookum-lake': [
    { name: 'Boat ramp', hay: '', county: 'Pend Oreille', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.39275, lng: -117.18381, operator: 'OpenStreetMap' },
  ],
  // Spada Lake
  'spada-lake': [
    { name: 'Boat ramp', hay: '', county: 'Snohomish', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.96104, lng: -121.64205, operator: 'OpenStreetMap' },
  ],
  // Spanaway Lake
  'spanaway-lake': [
    { name: 'Boat ramp', hay: '', county: 'Pierce', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.1144, lng: -122.44569, operator: 'OpenStreetMap' },
  ],
  // Spearfish Lake
  'spearfish-lake': [
    { name: 'Boat ramp', hay: '', county: 'Klickitat', type: 'Ramp', motor: true, ada: false, hp: '', lat: 45.62602, lng: -121.12826, operator: 'OpenStreetMap' },
  ],
  // Star Lake
  'star-lake': [
    { name: 'Boat ramp', hay: '', county: 'King', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.35295, lng: -122.28655, operator: 'OpenStreetMap' },
  ],
  // Steele Lake
  'steele-lake': [
    { name: 'Steel Lake Boat Launch', hay: '', county: 'King', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.32612, lng: -122.30018, operator: 'OpenStreetMap' },
  ],
  // Sullivan Lake
  'sullivan-lake': [
    { name: 'Boat ramp', hay: '', county: 'Pend Oreille', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.79315, lng: -117.2818, operator: 'OpenStreetMap' },
  ],
  // Swift Reservoir
  'swift-reservoir': [
    { name: 'Boat ramp', hay: '', county: 'Skamania', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.0516, lng: -122.04406, operator: 'OpenStreetMap' },
  ],
  // Sylvia Lake
  'sylvia-lake': [
    { name: 'Boat ramp', hay: '', county: 'Grays Harbor', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.99714, lng: -123.59399, operator: 'OpenStreetMap' },
  ],
  // Tucquala
  'tucquala': [
    { name: 'Boat ramp', hay: '', county: 'Kittitas', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.51022, lng: -121.06278, operator: 'OpenStreetMap' },
  ],
  // Twin Lakes - Upper
  'twin-lakes-upper': [
    { name: 'Boat ramp', hay: '', county: 'Lincoln', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.53091, lng: -118.50567, operator: 'OpenStreetMap' },
  ],
  // Tye Lake
  'tye-lake': [
    { name: 'Boat ramp', hay: '', county: 'Snohomish', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.86339, lng: -122.01011, operator: 'OpenStreetMap' },
  ],
  // Upper Caliche Lake
  'upper-caliche-lake': [
    { name: 'Caliche Lakes Boat Launch', hay: '', county: 'Grant', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.03312, lng: -119.92709, operator: 'OpenStreetMap' },
  ],
  // Vance Creek Pond 1 (Bowers Lake)
  'vance-creek-pond-1-bowers-lake': [
    { name: 'Boat ramp', hay: '', county: 'Grays Harbor', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.99615, lng: -123.41603, operator: 'OpenStreetMap' },
  ],
  // Vance Creek Pond 2 (Inez Lake)
  'vance-creek-pond-2-inez-lake': [
    { name: 'Boat ramp', hay: '', county: 'Grays Harbor', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.99616, lng: -123.41616, operator: 'OpenStreetMap' },
  ],
  // Washburn Island Pond
  'washburn-island-pond': [
    { name: 'Boat ramp', hay: '', county: 'Okanogan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 48.09429, lng: -119.66753, operator: 'OpenStreetMap' },
  ],
  // Wenatchee Lake
  'wenatchee-lake': [
    { name: 'Boat ramp', hay: '', county: 'Chelan', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.82414, lng: -120.8098, operator: 'OpenStreetMap' },
  ],
  // Western Lake (Radar Hill Ponds)
  'western-lake-radar-hill-ponds': [
    { name: 'Boat ramp', hay: '', county: 'Pacific', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.42334, lng: -123.82157, operator: 'OpenStreetMap' },
  ],
  // Wynoochee Lake
  'wynoochee-lake': [
    { name: 'Coho Campground Boat Launch', hay: '', county: 'Grays Harbor', type: 'Ramp', motor: true, ada: false, hp: '', lat: 47.39039, lng: -123.60168, operator: 'OpenStreetMap' },
  ],
  // Yale Reservoir
  'yale-reservoir': [
    { name: 'Boat ramp', hay: '', county: 'Cowlitz', type: 'Ramp', motor: true, ada: false, hp: '', lat: 46.02597, lng: -122.31708, operator: 'OpenStreetMap' },
  ],
};

export function extraLaunches(slug: string): Launch[] {
  return EXTRA_LAUNCHES[slug] || [];
}

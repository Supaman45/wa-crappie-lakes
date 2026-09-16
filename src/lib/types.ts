export type SpeciesId = 'crappie' | 'largemouth' | 'smallmouth' | 'cutthroat' | 'rainbow' | 'coho' | 'steelhead' | 'chinook' | 'bull' | 'brook' | 'brown' | 'tiger' | 'golden' | 'kokanee' | 'laker' | 'cutbow' | 'walleye' | 'muskie' | 'perch' | 'bluegill' | 'pumpkinseed' | 'bullhead' | 'other';

export interface Lake {
  id: number;            // index in dataset (stable for the session)
  name: string;
  slug: string;
  acres: number | null;
  elev: number;
  counties: string[];
  lat: number;
  lng: number;
  sp: SpeciesId[];
  kind: 'lowland' | 'high';     // high = hike-in alpine lake from the WDFW high lakes program
  ramp: boolean | null;         // WDFW BoatRampAvailable
  shore: 'good' | 'none' | null; // WDFW ShorelineAccess
  mgmt: string;                 // WDFW management emphasis, or high-lake program label
  wdfw: number;                 // WDFW feature id (lowland OBJECTID or high lake FishWAid)
}

export interface Launch {
  name: string;
  hay: string;
  county: string;
  type: string;
  motor: boolean;
  ada: boolean;
  hp: string;
  lat: number;
  lng: number;
  dist?: number;
  /** Set on curated ramps that WDFW does not list (city, county, state park, utility). */
  operator?: string;
  note?: string;
}

export interface Profile {
  id: string;
  name: string;
  color: string;
}

export type WaterType = 'lake' | 'creek' | 'river' | 'salt';

export interface Catch {
  id: string;
  user_id: string;
  lake_id: string;          // lake slug, or spot id when water_type != lake
  lake_name: string | null;
  species: string;
  date: string;             // YYYY-MM-DD
  length: number | null;
  weight: number | null;
  qty: number;
  notes: string | null;
  photo_path: string | null;
  depth: number | null;
  bait: string | null;
  structure: string | null;
  water_temp: number | null;
  water_type: WaterType;
  spot_id: string | null;
  created_at: string;
  /** Trip this fish belongs to, when it was logged during a live trip. */
  trip_id?: string | null;
  /** Clock time of the catch. `date` stays the calendar day. */
  caught_at?: string | null;
  /** Conditions at the moment it was logged, so patterns survive forecast churn. */
  cond?: Conditions | null;
  /** Kept or released. Only kept salmon and steelhead go on a Catch Record Card. */
  kept?: boolean | null;
  /** Adipose clipped, meaning hatchery. Null when not checked or not applicable. */
  clipped?: boolean | null;
  /** WDFW catch area code written on the card. */
  catch_area?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Off by default: the crew sees the water, not the pin. */
  share_spot?: boolean;
  _local?: boolean;
}

/** A snapshot of what the day was doing, taken when a fish or trip is logged. */
export interface Conditions {
  at: string;
  airF?: number | null;
  windMph?: number | null;
  windDir?: number | null;
  pressure?: number | null;
  /** Pressure change over the last 3 hours, mb. The number that moves fish. */
  pressureTrend?: number | null;
  cloud?: number | null;
  precip?: number | null;
  moonIllum?: number | null;
  /** cfs for a river, when the water has a gauge. */
  cfs?: number | null;
  waterF?: number | null;
}

export interface Visit {
  id: string;
  user_id: string;
  lake_id: string;
  lake_name: string | null;
  date: string;
  water_type: WaterType;
  spot_id: string | null;
  created_at: string;
  _local?: boolean;
}

export interface LakeTag {
  user_id: string;
  lake_id: string;
  fav: boolean;
  wish: boolean;
  color: string | null;
  cat: string | null;
  updated_at?: string;
}

export interface TrackPoint { t: number; lat: number; lng: number; }

export interface Trip {
  id: string;
  user_id: string;
  started_at: string | null;
  ended_at: string | null;
  duration_min: number | null;
  distance_mi: number | null;
  track: TrackPoint[] | null;
  lakes: string[] | null;      // slugs or spot ids
  catch_ids: string[] | null;
  note: string | null;
  created_at: string | null;
  /** The water fished, so a trip stands on its own without walking its catches. */
  water_id?: string | null;
  water_name?: string | null;
  water_type?: WaterType | null;
  spot_id?: string | null;
  cond?: Conditions | null;
  /** True while the trip is running on the phone. */
  open?: boolean;
  _local?: boolean;
}

export type SpotStatus = 'candidate' | 'scouted' | 'producing' | 'dead';
export type SpotAccess = 'public' | 'timber' | 'private' | 'unknown';

export interface Spot {
  id: string;
  user_id: string;
  kind: WaterType;
  name: string;
  lat: number;
  lng: number;
  llid: string | null;
  species: string[];
  meta: Record<string, unknown>;
  access: SpotAccess;
  permit: string | null;
  priority: number;
  status: SpotStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  _local?: boolean;
}

export interface OutboxItem {
  id: string;               // same as row id for catch/visit/trip/spot
  kind: 'catch' | 'visit' | 'trip' | 'spot' | 'spot_update' | 'tag';
  payload: Record<string, unknown>;
  created_at: number;
  attempts: number;
  last_error?: string;
}

export interface DailyForecast {
  time: string[];
  temperature_2m_max?: (number | null)[];
  precipitation_probability_max?: (number | null)[];
  wind_speed_10m_max?: (number | null)[];
  weather_code?: (number | null)[];
  sunrise?: string[];
  sunset?: string[];
}
export interface Forecast { daily: DailyForecast; latitude?: number; longitude?: number; }

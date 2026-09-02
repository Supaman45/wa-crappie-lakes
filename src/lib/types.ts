export type SpeciesId = 'crappie' | 'largemouth' | 'smallmouth' | 'cutthroat' | 'rainbow' | 'coho' | 'steelhead' | 'chinook' | 'bull' | 'brook' | 'other';

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
  _local?: boolean;
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

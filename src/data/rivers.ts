import type { SpeciesId } from '@/lib/types';

/**
 * Curated Washington rivers for the Plan tab.
 * gauge: USGS site id used for live flow (00060) and temperature (00010). The app resolves the id
 * live, so a retired or wrong id shows "no gauge data" rather than bad numbers.
 * facilities: facility names exactly as they appear in the WDFW weekly hatchery escapement report,
 * used to attach the latest returns to the river.
 * lat/lng: a representative public access point near the gauge.
 */
export interface River {
  id: string;
  name: string;
  counties: string[];
  lat: number;
  lng: number;
  gauge: string | null;
  gaugeName: string;
  facilities: string[];
  sp: SpeciesId[];
  region: 'puget' | 'coast' | 'columbia' | 'east';
}

export const RIVERS: River[] = [
  // Puget Sound
  { id: 'nooksack', name: 'Nooksack River', counties: ['Whatcom'], lat: 48.8483, lng: -122.5860, gauge: '12213100', gaugeName: 'Nooksack at Ferndale', facilities: ['KENDALL CR HATCHERY'], sp: ['chinook', 'coho', 'steelhead', 'cutthroat', 'bull'], region: 'puget' },
  { id: 'skagit', name: 'Skagit River', counties: ['Skagit'], lat: 48.4482, lng: -122.3350, gauge: '12200500', gaugeName: 'Skagit near Mount Vernon', facilities: ['MARBLEMOUNT HATCHERY', 'BAKER LK HATCHERY'], sp: ['chinook', 'coho', 'steelhead', 'cutthroat', 'bull'], region: 'puget' },
  { id: 'sauk', name: 'Sauk River', counties: ['Skagit', 'Snohomish'], lat: 48.4240, lng: -121.5680, gauge: '12189500', gaugeName: 'Sauk near Sauk', facilities: [], sp: ['steelhead', 'bull', 'cutthroat'], region: 'puget' },
  { id: 'stilly', name: 'Stillaguamish River', counties: ['Snohomish'], lat: 48.2020, lng: -122.1250, gauge: '12167000', gaugeName: 'NF Stillaguamish near Arlington', facilities: [], sp: ['coho', 'chinook', 'steelhead', 'cutthroat'], region: 'puget' },
  { id: 'skykomish', name: 'Skykomish River', counties: ['Snohomish'], lat: 47.8560, lng: -121.6960, gauge: '12134500', gaugeName: 'Skykomish near Gold Bar', facilities: ['WALLACE R HATCHERY', 'SUNSET FALLS FCF', 'REITER PONDS'], sp: ['steelhead', 'chinook', 'coho', 'cutthroat'], region: 'puget' },
  { id: 'snoqualmie', name: 'Snoqualmie River', counties: ['King'], lat: 47.6480, lng: -121.9140, gauge: '12149000', gaugeName: 'Snoqualmie near Carnation', facilities: [], sp: ['steelhead', 'coho', 'cutthroat', 'rainbow'], region: 'puget' },
  { id: 'snohomish', name: 'Snohomish River', counties: ['Snohomish'], lat: 47.8590, lng: -122.0020, gauge: '12150800', gaugeName: 'Snohomish near Monroe', facilities: [], sp: ['coho', 'chinook', 'steelhead', 'cutthroat'], region: 'puget' },
  { id: 'cedar', name: 'Cedar River', counties: ['King'], lat: 47.4820, lng: -122.1970, gauge: '12119000', gaugeName: 'Cedar at Renton', facilities: ['CEDAR RIVER HATCHERY'], sp: ['rainbow', 'cutthroat', 'coho'], region: 'puget' },
  { id: 'green', name: 'Green River', counties: ['King'], lat: 47.3060, lng: -122.2110, gauge: '12113000', gaugeName: 'Green near Auburn', facilities: ['SOOS CREEK HATCHERY', 'PALMER HATCHERY', 'ICY CR HATCHERY'], sp: ['chinook', 'coho', 'steelhead', 'cutthroat'], region: 'puget' },
  { id: 'puyallup', name: 'Puyallup River', counties: ['Pierce'], lat: 47.1900, lng: -122.2950, gauge: '12101500', gaugeName: 'Puyallup at Puyallup', facilities: ['VOIGHTS CR HATCHERY'], sp: ['chinook', 'coho', 'steelhead', 'cutthroat'], region: 'puget' },
  { id: 'nisqually', name: 'Nisqually River', counties: ['Pierce', 'Thurston'], lat: 46.9370, lng: -122.5570, gauge: '12089500', gaugeName: 'Nisqually at McKenna', facilities: [], sp: ['chinook', 'coho', 'steelhead', 'cutthroat'], region: 'puget' },
  { id: 'skokomish', name: 'Skokomish River', counties: ['Mason'], lat: 47.3100, lng: -123.1440, gauge: '12061500', gaugeName: 'Skokomish near Potlatch', facilities: ['GEORGE ADAMS HATCHERY', 'HOODSPORT HATCHERY'], sp: ['chinook', 'coho', 'steelhead', 'cutthroat'], region: 'puget' },
  { id: 'minter', name: 'Minter Creek', counties: ['Pierce'], lat: 47.3720, lng: -122.7000, gauge: null, gaugeName: '', facilities: ['MINTER CR HATCHERY'], sp: ['chinook', 'coho'], region: 'puget' },
  { id: 'dungeness', name: 'Dungeness River', counties: ['Clallam'], lat: 48.1140, lng: -123.1330, gauge: '12048000', gaugeName: 'Dungeness near Sequim', facilities: ['HURD CR HATCHERY'], sp: ['chinook', 'coho', 'steelhead', 'cutthroat'], region: 'puget' },
  { id: 'elwha', name: 'Elwha River', counties: ['Clallam'], lat: 48.1010, lng: -123.5560, gauge: '12045500', gaugeName: 'Elwha at McDonald Bridge', facilities: [], sp: ['chinook', 'coho', 'steelhead', 'bull'], region: 'puget' },
  // Olympic Peninsula and coast
  { id: 'solduc', name: 'Sol Duc River', counties: ['Clallam'], lat: 48.0090, lng: -124.2760, gauge: null, gaugeName: '', facilities: ['SOLDUC HATCHERY'], sp: ['steelhead', 'chinook', 'coho', 'cutthroat'], region: 'coast' },
  { id: 'bogachiel', name: 'Bogachiel River', counties: ['Clallam'], lat: 47.9280, lng: -124.4020, gauge: null, gaugeName: '', facilities: ['BOGACHIEL HATCHERY'], sp: ['steelhead', 'chinook', 'coho', 'cutthroat'], region: 'coast' },
  { id: 'calawah', name: 'Calawah River', counties: ['Clallam'], lat: 47.9700, lng: -124.3960, gauge: '12043000', gaugeName: 'Calawah near Forks', facilities: [], sp: ['steelhead', 'coho', 'cutthroat'], region: 'coast' },
  { id: 'hoh', name: 'Hoh River', counties: ['Jefferson'], lat: 47.8070, lng: -124.2500, gauge: '12041200', gaugeName: 'Hoh at US 101 near Forks', facilities: [], sp: ['steelhead', 'chinook', 'coho', 'cutthroat', 'bull'], region: 'coast' },
  { id: 'queets', name: 'Queets River', counties: ['Jefferson'], lat: 47.5560, lng: -124.3130, gauge: '12040500', gaugeName: 'Queets near Clearwater', facilities: [], sp: ['steelhead', 'chinook', 'coho', 'cutthroat'], region: 'coast' },
  { id: 'humptulips', name: 'Humptulips River', counties: ['Grays Harbor'], lat: 47.2330, lng: -123.9700, gauge: null, gaugeName: '', facilities: [], sp: ['steelhead', 'chinook', 'coho', 'cutthroat'], region: 'coast' },
  { id: 'wynoochee', name: 'Wynoochee River', counties: ['Grays Harbor'], lat: 47.0100, lng: -123.6510, gauge: null, gaugeName: '', facilities: ['TACOMA POWER WYNOOCHEE R DAM'], sp: ['steelhead', 'chinook', 'coho', 'cutthroat'], region: 'coast' },
  { id: 'satsop', name: 'Satsop River', counties: ['Grays Harbor'], lat: 47.0010, lng: -123.4920, gauge: '12035000', gaugeName: 'Satsop near Satsop', facilities: [], sp: ['steelhead', 'chinook', 'coho', 'cutthroat'], region: 'coast' },
  { id: 'chehalis', name: 'Chehalis River', counties: ['Grays Harbor', 'Lewis', 'Thurston'], lat: 46.9390, lng: -123.3130, gauge: '12031000', gaugeName: 'Chehalis at Porter', facilities: [], sp: ['steelhead', 'chinook', 'coho', 'cutthroat', 'smallmouth'], region: 'coast' },
  { id: 'willapa', name: 'Willapa River', counties: ['Pacific'], lat: 46.6650, lng: -123.6500, gauge: '12013500', gaugeName: 'Willapa near Willapa', facilities: [], sp: ['chinook', 'coho', 'steelhead', 'cutthroat'], region: 'coast' },
  { id: 'naselle', name: 'Naselle River', counties: ['Pacific'], lat: 46.3740, lng: -123.7550, gauge: '12010000', gaugeName: 'Naselle near Naselle', facilities: ['NASELLE HATCHERY'], sp: ['chinook', 'coho', 'steelhead', 'cutthroat'], region: 'coast' },
  // Lower Columbia
  { id: 'grays', name: 'Grays River', counties: ['Wahkiakum'], lat: 46.3520, lng: -123.5860, gauge: null, gaugeName: '', facilities: ['GRAYS RIVER WEIR'], sp: ['chinook', 'coho', 'steelhead', 'cutthroat'], region: 'columbia' },
  { id: 'elochoman', name: 'Elochoman River', counties: ['Wahkiakum'], lat: 46.2340, lng: -123.3900, gauge: null, gaugeName: '', facilities: ['FOSTER RD TRAP', 'BEAVER CR HATCHERY'], sp: ['chinook', 'coho', 'steelhead', 'cutthroat'], region: 'columbia' },
  { id: 'cowlitz', name: 'Cowlitz River', counties: ['Lewis', 'Cowlitz'], lat: 46.5060, lng: -122.6230, gauge: '14238000', gaugeName: 'Cowlitz below Mayfield Dam', facilities: ['COWLITZ SALMON HATCHERY'], sp: ['chinook', 'coho', 'steelhead', 'cutthroat'], region: 'columbia' },
  { id: 'toutle', name: 'Toutle River', counties: ['Cowlitz'], lat: 46.3620, lng: -122.8460, gauge: '14242580', gaugeName: 'Toutle at Tower Road', facilities: [], sp: ['steelhead', 'coho', 'chinook', 'cutthroat'], region: 'columbia' },
  { id: 'kalama', name: 'Kalama River', counties: ['Cowlitz'], lat: 46.0430, lng: -122.8020, gauge: '14223500', gaugeName: 'Kalama below Italian Creek', facilities: ['KALAMA FALLS HATCHERY', 'MODROW TRAP'], sp: ['steelhead', 'chinook', 'coho', 'cutthroat'], region: 'columbia' },
  { id: 'lewis', name: 'Lewis River', counties: ['Clark', 'Cowlitz'], lat: 45.9500, lng: -122.5600, gauge: '14220500', gaugeName: 'Lewis at Ariel', facilities: ['LEWIS RIVER HATCHERY', 'MERWIN HATCHERY', 'MERWIN DAM FCF', 'SPEELYAI HATCHERY'], sp: ['chinook', 'coho', 'steelhead', 'cutthroat'], region: 'columbia' },
  { id: 'eflewis', name: 'East Fork Lewis River', counties: ['Clark'], lat: 45.8320, lng: -122.5250, gauge: '14222500', gaugeName: 'EF Lewis near Heisson', facilities: [], sp: ['steelhead', 'coho', 'chinook', 'cutthroat'], region: 'columbia' },
  { id: 'washougal', name: 'Washougal River', counties: ['Clark', 'Skamania'], lat: 45.6000, lng: -122.3300, gauge: '14143500', gaugeName: 'Washougal near Washougal', facilities: ['WASHOUGAL HATCHERY', 'SKAMANIA HATCHERY'], sp: ['steelhead', 'coho', 'chinook', 'cutthroat'], region: 'columbia' },
  { id: 'whitesalmon', name: 'White Salmon River', counties: ['Klickitat', 'Skamania'], lat: 45.7480, lng: -121.5220, gauge: '14123500', gaugeName: 'White Salmon near Underwood', facilities: [], sp: ['steelhead', 'chinook', 'coho', 'rainbow'], region: 'columbia' },
  { id: 'klickitat', name: 'Klickitat River', counties: ['Klickitat'], lat: 45.7900, lng: -121.2380, gauge: '14113000', gaugeName: 'Klickitat near Pitt', facilities: [], sp: ['steelhead', 'chinook', 'coho', 'rainbow'], region: 'columbia' },
  // East side
  { id: 'yakima', name: 'Yakima River', counties: ['Kittitas', 'Yakima', 'Benton'], lat: 46.8880, lng: -120.4830, gauge: '12484500', gaugeName: 'Yakima at Umtanum', facilities: [], sp: ['rainbow', 'cutthroat', 'smallmouth', 'chinook', 'steelhead'], region: 'east' },
  { id: 'naches', name: 'Naches River', counties: ['Yakima'], lat: 46.7320, lng: -120.6980, gauge: '12494000', gaugeName: 'Naches near Naches', facilities: [], sp: ['rainbow', 'cutthroat', 'chinook'], region: 'east' },
  { id: 'wenatchee', name: 'Wenatchee River', counties: ['Chelan'], lat: 47.5440, lng: -120.5810, gauge: '12459000', gaugeName: 'Wenatchee at Peshastin', facilities: ['EASTBANK HATCHERY', 'CHIWAWA HATCHERY'], sp: ['chinook', 'steelhead', 'rainbow', 'cutthroat', 'bull'], region: 'east' },
  { id: 'methow', name: 'Methow River', counties: ['Okanogan'], lat: 48.0570, lng: -119.9080, gauge: '12449950', gaugeName: 'Methow near Pateros', facilities: [], sp: ['steelhead', 'chinook', 'rainbow', 'cutthroat', 'bull'], region: 'east' },
  { id: 'okanogan', name: 'Okanogan River', counties: ['Okanogan'], lat: 48.2820, lng: -119.7040, gauge: '12447200', gaugeName: 'Okanogan at Malott', facilities: [], sp: ['smallmouth', 'steelhead', 'chinook', 'rainbow'], region: 'east' },
  { id: 'spokane', name: 'Spokane River', counties: ['Spokane'], lat: 47.6600, lng: -117.4500, gauge: '12422500', gaugeName: 'Spokane at Spokane', facilities: [], sp: ['rainbow', 'smallmouth', 'brook'], region: 'east' },
  { id: 'snake', name: 'Snake River', counties: ['Whitman', 'Franklin', 'Walla Walla', 'Asotin'], lat: 46.4200, lng: -117.0400, gauge: null, gaugeName: '', facilities: ['LYONS FERRY HATCHERY'], sp: ['steelhead', 'chinook', 'smallmouth'], region: 'east' },
  { id: 'tucannon', name: 'Tucannon River', counties: ['Columbia'], lat: 46.5170, lng: -118.1300, gauge: '13344500', gaugeName: 'Tucannon near Starbuck', facilities: ['TUCANNON HATCHERY'], sp: ['rainbow', 'steelhead', 'chinook', 'bull'], region: 'east' },
  { id: 'touchet', name: 'Touchet River', counties: ['Columbia', 'Walla Walla'], lat: 46.3250, lng: -117.9880, gauge: '14017000', gaugeName: 'Touchet at Bolles', facilities: ['DAYTON ACCLIMA. POND'], sp: ['rainbow', 'steelhead', 'bull'], region: 'east' },
  { id: 'grande', name: 'Grande Ronde River', counties: ['Asotin'], lat: 46.0500, lng: -117.2800, gauge: '13333000', gaugeName: 'Grande Ronde at Troy', facilities: [], sp: ['steelhead', 'chinook', 'smallmouth', 'rainbow'], region: 'east' },
];

export const RIVER_REGIONS: { id: River['region']; label: string }[] = [
  { id: 'puget', label: 'Puget Sound' },
  { id: 'coast', label: 'Coast' },
  { id: 'columbia', label: 'Columbia' },
  { id: 'east', label: 'East' },
];

export function riverById(id: string): River | undefined { return RIVERS.find(r => r.id === id); }

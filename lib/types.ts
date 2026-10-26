export type ThemeMode = 'dark' | 'light' | 'system';

export type BackgroundMediaType = 'image' | 'gif' | 'video' | 'solid';

export type BackgroundSizing = 'cover' | 'contain' | 'center';

export type LiquidVariant = 'frosted' | 'clear' | 'blur';

export interface LiquidOsConfig {
  enabled: boolean;
  variant: LiquidVariant;
  blurPx: number; // 4 to 48
  opacity: number; // 0.12 to 0.90
  specularIntensity: number; // 0 to 1
  liteMode?: boolean; // Low-GPU mode for potato/low-spec devices
}

export type ModuleId =
  | 'weather'
  | 'quick_links'
  | 'forex'
  | 'music'
  | 'daily_activity'
  | 'notepad'
  | 'prayer_times';

export type DisplayDensity = 'compact' | 'comfortable';

export interface ModuleLayoutConfig {
  id: ModuleId;
  title: string;
  visible: boolean;
  order: number;
  colSpan: number; // 3 to 12 on desktop 12-col grid
  rowSpan: number; // 1 to 3
  minHeight?: number; // px
  customHeight?: number | null; // px
  density: DisplayDensity;
}

export interface AppearanceConfig {
  theme: ThemeMode;
  primaryColor: string;
  customBgColor: string | null;
  customSurfaceColor: string | null;
  customBorderColor: string | null;
  borderRadius: number; // default 12px (balanced, non-rigid, non-slop)
  liquid: LiquidOsConfig;
}

export interface BackgroundConfig {
  type: BackgroundMediaType;
  mediaUrl: string;
  localAssetId: string | null; // Key in IndexedDB when uploaded locally
  solidColor: string;
  sizing: BackgroundSizing;
  position: string; // e.g., 'center', 'top', 'bottom'
  overlayOpacity: number; // 0 to 0.95
  brightness: number; // 0.2 to 1.5
  heroHeight: number; // 320 to 900 (unobstructed showcase window height)
  fixedAttachment?: boolean; // Keep background locked on scroll
  focusTarget?: string; // Daily focus intention displayed in Hero Canvas
}

export interface QuickLinkItem {
  id: string;
  title: string;
  url: string;
  group: string;
  icon?: string;
  order: number;
}

export interface QuickLinksConfig {
  items: QuickLinkItem[];
  groups: string[];
  viewMode: 'compact' | 'expanded';
  openInNewTab: boolean;
}

export interface DailyActivityItem {
  id: string;
  title: string;
  category?: string;
  order: number;
  createdAt: string;
}

export interface DailyActivityDayRecord {
  date: string; // YYYY-MM-DD in local time
  completedIds: string[];
  totalDefined: number;
}

export interface DailyActivityConfig {
  activities: DailyActivityItem[];
  activeDate: string; // YYYY-MM-DD local date
  todayCompletedIds: string[];
  history: Record<string, DailyActivityDayRecord>; // keyed by YYYY-MM-DD
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  createdAt: string;
}

export interface NotepadConfig {
  notes: NoteItem[];
  activeNoteId: string | null;
}

export type SearchProviderId =
  | 'google'
  | 'duckduckgo'
  | 'brave'
  | 'bing'
  | 'startpage'
  | 'ecosia';

export interface SearchHistoryEntry {
  id: string;
  query: string;
  provider: SearchProviderId;
  timestamp: string;
}

export interface SearchConfig {
  provider: SearchProviderId;
  openInNewTab: boolean;
  persistHistory: boolean;
  showSuggestions: boolean;
  history: SearchHistoryEntry[];
}

export type MusicProviderId = 'spotify' | 'youtube' | 'apple_music' | 'soundcloud';

export interface MusicSavedLink {
  id: string;
  title: string;
  provider: MusicProviderId;
  url: string;
  embedUrl: string;
}

export interface LocalAudioTrackMeta {
  id: string;
  title: string;
  artist: string;
  fileName: string;
  mimeType: string;
  size: number;
  addedAt: string;
}

export interface MusicConfig {
  activeTab?: 'local_mp3' | 'spotify';
  provider: MusicProviderId;
  activeEmbedUrl: string;
  displayMode: 'compact' | 'expanded';
  savedPlaylists: MusicSavedLink[];
  localTracks?: LocalAudioTrackMeta[];
  activeLocalTrackId?: string | null;
  visualizerEnabled?: boolean;
}

export interface WeatherLocationConfig {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  unit: 'celsius' | 'fahrenheit';
  windUnit: 'kmh' | 'mph' | 'ms';
  autoDetect: boolean;
  prayerCityId: string; // For MyQuran Kemenag ID (e.g. '1301' for Jakarta)
  prayerCityName: string;
  prayerMethod: number; // Aladhan calculation method fallback (20 = Kemenag RI)
}

export interface ForexConfig {
  baseCurrency: string;
  quoteCurrency: string;
  timeframe: '7D' | '30D' | '90D' | '1Y';
}

export interface WingstConfig {
  version: number;
  appearance: AppearanceConfig;
  background: BackgroundConfig;
  layout: ModuleLayoutConfig[];
  quickLinks: QuickLinksConfig;
  dailyActivity: DailyActivityConfig;
  notepad: NotepadConfig;
  search: SearchConfig;
  music: MusicConfig;
  location: WeatherLocationConfig;
  forex: ForexConfig;
}

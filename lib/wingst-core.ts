import {
  DailyActivityConfig,
  ModuleId,
  ModuleLayoutConfig,
  MusicProviderId,
  SearchConfig,
  SearchProviderId,
  WingstConfig,
} from './types';

export const WINGST_CONFIG_VERSION = 2;
export const DEFAULT_HERO_IMAGE = '/assets/wingst-default-hero.svg';

export const SEARCH_PROVIDERS: Record<
  SearchProviderId,
  { name: string; searchUrl: string; domain: string; shortcutHint: string }
> = {
  google: {
    name: 'Google',
    searchUrl: 'https://www.google.com/search?q=',
    domain: 'google.com',
    shortcutHint: 'G',
  },
  duckduckgo: {
    name: 'DuckDuckGo',
    searchUrl: 'https://duckduckgo.com/?q=',
    domain: 'duckduckgo.com',
    shortcutHint: 'DDG',
  },
  brave: {
    name: 'Brave Search',
    searchUrl: 'https://search.brave.com/search?q=',
    domain: 'search.brave.com',
    shortcutHint: 'BRV',
  },
  bing: {
    name: 'Bing',
    searchUrl: 'https://www.bing.com/search?q=',
    domain: 'bing.com',
    shortcutHint: 'BNG',
  },
  startpage: {
    name: 'Startpage',
    searchUrl: 'https://www.startpage.com/do/dsearch?query=',
    domain: 'startpage.com',
    shortcutHint: 'SP',
  },
  ecosia: {
    name: 'Ecosia',
    searchUrl: 'https://www.ecosia.org/search?q=',
    domain: 'ecosia.org',
    shortcutHint: 'ECO',
  },
};

export function getLocalCalendarDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createDefaultLayout(): ModuleLayoutConfig[] {
  return [
    {
      id: 'weather',
      title: 'Weather & Atmosphere',
      visible: true,
      order: 0,
      colSpan: 5,
      rowSpan: 2,
      minHeight: 310,
      customHeight: null,
      density: 'comfortable',
    },
    {
      id: 'forex',
      title: 'Trading / Forex',
      visible: true,
      order: 1,
      colSpan: 4,
      rowSpan: 2,
      minHeight: 310,
      customHeight: null,
      density: 'comfortable',
    },
    {
      id: 'quick_links',
      title: 'Quick Links',
      visible: true,
      order: 2,
      colSpan: 3,
      rowSpan: 2,
      minHeight: 310,
      customHeight: null,
      density: 'comfortable',
    },
    {
      id: 'notepad',
      title: 'Local Notepad',
      visible: true,
      order: 3,
      colSpan: 7,
      rowSpan: 2,
      minHeight: 340,
      customHeight: null,
      density: 'comfortable',
    },
    {
      id: 'daily_activity',
      title: 'Daily Activity',
      visible: true,
      order: 4,
      colSpan: 5,
      rowSpan: 2,
      minHeight: 340,
      customHeight: null,
      density: 'comfortable',
    },
    {
      id: 'music',
      title: 'Music Embed',
      visible: true,
      order: 5,
      colSpan: 7,
      rowSpan: 2,
      minHeight: 300,
      customHeight: null,
      density: 'comfortable',
    },
    {
      id: 'prayer_times',
      title: 'Prayer Schedule',
      visible: true,
      order: 6,
      colSpan: 5,
      rowSpan: 2,
      minHeight: 300,
      customHeight: null,
      density: 'comfortable',
    },
  ];
}

export function createDefaultConfig(now: Date = new Date()): WingstConfig {
  const todayStr = getLocalCalendarDate(now);
  return {
    version: WINGST_CONFIG_VERSION,
    appearance: {
      theme: 'dark',
      primaryColor: '#e11d48',
      customBgColor: null,
      customSurfaceColor: null,
      customBorderColor: null,
      borderRadius: 12,
      liquid: {
        enabled: true,
        variant: 'frosted',
        blurPx: 22,
        opacity: 0.62,
        specularIntensity: 0.45,
        liteMode: false,
      },
    },
    background: {
      type: 'image',
      mediaUrl: DEFAULT_HERO_IMAGE,
      localAssetId: null,
      solidColor: '#09090b',
      sizing: 'cover',
      position: 'center',
      overlayOpacity: 0.28,
      brightness: 0.96,
      heroHeight: 460,
      fixedAttachment: true,
      focusTarget: '',
    },
    layout: createDefaultLayout(),
    quickLinks: {
      items: [
        {
          id: 'ql-github',
          title: 'GitHub',
          url: 'https://github.com',
          group: 'Development',
          order: 0,
        },
        {
          id: 'ql-mdn',
          title: 'MDN Docs',
          url: 'https://developer.mozilla.org',
          group: 'Development',
          order: 1,
        },
        {
          id: 'ql-tradingview',
          title: 'TradingView',
          url: 'https://www.tradingview.com',
          group: 'Markets',
          order: 2,
        },
      ],
      groups: ['Development', 'Markets', 'General'],
      viewMode: 'expanded',
      openInNewTab: true,
    },
    dailyActivity: {
      // Strictly empty by default per specification
      activities: [],
      activeDate: todayStr,
      todayCompletedIds: [],
      history: {},
    },
    notepad: {
      notes: [
        {
          id: 'note-welcome',
          title: 'Workspace Scratchpad',
          content:
            'Local-first scratchpad. Changes save automatically to your browser storage and never leave this device.',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
      activeNoteId: 'note-welcome',
    },
    search: {
      provider: 'google',
      openInNewTab: false,
      persistHistory: true,
      showSuggestions: true,
      history: [],
    },
    music: {
      activeTab: 'spotify',
      provider: 'spotify',
      activeEmbedUrl:
        'https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO?utm_source=generator&theme=0',
      displayMode: 'expanded',
      localTracks: [],
      activeLocalTrackId: null,
      visualizerEnabled: true,
      savedPlaylists: [
        {
          id: 'pl-lofi',
          title: 'Peaceful Piano (Official Spotify Embed)',
          provider: 'spotify',
          url: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO',
          embedUrl:
            'https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO?utm_source=generator&theme=0',
        },
        {
          id: 'pl-synth',
          title: 'Deep Focus Instrumental (Spotify)',
          provider: 'spotify',
          url: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ',
          embedUrl:
            'https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKCadgRdKQ?utm_source=generator&theme=0',
        },
      ],
    },
    location: {
      city: 'Jakarta',
      country: 'Indonesia',
      latitude: -6.2088,
      longitude: 106.8456,
      unit: 'celsius',
      windUnit: 'kmh',
      autoDetect: false,
      prayerCityId: '1301',
      prayerCityName: 'KOTA JAKARTA',
      prayerMethod: 20,
    },
    forex: {
      baseCurrency: 'USD',
      quoteCurrency: 'IDR',
      timeframe: '30D',
    },
  };
}

/**
 * Generates an ordered list of favicon image URLs derived directly from a link URL.
 * Includes server proxy, Google S2 favicons, DuckDuckGo ip3 icons, and direct origin /favicon.ico.
 */
export function getFaviconSources(
  rawUrl: string,
  customIcon?: string,
  preferDirectExternal: boolean = false
): string[] {
  const sources: string[] = [];
  if (customIcon && customIcon.trim()) {
    const check = validateSafeUrl(customIcon);
    if (check.valid) {
      sources.push(check.normalizedUrl);
    }
  }

  const check = validateSafeUrl(rawUrl);
  if (!check.valid) {
    return sources;
  }

  try {
    const parsed = new URL(check.normalizedUrl);
    const hostname = parsed.hostname;
    const origin = parsed.origin;

    if (!preferDirectExternal) {
      sources.push(`/api/favicon?url=${encodeURIComponent(check.normalizedUrl)}`);
    }
    sources.push(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`
    );
    sources.push(
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname)}.ico`
    );
    sources.push(`${origin}/favicon.ico`);
  } catch {
    // ignore malformed URL
  }

  return sources;
}

/**
 * Validates that a URL uses a safe http: or https: scheme.
 * Automatically prepends https:// if no protocol is supplied and it looks like a domain.
 */
export function validateSafeUrl(rawInput: string): {
  valid: boolean;
  normalizedUrl: string;
  error?: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: false, normalizedUrl: '', error: 'URL cannot be empty.' };
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Unsafe URL protocol rejected. Only http:// and https:// are allowed.',
    };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Only HTTP and HTTPS protocols are permitted.',
      };
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Please enter a valid domain name (e.g. example.com).',
      };
    }
    return { valid: true, normalizedUrl: parsed.toString() };
  } catch {
    return { valid: false, normalizedUrl: '', error: 'Malformed URL format.' };
  }
}

export function buildSearchUrl(provider: SearchProviderId, query: string): string {
  const spec = SEARCH_PROVIDERS[provider] || SEARCH_PROVIDERS.google;
  return `${spec.searchUrl}${encodeURIComponent(query.trim())}`;
}

export function recordSearchQuery(
  searchConfig: SearchConfig,
  query: string,
  now: Date = new Date()
): SearchConfig {
  const trimmed = query.trim();
  if (!trimmed || !searchConfig.persistHistory) {
    return searchConfig;
  }

  const filtered = searchConfig.history.filter(
    (entry) => entry.query.toLowerCase() !== trimmed.toLowerCase()
  );

  const nextEntry = {
    id: `sh-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    query: trimmed,
    provider: searchConfig.provider,
    timestamp: now.toISOString(),
  };

  return {
    ...searchConfig,
    history: [nextEntry, ...filtered].slice(0, 25),
  };
}

/**
 * Reconciles the daily activity state for the user's current local calendar day.
 * When a new local day starts, archives the previous day's completion state into `history`
 * and resets `todayCompletedIds` without ever erasing historical records.
 */
export function reconcileDailyActivityDay(
  state: DailyActivityConfig,
  now: Date = new Date()
): DailyActivityConfig {
  const currentLocalDay = getLocalCalendarDate(now);
  if (state.activeDate === currentLocalDay) {
    return state;
  }

  const updatedHistory = { ...state.history };
  if (state.activeDate && (state.todayCompletedIds.length > 0 || state.activities.length > 0)) {
    updatedHistory[state.activeDate] = {
      date: state.activeDate,
      completedIds: [...state.todayCompletedIds],
      totalDefined: state.activities.length,
    };
  }

  // If the new day already had a saved record (e.g., timezone shift back), restore it
  const existingForToday = updatedHistory[currentLocalDay];

  return {
    ...state,
    activeDate: currentLocalDay,
    todayCompletedIds: existingForToday ? [...existingForToday.completedIds] : [],
    history: updatedHistory,
  };
}

export function toggleActivityCompletion(
  state: DailyActivityConfig,
  activityId: string,
  now: Date = new Date()
): DailyActivityConfig {
  const reconciled = reconcileDailyActivityDay(state, now);
  const exists = reconciled.activities.some((a) => a.id === activityId);
  if (!exists) return reconciled;

  const isCompleted = reconciled.todayCompletedIds.includes(activityId);
  const nextCompleted = isCompleted
    ? reconciled.todayCompletedIds.filter((id) => id !== activityId)
    : [...reconciled.todayCompletedIds, activityId];

  const todayDate = reconciled.activeDate;
  const nextHistory = {
    ...reconciled.history,
    [todayDate]: {
      date: todayDate,
      completedIds: nextCompleted,
      totalDefined: reconciled.activities.length,
    },
  };

  return {
    ...reconciled,
    todayCompletedIds: nextCompleted,
    history: nextHistory,
  };
}

export function resetTodayActivityCompletions(
  state: DailyActivityConfig,
  now: Date = new Date()
): DailyActivityConfig {
  const reconciled = reconcileDailyActivityDay(state, now);
  const todayDate = reconciled.activeDate;
  const nextHistory = { ...reconciled.history };

  if (nextHistory[todayDate]) {
    nextHistory[todayDate] = {
      ...nextHistory[todayDate],
      completedIds: [],
      totalDefined: reconciled.activities.length,
    };
  }

  return {
    ...reconciled,
    todayCompletedIds: [],
    history: nextHistory,
  };
}

export function calculateDailyProgress(state: DailyActivityConfig): {
  completedCount: number;
  totalCount: number;
  percentage: number;
} {
  const totalCount = state.activities.length;
  if (totalCount === 0) {
    return { completedCount: 0, totalCount: 0, percentage: 0 };
  }
  const validIds = new Set(state.activities.map((a) => a.id));
  const completedCount = state.todayCompletedIds.filter((id) => validIds.has(id)).length;
  const percentage = Math.round((completedCount / totalCount) * 100);
  return { completedCount, totalCount, percentage };
}

export function reorderModules(
  layout: ModuleLayoutConfig[],
  sourceId: ModuleId,
  targetId: ModuleId
): ModuleLayoutConfig[] {
  if (sourceId === targetId) return layout;
  const sorted = [...layout].sort((a, b) => a.order - b.order);
  const sourceIdx = sorted.findIndex((m) => m.id === sourceId);
  const targetIdx = sorted.findIndex((m) => m.id === targetId);
  if (sourceIdx === -1 || targetIdx === -1) return layout;

  const [moved] = sorted.splice(sourceIdx, 1);
  sorted.splice(targetIdx, 0, moved);

  return sorted.map((item, idx) => ({
    ...item,
    order: idx,
  }));
}

export function clampModuleSpan(colSpan: number, rowSpan: number): {
  colSpan: number;
  rowSpan: number;
} {
  return {
    colSpan: Math.max(3, Math.min(12, Math.round(colSpan))),
    rowSpan: Math.max(1, Math.min(3, Math.round(rowSpan))),
  };
}

export function resetSingleModuleLayout(
  layout: ModuleLayoutConfig[],
  moduleId: ModuleId
): ModuleLayoutConfig[] {
  const defaults = createDefaultLayout();
  const defaultMod = defaults.find((m) => m.id === moduleId);
  if (!defaultMod) return layout;

  return layout.map((mod) =>
    mod.id === moduleId
      ? {
          ...defaultMod,
          order: mod.order,
        }
      : mod
  );
}

/**
 * Converts a user-supplied Spotify, YouTube, Apple Music, or SoundCloud URL
 * into a safe official embed URL.
 */
export function parseOfficialMusicEmbed(
  rawUrl: string,
  fallbackProvider: MusicProviderId = 'spotify'
): {
  valid: boolean;
  provider: MusicProviderId;
  embedUrl: string;
  error?: string;
} {
  const trimmed = rawUrl.trim();
  // Support direct Spotify URI: spotify:playlist:37i9dQZF1DX4sWSpwq3LiO
  const spotifyUriMatch = trimmed.match(
    /^spotify:(playlist|album|track|artist|episode|show):([a-zA-Z0-9]+)$/i
  );
  if (spotifyUriMatch) {
    return {
      valid: true,
      provider: 'spotify',
      embedUrl: `https://open.spotify.com/embed/${spotifyUriMatch[1].toLowerCase()}/${spotifyUriMatch[2]}?utm_source=generator&theme=0`,
    };
  }

  const urlCheck = validateSafeUrl(trimmed);
  if (!urlCheck.valid) {
    return {
      valid: false,
      provider: fallbackProvider,
      embedUrl: '',
      error: urlCheck.error,
    };
  }

  try {
    const parsed = new URL(urlCheck.normalizedUrl);
    const host = parsed.hostname.toLowerCase();

    // Spotify
    if (host.includes('spotify.com')) {
      if (parsed.pathname.startsWith('/embed/')) {
        return {
          valid: true,
          provider: 'spotify',
          embedUrl: parsed.toString(),
        };
      }
      const cleanPath = parsed.pathname.replace(/^\/intl-[a-z]{2}\//i, '/');
      const match = cleanPath.match(/^\/(playlist|album|track|artist|episode|show)\/([a-zA-Z0-9]+)/);
      if (match) {
        return {
          valid: true,
          provider: 'spotify',
          embedUrl: `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`,
        };
      }
      return {
        valid: false,
        provider: 'spotify',
        embedUrl: '',
        error: 'Spotify link must point to a playlist, album, track, or podcast.',
      };
    }

    // YouTube / YouTube Music
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      if (parsed.pathname.startsWith('/embed/')) {
        return { valid: true, provider: 'youtube', embedUrl: parsed.toString() };
      }
      const listId = parsed.searchParams.get('list');
      const videoId =
        parsed.searchParams.get('v') ||
        (host === 'youtu.be' ? parsed.pathname.slice(1) : null);

      if (listId && !videoId) {
        return {
          valid: true,
          provider: 'youtube',
          embedUrl: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(listId)}`,
        };
      }
      if (videoId) {
        const listParam = listId ? `?list=${encodeURIComponent(listId)}` : '';
        return {
          valid: true,
          provider: 'youtube',
          embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}${listParam}`,
        };
      }
      return {
        valid: false,
        provider: 'youtube',
        embedUrl: '',
        error: 'YouTube link must contain a video ID (v=) or playlist ID (list=).',
      };
    }

    // Apple Music
    if (host.includes('music.apple.com')) {
      const embedHostUrl = parsed.toString().replace('https://music.apple.com', 'https://embed.music.apple.com');
      return {
        valid: true,
        provider: 'apple_music',
        embedUrl: embedHostUrl,
      };
    }

    // SoundCloud
    if (host.includes('soundcloud.com')) {
      if (host.includes('w.soundcloud.com')) {
        return { valid: true, provider: 'soundcloud', embedUrl: parsed.toString() };
      }
      return {
        valid: true,
        provider: 'soundcloud',
        embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(parsed.toString())}&color=%23e11d48&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`,
      };
    }

    return {
      valid: false,
      provider: fallbackProvider,
      embedUrl: '',
      error:
        'Unsupported provider domain. Use an official Spotify, YouTube, Apple Music, or SoundCloud URL.',
    };
  } catch {
    return {
      valid: false,
      provider: fallbackProvider,
      embedUrl: '',
      error: 'Invalid URL.',
    };
  }
}

export interface PrayerScheduleMap {
  Fajr: string; // HH:MM
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export type PrayerName = keyof PrayerScheduleMap;

export const PRAYER_ORDER: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export function evaluatePrayerStatus(
  schedule: PrayerScheduleMap,
  now: Date = new Date()
): {
  currentPrayer: PrayerName | 'Pre-Fajr';
  nextPrayer: PrayerName;
  nextPrayerTime: string;
  secondsUntilNext: number;
} {
  const nowSeconds =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const toSeconds = (hhmm: string): number => {
    const clean = hhmm.trim().split(' ')[0];
    const [hStr, mStr] = clean.split(':');
    const h = Number(hStr) || 0;
    const m = Number(mStr) || 0;
    return h * 3600 + m * 60;
  };

  const timesInSec = PRAYER_ORDER.map((name) => ({
    name,
    timeStr: schedule[name],
    sec: toSeconds(schedule[name]),
  }));

  let currentPrayer: PrayerName | 'Pre-Fajr' = 'Pre-Fajr';
  let nextPrayer: PrayerName = 'Fajr';
  let nextPrayerTime = schedule.Fajr;
  let secondsUntilNext = 0;

  for (let i = 0; i < timesInSec.length; i++) {
    if (nowSeconds >= timesInSec[i].sec) {
      currentPrayer = timesInSec[i].name;
    } else {
      nextPrayer = timesInSec[i].name;
      nextPrayerTime = timesInSec[i].timeStr;
      secondsUntilNext = timesInSec[i].sec - nowSeconds;
      return {
        currentPrayer,
        nextPrayer,
        nextPrayerTime,
        secondsUntilNext,
      };
    }
  }

  // Past Isha: current period is Isha, next scheduled prayer is tomorrow's Fajr
  const fajrSeconds = timesInSec[0].sec;
  secondsUntilNext = 24 * 3600 - nowSeconds + fajrSeconds;
  return {
    currentPrayer: 'Isha',
    nextPrayer: 'Fajr',
    nextPrayerTime: schedule.Fajr,
    secondsUntilNext,
  };
}

/**
 * Safely validates and migrates imported or persisted configuration objects.
 * Protects user data during layout migrations and rejects corrupted inputs cleanly.
 */
export function validateAndMigrateConfig(
  raw: unknown,
  now: Date = new Date()
): { valid: boolean; config: WingstConfig; warnings: string[]; error?: string } {
  const defaults = createDefaultConfig(now);
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      config: defaults,
      warnings: [],
      error: 'Configuration root must be a valid JSON object.',
    };
  }

  const input = raw as Record<string, unknown>;

  // Appearance
  const rawApp = (input.appearance as Record<string, unknown>) || {};
  const theme =
    rawApp.theme === 'light' || rawApp.theme === 'dark' || rawApp.theme === 'system'
      ? rawApp.theme
      : defaults.appearance.theme;
  const primaryColor =
    typeof rawApp.primaryColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(rawApp.primaryColor)
      ? rawApp.primaryColor
      : defaults.appearance.primaryColor;
  const borderRadius =
    typeof rawApp.borderRadius === 'number'
      ? Math.max(4, Math.min(22, Math.round(rawApp.borderRadius)))
      : defaults.appearance.borderRadius;

  const rawLiquid = (rawApp.liquid as Record<string, unknown>) || {};
  const liquidVariant =
    rawLiquid.variant === 'frosted' ||
    rawLiquid.variant === 'clear' ||
    rawLiquid.variant === 'blur'
      ? rawLiquid.variant
      : defaults.appearance.liquid.variant;

  // Background
  const rawBg = (input.background as Record<string, unknown>) || {};
  const bgType =
    rawBg.type === 'image' ||
    rawBg.type === 'gif' ||
    rawBg.type === 'video' ||
    rawBg.type === 'solid'
      ? rawBg.type
      : defaults.background.type;

  // Layout migration: ensure all 7 modules exist without losing custom spans or ordering
  const rawLayout = Array.isArray(input.layout) ? input.layout : [];
  const mergedLayout: ModuleLayoutConfig[] = defaults.layout.map((defMod) => {
    const found = rawLayout.find(
      (item: unknown) =>
        item && typeof item === 'object' && (item as { id?: string }).id === defMod.id
    ) as Partial<ModuleLayoutConfig> | undefined;
    if (!found) {
      warnings.push(`Restored missing module layout for ${defMod.id}.`);
      return defMod;
    }
    const clamped = clampModuleSpan(
      typeof found.colSpan === 'number' ? found.colSpan : defMod.colSpan,
      typeof found.rowSpan === 'number' ? found.rowSpan : defMod.rowSpan
    );
    return {
      ...defMod,
      visible: typeof found.visible === 'boolean' ? found.visible : defMod.visible,
      order: typeof found.order === 'number' ? found.order : defMod.order,
      colSpan: clamped.colSpan,
      rowSpan: clamped.rowSpan,
      customHeight:
        typeof found.customHeight === 'number' && found.customHeight >= 180
          ? found.customHeight
          : null,
      density:
        found.density === 'compact' || found.density === 'comfortable'
          ? found.density
          : defMod.density,
    };
  });
  mergedLayout.sort((a, b) => a.order - b.order).forEach((m, i) => {
    m.order = i;
  });

  // Daily Activity preservation
  const rawDa = (input.dailyActivity as Record<string, unknown>) || {};
  const activities = Array.isArray(rawDa.activities)
    ? rawDa.activities.filter(
        (a: unknown): a is WingstConfig['dailyActivity']['activities'][number] =>
          Boolean(
            a &&
              typeof a === 'object' &&
              typeof (a as { id?: unknown }).id === 'string' &&
              typeof (a as { title?: unknown }).title === 'string'
          )
      )
    : defaults.dailyActivity.activities;

  const rawHistory =
    rawDa.history && typeof rawDa.history === 'object' && !Array.isArray(rawDa.history)
      ? (rawDa.history as WingstConfig['dailyActivity']['history'])
      : {};

  const reconciledDaily = reconcileDailyActivityDay(
    {
      activities,
      activeDate:
        typeof rawDa.activeDate === 'string'
          ? rawDa.activeDate
          : defaults.dailyActivity.activeDate,
      todayCompletedIds: Array.isArray(rawDa.todayCompletedIds)
        ? rawDa.todayCompletedIds.filter((id): id is string => typeof id === 'string')
        : [],
      history: rawHistory,
    },
    now
  );

  // Quick links validation
  const rawQl = (input.quickLinks as Record<string, unknown>) || {};
  const validLinks = Array.isArray(rawQl.items)
    ? rawQl.items.filter((item: unknown) => {
        if (!item || typeof item !== 'object') return false;
        const candidate = item as { title?: unknown; url?: unknown };
        if (typeof candidate.title !== 'string' || typeof candidate.url !== 'string') {
          return false;
        }
        return validateSafeUrl(candidate.url).valid;
      })
    : defaults.quickLinks.items;

  // Notepad preservation
  const rawNotes = (input.notepad as Record<string, unknown>) || {};
  const validNotes = Array.isArray(rawNotes.notes)
    ? rawNotes.notes.filter(
        (n: unknown): n is WingstConfig['notepad']['notes'][number] =>
          Boolean(
            n &&
              typeof n === 'object' &&
              typeof (n as { id?: unknown }).id === 'string' &&
              typeof (n as { title?: unknown }).title === 'string' &&
              typeof (n as { content?: unknown }).content === 'string'
          )
      )
    : defaults.notepad.notes;

  // Search preservation
  const rawSearch = (input.search as Record<string, unknown>) || {};
  const provider =
    typeof rawSearch.provider === 'string' && rawSearch.provider in SEARCH_PROVIDERS
      ? (rawSearch.provider as SearchProviderId)
      : defaults.search.provider;

  const migrated: WingstConfig = {
    version: WINGST_CONFIG_VERSION,
    appearance: {
      theme,
      primaryColor,
      customBgColor:
        typeof rawApp.customBgColor === 'string' ? rawApp.customBgColor : null,
      customSurfaceColor:
        typeof rawApp.customSurfaceColor === 'string' ? rawApp.customSurfaceColor : null,
      customBorderColor:
        typeof rawApp.customBorderColor === 'string' ? rawApp.customBorderColor : null,
      borderRadius,
      liquid: {
        enabled:
          typeof rawLiquid.enabled === 'boolean'
            ? rawLiquid.enabled
            : defaults.appearance.liquid.enabled,
        variant: liquidVariant,
        blurPx:
          typeof rawLiquid.blurPx === 'number'
            ? Math.max(4, Math.min(48, Math.round(rawLiquid.blurPx)))
            : defaults.appearance.liquid.blurPx,
        opacity:
          typeof rawLiquid.opacity === 'number'
            ? Math.max(0.12, Math.min(0.92, rawLiquid.opacity))
            : defaults.appearance.liquid.opacity,
        specularIntensity:
          typeof rawLiquid.specularIntensity === 'number'
            ? Math.max(0, Math.min(1, rawLiquid.specularIntensity))
            : defaults.appearance.liquid.specularIntensity,
        liteMode:
          typeof rawLiquid.liteMode === 'boolean' ? rawLiquid.liteMode : false,
      },
    },
    background: {
      type: bgType,
      mediaUrl:
        typeof rawBg.mediaUrl === 'string' && rawBg.mediaUrl.trim()
          ? rawBg.mediaUrl
          : defaults.background.mediaUrl,
      localAssetId:
        typeof rawBg.localAssetId === 'string' ? rawBg.localAssetId : null,
      solidColor:
        typeof rawBg.solidColor === 'string'
          ? rawBg.solidColor
          : defaults.background.solidColor,
      sizing:
        rawBg.sizing === 'cover' || rawBg.sizing === 'contain' || rawBg.sizing === 'center'
          ? rawBg.sizing
          : defaults.background.sizing,
      position:
        typeof rawBg.position === 'string'
          ? rawBg.position
          : defaults.background.position,
      overlayOpacity:
        typeof rawBg.overlayOpacity === 'number'
          ? Math.max(0, Math.min(0.95, rawBg.overlayOpacity))
          : defaults.background.overlayOpacity,
      brightness:
        typeof rawBg.brightness === 'number'
          ? Math.max(0.2, Math.min(1.5, rawBg.brightness))
          : defaults.background.brightness,
      heroHeight:
        typeof rawBg.heroHeight === 'number'
          ? Math.max(240, Math.min(950, rawBg.heroHeight))
          : defaults.background.heroHeight,
      fixedAttachment:
        typeof rawBg.fixedAttachment === 'boolean'
          ? rawBg.fixedAttachment
          : true,
      focusTarget:
        typeof rawBg.focusTarget === 'string' ? rawBg.focusTarget : '',
    },
    layout: mergedLayout,
    quickLinks: {
      items: validLinks as WingstConfig['quickLinks']['items'],
      groups: Array.isArray(rawQl.groups)
        ? rawQl.groups.filter((g): g is string => typeof g === 'string')
        : defaults.quickLinks.groups,
      viewMode: rawQl.viewMode === 'compact' ? 'compact' : 'expanded',
      openInNewTab:
        typeof rawQl.openInNewTab === 'boolean'
          ? rawQl.openInNewTab
          : defaults.quickLinks.openInNewTab,
    },
    dailyActivity: reconciledDaily,
    notepad: {
      notes: validNotes,
      activeNoteId:
        typeof rawNotes.activeNoteId === 'string'
          ? rawNotes.activeNoteId
          : validNotes[0]?.id || null,
    },
    search: {
      provider,
      openInNewTab:
        typeof rawSearch.openInNewTab === 'boolean'
          ? rawSearch.openInNewTab
          : defaults.search.openInNewTab,
      persistHistory:
        typeof rawSearch.persistHistory === 'boolean'
          ? rawSearch.persistHistory
          : defaults.search.persistHistory,
      showSuggestions:
        typeof rawSearch.showSuggestions === 'boolean'
          ? rawSearch.showSuggestions
          : defaults.search.showSuggestions,
      history: Array.isArray(rawSearch.history)
        ? (rawSearch.history as WingstConfig['search']['history'])
        : [],
    },
    music: {
      ...defaults.music,
      ...(input.music && typeof input.music === 'object' ? input.music : {}),
    },
    location: {
      ...defaults.location,
      ...(input.location && typeof input.location === 'object' ? input.location : {}),
    },
    forex: {
      ...defaults.forex,
      ...(input.forex && typeof input.forex === 'object' ? input.forex : {}),
    },
  };

  return { valid: true, config: migrated, warnings };
}

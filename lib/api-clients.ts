import { PrayerScheduleMap } from './wingst-core';
import { isExtensionContext } from './storage';

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  conditionLabel: string;
  hourly: {
    time: string;
    temperature: number;
    weatherCode: number;
  }[];
  unitSymbol: string;
  windUnitSymbol: string;
  fetchedAt: string;
  source: string;
  dataStatus: 'live' | 'cached';
}

export interface GeocodingResult {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export interface KemenagCityResult {
  id: string;
  lokasi: string;
}

export interface ForexSeriesPoint {
  date: string;
  rate: number;
}

export interface ForexData {
  base: string;
  quote: string;
  latestRate: number;
  latestDate: string;
  changeAbs: number;
  changePct: number;
  periodHigh: number;
  periodLow: number;
  series: ForexSeriesPoint[];
  fetchedAt: string;
  source: string;
  dataStatus: 'reference' | 'cached';
}

export interface PrayerTimesData {
  schedule: PrayerScheduleMap;
  Imsak?: string;
  Sunrise?: string;
  locationLabel: string;
  dateLabel: string;
  hijriLabel?: string;
  source: string;
  fetchedAt: string;
  dataStatus: 'live' | 'cached';
}

export function mapWmoCodeToLabel(code: number): string {
  const map: Record<number, string> = {
    0: 'Clear Sky',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Rime Fog',
    51: 'Light Drizzle',
    53: 'Moderate Drizzle',
    55: 'Dense Drizzle',
    61: 'Slight Rain',
    63: 'Moderate Rain',
    65: 'Heavy Rain',
    71: 'Slight Snow',
    73: 'Moderate Snow',
    75: 'Heavy Snow',
    80: 'Rain Showers',
    81: 'Moderate Showers',
    82: 'Violent Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm & Hail',
    99: 'Heavy Thunderstorm',
  };
  return map[code] || 'Variable Conditions';
}

const WEATHER_CACHE_KEY = 'wingst_cache_weather_v2';
const FOREX_CACHE_KEY = 'wingst_cache_forex_v2';
const PRAYER_CACHE_KEY = 'wingst_cache_prayer_v2';

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage quota issues for transient cache
  }
}

export async function searchCityGeocoding(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  let json: { results?: Record<string, unknown>[] } | null = null;

  if (
    !isExtensionContext() &&
    typeof window !== 'undefined' &&
    window.location.protocol.startsWith('http')
  ) {
    try {
      const apiRes = await fetch(
        `/api/weather?action=geocode&q=${encodeURIComponent(trimmed)}`
      );
      if (apiRes.ok) {
        json = await apiRes.json();
      }
    } catch {
      // fallback to direct below
    }
  }

  if (!json) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      trimmed
    )}&count=6&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Geocoding request failed (${res.status})`);
    }
    json = await res.json();
  }

  if (!json || !Array.isArray(json.results)) return [];
  return json.results.map((r: Record<string, unknown>) => ({
    id: Number(r.id) || Math.random(),
    name: String(r.name || ''),
    country: String(r.country || ''),
    admin1: r.admin1 ? String(r.admin1) : undefined,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
  }));
}

export async function searchKemenagCities(query: string): Promise<KemenagCityResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  if (
    !isExtensionContext() &&
    typeof window !== 'undefined' &&
    window.location.protocol.startsWith('http')
  ) {
    try {
      const res = await fetch(
        `/api/prayer?action=searchCity&q=${encodeURIComponent(trimmed)}`
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.results)) return json.results;
      }
    } catch {
      // fallback to direct below
    }
  }

  const directRes = await fetch(
    `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(trimmed)}`
  );
  if (!directRes.ok) return [];
  const dJson = await directRes.json();
  if (!Array.isArray(dJson?.data)) return [];
  return dJson.data.slice(0, 12).map((item: { id?: string; lokasi?: string }) => ({
    id: String(item.id || ''),
    lokasi: String(item.lokasi || ''),
  }));
}

export interface GpsResolvedLocation {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  prayerCityId: string;
  prayerCityName: string;
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number
): Promise<GpsResolvedLocation> {
  if (
    !isExtensionContext() &&
    typeof window !== 'undefined' &&
    window.location.protocol.startsWith('http')
  ) {
    try {
      const res = await fetch(
        `/api/weather?action=reverseGeocode&lat=${latitude}&lon=${longitude}`
      );
      if (res.ok) {
        const data = await res.json();
        return {
          city: data.city || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
          country: data.country || 'GPS Location',
          latitude,
          longitude,
          prayerCityId: String(data.prayerCityId || ''),
          prayerCityName: String(
            data.prayerCityName || data.city?.toUpperCase() || 'GPS COORDINATES'
          ),
        };
      }
    } catch {
      // Fallback to direct client call below
    }
  }

  try {
    const revRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=id`
    );
    if (revRes.ok) {
      const data = await revRes.json();
      const city =
        data.city ||
        data.locality ||
        data.principalSubdivision ||
        `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
      const country = data.countryName || 'GPS Location';
      let prayerCityId = '';
      let prayerCityName = city.toUpperCase();

      if (String(data.countryCode || '').toUpperCase() === 'ID') {
        const cleanCity = city.replace(/^(kota|kabupaten|kab\.?)\s+/i, '').trim();
        const found = await searchKemenagCities(cleanCity);
        if (found.length > 0) {
          prayerCityId = found[0].id;
          prayerCityName = found[0].lokasi;
        }
      }

      return {
        city,
        country,
        latitude,
        longitude,
        prayerCityId,
        prayerCityName,
      };
    }
  } catch {
    // Ignore
  }

  return {
    city: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
    country: 'GPS Coordinates',
    latitude,
    longitude,
    prayerCityId: '',
    prayerCityName: 'GPS COORDINATES',
  };
}

export function detectGpsAndResolveLocation(): Promise<GpsResolvedLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Browser Anda tidak mendukung fitur GPS Geolocation.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const resolved = await reverseGeocodeCoordinates(
            pos.coords.latitude,
            pos.coords.longitude
          );
          resolve(resolved);
        } catch {
          resolve({
            city: `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`,
            country: 'GPS Coordinates',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            prayerCityId: '',
            prayerCityName: 'GPS COORDINATES',
          });
        }
      },
      (err) => {
        reject(
          new Error(
            err.code === 1
              ? 'Izin lokasi GPS ditolak oleh browser. Aktifkan izin lokasi atau pilih kota manual.'
              : `Gagal mendeteksi titik GPS: ${err.message}`
          )
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

export async function fetchWeatherClient(params: {
  latitude: number;
  longitude: number;
  unit: 'celsius' | 'fahrenheit';
  windUnit: 'kmh' | 'mph' | 'ms';
}): Promise<WeatherData> {
  const cacheSubKey = `${WEATHER_CACHE_KEY}_${params.latitude.toFixed(2)}_${params.longitude.toFixed(2)}_${params.unit}_${params.windUnit}`;

  try {
    let rawJson: Record<string, unknown> | null = null;

    if (
      !isExtensionContext() &&
      typeof window !== 'undefined' &&
      window.location.protocol.startsWith('http')
    ) {
      try {
        const apiRes = await fetch(
          `/api/weather?lat=${params.latitude}&lon=${params.longitude}&unit=${params.unit}&wind=${params.windUnit}`
        );
        if (apiRes.ok) {
          rawJson = await apiRes.json();
        }
      } catch {
        // Fallback to direct Open-Meteo call below
      }
    }

    if (!rawJson || !rawJson.current) {
      const directUrl = `https://api.open-meteo.com/v1/forecast?latitude=${params.latitude}&longitude=${params.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&temperature_unit=${params.unit}&wind_speed_unit=${params.windUnit}&forecast_days=2&timezone=auto`;
      const directRes = await fetch(directUrl);
      if (!directRes.ok) {
        throw new Error(`Open-Meteo HTTP ${directRes.status}`);
      }
      rawJson = await directRes.json();
    }

    const current = (rawJson?.current as Record<string, unknown>) || {};
    const hourly =
      (rawJson?.hourly as {
        time?: string[];
        temperature_2m?: number[];
        weather_code?: number[];
      }) || {};

    const times = Array.isArray(hourly.time) ? hourly.time : [];
    const temps = Array.isArray(hourly.temperature_2m) ? hourly.temperature_2m : [];
    const codes = Array.isArray(hourly.weather_code) ? hourly.weather_code : [];

    // Match the current local hour returned by Open-Meteo (`current.time`)
    const currentTimePrefix =
      typeof current.time === 'string'
        ? current.time.slice(0, 13)
        : new Date().toISOString().slice(0, 13);
    let startIdx = times.findIndex((t) => t.startsWith(currentTimePrefix));
    if (startIdx === -1) startIdx = 0;

    const nextHours = times.slice(startIdx, startIdx + 8).map((t, i) => ({
      time: t,
      temperature: Math.round(
        temps[startIdx + i] ?? Number(current.temperature_2m ?? 0)
      ),
      weatherCode: codes[startIdx + i] ?? 0,
    }));

    const result: WeatherData = {
      temperature: Math.round(Number(current.temperature_2m ?? 0)),
      feelsLike: Math.round(
        Number(current.apparent_temperature ?? current.temperature_2m ?? 0)
      ),
      humidity: Math.round(Number(current.relative_humidity_2m ?? 0)),
      windSpeed: Number(Number(current.wind_speed_10m ?? 0).toFixed(1)),
      weatherCode: Number(current.weather_code ?? 0),
      conditionLabel: mapWmoCodeToLabel(Number(current.weather_code ?? 0)),
      hourly: nextHours,
      unitSymbol: params.unit === 'fahrenheit' ? '°F' : '°C',
      windUnitSymbol:
        params.windUnit === 'mph'
          ? 'mph'
          : params.windUnit === 'ms'
          ? 'm/s'
          : 'km/h',
      fetchedAt: new Date().toISOString(),
      source: 'Open-Meteo Meteorological API',
      dataStatus: 'live',
    };

    writeCache(cacheSubKey, result);
    return result;
  } catch (err) {
    const cached = readCache<WeatherData>(cacheSubKey);
    if (cached) {
      return {
        ...cached,
        dataStatus: 'cached',
      };
    }
    throw err instanceof Error
      ? err
      : new Error('Unable to retrieve weather telemetry.');
  }
}

export async function fetchForexClient(params: {
  base: string;
  quote: string;
  timeframe: '7D' | '30D' | '90D' | '1Y';
}): Promise<ForexData> {
  const cacheSubKey = `${FOREX_CACHE_KEY}_${params.base}_${params.quote}_${params.timeframe}`;

  try {
    if (
      !isExtensionContext() &&
      typeof window !== 'undefined' &&
      window.location.protocol.startsWith('http')
    ) {
      try {
        const apiRes = await fetch(
          `/api/forex?base=${encodeURIComponent(
            params.base
          )}&quote=${encodeURIComponent(
            params.quote
          )}&timeframe=${encodeURIComponent(params.timeframe)}`
        );
        if (apiRes.ok) {
          const data = (await apiRes.json()) as ForexData;
          if (data && Array.isArray(data.series) && data.series.length > 0) {
            writeCache(cacheSubKey, data);
            return data;
          }
        }
      } catch {
        // Fallback to direct HTTPS calls below
      }
    }

    const daysMap: Record<string, number> = {
      '7D': 10,
      '30D': 32,
      '90D': 92,
      '1Y': 365,
    };
    const days = daysMap[params.timeframe] || 32;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 3600 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const endpoints = [
      `https://api.frankfurter.dev/v1/${fmt(start)}..${fmt(
        end
      )}?base=${encodeURIComponent(params.base)}&symbols=${encodeURIComponent(
        params.quote
      )}`,
      `https://api.frankfurter.app/${fmt(start)}..${fmt(
        end
      )}?from=${encodeURIComponent(params.base)}&to=${encodeURIComponent(
        params.quote
      )}`,
    ];

    let json: { rates?: Record<string, Record<string, number>> } | null = null;
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep);
        if (r.ok) {
          json = await r.json();
          break;
        }
      } catch {
        // try next endpoint
      }
    }

    let series: ForexSeriesPoint[] = [];
    if (json && json.rates) {
      series = Object.entries(json.rates)
        .map(([date, rateObj]) => ({
          date,
          rate: Number(rateObj[params.quote]),
        }))
        .filter((pt) => !Number.isNaN(pt.rate) && pt.rate > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    if (series.length === 0) {
      const erRes = await fetch(
        `https://open.er-api.com/v6/latest/${encodeURIComponent(params.base)}`
      );
      if (erRes.ok) {
        const erJson = await erRes.json();
        const rateVal = Number(erJson?.rates?.[params.quote]);
        if (!Number.isNaN(rateVal) && rateVal > 0) {
          series = [
            { date: fmt(start), rate: rateVal },
            { date: fmt(end), rate: rateVal },
          ];
        }
      }
    }

    if (series.length === 0) {
      throw new Error(
        `No exchange rate records returned for ${params.base}/${params.quote}.`
      );
    }

    const first = series[0];
    const last = series[series.length - 1];
    const changeAbs = last.rate - first.rate;
    const changePct = first.rate !== 0 ? (changeAbs / first.rate) * 100 : 0;
    const ratesOnly = series.map((s) => s.rate);

    const result: ForexData = {
      base: params.base,
      quote: params.quote,
      latestRate: last.rate,
      latestDate: last.date,
      changeAbs,
      changePct,
      periodHigh: Math.max(...ratesOnly),
      periodLow: Math.min(...ratesOnly),
      series,
      fetchedAt: new Date().toISOString(),
      source: 'ECB / Frankfurter Reference Feed (Indicative)',
      dataStatus: 'reference',
    };

    writeCache(cacheSubKey, result);
    return result;
  } catch (err) {
    const cached = readCache<ForexData>(cacheSubKey);
    if (cached) {
      return {
        ...cached,
        dataStatus: 'cached',
      };
    }
    throw err instanceof Error
      ? err
      : new Error('Failed to load exchange rate series.');
  }
}

export async function fetchPrayerTimesClient(params: {
  cityId: string;
  cityName: string;
  latitude: number;
  longitude: number;
  method: number;
}): Promise<PrayerTimesData> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const cacheSubKey = `${PRAYER_CACHE_KEY}_${params.cityId}_${params.latitude.toFixed(2)}_${yyyy}-${mm}-${dd}`;

  try {
    if (
      !isExtensionContext() &&
      typeof window !== 'undefined' &&
      window.location.protocol.startsWith('http')
    ) {
      try {
        const apiRes = await fetch(
          `/api/prayer?cityId=${encodeURIComponent(
            params.cityId
          )}&cityName=${encodeURIComponent(params.cityName)}&lat=${
            params.latitude
          }&lon=${params.longitude}&method=${params.method}`
        );
        if (apiRes.ok) {
          const data = (await apiRes.json()) as PrayerTimesData;
          if (data && data.schedule) {
            writeCache(cacheSubKey, data);
            return data;
          }
        }
      } catch {
        // Fallback to direct HTTPS calls below
      }
    }

    // Try MyQuran Kemenag API first if cityId is provided
    if (params.cityId && params.cityId.trim().length > 0) {
      try {
        const kemenagUrl = `https://api.myquran.com/v2/sholat/jadwal/${encodeURIComponent(
          params.cityId
        )}/${yyyy}/${mm}/${dd}`;
        const kRes = await fetch(kemenagUrl);
        if (kRes.ok) {
          const kJson = await kRes.json();
          if (kJson?.status && kJson?.data?.jadwal) {
            const j = kJson.data.jadwal;
            const result: PrayerTimesData = {
              schedule: {
                Fajr: j.subuh,
                Dhuhr: j.dzuhur,
                Asr: j.ashar,
                Maghrib: j.maghrib,
                Isha: j.isya,
              },
              Imsak: j.imsak,
              Sunrise: j.terbit,
              locationLabel: kJson.data.lokasi || params.cityName,
              dateLabel: j.tanggal || `${yyyy}-${mm}-${dd}`,
              source: 'MyQuran Kemenag RI Official Schedule',
              fetchedAt: new Date().toISOString(),
              dataStatus: 'live',
            };
            writeCache(cacheSubKey, result);
            return result;
          }
        }
      } catch {
        // Fallback to Aladhan below
      }
    }

    // Fallback to Aladhan API by coordinates
    const aladhanUrl = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${params.latitude}&longitude=${params.longitude}&method=${
      params.method || 20
    }`;
    const aRes = await fetch(aladhanUrl);
    if (!aRes.ok) {
      throw new Error(`Aladhan API returned ${aRes.status}`);
    }
    const aJson = await aRes.json();
    const timings = aJson?.data?.timings;
    if (!timings) {
      throw new Error('Invalid prayer schedule response.');
    }
    const cleanTime = (t: string) => String(t || '').split(' ')[0];
    const result: PrayerTimesData = {
      schedule: {
        Fajr: cleanTime(timings.Fajr),
        Dhuhr: cleanTime(timings.Dhuhr),
        Asr: cleanTime(timings.Asr),
        Maghrib: cleanTime(timings.Maghrib),
        Isha: cleanTime(timings.Isha),
      },
      Imsak: cleanTime(timings.Imsak),
      Sunrise: cleanTime(timings.Sunrise),
      locationLabel:
        params.cityName ||
        `${params.latitude.toFixed(2)}, ${params.longitude.toFixed(2)}`,
      dateLabel: aJson?.data?.date?.readable || `${yyyy}-${mm}-${dd}`,
      hijriLabel: aJson?.data?.date?.hijri
        ? `${aJson.data.date.hijri.day} ${
            aJson.data.date.hijri.month?.en || ''
          } ${aJson.data.date.hijri.year} H`
        : undefined,
      source: 'Aladhan Astronomical Calculation (Kemenag/Global)',
      fetchedAt: new Date().toISOString(),
      dataStatus: 'live',
    };
    writeCache(cacheSubKey, result);
    return result;
  } catch (err) {
    const cached = readCache<PrayerTimesData>(cacheSubKey);
    if (cached) {
      return {
        ...cached,
        dataStatus: 'cached',
      };
    }
    throw err instanceof Error
      ? err
      : new Error('Prayer schedule sources are currently unreachable.');
  }
}

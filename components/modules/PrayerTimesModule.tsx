'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Compass, RefreshCw, AlertCircle, Clock, Search, X, Navigation } from 'lucide-react';
import { DisplayDensity, WeatherLocationConfig } from '@/lib/types';
import {
  fetchPrayerTimesClient,
  PrayerTimesData,
  searchKemenagCities,
  detectGpsAndResolveLocation,
} from '@/lib/api-clients';
import {
  evaluatePrayerStatus,
  PRAYER_ORDER,
  PrayerName,
} from '@/lib/wingst-core';

interface PrayerTimesModuleProps {
  location: WeatherLocationConfig;
  density: DisplayDensity;
  onUpdateLocation: (next: WeatherLocationConfig) => void;
}

const INDONESIAN_CITY_PRESETS = [
  { id: '1301', name: 'KOTA JAKARTA', lat: -6.2088, lon: 106.8456 },
  { id: '1219', name: 'KOTA BANDUNG', lat: -6.9175, lon: 107.6191 },
  { id: '1638', name: 'KOTA SURABAYA', lat: -7.2575, lon: 112.7521 },
  { id: '1505', name: 'KOTA YOGYAKARTA', lat: -7.7956, lon: 110.3695 },
  { id: '0228', name: 'KOTA MEDAN', lat: 3.5952, lon: 98.6722 },
  { id: '2622', name: 'KOTA MAKASSAR', lat: -5.1477, lon: 119.4327 },
  { id: '', name: 'USE WEATHER COORDS (Aladhan Global)', lat: 0, lon: 0 },
];

const PRAYER_LABELS: Record<PrayerName, { en: string; id: string }> = {
  Fajr: { en: 'Fajr', id: 'Subuh' },
  Dhuhr: { en: 'Dhuhr', id: 'Dzuhur' },
  Asr: { en: 'Asr', id: 'Ashar' },
  Maghrib: { en: 'Maghrib', id: 'Maghrib' },
  Isha: { en: 'Isha', id: 'Isya' },
};

export default function PrayerTimesModule({
  location,
  density,
  onUpdateLocation,
}: PrayerTimesModuleProps) {
  const [data, setData] = useState<PrayerTimesData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  // Live Kemenag city search state
  const [showCitySearch, setShowCitySearch] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<{ id: string; lokasi: string }[]>([]);
  const [searchingCity, setSearchingCity] = useState(false);
  const [syncingGps, setSyncingGps] = useState(false);

  const loadSchedule = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPrayerTimesClient({
        cityId: location.prayerCityId,
        cityName: location.prayerCityName || location.city,
        latitude: location.latitude,
        longitude: location.longitude,
        method: location.prayerMethod,
      });
      setData(res);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to retrieve prayer schedule from Kemenag / Aladhan.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    location.prayerCityId,
    location.prayerCityName,
    location.city,
    location.latitude,
    location.longitude,
    location.prayerMethod,
  ]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadSchedule();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadSchedule]);

  // Single clean 1-second timer for live countdown
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleSearchKemenag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityQuery.trim()) return;
    setSearchingCity(true);
    try {
      const found = await searchKemenagCities(cityQuery);
      setCityResults(found);
    } finally {
      setSearchingCity(false);
    }
  };

  const handleGpsSync = async () => {
    setSyncingGps(true);
    setError(null);
    try {
      const resolved = await detectGpsAndResolveLocation();
      onUpdateLocation({
        ...location,
        city: resolved.city,
        country: resolved.country,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        autoDetect: true,
        prayerCityId: resolved.prayerCityId,
        prayerCityName: resolved.prayerCityName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal sinkronisasi GPS.');
    } finally {
      setSyncingGps(false);
    }
  };

  const formatCountdown = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(
      2,
      '0'
    )}:${String(secs).padStart(2, '0')}`;
  };

  const evaluated = data ? evaluatePrayerStatus(data.schedule, now) : null;

  // Include active custom Kemenag city in dropdown if not in preset list
  const hasCustomCity =
    Boolean(location.prayerCityId) &&
    !INDONESIAN_CITY_PRESETS.some((p) => p.id === location.prayerCityId);

  return (
    <div className="flex h-full flex-col justify-between gap-3">
      {/* Top Location & Refresh Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
        <div className="flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-[var(--accent-primary)] shrink-0" />
          <select
            aria-label="Select prayer schedule city"
            value={location.prayerCityId}
            onChange={(e) => {
              const selectedId = e.target.value;
              const preset = INDONESIAN_CITY_PRESETS.find(
                (p) => p.id === selectedId
              );
              if (preset && preset.id) {
                onUpdateLocation({
                  ...location,
                  prayerCityId: preset.id,
                  prayerCityName: preset.name,
                  latitude: preset.lat,
                  longitude: preset.lon,
                  autoDetect: false,
                });
              } else if (!selectedId) {
                onUpdateLocation({
                  ...location,
                  prayerCityId: '',
                  prayerCityName: location.city.toUpperCase(),
                });
              }
            }}
            className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-xs font-semibold text-[var(--text-primary)] max-w-[190px] truncate"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            {hasCustomCity && (
              <option value={location.prayerCityId}>
                {location.prayerCityName} (Kemenag)
              </option>
            )}
            {INDONESIAN_CITY_PRESETS.map((p) => (
              <option key={p.id || 'global'} value={p.id}>
                {p.id ? `${p.name} (Kemenag)` : `Coordinates: ${location.city}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleGpsSync}
            disabled={syncingGps}
            title="Sinkronkan Jadwal Sholat & Cuaca dengan GPS"
            className="wingst-focus flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <Navigation
              className={`h-3 w-3 text-[var(--accent-primary)] ${
                syncingGps ? 'animate-spin' : ''
              }`}
            />
            <span>{syncingGps ? 'GPS...' : 'GPS'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCitySearch((v) => !v)}
            aria-label="Search Indonesian city for prayer schedule"
            className="wingst-focus flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <Search className="h-3 w-3" />
            <span>Cari Kota</span>
          </button>

          <button
            type="button"
            onClick={loadSchedule}
            aria-label="Refresh prayer schedule"
            className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Inline Kemenag City Search Panel */}
      {showCitySearch && (
        <div className="border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-2.5 text-xs space-y-2">
          <form onSubmit={handleSearchKemenag} className="flex items-center gap-1.5">
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Ketik nama kota/kabupaten (mis. Bekasi, Malang, Bali)..."
              aria-label="Cari kota Kemenag"
              className="flex-1 border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={searchingCity}
              className="bg-[var(--accent-primary)] px-2.5 py-1 text-xs font-medium text-white"
            >
              {searchingCity ? '...' : 'Cari'}
            </button>
            <button
              type="button"
              onClick={() => setShowCitySearch(false)}
              aria-label="Close city search"
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>

          {cityResults.length > 0 && (
            <div className="max-h-32 overflow-y-auto divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              {cityResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onUpdateLocation({
                      ...location,
                      prayerCityId: c.id,
                      prayerCityName: c.lokasi,
                    });
                    setShowCitySearch(false);
                    setCityResults([]);
                    setCityQuery('');
                  }}
                  className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs hover:bg-[var(--bg-elevated)]"
                >
                  <span className="font-medium text-[var(--text-primary)]">
                    {c.lokasi}
                  </span>
                  <span className="font-mono-tabular text-[10px] text-[var(--text-muted)]">
                    ID: {c.id}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {loading && !data ? (
        <div className="flex flex-1 flex-col justify-center gap-2 py-4">
          <div className="h-12 w-full animate-pulse bg-[var(--bg-elevated)]" />
          <div className="grid grid-cols-5 gap-2">
            <div className="h-14 animate-pulse bg-[var(--bg-elevated)]" />
            <div className="h-14 animate-pulse bg-[var(--bg-elevated)]" />
            <div className="h-14 animate-pulse bg-[var(--bg-elevated)]" />
            <div className="h-14 animate-pulse bg-[var(--bg-elevated)]" />
            <div className="h-14 animate-pulse bg-[var(--bg-elevated)]" />
          </div>
        </div>
      ) : error && !data ? (
        <div className="flex flex-1 flex-col justify-center gap-2 border border-[var(--status-error)]/30 bg-[var(--bg-elevated)] p-4 text-xs">
          <div className="flex items-center gap-2 font-semibold text-[var(--status-error)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Schedule Unavailable</span>
          </div>
          <p className="text-[var(--text-secondary)]">{error}</p>
          <button
            type="button"
            onClick={loadSchedule}
            className="mt-1 w-fit border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]"
          >
            Retry Request
          </button>
        </div>
      ) : data && evaluated ? (
        <>
          {/* Current Period vs Next Scheduled Prayer Banner */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-2.5"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                Active Period:{' '}
                <strong className="text-[var(--text-primary)]">
                  {evaluated.currentPrayer === 'Pre-Fajr'
                    ? 'Late Night / Pre-Fajr'
                    : `${PRAYER_LABELS[evaluated.currentPrayer].id} (${evaluated.currentPrayer})`}
                </strong>
              </div>
              <div className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">
                Next Scheduled:{' '}
                <span className="text-[var(--accent-primary)]">
                  {PRAYER_LABELS[evaluated.nextPrayer].id}
                </span>{' '}
                at{' '}
                <span className="font-mono-tabular">{evaluated.nextPrayerTime}</span>
              </div>
            </div>

            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-[10px] text-[var(--text-muted)]">
                <Clock className="h-3 w-3 text-[var(--accent-primary)]" />
                <span>Countdown</span>
              </div>
              <div
                data-testid="prayer-countdown"
                className="font-mono-tabular text-base font-bold text-[var(--text-primary)]"
              >
                -{formatCountdown(evaluated.secondsUntilNext)}
              </div>
            </div>
          </div>

          {/* Five Daily Prayers Grid */}
          <div className="grid grid-cols-5 gap-1.5">
            {PRAYER_ORDER.map((pName) => {
              const isCurrent = evaluated.currentPrayer === pName;
              const isNext = evaluated.nextPrayer === pName;
              return (
                <div
                  key={pName}
                  className={`flex flex-col items-center justify-between border px-1.5 py-2 text-center transition-colors ${
                    isNext
                      ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
                      : isCurrent
                      ? 'border-[var(--border-strong)] bg-[var(--bg-elevated)]/70'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30'
                  }`}
                  style={{ borderRadius: 'var(--radius-control)' }}
                >
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {PRAYER_LABELS[pName].id}
                  </span>
                  <span className="font-mono-tabular mt-1 text-xs font-bold text-[var(--text-primary)]">
                    {data.schedule[pName]}
                  </span>
                  <span className="mt-0.5 text-[9px] text-[var(--text-muted)]">
                    {isNext ? 'Next' : isCurrent ? 'Current' : pName}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Optional Imsak / Sunrise & Date Row */}
          {density !== 'compact' && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
              <span>
                {data.Imsak ? `Imsak ${data.Imsak}` : ''}
                {data.Imsak && data.Sunrise ? ' · ' : ''}
                {data.Sunrise ? `Sunrise ${data.Sunrise}` : ''}
              </span>
              <span>
                {data.dateLabel}
                {data.hijriLabel ? ` · ${data.hijriLabel}` : ''}
              </span>
            </div>
          )}

          {/* Footer Source */}
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-[10px] text-[var(--text-muted)]">
            <span className="truncate">{data.source}</span>
            <span className="font-mono-tabular shrink-0">{data.locationLabel}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

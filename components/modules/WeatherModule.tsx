'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Cloud,
  Droplets,
  Wind,
  MapPin,
  RefreshCw,
  Navigation,
  Search,
  AlertCircle,
  Thermometer,
} from 'lucide-react';
import { DisplayDensity, WeatherLocationConfig } from '@/lib/types';
import {
  fetchWeatherClient,
  GeocodingResult,
  searchCityGeocoding,
  WeatherData,
  detectGpsAndResolveLocation,
} from '@/lib/api-clients';

interface WeatherModuleProps {
  location: WeatherLocationConfig;
  density: DisplayDensity;
  onUpdateLocation: (next: WeatherLocationConfig) => void;
}

export default function WeatherModule({
  location,
  density,
  onUpdateLocation,
}: WeatherModuleProps) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<GeocodingResult[]>([]);
  const [searchingGeo, setSearchingGeo] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const loadWeather = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWeatherClient({
        latitude: location.latitude,
        longitude: location.longitude,
        unit: location.unit,
        windUnit: location.windUnit,
      });
      setData(res);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Weather feed unavailable. Check your network connection.'
      );
    } finally {
      setLoading(false);
    }
  }, [location.latitude, location.longitude, location.unit, location.windUnit]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadWeather();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadWeather]);

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cityQuery.trim().length < 2) return;
    setSearchingGeo(true);
    setGeoError(null);
    try {
      const results = await searchCityGeocoding(cityQuery);
      setCityResults(results);
      if (results.length === 0) {
        setGeoError('No matching locations found.');
      }
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : 'City lookup failed.');
    } finally {
      setSearchingGeo(false);
    }
  };

  const handleSelectCity = (city: GeocodingResult) => {
    onUpdateLocation({
      ...location,
      city: city.name,
      country: city.country,
      latitude: city.latitude,
      longitude: city.longitude,
      autoDetect: false,
      prayerCityName: city.name.toUpperCase(),
      // Use Aladhan coordinates if outside default Jakarta ID
      prayerCityId: city.name.toLowerCase().includes('jakarta') ? '1301' : '',
    });
    setIsSearchingCity(false);
    setCityResults([]);
    setCityQuery('');
  };

  const handleGeolocate = async () => {
    setSearchingGeo(true);
    setGeoError(null);
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
      setIsSearchingCity(false);
    } catch (err) {
      setGeoError(
        err instanceof Error
          ? err.message
          : 'Gagal mendeteksi lokasi GPS.'
      );
    } finally {
      setSearchingGeo(false);
    }
  };

  const toggleUnit = () => {
    onUpdateLocation({
      ...location,
      unit: location.unit === 'celsius' ? 'fahrenheit' : 'celsius',
    });
  };

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      {/* Top Location & Unit Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-[var(--accent-primary)] shrink-0" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {location.city}
          </span>
          {location.country && (
            <span className="text-xs text-[var(--text-muted)]">
              · {location.country}
            </span>
          )}
          {location.autoDetect && (
            <span
              className="border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 px-1.5 py-0.5 font-mono-tabular text-[9px] font-semibold text-[var(--accent-primary)]"
              style={{ borderRadius: '4px' }}
            >
              GPS
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleGeolocate}
            disabled={searchingGeo}
            data-testid="weather-gps-btn"
            title="Deteksi koordinat GPS & sinkronkan Cuaca + Jadwal Sholat"
            className="wingst-focus flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <Navigation
              className={`h-3 w-3 text-[var(--accent-primary)] ${
                searchingGeo ? 'animate-spin' : ''
              }`}
            />
            <span>{searchingGeo ? 'GPS...' : 'GPS'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSearchingCity((v) => !v)}
            className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            {isSearchingCity ? 'Close Search' : 'Change City'}
          </button>

          <button
            type="button"
            onClick={toggleUnit}
            aria-label={`Switch temperature unit (currently ${location.unit})`}
            className="wingst-focus font-mono-tabular border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            {location.unit === 'celsius' ? '°C → °F' : '°F → °C'}
          </button>

          <button
            type="button"
            onClick={loadWeather}
            aria-label="Refresh weather data"
            className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Inline City Search & Geolocation Panel */}
      {isSearchingCity && (
        <div className="border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3 text-xs">
          <form onSubmit={handleCitySearch} className="flex items-center gap-2">
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Search city (e.g. Tokyo, London, Bandung)..."
              aria-label="Search city for weather"
              className="flex-1 border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={searchingGeo}
              className="bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 whitespace-nowrap shrink-0"
            >
              <Search className="h-3.5 w-3.5 inline mr-1" />
              Find
            </button>
            <button
              type="button"
              onClick={handleGeolocate}
              disabled={searchingGeo}
              title="Detect current coordinates via browser Geolocation"
              className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            >
              <Navigation className="h-3.5 w-3.5 inline mr-1 text-[var(--accent-primary)]" />
              GPS
            </button>
          </form>

          {geoError && (
            <p className="mt-2 text-[11px] text-[var(--status-error)]">{geoError}</p>
          )}

          {cityResults.length > 0 && (
            <div className="mt-2 divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] pt-1">
              {cityResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCity(c)}
                  className="flex w-full items-center justify-between py-1.5 text-left hover:text-[var(--accent-primary)]"
                >
                  <span>
                    <strong>{c.name}</strong>
                    {c.admin1 ? `, ${c.admin1}` : ''} · {c.country}
                  </span>
                  <span className="font-mono-tabular text-[10px] text-[var(--text-muted)]">
                    {c.latitude.toFixed(2)}, {c.longitude.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {loading && !data ? (
        <div className="flex flex-1 flex-col justify-center gap-3 py-6">
          <div className="h-10 w-32 animate-pulse bg-[var(--bg-elevated)]" />
          <div className="h-4 w-48 animate-pulse bg-[var(--bg-elevated)]" />
          <div className="grid grid-cols-4 gap-2 pt-2">
            <div className="h-14 animate-pulse bg-[var(--bg-elevated)]" />
            <div className="h-14 animate-pulse bg-[var(--bg-elevated)]" />
            <div className="h-14 animate-pulse bg-[var(--bg-elevated)]" />
            <div className="h-14 animate-pulse bg-[var(--bg-elevated)]" />
          </div>
        </div>
      ) : error && !data ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-2 border border-[var(--status-error)]/30 bg-[var(--bg-elevated)] p-4 text-xs">
          <div className="flex items-center gap-2 text-[var(--status-error)] font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Weather Feed Error</span>
          </div>
          <p className="text-[var(--text-secondary)]">{error}</p>
          <button
            type="button"
            onClick={loadWeather}
            className="mt-1 border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
          >
            Retry Request
          </button>
        </div>
      ) : data ? (
        <>
          {/* Primary Reading & Metrics */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="font-mono-tabular text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl">
                {data.temperature}
                {data.unitSymbol}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <Cloud className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span>{data.conditionLabel}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 border-l border-[var(--border-subtle)] pl-4 text-xs">
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Feels Like</div>
                <div className="font-mono-tabular mt-0.5 font-semibold text-[var(--text-primary)]">
                  <Thermometer className="inline h-3 w-3 mr-0.5 text-[var(--text-muted)]" />
                  {data.feelsLike}
                  {data.unitSymbol}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Humidity</div>
                <div className="font-mono-tabular mt-0.5 font-semibold text-[var(--text-primary)]">
                  <Droplets className="inline h-3 w-3 mr-0.5 text-[var(--text-muted)]" />
                  {data.humidity}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Wind</div>
                <div className="font-mono-tabular mt-0.5 font-semibold text-[var(--text-primary)]">
                  <Wind className="inline h-3 w-3 mr-0.5 text-[var(--text-muted)]" />
                  {data.windSpeed} {data.windUnitSymbol}
                </div>
              </div>
            </div>
          </div>

          {/* Hourly Forecast Strip */}
          {density !== 'compact' && data.hourly.length > 0 && (
            <div className="border-t border-[var(--border-subtle)] pt-3">
              <div className="mb-2 text-[11px] font-medium text-[var(--text-muted)]">
                Hourly Forecast (Next 8 Hours)
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {data.hourly.map((h) => {
                  const hourLabel = h.time.split('T')[1]?.slice(0, 5) || h.time;
                  return (
                    <div
                      key={h.time}
                      className="flex flex-col items-center justify-between border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 px-1.5 py-2 text-center"
                      style={{ borderRadius: 'var(--radius-control)' }}
                    >
                      <span className="font-mono-tabular text-[10px] text-[var(--text-muted)]">
                        {hourLabel}
                      </span>
                      <span className="font-mono-tabular mt-1 text-xs font-semibold text-[var(--text-primary)]">
                        {h.temperature}
                        {data.unitSymbol}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Source & Timestamp */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-muted)]">
            <span>
              {data.source} ·{' '}
              {data.dataStatus === 'live' ? 'Live Telemetry' : 'Cached Snapshot'}
            </span>
            <span className="font-mono-tabular">
              Updated {new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  // 1. Reverse geocoding for GPS coordinates -> City, Country & Kemenag ID
  if (action === 'reverseGeocode') {
    const lat = Number(searchParams.get('lat') ?? -6.2088);
    const lon = Number(searchParams.get('lon') ?? 106.8456);

    try {
      const revUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=id`;
      const res = await fetch(revUrl, { next: { revalidate: 3600 } });
      let city = '';
      let country = '';
      let countryCode = '';

      if (res.ok) {
        const data = await res.json();
        city =
          data.city ||
          data.locality ||
          data.principalSubdivision ||
          'Lokasi GPS';
        country = data.countryName || '';
        countryCode = String(data.countryCode || '').toUpperCase();
      }

      // If in Indonesia, try matching official Kemenag city ID via MyQuran API
      let prayerCityId = '';
      let prayerCityName = city ? city.toUpperCase() : 'KOORDINAT GPS';

      if (countryCode === 'ID' && city) {
        const cleanKeyword = city
          .replace(/^(kota|kabupaten|kab\.?)\s+/i, '')
          .trim();
        if (cleanKeyword.length >= 3) {
          try {
            const kemRes = await fetch(
              `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(
                cleanKeyword
              )}`,
              { next: { revalidate: 86400 } }
            );
            if (kemRes.ok) {
              const kemJson = await kemRes.json();
              if (Array.isArray(kemJson?.data) && kemJson.data.length > 0) {
                prayerCityId = String(kemJson.data[0].id || '');
                prayerCityName = String(
                  kemJson.data[0].lokasi || city.toUpperCase()
                );
              }
            }
          } catch {
            // Fallback to coordinate calculation
          }
        }
      }

      return NextResponse.json({
        city: city || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
        country: country || 'GPS Coordinates',
        countryCode,
        latitude: lat,
        longitude: lon,
        prayerCityId,
        prayerCityName,
      });
    } catch {
      return NextResponse.json({
        city: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
        country: 'GPS Coordinates',
        countryCode: '',
        latitude: lat,
        longitude: lon,
        prayerCityId: '',
        prayerCityName: 'GPS COORDINATES',
      });
    }
  }

  // 2. City geocoding proxy
  if (action === 'geocode') {
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        q
      )}&count=6&language=en&format=json`;
      const res = await fetch(geoUrl, { next: { revalidate: 3600 } });
      if (!res.ok) {
        return NextResponse.json({ results: [] }, { status: res.status });
      }
      const data = await res.json();
      return NextResponse.json(data);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Geocoding failed', results: [] },
        { status: 502 }
      );
    }
  }

  // 3. Weather forecast proxy
  const lat = Number(searchParams.get('lat') ?? -6.2088);
  const lon = Number(searchParams.get('lon') ?? 106.8456);
  const unit = searchParams.get('unit') === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  const wind =
    searchParams.get('wind') === 'mph'
      ? 'mph'
      : searchParams.get('wind') === 'ms'
      ? 'ms'
      : 'kmh';

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&temperature_unit=${unit}&wind_speed_unit=${wind}&forecast_days=2&timezone=auto`;
    const response = await fetch(url, { next: { revalidate: 300 } });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Open-Meteo upstream error ${response.status}` },
        { status: response.status }
      );
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Weather service unavailable' },
      { status: 502 }
    );
  }
}

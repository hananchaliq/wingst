import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  // Kemenag RI City Search endpoint
  if (action === 'searchCity') {
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }
    try {
      const kSearchUrl = `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(
        q
      )}`;
      const res = await fetch(kSearchUrl, { next: { revalidate: 86400 } });
      if (!res.ok) {
        return NextResponse.json({ results: [] });
      }
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      return NextResponse.json({
        results: list.slice(0, 12).map((item: { id?: string; lokasi?: string }) => ({
          id: String(item.id || ''),
          lokasi: String(item.lokasi || ''),
        })),
      });
    } catch {
      return NextResponse.json({ results: [] });
    }
  }

  // Respect explicit empty string cityId="" when user chooses global coordinates
  const rawCityId = searchParams.get('cityId');
  const cityId = rawCityId !== null ? rawCityId.trim() : '1301';
  const cityName = searchParams.get('cityName') || 'Jakarta';
  const lat = Number(searchParams.get('lat') ?? -6.2088);
  const lon = Number(searchParams.get('lon') ?? 106.8456);
  const method = Number(searchParams.get('method') ?? 20);

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  // 1. Primary: MyQuran Kemenag RI (when a Kemenag cityId is active)
  if (cityId.length > 0) {
    try {
      const kUrl = `https://api.myquran.com/v2/sholat/jadwal/${encodeURIComponent(
        cityId
      )}/${yyyy}/${mm}/${dd}`;
      const kRes = await fetch(kUrl, { next: { revalidate: 3600 } });
      if (kRes.ok) {
        const kJson = await kRes.json();
        if (kJson?.status && kJson?.data?.jadwal) {
          const j = kJson.data.jadwal;
          return NextResponse.json({
            schedule: {
              Fajr: j.subuh,
              Dhuhr: j.dzuhur,
              Asr: j.ashar,
              Maghrib: j.maghrib,
              Isha: j.isya,
            },
            Imsak: j.imsak,
            Sunrise: j.terbit,
            locationLabel: kJson.data.lokasi || cityName,
            dateLabel: j.tanggal || `${yyyy}-${mm}-${dd}`,
            source: 'MyQuran Kemenag RI Official Schedule',
            fetchedAt: new Date().toISOString(),
            dataStatus: 'live',
          });
        }
      }
    } catch {
      // Fallback to Aladhan
    }
  }

  // 2. Fallback / Global Coordinates: Aladhan API
  try {
    const aUrl = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${lat}&longitude=${lon}&method=${method}`;
    const aRes = await fetch(aUrl, { next: { revalidate: 3600 } });
    if (!aRes.ok) {
      return NextResponse.json(
        { error: `Aladhan upstream status ${aRes.status}` },
        { status: aRes.status }
      );
    }
    const aJson = await aRes.json();
    const timings = aJson?.data?.timings;
    if (!timings) {
      return NextResponse.json(
        { error: 'Invalid timings structure from Aladhan' },
        { status: 502 }
      );
    }
    const cleanTime = (t: string) => String(t || '').split(' ')[0];
    return NextResponse.json({
      schedule: {
        Fajr: cleanTime(timings.Fajr),
        Dhuhr: cleanTime(timings.Dhuhr),
        Asr: cleanTime(timings.Asr),
        Maghrib: cleanTime(timings.Maghrib),
        Isha: cleanTime(timings.Isha),
      },
      Imsak: cleanTime(timings.Imsak),
      Sunrise: cleanTime(timings.Sunrise),
      locationLabel: cityName,
      dateLabel: aJson?.data?.date?.readable || `${yyyy}-${mm}-${dd}`,
      hijriLabel: aJson?.data?.date?.hijri
        ? `${aJson.data.date.hijri.day} ${aJson.data.date.hijri.month?.en || ''} ${aJson.data.date.hijri.year} H`
        : undefined,
      source: 'Aladhan Astronomical Calculation (Kemenag/Global)',
      fetchedAt: new Date().toISOString(),
      dataStatus: 'live',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Prayer schedule providers unreachable' },
      { status: 502 }
    );
  }
}

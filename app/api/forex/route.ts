import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const base = (searchParams.get('base') || 'USD').toUpperCase();
  const quote = (searchParams.get('quote') || 'IDR').toUpperCase();
  const timeframe = searchParams.get('timeframe') || '30D';

  const daysMap: Record<string, number> = {
    '7D': 10,
    '30D': 32,
    '90D': 92,
    '1Y': 365,
  };
  const days = daysMap[timeframe] || 32;
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 3600 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const endpoints = [
    `https://api.frankfurter.dev/v1/${fmt(start)}..${fmt(end)}?base=${encodeURIComponent(
      base
    )}&symbols=${encodeURIComponent(quote)}`,
    `https://api.frankfurter.app/${fmt(start)}..${fmt(end)}?from=${encodeURIComponent(
      base
    )}&to=${encodeURIComponent(quote)}`,
  ];

  let json: { rates?: Record<string, Record<string, number>> } | null = null;
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { next: { revalidate: 600 } });
      if (res.ok) {
        const parsed = await res.json();
        if (parsed && parsed.rates && Object.keys(parsed.rates).length > 0) {
          json = parsed;
          break;
        }
      }
    } catch {
      // try next
    }
  }

  let series: { date: string; rate: number }[] = [];
  let sourceLabel = 'ECB / Frankfurter Reference Feed (Indicative)';

  if (json && json.rates) {
    series = Object.entries(json.rates)
      .map(([date, rateObj]) => ({
        date,
        rate: Number(rateObj[quote]),
      }))
      .filter((pt) => !Number.isNaN(pt.rate) && pt.rate > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Fallback to ExchangeRate-API / jsDelivr Currency API if Frankfurter is unavailable
  if (series.length === 0) {
    try {
      const erRes = await fetch(
        `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
        { next: { revalidate: 900 } }
      );
      if (erRes.ok) {
        const erJson = await erRes.json();
        const latestVal = Number(erJson?.rates?.[quote]);
        if (!Number.isNaN(latestVal) && latestVal > 0) {
          const todayStr = fmt(end);
          const prevStr = fmt(start);
          series = [
            { date: prevStr, rate: latestVal },
            { date: todayStr, rate: latestVal },
          ];
          sourceLabel = 'ExchangeRate-API Open Reference Feed';
        }
      }
    } catch {
      // ignore fallback error
    }
  }

  if (series.length === 0) {
    return NextResponse.json(
      { error: `No exchange rate series found for ${base}/${quote}.` },
      { status: 502 }
    );
  }

  const first = series[0];
  const last = series[series.length - 1];
  const changeAbs = last.rate - first.rate;
  const changePct = first.rate !== 0 ? (changeAbs / first.rate) * 100 : 0;
  const ratesOnly = series.map((s) => s.rate);

  return NextResponse.json({
    base,
    quote,
    latestRate: last.rate,
    latestDate: last.date,
    changeAbs,
    changePct,
    periodHigh: Math.max(...ratesOnly),
    periodLow: Math.min(...ratesOnly),
    series,
    fetchedAt: new Date().toISOString(),
    source: sourceLabel,
    dataStatus: 'reference',
  });
}

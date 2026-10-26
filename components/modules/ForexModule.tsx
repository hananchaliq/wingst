'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Info,
} from 'lucide-react';
import { DisplayDensity, ForexConfig } from '@/lib/types';
import { fetchForexClient, ForexData } from '@/lib/api-clients';

interface ForexModuleProps {
  config: ForexConfig;
  density: DisplayDensity;
  onUpdate: (next: ForexConfig) => void;
}

const CURRENCY_PAIRS = [
  { base: 'USD', quote: 'IDR', label: 'USD / IDR' },
  { base: 'EUR', quote: 'IDR', label: 'EUR / IDR' },
  { base: 'SGD', quote: 'IDR', label: 'SGD / IDR' },
  { base: 'USD', quote: 'JPY', label: 'USD / JPY' },
  { base: 'EUR', quote: 'USD', label: 'EUR / USD' },
  { base: 'GBP', quote: 'USD', label: 'GBP / USD' },
];

const TIMEFRAMES: ForexConfig['timeframe'][] = ['7D', '30D', '90D', '1Y'];

export default function ForexModule({
  config,
  density,
  onUpdate,
}: ForexModuleProps) {
  const [data, setData] = useState<ForexData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const loadForex = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      const res = await fetchForexClient({
        base: config.baseCurrency,
        quote: config.quoteCurrency,
        timeframe: config.timeframe,
      });
      setData(res);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to retrieve forex reference series.'
      );
    } finally {
      setLoading(false);
    }
  }, [config.baseCurrency, config.quoteCurrency, config.timeframe]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadForex();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadForex]);

  const formatRate = (val: number, quote: string) => {
    if (quote === 'IDR' || quote === 'JPY') {
      return val.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  // Build SVG path from actual API series
  const renderSvgChart = (forexData: ForexData) => {
    const pts = forexData.series;
    if (pts.length < 2) return null;

    const width = 460;
    const height = 115;
    const padX = 6;
    const padY = 10;

    const minVal = forexData.periodLow;
    const maxVal = forexData.periodHigh;
    const span = maxVal - minVal || 1;

    const coords = pts.map((pt, i) => {
      const x = padX + (i / (pts.length - 1)) * (width - padX * 2);
      const y =
        height - padY - ((pt.rate - minVal) / span) * (height - padY * 2);
      return { x, y, pt };
    });

    const linePath = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');

    const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(
      1
    )} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`;

    const activePoint =
      hoverIdx !== null && coords[hoverIdx]
        ? coords[hoverIdx]
        : coords[coords.length - 1];

    return (
      <div className="relative mt-1">
        <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span>
            Date: <strong className="font-mono-tabular text-[var(--text-primary)]">{activePoint.pt.date}</strong>
          </span>
          <span>
            Rate:{' '}
            <strong className="font-mono-tabular text-[var(--text-primary)]">
              {formatRate(activePoint.pt.rate, forexData.quote)} {forexData.quote}
            </strong>
          </span>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-28 w-full overflow-visible border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40"
          onMouseLeave={() => setHoverIdx(null)}
          role="img"
          aria-label={`Historical exchange rate chart for ${forexData.base}/${forexData.quote}`}
        >
          <defs>
            <linearGradient id="forexAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <path d={areaPath} fill="url(#forexAreaGrad)" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth="2"
          />

          {activePoint && (
            <>
              <line
                x1={activePoint.x}
                y1={0}
                x2={activePoint.x}
                y2={height}
                stroke="var(--border-strong)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="4"
                fill="var(--accent-primary)"
                stroke="var(--bg-surface)"
                strokeWidth="1.5"
              />
            </>
          )}

          {/* Interactive hover columns */}
          {coords.map((c, idx) => (
            <rect
              key={c.pt.date}
              x={c.x - width / pts.length / 2}
              y={0}
              width={width / pts.length}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(idx)}
            />
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col justify-between gap-3">
      {/* Top Pair Selector & Timeframe Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
        <div className="flex items-center gap-2">
          <select
            aria-label="Select currency pair"
            value={`${config.baseCurrency}/${config.quoteCurrency}`}
            onChange={(e) => {
              const [base, quote] = e.target.value.split('/');
              onUpdate({ ...config, baseCurrency: base, quoteCurrency: quote });
            }}
            className="wingst-focus font-mono-tabular border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)]"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            {CURRENCY_PAIRS.map((p) => (
              <option key={p.label} value={`${p.base}/${p.quote}`}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onUpdate({ ...config, timeframe: tf })}
              className={`wingst-focus font-mono-tabular px-2 py-1 text-[11px] font-medium transition-colors ${
                config.timeframe === tf
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              {tf}
            </button>
          ))}
          <button
            type="button"
            onClick={loadForex}
            aria-label="Refresh exchange rate data"
            className="wingst-focus ml-1 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading && !data ? (
        <div className="flex flex-1 flex-col justify-center gap-3 py-4">
          <div className="h-8 w-40 animate-pulse bg-[var(--bg-elevated)]" />
          <div className="h-28 w-full animate-pulse bg-[var(--bg-elevated)]" />
        </div>
      ) : error && !data ? (
        <div className="flex flex-1 flex-col justify-center gap-2 border border-[var(--status-error)]/30 bg-[var(--bg-elevated)] p-4 text-xs">
          <div className="flex items-center gap-2 font-semibold text-[var(--status-error)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Forex Data Unavailable</span>
          </div>
          <p className="text-[var(--text-secondary)]">{error}</p>
          <button
            type="button"
            onClick={loadForex}
            className="mt-1 w-fit border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]"
          >
            Retry Request
          </button>
        </div>
      ) : data ? (
        <>
          {/* Latest Rate & Period Change */}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-[11px] text-[var(--text-muted)]">
                1 {data.base} in {data.quote} (As of {data.latestDate})
              </div>
              <div className="font-mono-tabular text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                {formatRate(data.latestRate, data.quote)}{' '}
                <span className="text-sm font-normal text-[var(--text-secondary)]">
                  {data.quote}
                </span>
              </div>
            </div>

            <div
              className={`font-mono-tabular flex items-center gap-1 text-xs font-semibold ${
                data.changePct >= 0
                  ? 'text-[var(--status-success)]'
                  : 'text-[var(--status-error)]'
              }`}
            >
              {data.changePct >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>
                {data.changePct >= 0 ? '+' : ''}
                {data.changePct.toFixed(2)}% ({config.timeframe})
              </span>
            </div>
          </div>

          {/* Historical Chart */}
          {renderSvgChart(data)}

          {/* High / Low Range */}
          {density !== 'compact' && (
            <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] pt-2 text-xs">
              <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 px-2.5 py-1.5">
                <span className="text-[10px] text-[var(--text-muted)] block">
                  {config.timeframe} High
                </span>
                <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                  {formatRate(data.periodHigh, data.quote)}
                </span>
              </div>
              <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 px-2.5 py-1.5">
                <span className="text-[10px] text-[var(--text-muted)] block">
                  {config.timeframe} Low
                </span>
                <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                  {formatRate(data.periodLow, data.quote)}
                </span>
              </div>
            </div>
          )}

          {/* Honest Disclaimer & Source Footer */}
          <div className="flex flex-wrap items-center justify-between gap-1 border-t border-[var(--border-subtle)] pt-2 text-[10px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3 shrink-0" />
              <span>
                {data.dataStatus === 'cached'
                  ? 'Cached Reference Data'
                  : 'ECB Reference Rate (Indicative, non-executable)'}
              </span>
            </span>
            <span className="font-mono-tabular">
              {new Date(data.fetchedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

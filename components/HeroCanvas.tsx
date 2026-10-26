'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Sliders,
  AlertTriangle,
  Play,
  Pause,
  Navigation,
  Eye,
  EyeOff,
} from 'lucide-react';
import { BackgroundConfig } from '@/lib/types';
import { DEFAULT_HERO_IMAGE } from '@/lib/wingst-core';
import { loadLocalMediaObjectUrl } from '@/lib/storage';

interface HeroCanvasProps {
  background: BackgroundConfig;
  locationCity: string;
  locationCountry?: string;
  isSyncingGps?: boolean;
  onTriggerGps?: () => void;
  onOpenBackgroundSettings: () => void;
  onToggleEditLayout: () => void;
  isEditingLayout: boolean;
  isPeekingCanvas?: boolean;
  onTogglePeekCanvas?: () => void;
}

export default function HeroCanvas({
  background,
  locationCity,
  locationCountry,
  isSyncingGps = false,
  onTriggerGps,
  onOpenBackgroundSettings,
  onToggleEditLayout,
  isEditingLayout,
  isPeekingCanvas = false,
  onTogglePeekCanvas,
}: HeroCanvasProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string>(
    background.mediaUrl || DEFAULT_HERO_IMAGE
  );
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState<boolean>(false);
  const [videoPaused, setVideoPaused] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [now, setNow] = useState<Date | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Detect reduced motion preference & clock
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const initTimer = window.setTimeout(() => {
      setNow(new Date());
      setPrefersReducedMotion(mq.matches);
    }, 0);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(timer);
      mq.removeEventListener('change', handler);
    };
  }, []);

  // Resolve either local IndexedDB asset or remote/default media URL
  useEffect(() => {
    let activeObjectUrl: string | null = null;
    let cancelled = false;

    async function resolveSource() {
      await Promise.resolve();
      if (cancelled) return;
      setMediaError(null);
      if (background.type === 'solid') {
        setIsLoadingMedia(false);
        return;
      }

      if (background.localAssetId) {
        setIsLoadingMedia(true);
        const res = await loadLocalMediaObjectUrl(background.localAssetId);
        if (cancelled) return;
        setIsLoadingMedia(false);
        if (res.objectUrl) {
          activeObjectUrl = res.objectUrl;
          setResolvedUrl(res.objectUrl);
          return;
        } else {
          setMediaError(
            res.error || 'Local background file missing from IndexedDB. Showing default canvas.'
          );
          setResolvedUrl(DEFAULT_HERO_IMAGE);
          return;
        }
      }

      setIsLoadingMedia(false);
      setResolvedUrl(background.mediaUrl || DEFAULT_HERO_IMAGE);
    }

    resolveSource();

    return () => {
      cancelled = true;
      if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl);
      }
    };
  }, [background.type, background.mediaUrl, background.localAssetId]);

  const toggleVideoPlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setVideoPaused(false);
    } else {
      videoRef.current.pause();
      setVideoPaused(true);
    }
  };

  const formattedTime = now
    ? now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    : '--:--:--';

  const formattedDate = now
    ? now.toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Loading date...';

  const objectFitClass =
    background.sizing === 'contain'
      ? 'object-contain'
      : background.sizing === 'center'
      ? 'object-none'
      : 'object-cover';

  const isFixed = background.fixedAttachment !== false;

  return (
    <>
      {/* 1. FIXED FULL-VIEWPORT BACKGROUND LAYER (Stationary on scroll so Liquid OS refracts it) */}
      <div
        aria-hidden="true"
        data-testid="fixed-background-canvas"
        className={`${
          isFixed ? 'fixed inset-0 z-0' : 'absolute inset-x-0 top-0 z-0 h-[100vh]'
        } pointer-events-none overflow-hidden`}
        style={{
          backgroundColor:
            background.type === 'solid' ? background.solidColor : '#07070a',
        }}
      >
        <div
          className="h-full w-full"
          style={{
            filter: `brightness(${background.brightness})`,
          }}
        >
          {background.type === 'video' && !mediaError ? (
            <video
              ref={videoRef}
              key={resolvedUrl}
              src={resolvedUrl}
              muted
              loop
              playsInline
              autoPlay={!prefersReducedMotion}
              onError={() => {
                setMediaError(
                  'Video stream failed to load or format is unsupported. Falling back to static canvas.'
                );
              }}
              className={`h-full w-full ${objectFitClass}`}
              style={{ objectPosition: background.position || 'center' }}
            />
          ) : background.type !== 'solid' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaError ? DEFAULT_HERO_IMAGE : resolvedUrl}
              alt="Wingst atmospheric workspace canvas"
              referrerPolicy="no-referrer"
              onError={() => {
                if (resolvedUrl !== DEFAULT_HERO_IMAGE) {
                  setMediaError(
                    'Selected background image failed to load. Showing default architectural canvas.'
                  );
                  setResolvedUrl(DEFAULT_HERO_IMAGE);
                }
              }}
              className={`h-full w-full ${objectFitClass}`}
              style={{ objectPosition: background.position || 'center' }}
            />
          ) : null}
        </div>

        {/* Adjustable Contrast Scrim & Subtle Editorial Crimson Vignette */}
        <div
          className="absolute inset-0 transition-opacity"
          style={{
            backgroundColor: `rgba(7, 7, 10, ${background.overlayOpacity})`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 88% 12%, rgba(225, 29, 72, 0.16) 0%, transparent 45%), radial-gradient(circle at 10% 85%, rgba(159, 18, 57, 0.14) 0%, transparent 50%)',
          }}
        />
      </div>

      {/* 2. UNOBSTRUCTED CANVAS SHOWCASE WINDOW (Reserved empty space to display full BG clearly) */}
      <section
        aria-label="Workspace Atmospheric Canvas"
        data-testid="hero-canvas"
        className="relative z-10 w-full border-b border-white/10 transition-all max-md:!h-[340px]"
        style={{
          height: `${background.heroHeight}px`,
          minHeight: '280px',
        }}
      >
        <div className="mx-auto flex h-full max-w-[1440px] flex-col justify-between px-4 py-6 sm:px-6 md:py-8">
          {/* Top Editorial Row: Location + Dot Matrix Ornament + Canvas Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-200">
              {/* Editorial 3x3 Dot Matrix Indicator (Reference Image 1) */}
              <span
                aria-hidden="true"
                className="grid grid-cols-3 gap-1 opacity-80"
              >
                <span className="h-1 w-1 rounded-full bg-white" />
                <span className="h-1 w-1 rounded-full bg-white" />
                <span className="h-1 w-1 rounded-full bg-white" />
                <span className="h-1 w-1 rounded-full bg-[var(--accent-primary)]" />
                <span className="h-1 w-1 rounded-full bg-[var(--accent-primary)]" />
                <span className="h-1 w-1 rounded-full bg-[var(--accent-primary)]" />
              </span>

              <span className="font-mono-tabular font-semibold tracking-wider text-white">
                {locationCity.toUpperCase()}
                {locationCountry ? `, ${locationCountry.toUpperCase()}` : ''}
              </span>

              <span aria-hidden="true" className="text-white/40">
                —
              </span>
              <span className="text-zinc-300">{formattedDate}</span>

              {onTriggerGps && (
                <button
                  type="button"
                  onClick={onTriggerGps}
                  disabled={isSyncingGps}
                  title="Sinkronkan lokasi dengan GPS untuk Cuaca & Jadwal Sholat"
                  className="wingst-focus flex items-center gap-1.5 border border-white/15 bg-black/45 px-2.5 py-1 text-[11px] font-medium text-zinc-100 hover:border-[var(--accent-primary)] hover:text-white backdrop-blur-md transition-colors"
                  style={{ borderRadius: 'var(--radius-control)' }}
                >
                  <Navigation
                    className={`h-3 w-3 text-[var(--accent-primary)] ${
                      isSyncingGps ? 'animate-spin' : ''
                    }`}
                  />
                  <span>{isSyncingGps ? 'Mendeteksi GPS...' : 'Sync GPS'}</span>
                </button>
              )}

              {isLoadingMedia && (
                <span className="text-[var(--accent-primary)]">
                  · Memuat kanvas...
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onTogglePeekCanvas && (
                <button
                  type="button"
                  onClick={onTogglePeekCanvas}
                  className="wingst-focus flex items-center gap-1.5 border border-white/15 bg-black/45 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:border-[var(--accent-primary)] hover:text-white backdrop-blur-md transition-colors"
                  style={{ borderRadius: 'var(--radius-control)' }}
                >
                  {isPeekingCanvas ? (
                    <>
                      <Eye className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                      <span>Tampilkan Modul</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                      <span>Lihat Full BG</span>
                    </>
                  )}
                </button>
              )}

              {background.type === 'video' && !mediaError && (
                <button
                  type="button"
                  onClick={toggleVideoPlayback}
                  aria-label={
                    videoPaused ? 'Resume background video' : 'Pause background video'
                  }
                  className="wingst-focus flex items-center gap-1.5 border border-white/15 bg-black/45 px-2.5 py-1.5 text-xs text-zinc-100 hover:border-white/40 backdrop-blur-md"
                  style={{ borderRadius: 'var(--radius-control)' }}
                >
                  {videoPaused ? (
                    <>
                      <Play className="h-3 w-3" />
                      <span>Play BG</span>
                    </>
                  ) : (
                    <>
                      <Pause className="h-3 w-3" />
                      <span>Pause BG</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={onOpenBackgroundSettings}
                className="wingst-focus flex items-center gap-1.5 border border-white/15 bg-black/45 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:border-[var(--accent-primary)] hover:text-white backdrop-blur-md transition-colors"
                style={{ borderRadius: 'var(--radius-control)' }}
              >
                <ImageIcon className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span>Atur Kanvas BG</span>
              </button>
            </div>
          </div>

          {/* Media Failure Graceful Banner */}
          {mediaError && (
            <div
              role="status"
              className="my-auto max-w-md border border-amber-500/40 bg-black/80 p-3 text-xs text-amber-200 backdrop-blur-md"
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-100">{mediaError}</p>
                  <button
                    type="button"
                    onClick={onOpenBackgroundSettings}
                    className="mt-1.5 underline hover:text-white"
                  >
                    Ubah sumber media di Settings
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Asymmetrical Editorial Anchor: Tabular Time & Mosaic Grid Trigger */}
          <div className="mt-auto flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium tracking-wider text-zinc-300">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)]" />
                <span>WORKSPACE LOCAL TIME</span>
              </div>
              <div
                className="font-mono-tabular mt-1 text-4xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-6xl lg:text-7xl"
                data-testid="hero-clock"
              >
                {formattedTime}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onToggleEditLayout}
                className="wingst-focus flex items-center gap-2 border border-white/20 bg-black/55 px-4 py-2 text-xs font-medium text-white hover:border-[var(--accent-primary)] backdrop-blur-md transition-colors whitespace-nowrap shrink-0"
                style={{ borderRadius: 'var(--radius-control)' }}
              >
                <Sliders className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span>
                  {isEditingLayout ? 'Selesai Atur Grid' : 'Sesuaikan Tata Letak'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

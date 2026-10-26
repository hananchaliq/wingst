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
  Timer,
  RotateCcw,
  Target,
} from 'lucide-react';
import { BackgroundConfig } from '@/lib/types';
import { DEFAULT_HERO_IMAGE } from '@/lib/wingst-core';
import { loadLocalMediaObjectUrl } from '@/lib/storage';

interface HeroCanvasProps {
  background: BackgroundConfig;
  onUpdateBackground?: (next: BackgroundConfig) => void;
  liteMode?: boolean;
  locationCity: string;
  locationCountry?: string;
  isSyncingGps?: boolean;
  onTriggerGps?: () => void;
  onOpenBackgroundSettings: () => void;
  onToggleEditLayout: () => void;
  isEditingLayout: boolean;
  isPeekingCanvas?: boolean;
  onTogglePeekCanvas?: () => void;
  onResolvedMediaUrl?: (url: string) => void;
}

type PomodoroPhase = 'focus' | 'short_break' | 'long_break';

const POMODORO_PRESETS: Record<
  PomodoroPhase,
  { label: string; seconds: number }
> = {
  focus: { label: '25m Focus', seconds: 25 * 60 },
  short_break: { label: '5m Break', seconds: 5 * 60 },
  long_break: { label: '15m Rest', seconds: 15 * 60 },
};

function playPomodoroChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.14); // A5
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  } catch {
    // Ignore audio context restriction errors
  }
}

export default function HeroCanvas({
  background,
  onUpdateBackground,
  liteMode = false,
  locationCity,
  locationCountry,
  isSyncingGps = false,
  onTriggerGps,
  onOpenBackgroundSettings,
  onToggleEditLayout,
  isEditingLayout,
  isPeekingCanvas = false,
  onTogglePeekCanvas,
  onResolvedMediaUrl,
}: HeroCanvasProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string>(
    background.mediaUrl || DEFAULT_HERO_IMAGE
  );
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState<boolean>(false);
  const [videoPaused, setVideoPaused] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [now, setNow] = useState<Date | null>(null);

  // Pomodoro Focus Timer State
  const [pomoPhase, setPomoPhase] = useState<PomodoroPhase>('focus');
  const [pomoSecondsLeft, setPomoSecondsLeft] = useState<number>(25 * 60);
  const [pomoRunning, setPomoRunning] = useState<boolean>(false);

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

  // Pomodoro countdown interval
  useEffect(() => {
    if (!pomoRunning) return;
    const id = window.setInterval(() => {
      setPomoSecondsLeft((prev) => {
        if (prev <= 1) {
          setPomoRunning(false);
          playPomodoroChime();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [pomoRunning]);

  // Low-Spec Device & Tab Visibility Video Auto-Pause
  useEffect(() => {
    const el = videoRef.current;
    if (!el || background.type !== 'video') return;

    const syncPlayback = () => {
      if (document.hidden || liteMode || prefersReducedMotion || videoPaused) {
        el.pause();
      } else {
        el.play().catch(() => {});
      }
    };

    syncPlayback();
    document.addEventListener('visibilitychange', syncPlayback);
    return () => document.removeEventListener('visibilitychange', syncPlayback);
  }, [background.type, liteMode, prefersReducedMotion, videoPaused]);

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
          onResolvedMediaUrl?.(res.objectUrl);
          return;
        } else {
          setMediaError(
            res.error || 'Local background file missing from IndexedDB. Showing default canvas.'
          );
          setResolvedUrl(DEFAULT_HERO_IMAGE);
          onResolvedMediaUrl?.(DEFAULT_HERO_IMAGE);
          return;
        }
      }

      setIsLoadingMedia(false);
      const nextUrl = background.mediaUrl || DEFAULT_HERO_IMAGE;
      setResolvedUrl(nextUrl);
      onResolvedMediaUrl?.(nextUrl);
    }

    resolveSource();

    return () => {
      cancelled = true;
      if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl);
      }
    };
  }, [background.type, background.mediaUrl, background.localAssetId, onResolvedMediaUrl]);

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

  const handleCyclePomodoroPhase = () => {
    const order: PomodoroPhase[] = ['focus', 'short_break', 'long_break'];
    const nextPhase = order[(order.indexOf(pomoPhase) + 1) % order.length];
    setPomoRunning(false);
    setPomoPhase(nextPhase);
    setPomoSecondsLeft(POMODORO_PRESETS[nextPhase].seconds);
  };

  const handleResetPomodoro = () => {
    setPomoRunning(false);
    setPomoSecondsLeft(POMODORO_PRESETS[pomoPhase].seconds);
  };

  const pomoMinutes = String(Math.floor(pomoSecondsLeft / 60)).padStart(2, '0');
  const pomoSecs = String(pomoSecondsLeft % 60).padStart(2, '0');

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
              autoPlay={!prefersReducedMotion && !liteMode}
              onError={() => {
                setMediaError(
                  'Video stream failed to load or format is unsupported. Falling back to static canvas.'
                );
              }}
              className={`h-full w-full ${objectFitClass}`}
              style={{ objectPosition: background.position || 'center' }}
            />
          ) : background.type !== 'solid' &&
            (mediaError || resolvedUrl === DEFAULT_HERO_IMAGE) ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1920 1080"
              preserveAspectRatio="xMidYMid slice"
              data-testid="default-dynamic-hero-svg"
              className={`h-full w-full ${objectFitClass}`}
            >
              <defs>
                <linearGradient id="obsidianBase" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#060608" />
                  <stop offset="50%" stopColor="#0a0a0e" />
                  <stop offset="100%" stopColor="#050507" />
                </linearGradient>

                <radialGradient id="accentSphereTR" cx="86%" cy="14%" r="42%">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.52" />
                  <stop offset="38%" stopColor="var(--accent-primary)" stopOpacity="0.26" />
                  <stop offset="72%" stopColor="var(--accent-primary)" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#060608" stopOpacity="0" />
                </radialGradient>

                <radialGradient id="accentSphereBL" cx="12%" cy="78%" r="46%">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.44" />
                  <stop offset="45%" stopColor="var(--accent-primary)" stopOpacity="0.20" />
                  <stop offset="80%" stopColor="var(--accent-primary)" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#060608" stopOpacity="0" />
                </radialGradient>

                <linearGradient id="accentPillar" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.02" />
                  <stop offset="55%" stopColor="var(--accent-primary)" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.34" />
                </linearGradient>

                <linearGradient id="accentPillarInverse" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.30" />
                  <stop offset="60%" stopColor="var(--accent-primary)" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#09090b" stopOpacity="0.02" />
                </linearGradient>

                <pattern id="architecturalGrid" width="96" height="96" patternUnits="userSpaceOnUse">
                  <path
                    d="M 96 0 L 0 0 0 96"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="0.6"
                    strokeOpacity="0.03"
                  />
                </pattern>
              </defs>

              <rect width="1920" height="1080" fill="url(#obsidianBase)" />
              <rect width="1920" height="1080" fill="url(#accentSphereTR)" />
              <rect width="1920" height="1080" fill="url(#accentSphereBL)" />
              <rect width="1920" height="1080" fill="url(#architecturalGrid)" />

              <circle
                cx="1720"
                cy="110"
                r="390"
                fill="url(#accentSphereTR)"
                stroke="var(--accent-primary)"
                strokeOpacity="0.14"
                strokeWidth="1"
              />
              <circle
                cx="190"
                cy="880"
                r="430"
                fill="url(#accentSphereBL)"
                stroke="var(--accent-primary)"
                strokeOpacity="0.12"
                strokeWidth="1"
              />

              <g transform="translate(1060, 110)">
                <rect
                  x="0"
                  y="60"
                  width="180"
                  height="440"
                  rx="8"
                  fill="url(#accentPillar)"
                  stroke="var(--accent-primary)"
                  strokeOpacity="0.16"
                  strokeWidth="1"
                />
                <line x1="90" y1="90" x2="90" y2="330" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.2" />
                <circle cx="90" cy="330" r="3.5" fill="#ffffff" />

                <rect
                  x="210"
                  y="0"
                  width="180"
                  height="460"
                  rx="8"
                  fill="url(#accentPillarInverse)"
                  stroke="var(--accent-primary)"
                  strokeOpacity="0.22"
                  strokeWidth="1"
                />
                <line x1="300" y1="210" x2="300" y2="410" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.2" />
                <circle cx="300" cy="210" r="3.5" fill="#ffffff" />

                <rect
                  x="420"
                  y="60"
                  width="180"
                  height="440"
                  rx="8"
                  fill="url(#accentPillar)"
                  stroke="var(--accent-primary)"
                  strokeOpacity="0.16"
                  strokeWidth="1"
                />
                <line x1="510" y1="90" x2="510" y2="330" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.2" />
                <circle cx="510" cy="330" r="3.5" fill="#ffffff" />
              </g>

              <line x1="96" y1="84" x2="1824" y2="84" stroke="var(--accent-primary)" strokeOpacity="0.28" strokeWidth="1" />

              <g fill="#ffffff" fillOpacity="0.72" transform="translate(116, 122)">
                <circle cx="0" cy="0" r="2" /><circle cx="10" cy="0" r="2" /><circle cx="20" cy="0" r="2" /><circle cx="30" cy="0" r="2" />
                <circle cx="0" cy="10" r="2" /><circle cx="10" cy="10" r="2" /><circle cx="20" cy="10" r="2" /><circle cx="30" cy="10" r="2" />
                <circle cx="0" cy="20" r="2" /><circle cx="10" cy="20" r="2" /><circle cx="20" cy="20" r="2" /><circle cx="30" cy="20" r="2" />
              </g>

              <g fill="var(--accent-primary)" fillOpacity="0.55" transform="translate(520, 320)">
                <circle cx="0" cy="0" r="2" /><circle cx="10" cy="0" r="2" /><circle cx="20" cy="0" r="2" /><circle cx="30" cy="0" r="2" /><circle cx="40" cy="0" r="2" /><circle cx="50" cy="0" r="2" />
                <circle cx="0" cy="10" r="2" /><circle cx="10" cy="10" r="2" /><circle cx="20" cy="10" r="2" /><circle cx="30" cy="10" r="2" /><circle cx="40" cy="10" r="2" /><circle cx="50" cy="10" r="2" />
                <circle cx="0" cy="20" r="2" /><circle cx="10" cy="20" r="2" /><circle cx="20" cy="20" r="2" /><circle cx="30" cy="20" r="2" /><circle cx="40" cy="20" r="2" /><circle cx="50" cy="20" r="2" />
              </g>

              <g fill="#ffffff" fillOpacity="0.35" transform="translate(1740, 490)">
                <circle cx="0" cy="0" r="1.8" /><circle cx="9" cy="0" r="1.8" /><circle cx="18" cy="0" r="1.8" /><circle cx="27" cy="0" r="1.8" />
                <circle cx="0" cy="9" r="1.8" /><circle cx="9" cy="9" r="1.8" /><circle cx="18" cy="9" r="1.8" /><circle cx="27" cy="9" r="1.8" />
                <circle cx="0" cy="18" r="1.8" /><circle cx="9" cy="18" r="1.8" /><circle cx="18" cy="18" r="1.8" /><circle cx="27" cy="18" r="1.8" />
                <circle cx="0" cy="27" r="1.8" /><circle cx="9" cy="27" r="1.8" /><circle cx="18" cy="27" r="1.8" /><circle cx="27" cy="27" r="1.8" />
              </g>
            </svg>
          ) : background.type !== 'solid' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedUrl}
              alt="Wingst atmospheric workspace canvas"
              referrerPolicy="no-referrer"
              onError={() => {
                if (resolvedUrl !== DEFAULT_HERO_IMAGE) {
                  setMediaError(
                    'Selected background image failed to load. Showing default architectural canvas.'
                  );
                  setResolvedUrl(DEFAULT_HERO_IMAGE);
                  onResolvedMediaUrl?.(DEFAULT_HERO_IMAGE);
                }
              }}
              className={`h-full w-full ${objectFitClass}`}
              style={{ objectPosition: background.position || 'center' }}
            />
          ) : null}
        </div>

        {/* Adjustable Contrast Scrim & Dynamic Primary Accent Vignette */}
        <div
          className="absolute inset-0 transition-opacity"
          style={{
            backgroundColor: `rgba(7, 7, 10, ${background.overlayOpacity})`,
          }}
        />
        <div
          data-testid="hero-accent-vignette"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 88% 12%, rgba(var(--accent-rgb, 225, 29, 72), 0.18) 0%, transparent 45%), radial-gradient(circle at 10% 85%, rgba(var(--accent-rgb, 225, 29, 72), 0.14) 0%, transparent 50%)',
          }}
        />
      </div>

      {/* 2. UNOBSTRUCTED CANVAS SHOWCASE WINDOW (Reserved empty space to display full BG clearly) */}
      <section
        aria-label="Workspace Atmospheric Canvas"
        data-testid="hero-canvas"
        className="relative z-10 w-full border-b border-white/10 transition-all max-md:!h-auto max-md:min-h-[360px]"
        style={{
          height: `${background.heroHeight}px`,
          minHeight: '300px',
        }}
      >
        <div className="mx-auto flex h-full max-w-[1440px] flex-col justify-between gap-4 px-4 py-6 sm:px-6 md:py-8">
          {/* Top Editorial Row: Location + Dot Matrix Ornament + Canvas Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-200">
              {/* Editorial 3x3 Dot Matrix Indicator */}
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
              {/* Pomodoro Focus Timer Capsule */}
              <div
                data-testid="hero-pomodoro"
                className="flex items-center gap-1.5 border border-white/15 bg-black/50 px-2.5 py-1 text-xs text-zinc-100 backdrop-blur-md"
                style={{ borderRadius: 'var(--radius-control)' }}
              >
                <Timer className="h-3.5 w-3.5 text-[var(--accent-primary)] shrink-0" />
                <button
                  type="button"
                  onClick={handleCyclePomodoroPhase}
                  title="Ganti durasi Pomodoro (25m Focus / 5m Break / 15m Rest)"
                  className="text-[11px] font-medium text-zinc-300 hover:text-white"
                >
                  {POMODORO_PRESETS[pomoPhase].label}:
                </button>
                <span
                  data-testid="pomodoro-time"
                  className="font-mono-tabular text-xs font-semibold text-white"
                >
                  {pomoMinutes}:{pomoSecs}
                </span>
                <button
                  type="button"
                  data-testid="pomodoro-toggle-btn"
                  onClick={() => setPomoRunning((r) => !r)}
                  aria-label={pomoRunning ? 'Pause Pomodoro timer' : 'Start Pomodoro timer'}
                  className={`ml-0.5 px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                    pomoRunning
                      ? 'bg-amber-500 text-black'
                      : 'bg-[var(--accent-primary)] text-white'
                  }`}
                  style={{ borderRadius: 'calc(var(--radius-control) - 3px)' }}
                >
                  {pomoRunning ? 'Pause' : 'Start'}
                </button>
                <button
                  type="button"
                  onClick={handleResetPomodoro}
                  aria-label="Reset Pomodoro timer"
                  title="Reset Timer"
                  className="p-0.5 text-zinc-400 hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>

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

          {/* Bottom Asymmetrical Editorial Anchor: Tabular Time, Daily Focus Target & Mosaic Grid Trigger */}
          <div className="mt-auto flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-6">
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

              {/* Editable Daily Focus Target (Target Fokus Hari Ini) */}
              <div
                className="flex items-center gap-2 border border-white/15 bg-black/45 px-3 py-2 text-xs text-zinc-100 backdrop-blur-md sm:mb-1.5"
                style={{ borderRadius: 'var(--radius-control)' }}
              >
                <Target className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-zinc-400">
                    Target Fokus Hari Ini
                  </span>
                  <input
                    type="text"
                    data-testid="hero-focus-target-input"
                    value={background.focusTarget ?? ''}
                    onChange={(e) =>
                      onUpdateBackground?.({
                        ...background,
                        focusTarget: e.target.value,
                      })
                    }
                    placeholder="Tulis target utama hari ini..."
                    aria-label="Target Fokus Hari Ini"
                    className="w-56 sm:w-64 bg-transparent text-xs font-medium text-white placeholder:text-zinc-400 focus:outline-none"
                  />
                </div>
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


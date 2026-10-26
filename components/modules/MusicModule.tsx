'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Music,
  Plus,
  ExternalLink,
  Trash2,
  Maximize2,
  Minimize2,
  Upload,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Disc,
  Radio,
  Waves,
} from 'lucide-react';
import {
  DisplayDensity,
  LocalAudioTrackMeta,
  MusicConfig,
  MusicProviderId,
} from '@/lib/types';
import { parseOfficialMusicEmbed } from '@/lib/wingst-core';
import {
  deleteLocalAudioTrack,
  loadLocalAudioObjectUrl,
  saveLocalAudioTrack,
} from '@/lib/storage';

interface MusicModuleProps {
  config: MusicConfig;
  density: DisplayDensity;
  onUpdate: (next: MusicConfig) => void;
}

const PROVIDER_LABELS: Record<MusicProviderId, string> = {
  spotify: 'Spotify Connect / Embed',
  youtube: 'YouTube / YT Music Embed',
  apple_music: 'Apple Music Embed',
  soundcloud: 'SoundCloud Widget',
};

type AmbientFocusMode = 'off' | 'rain' | 'brown';

// 7-bar resting profile matching Reference Image 3 (tall-mid-short-tall-short-mid-short)
const RESTING_BAR_HEIGHTS = [0.76, 0.56, 0.34, 0.92, 0.42, 0.68, 0.38];
const RHYTHM_DURATIONS = ['0.82s', '0.68s', '0.94s', '0.62s', '0.88s', '0.74s', '0.90s'];
const RHYTHM_DELAYS = ['0ms', '140ms', '70ms', '210ms', '110ms', '250ms', '170ms'];

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function MusicModule({
  config,
  density,
  onUpdate,
}: MusicModuleProps) {
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Local MP3 Player State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [uploadingTrack, setUploadingTrack] = useState(false);

  // 7-Bar Audio Visualizer State (Web Audio API AnalyserNode for MP3 + Rhythmic for Spotify)
  const [freqBars, setFreqBars] = useState<number[]>(RESTING_BAR_HEIGHTS);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const connectedAudioElRef = useRef<HTMLAudioElement | null>(null);

  // Procedural Web Audio Ambient Focus Sound Generator ('off' | 'rain' | 'brown')
  const [ambientMode, setAmbientMode] = useState<AmbientFocusMode>('off');
  const ambientCtxRef = useRef<AudioContext | null>(null);
  const ambientSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const activeTab = config.activeTab || 'spotify';
  const visualizerEnabled = config.visualizerEnabled !== false;
  const localTracks = config.localTracks || [];
  const activeTrackId =
    config.activeLocalTrackId || (localTracks[0]?.id ?? null);
  const activeTrackMeta =
    localTracks.find((t) => t.id === activeTrackId) || null;

  const isCompact = config.displayMode === 'compact' || density === 'compact';

  // Load active local audio track from IndexedDB when activeTrackId changes
  useEffect(() => {
    let mounted = true;
    let currentUrl: string | null = null;

    async function resolveTrack() {
      if (!activeTrackId) {
        if (mounted) {
          setAudioObjectUrl(null);
          setIsPlaying(false);
          setCurrentTime(0);
          setDuration(0);
        }
        return;
      }
      const loaded = await loadLocalAudioObjectUrl(activeTrackId);
      if (!mounted) {
        if (loaded.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
        return;
      }
      currentUrl = loaded.objectUrl;
      setAudioObjectUrl(loaded.objectUrl);
      setIsPlaying(false);
      setCurrentTime(0);
    }

    const timer = window.setTimeout(() => {
      void resolveTrack();
    }, 0);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [activeTrackId]);

  // Real-time Web Audio API frequency sampling when playing Local MP3
  useEffect(() => {
    if (activeTab !== 'local_mp3' || !isPlaying || !visualizerEnabled) {
      return;
    }

    const el = audioRef.current;
    if (!el) return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          void ctx.resume();
        }
        if (!analyserRef.current) {
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.78;
          analyserRef.current = analyser;
        }
        if (connectedAudioElRef.current !== el && analyserRef.current) {
          try {
            sourceNodeRef.current = ctx.createMediaElementSource(el);
            sourceNodeRef.current.connect(analyserRef.current);
            analyserRef.current.connect(ctx.destination);
            connectedAudioElRef.current = el;
          } catch {
            // Element already bound
          }
        }
      }
    } catch {
      // Fallback to rhythmic pulse if Web Audio API fails
    }

    const binData = new Uint8Array(32);
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      const analyser = analyserRef.current;
      if (analyser) {
        analyser.getByteFrequencyData(binData);
        const indices = [1, 2, 4, 6, 9, 12, 16];
        const nextBars = indices.map((idx, barIdx) => {
          const raw = (binData[idx] || 0) / 255;
          return Math.max(0.22, Math.min(1, raw * 0.9 + RESTING_BAR_HEIGHTS[barIdx] * 0.18));
        });
        setFreqBars(nextBars);
      }
    }, 45);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeTab, isPlaying, visualizerEnabled]);

  // Procedural Web Audio Ambient Focus Sound Engine (Rain / Deep Brown Noise)
  useEffect(() => {
    if (ambientSourceRef.current) {
      try {
        ambientSourceRef.current.stop();
        ambientSourceRef.current.disconnect();
      } catch {
        // Ignore
      }
      ambientSourceRef.current = null;
    }

    if (ambientMode === 'off') return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      if (!ambientCtxRef.current) {
        ambientCtxRef.current = new AudioCtx();
      }
      const ctx = ambientCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);

      if (ambientMode === 'brown') {
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 0.22;
        }
      } else {
        // Soft Rain pink-filtered texture
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99765 * b0 + white * 0.099046;
          b1 = 0.96300 * b1 + white * 0.2965164;
          b2 = 0.57000 * b2 + white * 1.0526913;
          output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.03;
        }
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = ambientMode === 'brown' ? 420 : 1350;

      const gain = ctx.createGain();
      gain.gain.value = 0.35;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(0);
      ambientSourceRef.current = noise;
    } catch {
      // Ignore audio restriction errors
    }

    return () => {
      if (ambientSourceRef.current) {
        try {
          ambientSourceRef.current.stop();
          ambientSourceRef.current.disconnect();
        } catch {
          // Ignore
        }
        ambientSourceRef.current = null;
      }
    };
  }, [ambientMode]);

  const handleToggleVisualizer = () => {
    onUpdate({
      ...config,
      visualizerEnabled: !visualizerEnabled,
    });
  };

  const handleSwitchTab = (tab: 'local_mp3' | 'spotify') => {
    setError(null);
    onUpdate({
      ...config,
      activeTab: tab,
    });
  };

  const handleUploadMp3 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setUploadingTrack(true);

    try {
      const addedTracks: LocalAudioTrackMeta[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const saved = await saveLocalAudioTrack(file);
        if (!saved.ok || !saved.track) {
          setError(saved.error || 'Gagal menyimpan file audio ke IndexedDB.');
        } else {
          addedTracks.push(saved.track);
        }
      }

      if (addedTracks.length > 0) {
        const nextTracks = [...addedTracks, ...localTracks];
        onUpdate({
          ...config,
          activeTab: 'local_mp3',
          localTracks: nextTracks,
          activeLocalTrackId: addedTracks[0].id,
        });
      }
    } finally {
      setUploadingTrack(false);
      e.target.value = '';
    }
  };

  const handleDeleteLocalTrack = async (trackId: string) => {
    await deleteLocalAudioTrack(trackId);
    const remaining = localTracks.filter((t) => t.id !== trackId);
    const nextActiveId =
      activeTrackId === trackId ? remaining[0]?.id || null : activeTrackId;
    onUpdate({
      ...config,
      localTracks: remaining,
      activeLocalTrackId: nextActiveId,
    });
  };

  const togglePlayPause = async () => {
    const el = audioRef.current;
    if (!el || !audioObjectUrl) return;
    try {
      if (el.paused) {
        await el.play();
        setIsPlaying(true);
      } else {
        el.pause();
        setIsPlaying(false);
      }
    } catch {
      setIsPlaying(false);
    }
  };

  const handleStepTrack = (dir: -1 | 1) => {
    if (localTracks.length <= 1 || !activeTrackId) return;
    const idx = localTracks.findIndex((t) => t.id === activeTrackId);
    if (idx < 0) return;
    const nextIdx = (idx + dir + localTracks.length) % localTracks.length;
    onUpdate({
      ...config,
      activeLocalTrackId: localTracks[nextIdx].id,
    });
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(e.target.value);
    setCurrentTime(nextTime);
    if (audioRef.current) {
      audioRef.current.currentTime = nextTime;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVol = Number(e.target.value);
    setVolume(nextVol);
    setIsMuted(nextVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = nextVol;
      audioRef.current.muted = nextVol === 0;
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (audioRef.current) {
      audioRef.current.muted = nextMute;
    }
  };

  const handleAddOfficialEmbed = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = parseOfficialMusicEmbed(urlInput, config.provider);
    if (!parsed.valid) {
      setError(
        parsed.error ||
          'Masukkan URL Spotify, spotify:playlist:..., YouTube, Apple Music, atau SoundCloud yang valid.'
      );
      return;
    }

    const newEntry = {
      id: `pl-${Date.now()}`,
      title: titleInput.trim() || `${PROVIDER_LABELS[parsed.provider]} Stream`,
      provider: parsed.provider,
      url: urlInput.trim(),
      embedUrl: parsed.embedUrl,
    };

    onUpdate({
      ...config,
      activeTab: 'spotify',
      provider: parsed.provider,
      activeEmbedUrl: parsed.embedUrl,
      savedPlaylists: [newEntry, ...config.savedPlaylists],
    });

    setTitleInput('');
    setUrlInput('');
    setIsAddingLink(false);
  };

  const removePlaylist = (id: string) => {
    const remaining = config.savedPlaylists.filter((p) => p.id !== id);
    const nextActive =
      remaining.find((p) => p.embedUrl === config.activeEmbedUrl)?.embedUrl ||
      remaining[0]?.embedUrl ||
      '';
    onUpdate({
      ...config,
      savedPlaylists: remaining,
      activeEmbedUrl: nextActive,
    });
  };

  // Determine whether the 7-bar capsule equalizer should animate
  const isRhythmicSpotifyActive =
    visualizerEnabled &&
    ((activeTab === 'spotify' && Boolean(config.activeEmbedUrl)) ||
      ambientMode !== 'off');
  const isRealTimeMp3Active =
    visualizerEnabled && activeTab === 'local_mp3' && isPlaying;

  return (
    <div className="flex h-full flex-col justify-between gap-3">
      {/* Top Mode Switcher + Reference Image 3 7-Bar Audio Visualizer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
        <div
          role="tablist"
          aria-label="Music Studio Mode"
          className="flex items-center gap-1 bg-[var(--bg-elevated)] p-1 border border-[var(--border-subtle)]"
          style={{ borderRadius: 'var(--radius-control)' }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'spotify'}
            data-testid="music-tab-spotify"
            onClick={() => handleSwitchTab('spotify')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeTab === 'spotify'
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            style={{ borderRadius: 'calc(var(--radius-control) - 2px)' }}
          >
            <Radio className="h-3 w-3" />
            <span>Spotify & Embed</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'local_mp3'}
            data-testid="music-tab-local"
            onClick={() => handleSwitchTab('local_mp3')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeTab === 'local_mp3'
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            style={{ borderRadius: 'calc(var(--radius-control) - 2px)' }}
          >
            <Disc className="h-3 w-3" />
            <span>Local MP3 ({localTracks.length})</span>
          </button>
        </div>

        {/* Center/Right: Compact 7-Bar Capsule Audio Visualizer (Reference Image 3) + Contextual Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 7-Bar Capsule Audio Equalizer + Square Toggle Button (Reference Image 3) */}
          <div
            data-testid="music-audio-visualizer"
            data-visualizer-active={
              isRealTimeMp3Active || isRhythmicSpotifyActive ? 'true' : 'false'
            }
            className="flex items-center gap-2 border border-[var(--border-subtle)] bg-[#0b0b0e]/90 px-2.5 py-1"
            style={{ borderRadius: 'var(--radius-control)' }}
            title={
              visualizerEnabled
                ? 'Audio Equalizer Aktif (Real-time MP3 / Ritmik Spotify)'
                : 'Audio Equalizer Nonaktif'
            }
          >
            <div
              aria-hidden="true"
              className="flex h-4 items-center gap-[3px]"
            >
              {RESTING_BAR_HEIGHTS.map((restingScale, idx) => {
                const liveScale = isRealTimeMp3Active
                  ? freqBars[idx] ?? restingScale
                  : visualizerEnabled
                  ? restingScale
                  : 0.22;

                return (
                  <span
                    key={idx}
                    data-testid={`visualizer-bar-${idx}`}
                    className={`w-[3px] rounded-full transition-transform duration-75 ${
                      visualizerEnabled
                        ? 'bg-white'
                        : 'bg-zinc-600'
                    }`}
                    style={{
                      height: '16px',
                      transform: `scaleY(${liveScale})`,
                      transformOrigin: 'center',
                      animation: isRhythmicSpotifyActive
                        ? `wingst-eq-bounce ${RHYTHM_DURATIONS[idx]} ease-in-out ${RHYTHM_DELAYS[idx]} infinite`
                        : 'none',
                    }}
                  />
                );
              })}
            </div>

            {/* Square-rounded Toggle Button right beside the 7 bars (Reference Image 3) */}
            <button
              type="button"
              data-testid="music-visualizer-toggle"
              onClick={handleToggleVisualizer}
              aria-pressed={visualizerEnabled}
              aria-label={
                visualizerEnabled
                  ? 'Pause audio visualizer bars'
                  : 'Activate audio visualizer bars'
              }
              title={
                visualizerEnabled
                  ? 'Matikan gerakan garis audio'
                  : 'Hidupkan gerakan garis audio'
              }
              className={`h-4 w-4 shrink-0 border transition-colors ${
                visualizerEnabled
                  ? 'border-white/40 bg-zinc-400/80 hover:bg-white'
                  : 'border-white/20 bg-zinc-800 hover:bg-zinc-700'
              }`}
              style={{ borderRadius: '4px' }}
            />
          </div>

          {activeTab === 'spotify' ? (
            <>
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    ...config,
                    displayMode:
                      config.displayMode === 'compact' ? 'expanded' : 'compact',
                  })
                }
                aria-label="Toggle music player height"
                className="wingst-focus flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
                style={{ borderRadius: 'var(--radius-control)' }}
              >
                {config.displayMode === 'compact' ? (
                  <>
                    <Maximize2 className="h-3 w-3" />
                    <span>Expand</span>
                  </>
                ) : (
                  <>
                    <Minimize2 className="h-3 w-3" />
                    <span>Compact</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAddingLink((v) => !v);
                  setError(null);
                }}
                className="wingst-focus flex items-center gap-1 bg-[var(--accent-primary)] px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 whitespace-nowrap shrink-0"
                style={{ borderRadius: 'var(--radius-control)' }}
              >
                <Plus className="h-3 w-3" />
                <span>{isAddingLink ? 'Close' : 'Spotify / URL'}</span>
              </button>
            </>
          ) : (
            <label
              className="wingst-focus inline-flex cursor-pointer items-center gap-1.5 bg-[var(--accent-primary)] px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 whitespace-nowrap shrink-0"
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              <Upload className="h-3 w-3" />
              <span>{uploadingTrack ? 'Saving...' : 'Upload MP3'}</span>
              <input
                type="file"
                data-testid="music-mp3-upload-input"
                accept=".mp3,.wav,.ogg,.m4a,.flac,audio/*"
                multiple
                onChange={handleUploadMp3}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 px-2.5 py-1.5 text-[11px] text-[var(--status-error)]"
          style={{ borderRadius: 'var(--radius-control)' }}
        >
          {error}
        </div>
      )}

      {/* TAB 1: SPOTIFY CONNECT & OFFICIAL EMBED */}
      {activeTab === 'spotify' ? (
        <>
          {isAddingLink && (
            <form
              onSubmit={handleAddOfficialEmbed}
              className="border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3 text-xs space-y-2"
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              <div className="font-semibold text-[var(--text-primary)]">
                Connect Spotify Playlist / Track or Official Embed
              </div>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="Label (e.g. Deep Focus Synth, Late Night Coding)"
                aria-label="Playlist label"
                className="w-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                style={{ borderRadius: 'var(--radius-control)' }}
              />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://open.spotify.com/playlist/... or spotify:playlist:..."
                aria-label="Official playlist or track URL"
                className="w-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                style={{ borderRadius: 'var(--radius-control)' }}
              />
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[10px] text-[var(--text-muted)]">
                  Supports Spotify URL/URI, YouTube, Apple Music & SoundCloud
                </span>
                <button
                  type="submit"
                  className="bg-[var(--accent-primary)] px-3 py-1 text-xs font-medium text-white"
                  style={{ borderRadius: 'var(--radius-control)' }}
                >
                  Load Player
                </button>
              </div>
            </form>
          )}

          {/* Official Iframe Embed Player */}
          {config.activeEmbedUrl ? (
            <div
              className="overflow-hidden border border-[var(--border-subtle)] bg-black"
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              <iframe
                title="Official Embedded Music Player"
                src={config.activeEmbedUrl}
                width="100%"
                height={isCompact ? '80' : '152'}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="block border-0"
              />
            </div>
          ) : (
            <div
              className="flex flex-1 flex-col items-center justify-center gap-2 border border-dashed border-[var(--border-subtle)] p-6 text-center text-xs text-[var(--text-muted)]"
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              <Music className="h-5 w-5 text-[var(--accent-primary)]" />
              <p>No Spotify or official stream loaded.</p>
              <button
                type="button"
                onClick={() => setIsAddingLink(true)}
                className="border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-primary)]"
                style={{ borderRadius: 'var(--radius-control)' }}
              >
                Connect Spotify URL / URI
              </button>
            </div>
          )}

          {/* Saved Playlists Selector */}
          {config.savedPlaylists.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {config.savedPlaylists.map((pl) => {
                const active = pl.embedUrl === config.activeEmbedUrl;
                return (
                  <div
                    key={pl.id}
                    className={`flex items-center gap-1.5 border px-2.5 py-1 text-[11px] transition-colors ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                    }`}
                    style={{ borderRadius: 'var(--radius-control)' }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate({
                          ...config,
                          provider: pl.provider,
                          activeEmbedUrl: pl.embedUrl,
                        })
                      }
                      className="truncate max-w-[150px]"
                    >
                      {pl.title}
                    </button>
                    <a
                      href={pl.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${pl.title} in Spotify / Provider`}
                      aria-label={`Open ${pl.title} on provider website`}
                      className="text-[var(--text-muted)] hover:text-[var(--accent-primary)]"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => removePlaylist(pl.id)}
                      aria-label={`Remove ${pl.title}`}
                      className="text-[var(--text-muted)] hover:text-[var(--status-error)]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Bar: Ambient Focus Sound Synth + Open Spotify */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2 text-[10px] text-[var(--text-muted)]">
            <div className="flex items-center gap-1.5">
              <Waves className="h-3 w-3 text-[var(--accent-primary)]" />
              <span>Ambient Focus:</span>
              {(['off', 'rain', 'brown'] as AmbientFocusMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  data-testid={`ambient-btn-${mode}`}
                  onClick={() => setAmbientMode(mode)}
                  className={`border px-1.5 py-0.5 text-[10px] font-medium capitalize transition-colors ${
                    ambientMode === mode
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  style={{ borderRadius: '4px' }}
                >
                  {mode === 'off' ? 'Off' : mode === 'rain' ? 'Rain' : 'Brown Noise'}
                </button>
              ))}
            </div>

            <a
              href="https://open.spotify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] shrink-0"
            >
              <span>Open Spotify</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </>
      ) : (
        /* TAB 2: LOCAL MP3 / AUDIO STUDIO (INDEXEDDB) */
        <div
          data-testid="music-local-panel"
          className="flex flex-1 flex-col justify-between gap-3"
        >
          {/* Hidden HTML5 Audio Element */}
          {audioObjectUrl && (
            <audio
              ref={audioRef}
              src={audioObjectUrl}
              loop={isLooping}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => {
                setDuration(e.currentTarget.duration || 0);
                e.currentTarget.volume = volume;
                e.currentTarget.muted = isMuted;
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => {
                if (!isLooping) {
                  if (localTracks.length > 1) {
                    handleStepTrack(1);
                  } else {
                    setIsPlaying(false);
                  }
                }
              }}
            />
          )}

          {localTracks.length === 0 ? (
            <div
              className="flex flex-1 flex-col items-center justify-center gap-2.5 border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 p-5 text-center text-xs"
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              <Disc className="h-6 w-6 text-[var(--accent-primary)]" />
              <div className="space-y-0.5">
                <p className="font-semibold text-[var(--text-primary)]">
                  Belum ada lagu MP3 lokal
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Upload file MP3, WAV, OGG, M4A, atau FLAC Anda sendiri. Disimpan permanen di IndexedDB browser & terhubung ke 7-Bar Audio Visualizer.
                </p>
              </div>
              <label
                className="inline-flex cursor-pointer items-center gap-1.5 bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                style={{ borderRadius: 'var(--radius-control)' }}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Pilih File MP3 / Audio...</span>
                <input
                  type="file"
                  accept=".mp3,.wav,.ogg,.m4a,.flac,audio/*"
                  multiple
                  onChange={handleUploadMp3}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <>
              {/* Active Track Deck */}
              <div
                className="border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3 space-y-2.5"
                style={{ borderRadius: 'var(--radius-control)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
                      <span className="truncate font-display text-xs font-bold text-[var(--text-primary)]">
                        {activeTrackMeta?.title || 'Select Track'}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono-tabular text-[10px] text-[var(--text-muted)]">
                      {activeTrackMeta
                        ? `${activeTrackMeta.fileName} · ${(
                            activeTrackMeta.size /
                            1024 /
                            1024
                          ).toFixed(2)} MB`
                        : 'Local IndexedDB Audio'}
                    </div>
                  </div>

                  <div className="font-mono-tabular text-xs font-semibold text-[var(--text-secondary)] shrink-0">
                    {formatDuration(currentTime)} / {formatDuration(duration)}
                  </div>
                </div>

                {/* Seek Bar + Crimson Progress Bar */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={duration > 0 ? duration : 100}
                    step={0.5}
                    value={currentTime}
                    onChange={handleSeek}
                    aria-label="Audio seek progress"
                    className="w-full h-1.5 accent-[var(--accent-primary)] cursor-pointer"
                  />
                </div>

                {/* Transport & Volume Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStepTrack(-1)}
                      disabled={localTracks.length <= 1}
                      aria-label="Previous track"
                      className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                      style={{ borderRadius: 'var(--radius-control)' }}
                    >
                      <SkipBack className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={togglePlayPause}
                      aria-label={isPlaying ? 'Pause local track' : 'Play local track'}
                      data-testid="music-local-play-btn"
                      className="flex items-center gap-1.5 bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      style={{ borderRadius: 'var(--radius-control)' }}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          <span>Play</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStepTrack(1)}
                      disabled={localTracks.length <= 1}
                      aria-label="Next track"
                      className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                      style={{ borderRadius: 'var(--radius-control)' }}
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsLooping((v) => !v)}
                      aria-label="Toggle track loop"
                      title="Repeat Current Track"
                      className={`border p-1.5 transition-colors ${
                        isLooping
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                      style={{ borderRadius: 'var(--radius-control)' }}
                    >
                      <Repeat className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Volume Control */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      {isMuted ? (
                        <VolumeX className="h-3.5 w-3.5 text-[var(--status-error)]" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      aria-label="Audio volume"
                      className="w-20 h-1 accent-[var(--accent-primary)] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Uploaded MP3 Playlist Queue */}
              <div className="max-h-32 overflow-y-auto space-y-1 pr-0.5">
                {localTracks.map((track, idx) => {
                  const isCurrent = track.id === activeTrackId;
                  return (
                    <div
                      key={track.id}
                      className={`flex items-center justify-between gap-2 border px-2.5 py-1.5 text-xs transition-colors ${
                        isCurrent
                          ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]/60 text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                      }`}
                      style={{ borderRadius: 'var(--radius-control)' }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onUpdate({
                            ...config,
                            activeLocalTrackId: track.id,
                          })
                        }
                        className="flex flex-1 items-center gap-2 truncate text-left"
                      >
                        <span className="font-mono-tabular text-[10px] text-[var(--accent-primary)]">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="truncate font-medium">
                          {track.title}
                        </span>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono-tabular text-[10px] text-[var(--text-muted)]">
                          {(track.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteLocalTrack(track.id)}
                          aria-label={`Hapus lagu ${track.title}`}
                          className="text-[var(--text-muted)] hover:text-[var(--status-error)]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2 text-[10px] text-[var(--text-muted)]">
            <span>
              Local MP3 Studio · Web Audio Frequency Equalizer + IndexedDB
            </span>
            <div className="flex items-center gap-1.5">
              <Waves className="h-3 w-3 text-[var(--accent-primary)]" />
              <span>Ambient:</span>
              {(['off', 'rain', 'brown'] as AmbientFocusMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAmbientMode(mode)}
                  className={`border px-1.5 py-0.5 text-[10px] font-medium capitalize transition-colors ${
                    ambientMode === mode
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                  }`}
                  style={{ borderRadius: '4px' }}
                >
                  {mode === 'off' ? 'Off' : mode === 'rain' ? 'Rain' : 'Brown'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


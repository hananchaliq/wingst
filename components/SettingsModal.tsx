'use client';

import React, { useState } from 'react';
import {
  X,
  Palette,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  CheckSquare,
  Search,
  Music,
  MapPin,
  Shield,
  Upload,
  Download,
  RotateCcw,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  Check,
  AlertTriangle,
  Sparkles,
  Navigation,
} from 'lucide-react';
import {
  BackgroundMediaType,
  BackgroundSizing,
  LiquidVariant,
  ModuleId,
  MusicProviderId,
  SearchProviderId,
  ThemeMode,
  WingstConfig,
} from '@/lib/types';
import {
  clampModuleSpan,
  createDefaultConfig,
  createDefaultLayout,
  DEFAULT_HERO_IMAGE,
  parseOfficialMusicEmbed,
  reorderModules,
  resetSingleModuleLayout,
  resetTodayActivityCompletions,
  SEARCH_PROVIDERS,
  validateAndMigrateConfig,
  validateSafeUrl,
} from '@/lib/wingst-core';
import {
  clearAllWingstStorage,
  clearLocalMediaAssets,
  saveLocalMediaAsset,
} from '@/lib/storage';
import { LinkFavicon } from '@/components/modules/QuickLinksModule';

export type SettingsTabId =
  | 'appearance'
  | 'background'
  | 'workspace'
  | 'quick_links'
  | 'daily_activity'
  | 'search'
  | 'music'
  | 'location'
  | 'data_privacy';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: SettingsTabId;
  config: WingstConfig;
  storageSource: 'web' | 'extension';
  onClose: () => void;
  onUpdateConfig: (next: WingstConfig) => void;
  onTriggerGps?: () => void;
  isSyncingGps?: boolean;
}

const ACCENT_PRESETS = [
  { name: 'Wingst Crimson', hex: '#e11d48' },
  { name: 'Signal Vermilion', hex: '#ea580c' },
  { name: 'Cobalt Precision', hex: '#2563eb' },
  { name: 'Cyan Telemetry', hex: '#0284c7' },
  { name: 'Emerald Field', hex: '#059669' },
  { name: 'Amber Gold', hex: '#d97706' },
];

const LIQUID_MODE_CARDS: {
  id: LiquidVariant;
  title: string;
  subtitle: string;
  defaultBlur: number;
  defaultOpacity: number;
  defaultSpecular: number;
}[] = [
  {
    id: 'frosted',
    title: 'Frosted',
    subtitle: 'Concept · Matte frosted diffusion & warm rim',
    defaultBlur: 20,
    defaultOpacity: 0.62,
    defaultSpecular: 0.48,
  },
  {
    id: 'clear',
    title: 'Clear',
    subtitle: 'iOS · Crystal refraction & specular edge',
    defaultBlur: 12,
    defaultOpacity: 0.34,
    defaultSpecular: 0.78,
  },
  {
    id: 'blur',
    title: 'Blur',
    subtitle: 'One UI · Deep atmospheric Gaussian blur',
    defaultBlur: 32,
    defaultOpacity: 0.74,
    defaultSpecular: 0.25,
  },
];

const TABS: { id: SettingsTabId; label: string; icon: React.ComponentType<{ className?: string }>; keywords: string }[] = [
  { id: 'appearance', label: 'Appearance & Liquid OS', icon: Palette, keywords: 'theme dark light primary color accent contrast surface liquid frosted clear blur radius' },
  { id: 'background', label: 'Background Canvas', icon: ImageIcon, keywords: 'hero image gif video mp4 webm upload opacity brightness height fixed' },
  { id: 'workspace', label: 'Mosaic Layout', icon: LayoutGrid, keywords: 'grid span order columns rows visibility density modules' },
  { id: 'quick_links', label: 'Quick Links', icon: Link2, keywords: 'shortcuts urls groups bookmarks export import' },
  { id: 'daily_activity', label: 'Daily Activity', icon: CheckSquare, keywords: 'habits checklist history progress reset' },
  { id: 'search', label: 'Search Engine', icon: Search, keywords: 'google duckduckgo brave bing startpage ecosia history suggestions' },
  { id: 'music', label: 'Music & MP3', icon: Music, keywords: 'spotify youtube apple music soundcloud playlist iframe mp3 local' },
  { id: 'location', label: 'GPS, Weather & Prayer', icon: MapPin, keywords: 'gps city coordinates celsius fahrenheit wind kemenag aladhan' },
  { id: 'data_privacy', label: 'Data & Privacy', icon: Shield, keywords: 'localstorage indexeddb chrome storage export import clear reset' },
];

export default function SettingsModal({
  isOpen,
  initialTab = 'appearance',
  config,
  storageSource,
  onClose,
  onUpdateConfig,
  onTriggerGps,
  isSyncingGps = false,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [tabFilter, setTabFilter] = useState('');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Sub-forms state
  const [newActivityName, setNewActivityName] = useState('');
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingActivityTitle, setEditingActivityTitle] = useState('');

  const [qlTitle, setQlTitle] = useState('');
  const [qlUrl, setQlUrl] = useState('');
  const [qlGroup, setQlGroup] = useState(config.quickLinks.groups[0] || 'General');

  const [musicTitle, setMusicTitle] = useState('');
  const [musicUrl, setMusicUrl] = useState('');

  const [confirmFullReset, setConfirmFullReset] = useState(false);

  React.useEffect(() => {
    if (!initialTab) return;
    const t = window.setTimeout(() => setActiveTab(initialTab), 0);
    return () => window.clearTimeout(t);
  }, [initialTab]);

  if (!isOpen) return null;

  const filteredTabs = TABS.filter((t) => {
    const q = tabFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      t.label.toLowerCase().includes(q) || t.keywords.toLowerCase().includes(q)
    );
  });

  const notify = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    window.setTimeout(() => {
      setStatusBanner((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // --- Handlers for Background Upload via IndexedDB ---
  const handleLocalMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const mime = file.type.toLowerCase();
    let inferredType: BackgroundMediaType = 'image';
    if (mime.includes('gif')) inferredType = 'gif';
    else if (mime.includes('video')) inferredType = 'video';

    const saved = await saveLocalMediaAsset(file);
    if (!saved.ok || !saved.assetId) {
      notify('error', saved.error || 'Could not store media file in IndexedDB.');
      return;
    }

    onUpdateConfig({
      ...config,
      background: {
        ...config.background,
        type: inferredType,
        localAssetId: saved.assetId,
      },
    });
    notify(
      'success',
      `Stored "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)} MB) in local IndexedDB as ${inferredType.toUpperCase()} canvas.`
    );
  };

  // --- Handlers for Daily Activity CRUD ---
  const handleCreateActivity = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newActivityName.trim();
    if (!title) return;
    const nextItem = {
      id: `act-${Date.now()}`,
      title,
      order: config.dailyActivity.activities.length,
      createdAt: new Date().toISOString(),
    };
    const nextActivities = [...config.dailyActivity.activities, nextItem];
    onUpdateConfig({
      ...config,
      dailyActivity: {
        ...config.dailyActivity,
        activities: nextActivities,
      },
    });
    setNewActivityName('');
    notify('success', `Added daily activity "${title}".`);
  };

  const handleDeleteActivity = (id: string) => {
    const remaining = config.dailyActivity.activities
      .filter((a) => a.id !== id)
      .map((a, idx) => ({ ...a, order: idx }));
    onUpdateConfig({
      ...config,
      dailyActivity: {
        ...config.dailyActivity,
        activities: remaining,
        todayCompletedIds: config.dailyActivity.todayCompletedIds.filter(
          (cid) => cid !== id
        ),
      },
    });
  };

  const handleMoveActivity = (id: string, dir: -1 | 1) => {
    const sorted = [...config.dailyActivity.activities].sort(
      (a, b) => a.order - b.order
    );
    const idx = sorted.findIndex((a) => a.id === id);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= sorted.length) return;
    const [moved] = sorted.splice(idx, 1);
    sorted.splice(targetIdx, 0, moved);
    onUpdateConfig({
      ...config,
      dailyActivity: {
        ...config.dailyActivity,
        activities: sorted.map((a, i) => ({ ...a, order: i })),
      },
    });
  };

  const handleSaveActivityRename = (id: string) => {
    const trimmed = editingActivityTitle.trim();
    if (!trimmed) return;
    onUpdateConfig({
      ...config,
      dailyActivity: {
        ...config.dailyActivity,
        activities: config.dailyActivity.activities.map((a) =>
          a.id === id ? { ...a, title: trimmed } : a
        ),
      },
    });
    setEditingActivityId(null);
    setEditingActivityTitle('');
  };

  // --- Export / Import Config ---
  const handleExportFullConfig = () => {
    const jsonStr = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wingst-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('success', 'Exported Wingst configuration JSON.');
  };

  const handleImportFullConfig = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const migrated = validateAndMigrateConfig(parsed);
      if (!migrated.valid) {
        notify('error', migrated.error || 'Invalid configuration file.');
        return;
      }
      onUpdateConfig(migrated.config);
      notify(
        'success',
        migrated.warnings.length > 0
          ? `Configuration imported with ${migrated.warnings.length} migration adjustment(s).`
          : 'Configuration validated and imported.'
      );
    } catch (err) {
      notify(
        'error',
        err instanceof Error
          ? `Import failed: ${err.message}`
          : 'Invalid JSON file.'
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wingst Settings Center"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
    >
      <div
        className="wingst-surface flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden shadow-2xl"
        style={{ borderRadius: 'var(--radius-card)' }}
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-3.5">
          <div>
            <h2 className="font-display text-base font-bold tracking-tight text-[var(--text-primary)] sm:text-lg">
              Wingst Settings Center
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Local-first workspace configuration · Active adapter:{' '}
              <span className="font-mono-tabular text-[var(--text-secondary)]">
                {storageSource === 'extension'
                  ? 'chrome.storage.local + IndexedDB'
                  : 'localStorage + IndexedDB'}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings Center"
            className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status Feedback Banner */}
        {statusBanner && (
          <div
            role="status"
            className={`flex items-center justify-between px-5 py-2 text-xs font-medium ${
              statusBanner.type === 'error'
                ? 'bg-[var(--status-error)]/20 text-[var(--status-error)] border-b border-[var(--status-error)]/40'
                : 'bg-[var(--status-success)]/20 text-[var(--status-success)] border-b border-[var(--status-success)]/40'
            }`}
          >
            <span>{statusBanner.text}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main 2-Column Body */}
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {/* Left Navigation Sidebar */}
          <aside className="flex w-full shrink-0 flex-col border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/60 p-3 md:w-60 md:border-b-0 md:border-r">
            <div className="mb-2">
              <input
                type="text"
                value={tabFilter}
                onChange={(e) => setTabFilter(e.target.value)}
                placeholder="Filter settings..."
                aria-label="Filter settings sections"
                className="w-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                style={{ borderRadius: 'var(--radius-control)' }}
              />
            </div>

            <nav
              aria-label="Settings Categories"
              className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-y-auto"
            >
              {filteredTabs.map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`wingst-focus flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                    }`}
                    style={{ borderRadius: 'var(--radius-control)' }}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right Active Section Panel */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-xs space-y-6">
            {/* 1. APPEARANCE & LIQUID OS */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                    Appearance, Geometry & Liquid OS Surface Engine
                  </h3>
                  <p className="mt-1 text-[var(--text-secondary)]">
                    Configure Liquid OS glassmorphic refraction modes (Frosted, Clear iOS, Blur One UI), balanced corner geometry, and editorial crimson theme tokens.
                  </p>
                </div>

                {/* LIQUID OS 3-MODE ENGINE (Reference Image 2) */}
                <div
                  className="border border-[var(--border-strong)] bg-[var(--bg-elevated)]/70 p-4 space-y-4"
                  style={{ borderRadius: 'var(--radius-card)' }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
                      <div>
                        <div className="font-display text-sm font-bold text-[var(--text-primary)]">
                          Liquid OS Surface Engine
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          3 Jenis Liquid (Frosted Concept · Clear iOS · Blur One UI) — bisa dinyalakan/dimatikan dan diatur detailnya
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onUpdateConfig({
                          ...config,
                          appearance: {
                            ...config.appearance,
                            liquid: {
                              ...config.appearance.liquid,
                              enabled: !config.appearance.liquid.enabled,
                            },
                          },
                        })
                      }
                      className={`px-3.5 py-1.5 text-xs font-bold transition-colors ${
                        config.appearance.liquid.enabled
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                      }`}
                      style={{ borderRadius: 'var(--radius-control)' }}
                    >
                      {config.appearance.liquid.enabled
                        ? 'Liquid OS: ON (Aktif)'
                        : 'Liquid OS: OFF (Matte)'}
                    </button>
                  </div>

                  {/* 3 Liquid Variant Cards */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {LIQUID_MODE_CARDS.map((card) => {
                      const isSelected =
                        config.appearance.liquid.enabled &&
                        !config.appearance.liquid.liteMode &&
                        config.appearance.liquid.variant === card.id;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() =>
                            onUpdateConfig({
                              ...config,
                              appearance: {
                                ...config.appearance,
                                liquid: {
                                  enabled: true,
                                  variant: card.id,
                                  blurPx: card.defaultBlur,
                                  opacity: card.defaultOpacity,
                                  specularIntensity: card.defaultSpecular,
                                  liteMode: false,
                                },
                              },
                            })
                          }
                          className={`flex flex-col justify-between border p-3 text-left transition-all ${
                            isSelected
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 ring-1 ring-[var(--accent-primary)]'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 hover:border-[var(--border-strong)]'
                          }`}
                          style={{ borderRadius: 'var(--radius-control)' }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-display text-sm font-bold text-[var(--text-primary)]">
                              {card.title}
                            </span>
                            <span
                              className={`font-mono-tabular text-[10px] px-1.5 py-0.5 ${
                                isSelected
                                  ? 'bg-[var(--accent-primary)] text-white font-semibold'
                                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                              }`}
                              style={{ borderRadius: '4px' }}
                            >
                              {isSelected ? 'ACTIVE' : 'SELECT'}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">
                            {card.subtitle}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Mode Ringan (Device Kentang / Lite GPU) Card */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 border border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 p-3"
                    style={{ borderRadius: 'var(--radius-control)' }}
                  >
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">
                        Mode Ringan / Device Kentang (Lite GPU Performance)
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        Menonaktifkan multi-pass Gaussian blur & bayangan berat untuk menghemat GPU/RAM di laptop atau HP spesifikasi rendah sambil tetap mempertahankan estetika semi-transparan.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateConfig({
                          ...config,
                          appearance: {
                            ...config.appearance,
                            liquid: {
                              ...config.appearance.liquid,
                              enabled: true,
                              liteMode: !config.appearance.liquid.liteMode,
                            },
                          },
                        })
                      }
                      className={`border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        config.appearance.liquid.liteMode
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                      }`}
                      style={{ borderRadius: 'var(--radius-control)' }}
                    >
                      {config.appearance.liquid.liteMode
                        ? 'Mode Ringan: ON'
                        : 'Mode Ringan: OFF'}
                    </button>
                  </div>

                  {/* Liquid Parameter Sliders + Corner Radius */}
                  <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="flex justify-between text-[11px] font-medium text-[var(--text-secondary)]">
                        <span>Liquid Blur Intensity</span>
                        <span className="font-mono-tabular text-[var(--text-primary)]">
                          {config.appearance.liquid.blurPx}px
                        </span>
                      </label>
                      <input
                        type="range"
                        min={4}
                        max={40}
                        step={1}
                        disabled={!config.appearance.liquid.enabled}
                        value={config.appearance.liquid.blurPx}
                        onChange={(e) =>
                          onUpdateConfig({
                            ...config,
                            appearance: {
                              ...config.appearance,
                              liquid: {
                                ...config.appearance.liquid,
                                blurPx: Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full accent-[var(--accent-primary)]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="flex justify-between text-[11px] font-medium text-[var(--text-secondary)]">
                        <span>Surface Glass Opacity</span>
                        <span className="font-mono-tabular text-[var(--text-primary)]">
                          {Math.round(config.appearance.liquid.opacity * 100)}%
                        </span>
                      </label>
                      <input
                        type="range"
                        min={0.15}
                        max={0.95}
                        step={0.02}
                        disabled={!config.appearance.liquid.enabled}
                        value={config.appearance.liquid.opacity}
                        onChange={(e) =>
                          onUpdateConfig({
                            ...config,
                            appearance: {
                              ...config.appearance,
                              liquid: {
                                ...config.appearance.liquid,
                                opacity: Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full accent-[var(--accent-primary)]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="flex justify-between text-[11px] font-medium text-[var(--text-secondary)]">
                        <span>Specular Rim Highlight</span>
                        <span className="font-mono-tabular text-[var(--text-primary)]">
                          {Math.round(
                            config.appearance.liquid.specularIntensity * 100
                          )}
                          %
                        </span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        disabled={!config.appearance.liquid.enabled}
                        value={config.appearance.liquid.specularIntensity}
                        onChange={(e) =>
                          onUpdateConfig({
                            ...config,
                            appearance: {
                              ...config.appearance,
                              liquid: {
                                ...config.appearance.liquid,
                                specularIntensity: Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-full accent-[var(--accent-primary)]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="flex justify-between text-[11px] font-medium text-[var(--text-secondary)]">
                        <span>Balanced Corner Radius (Standar: 12px)</span>
                        <span className="font-mono-tabular text-[var(--text-primary)]">
                          {config.appearance.borderRadius ?? 12}px
                        </span>
                      </label>
                      <input
                        type="range"
                        min={6}
                        max={20}
                        step={1}
                        value={config.appearance.borderRadius ?? 12}
                        onChange={(e) =>
                          onUpdateConfig({
                            ...config,
                            appearance: {
                              ...config.appearance,
                              borderRadius: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-[var(--accent-primary)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Theme Mode */}
                <div className="space-y-2">
                  <label className="block font-semibold text-[var(--text-primary)]">
                    Theme Mode
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({
                            ...config,
                            appearance: { ...config.appearance, theme: mode },
                          })
                        }
                        className={`border px-4 py-2 text-xs font-medium capitalize transition-colors ${
                          config.appearance.theme === mode
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                        }`}
                        style={{ borderRadius: 'var(--radius-control)' }}
                      >
                        {mode} Theme
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Accent Color */}
                <div className="space-y-2">
                  <label className="block font-semibold text-[var(--text-primary)]">
                    Primary Accent Color
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {ACCENT_PRESETS.map((preset) => (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({
                            ...config,
                            appearance: {
                              ...config.appearance,
                              primaryColor: preset.hex,
                            },
                          })
                        }
                        className={`flex items-center gap-2 border px-3 py-1.5 text-xs ${
                          config.appearance.primaryColor.toLowerCase() ===
                          preset.hex.toLowerCase()
                            ? 'border-[var(--text-primary)] bg-[var(--bg-elevated)] font-semibold'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                        }`}
                        style={{ borderRadius: 'var(--radius-control)' }}
                      >
                        <span
                          className="h-3.5 w-3.5 border border-white/20"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span>{preset.name}</span>
                      </button>
                    ))}

                    <label className="flex items-center gap-2 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1">
                      <span>Custom Hex:</span>
                      <input
                        type="color"
                        aria-label="Custom primary hex color"
                        value={config.appearance.primaryColor}
                        onChange={(e) =>
                          onUpdateConfig({
                            ...config,
                            appearance: {
                              ...config.appearance,
                              primaryColor: e.target.value,
                            },
                          })
                        }
                        className="h-5 w-8 cursor-pointer border-0 bg-transparent"
                      />
                      <span className="font-mono-tabular">
                        {config.appearance.primaryColor}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Custom Background, Surface & Border Colors */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 border-t border-[var(--border-subtle)] pt-4">
                  <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 p-3 space-y-1.5">
                    <div className="font-semibold text-[var(--text-primary)]">
                      Canvas Background Override
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Custom canvas background color"
                        value={config.appearance.customBgColor || '#09090b'}
                        onChange={(e) =>
                          onUpdateConfig({
                            ...config,
                            appearance: {
                              ...config.appearance,
                              customBgColor: e.target.value,
                            },
                          })
                        }
                        className="h-6 w-10 cursor-pointer border-0 bg-transparent"
                      />
                      <span className="font-mono-tabular text-[11px]">
                        {config.appearance.customBgColor || 'Theme Default'}
                      </span>
                    </div>
                  </div>

                  <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 p-3 space-y-1.5">
                    <div className="font-semibold text-[var(--text-primary)]">
                      Module Surface Override
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Custom module surface color"
                        value={config.appearance.customSurfaceColor || '#111115'}
                        onChange={(e) =>
                          onUpdateConfig({
                            ...config,
                            appearance: {
                              ...config.appearance,
                              customSurfaceColor: e.target.value,
                            },
                          })
                        }
                        className="h-6 w-10 cursor-pointer border-0 bg-transparent"
                      />
                      <span className="font-mono-tabular text-[11px]">
                        {config.appearance.customSurfaceColor || 'Theme Default'}
                      </span>
                    </div>
                  </div>

                  <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 p-3 space-y-1.5">
                    <div className="font-semibold text-[var(--text-primary)]">
                      Module Border Override
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Custom module border color"
                        value={config.appearance.customBorderColor || '#232329'}
                        onChange={(e) =>
                          onUpdateConfig({
                            ...config,
                            appearance: {
                              ...config.appearance,
                              customBorderColor: e.target.value,
                            },
                          })
                        }
                        className="h-6 w-10 cursor-pointer border-0 bg-transparent"
                      />
                      <span className="font-mono-tabular text-[11px]">
                        {config.appearance.customBorderColor || 'Theme Default'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Token & Contrast Safeguard Preview */}
                <div className="border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-[var(--text-primary)]">
                      Live Theme & Contrast Preview
                    </span>
                    <span className="font-mono-tabular text-[11px] text-[var(--accent-primary)]">
                      Accent {config.appearance.primaryColor} · Contrast Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Primary text and tabular numerals maintain high legibility against active surface tokens.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="bg-[var(--accent-primary)] px-3 py-1 text-[11px] font-semibold text-white">
                      Primary Action Sample
                    </span>
                    <span className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1 font-mono-tabular text-[11px] text-[var(--text-primary)]">
                      18,108.00 IDR
                    </span>
                  </div>
                </div>

                {/* Restore Appearance Defaults */}
                <div className="border-t border-[var(--border-subtle)] pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const def = createDefaultConfig().appearance;
                      onUpdateConfig({ ...config, appearance: def });
                      notify('success', 'Restored default dark crimson appearance.');
                    }}
                    className="flex items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restore Default Appearance</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. BACKGROUND CANVAS */}
            {activeTab === 'background' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                    Stationary Full-Viewport Background Canvas
                  </h3>
                  <p className="mt-1 text-[var(--text-secondary)]">
                    Kanvas latar belakang dipasang tidak bergerak (fixed viewport) saat halaman di-scroll, dengan ruang showcase terbuka di bagian atas agar gambar/video latar terlihat penuh tanpa terhalang.
                  </p>
                </div>

                {/* Fixed Stationary Background Toggle */}
                <div
                  className="flex flex-wrap items-center justify-between gap-2 border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3"
                  style={{ borderRadius: 'var(--radius-control)' }}
                >
                  <div>
                    <div className="font-semibold text-[var(--text-primary)]">
                      Stationary Fixed Background (Latar Tidak Bergerak Saat Scroll)
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Membuat kanvas gambar/video mengunci penuh di seluruh layar di belakang kartu Liquid OS.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.background.fixedAttachment !== false}
                    onChange={(e) =>
                      onUpdateConfig({
                        ...config,
                        background: {
                          ...config.background,
                          fixedAttachment: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 accent-[var(--accent-primary)]"
                  />
                </div>

                {/* Media Mode Selector */}
                <div className="space-y-2">
                  <label className="block font-semibold text-[var(--text-primary)]">
                    Background Mode
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'image', label: 'Static Image (Default)' },
                        { id: 'gif', label: 'Animated GIF' },
                        { id: 'video', label: 'Looping MP4 / WebM' },
                        { id: 'solid', label: 'Solid Color' },
                      ] as { id: BackgroundMediaType; label: string }[]
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          onUpdateConfig({
                            ...config,
                            background: {
                              ...config.background,
                              type: m.id,
                            },
                          })
                        }
                        className={`border px-3.5 py-2 text-xs font-medium transition-colors ${
                          config.background.type === m.id
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                        }`}
                        style={{ borderRadius: 'var(--radius-control)' }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Remote URL or Solid Color Picker */}
                {config.background.type === 'solid' ? (
                  <div className="space-y-2">
                    <label className="block font-semibold text-[var(--text-primary)]">
                      Canvas Solid Color
                    </label>
                    <input
                      type="color"
                      aria-label="Hero solid background color"
                      value={config.background.solidColor}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          background: {
                            ...config.background,
                            solidColor: e.target.value,
                          },
                        })
                      }
                      className="h-8 w-20 cursor-pointer border border-[var(--border-subtle)] bg-transparent"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-[var(--text-primary)]">
                        Remote Media URL ({config.background.type.toUpperCase()})
                      </label>
                      <input
                        type="text"
                        value={config.background.mediaUrl}
                        onChange={(e) =>
                          onUpdateConfig({
                            ...config,
                            background: {
                              ...config.background,
                              mediaUrl: e.target.value,
                              localAssetId: null,
                            },
                          })
                        }
                        placeholder="https://example.com/wallpaper.jpg or .mp4"
                        aria-label="Remote background media URL"
                        className="w-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                      />
                    </div>

                    {/* Local File Upload (IndexedDB) */}
                    <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-2">
                      <div className="font-semibold text-[var(--text-primary)]">
                        Upload Local Media File (IndexedDB Storage)
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Supports JPG, PNG, WebP, SVG, GIF, MP4, and WebM up to 45 MB. Stored directly in browser IndexedDB.
                      </p>
                      <label className="inline-flex cursor-pointer items-center gap-2 bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Choose Local File...</span>
                        <input
                          type="file"
                          accept="image/*,video/mp4,video/webm"
                          onChange={handleLocalMediaUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Sliders: Hero Height, Overlay Opacity, Brightness, Sizing */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="flex justify-between font-medium text-[var(--text-primary)]">
                      <span>Desktop Hero Height</span>
                      <span className="font-mono-tabular">
                        {config.background.heroHeight} px
                      </span>
                    </label>
                    <input
                      type="range"
                      min={320}
                      max={900}
                      step={10}
                      value={config.background.heroHeight}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          background: {
                            ...config.background,
                            heroHeight: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-[var(--accent-primary)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="flex justify-between font-medium text-[var(--text-primary)]">
                      <span>Overlay Scrim Opacity</span>
                      <span className="font-mono-tabular">
                        {Math.round(config.background.overlayOpacity * 100)}%
                      </span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={0.9}
                      step={0.05}
                      value={config.background.overlayOpacity}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          background: {
                            ...config.background,
                            overlayOpacity: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-[var(--accent-primary)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="flex justify-between font-medium text-[var(--text-primary)]">
                      <span>Media Brightness</span>
                      <span className="font-mono-tabular">
                        {Math.round(config.background.brightness * 100)}%
                      </span>
                    </label>
                    <input
                      type="range"
                      min={0.3}
                      max={1.4}
                      step={0.05}
                      value={config.background.brightness}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          background: {
                            ...config.background,
                            brightness: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-[var(--accent-primary)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-medium text-[var(--text-primary)]">
                      Media Sizing & Fit
                    </label>
                    <select
                      aria-label="Background sizing mode"
                      value={config.background.sizing}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          background: {
                            ...config.background,
                            sizing: e.target.value as BackgroundSizing,
                          },
                        })
                      }
                      className="w-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                    >
                      <option value="cover">Cover (Fill Canvas)</option>
                      <option value="contain">Contain (Fit Entire Media)</option>
                      <option value="center">Original Center</option>
                    </select>
                  </div>
                </div>

                {/* Restore Default Static Background */}
                <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4">
                  <button
                    type="button"
                    onClick={async () => {
                      await clearLocalMediaAssets();
                      onUpdateConfig({
                        ...config,
                        background: createDefaultConfig().background,
                      });
                      notify('success', 'Restored default static hero image.');
                    }}
                    className="flex items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restore Default Static Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await clearLocalMediaAssets();
                      onUpdateConfig({
                        ...config,
                        background: {
                          ...config.background,
                          type: 'solid',
                          localAssetId: null,
                          mediaUrl: DEFAULT_HERO_IMAGE,
                        },
                      });
                      notify('success', 'Removed media background; switched to solid canvas.');
                    }}
                    className="flex items-center gap-1.5 border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove Media (Solid Canvas)</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. WORKSPACE MOSAIC LAYOUT */}
            {activeTab === 'workspace' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                      Mosaic Layout & Module Spans
                    </h3>
                    <p className="mt-1 text-[var(--text-secondary)]">
                      Control module visibility, ordering, column spans (3–12), row spans (1–3), and density.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateConfig({
                        ...config,
                        layout: createDefaultLayout(),
                      });
                      notify('success', 'Reset all modules to default asymmetrical layout.');
                    }}
                    className="flex items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset All Modules</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {[...config.layout]
                    .sort((a, b) => a.order - b.order)
                    .map((mod, idx) => (
                      <div
                        key={mod.id}
                        className="flex flex-wrap items-center justify-between gap-3 border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 p-3"
                        style={{ borderRadius: 'var(--radius-control)' }}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={mod.visible}
                            aria-label={`Toggle ${mod.title} visibility`}
                            onChange={(e) => {
                              onUpdateConfig({
                                ...config,
                                layout: config.layout.map((m) =>
                                  m.id === mod.id
                                    ? { ...m, visible: e.target.checked }
                                    : m
                                ),
                              });
                            }}
                            className="h-4 w-4 accent-[var(--accent-primary)]"
                          />
                          <div>
                            <div className="font-semibold text-[var(--text-primary)]">
                              {idx + 1}. {mod.title}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)]">
                              ID: {mod.id} · {mod.visible ? 'Visible' : 'Hidden'}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-1 text-[11px]">
                            <span>Cols:</span>
                            <select
                              aria-label={`${mod.title} columns`}
                              value={mod.colSpan}
                              onChange={(e) => {
                                const clamped = clampModuleSpan(
                                  Number(e.target.value),
                                  mod.rowSpan
                                );
                                onUpdateConfig({
                                  ...config,
                                  layout: config.layout.map((m) =>
                                    m.id === mod.id
                                      ? { ...m, colSpan: clamped.colSpan }
                                      : m
                                  ),
                                });
                              }}
                              className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 font-mono-tabular"
                            >
                              {[3, 4, 5, 6, 7, 8, 9, 12].map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="flex items-center gap-1 text-[11px]">
                            <span>Rows:</span>
                            <select
                              aria-label={`${mod.title} rows`}
                              value={mod.rowSpan}
                              onChange={(e) => {
                                const clamped = clampModuleSpan(
                                  mod.colSpan,
                                  Number(e.target.value)
                                );
                                onUpdateConfig({
                                  ...config,
                                  layout: config.layout.map((m) =>
                                    m.id === mod.id
                                      ? { ...m, rowSpan: clamped.rowSpan }
                                      : m
                                  ),
                                });
                              }}
                              className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 font-mono-tabular"
                            >
                              {[1, 2, 3].map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </label>

                          <select
                            aria-label={`${mod.title} density`}
                            value={mod.density}
                            onChange={(e) =>
                              onUpdateConfig({
                                ...config,
                                layout: config.layout.map((m) =>
                                  m.id === mod.id
                                    ? {
                                        ...m,
                                        density: e.target.value as
                                          | 'compact'
                                          | 'comfortable',
                                      }
                                    : m
                                ),
                              })
                            }
                            className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11px]"
                          >
                            <option value="comfortable">Comfortable</option>
                            <option value="compact">Compact</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              const sorted = [...config.layout].sort(
                                (a, b) => a.order - b.order
                              );
                              if (idx > 0) {
                                onUpdateConfig({
                                  ...config,
                                  layout: reorderModules(
                                    sorted,
                                    mod.id,
                                    sorted[idx - 1].id
                                  ),
                                });
                              }
                            }}
                            aria-label={`Move ${mod.title} up`}
                            className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const sorted = [...config.layout].sort(
                                (a, b) => a.order - b.order
                              );
                              if (idx < sorted.length - 1) {
                                onUpdateConfig({
                                  ...config,
                                  layout: reorderModules(
                                    sorted,
                                    mod.id,
                                    sorted[idx + 1].id
                                  ),
                                });
                              }
                            }}
                            aria-label={`Move ${mod.title} down`}
                            className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onUpdateConfig({
                                ...config,
                                layout: resetSingleModuleLayout(
                                  config.layout,
                                  mod.id as ModuleId
                                ),
                              })
                            }
                            className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] hover:border-[var(--accent-primary)]"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 4. QUICK LINKS */}
            {activeTab === 'quick_links' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                      Quick Links Management
                    </h3>
                    <p className="mt-1 text-[var(--text-secondary)]">
                      Add, organize, and validate shortcuts. Website icons are automatically fetched directly from each entered URL.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob(
                          [JSON.stringify(config.quickLinks, null, 2)],
                          { type: 'application/json' }
                        );
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `wingst-quick-links-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        notify('success', 'Exported Quick Links JSON.');
                      }}
                      className="flex items-center gap-1.5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Export Links</span>
                    </button>

                    <label className="flex cursor-pointer items-center gap-1.5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:border-[var(--accent-primary)]">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Import Links</span>
                      <input
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const parsed = JSON.parse(await file.text());
                            const rawItems = Array.isArray(parsed)
                              ? parsed
                              : Array.isArray(parsed?.items)
                              ? parsed.items
                              : null;
                            if (!rawItems) {
                              notify('error', 'Invalid Quick Links JSON format.');
                              return;
                            }
                            const validItems = rawItems
                              .map((it: Record<string, unknown>, idx: number) => {
                                const check = validateSafeUrl(String(it?.url || ''));
                                if (!check.valid) return null;
                                return {
                                  id: String(it.id || `ql-${Date.now()}-${idx}`),
                                  title: String(it.title || check.normalizedUrl),
                                  url: check.normalizedUrl,
                                  group: String(it.group || 'General'),
                                  order: idx,
                                };
                              })
                              .filter(Boolean) as typeof config.quickLinks.items;
                            const allGroups = Array.from(
                              new Set([
                                ...config.quickLinks.groups,
                                ...validItems.map((i) => i.group),
                              ])
                            );
                            onUpdateConfig({
                              ...config,
                              quickLinks: {
                                ...config.quickLinks,
                                groups: allGroups,
                                items: validItems,
                              },
                            });
                            notify(
                              'success',
                              `Imported ${validItems.length} quick link(s).`
                            );
                          } catch {
                            notify('error', 'Could not parse Quick Links JSON.');
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.quickLinks.openInNewTab}
                    onChange={(e) =>
                      onUpdateConfig({
                        ...config,
                        quickLinks: {
                          ...config.quickLinks,
                          openInNewTab: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 accent-[var(--accent-primary)]"
                  />
                  <span>Open shortcuts in a new browser tab</span>
                </label>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const check = validateSafeUrl(qlUrl);
                    if (!check.valid) {
                      notify('error', check.error || 'Enter a valid URL.');
                      return;
                    }
                    let resolvedTitle = qlTitle.trim();
                    if (!resolvedTitle) {
                      try {
                        const host = new URL(check.normalizedUrl).hostname.replace(/^www\./i, '');
                        resolvedTitle = host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1);
                      } catch {
                        resolvedTitle = check.normalizedUrl;
                      }
                    }
                    const grp = qlGroup.trim() || 'General';
                    const nextGroups = config.quickLinks.groups.includes(grp)
                      ? config.quickLinks.groups
                      : [...config.quickLinks.groups, grp];
                    onUpdateConfig({
                      ...config,
                      quickLinks: {
                        ...config.quickLinks,
                        groups: nextGroups,
                        items: [
                          ...config.quickLinks.items,
                          {
                            id: `ql-${Date.now()}`,
                            title: resolvedTitle,
                            url: check.normalizedUrl,
                            group: grp,
                            order: config.quickLinks.items.length,
                          },
                        ],
                      },
                    });
                    setQlTitle('');
                    setQlUrl('');
                    notify('success', `Added "${resolvedTitle}" with automatic site icon.`);
                  }}
                  className="grid grid-cols-1 gap-2 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 sm:grid-cols-4"
                >
                  <input
                    type="text"
                    value={qlTitle}
                    onChange={(e) => setQlTitle(e.target.value)}
                    placeholder="Title (optional, auto from URL)"
                    aria-label="New link title"
                    className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5"
                  />
                  <input
                    type="text"
                    value={qlUrl}
                    onChange={(e) => setQlUrl(e.target.value)}
                    placeholder="https://... or domain.com"
                    aria-label="New link URL"
                    className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5"
                  />
                  <input
                    type="text"
                    value={qlGroup}
                    onChange={(e) => setQlGroup(e.target.value)}
                    placeholder="Group"
                    aria-label="New link group"
                    className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5"
                  />
                  <button
                    type="submit"
                    className="bg-[var(--accent-primary)] px-3 py-1.5 font-medium text-white"
                  >
                    <Plus className="inline h-3.5 w-3.5 mr-1" />
                    Add Shortcut
                  </button>
                </form>

                <div className="space-y-1.5">
                  {config.quickLinks.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <LinkFavicon
                          url={item.url}
                          title={item.title}
                          customIcon={item.icon}
                          sizeClass="h-4 w-4"
                        />
                        <div className="truncate">
                          <strong className="text-[var(--text-primary)]">
                            {item.title}
                          </strong>{' '}
                          <span className="text-[var(--text-muted)]">
                            ({item.group}) · {item.url}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateConfig({
                            ...config,
                            quickLinks: {
                              ...config.quickLinks,
                              items: config.quickLinks.items.filter(
                                (i) => i.id !== item.id
                              ),
                            },
                          })
                        }
                        aria-label={`Delete ${item.title}`}
                        className="text-[var(--text-muted)] hover:text-[var(--status-error)] shrink-0 ml-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. DAILY ACTIVITY */}
            {activeTab === 'daily_activity' && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                    Daily Activity & Habit Checklist
                  </h3>
                  <p className="mt-1 text-[var(--text-secondary)]">
                    Create, rename, reorder, and manage your daily activities. Resetting today&apos;s checklist never deletes historical records.
                  </p>
                </div>

                <form
                  onSubmit={handleCreateActivity}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={newActivityName}
                    onChange={(e) => setNewActivityName(e.target.value)}
                    placeholder="Define a new daily activity (e.g. Read 20 pages)..."
                    aria-label="Define new daily activity"
                    className="flex-1 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="bg-[var(--accent-primary)] px-4 py-2 text-xs font-medium text-white hover:opacity-90"
                  >
                    Create Activity
                  </button>
                </form>

                {config.dailyActivity.activities.length === 0 ? (
                  <div className="border border-dashed border-[var(--border-subtle)] p-6 text-center text-[var(--text-muted)]">
                    Your daily activity list is currently empty. Add your first habit above.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {[...config.dailyActivity.activities]
                      .sort((a, b) => a.order - b.order)
                      .map((act) => (
                        <div
                          key={act.id}
                          className="flex items-center justify-between gap-2 border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 px-3 py-2"
                        >
                          {editingActivityId === act.id ? (
                            <div className="flex flex-1 items-center gap-2">
                              <input
                                type="text"
                                value={editingActivityTitle}
                                onChange={(e) =>
                                  setEditingActivityTitle(e.target.value)
                                }
                                aria-label="Rename activity"
                                className="flex-1 border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 py-1"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveActivityRename(act.id)}
                                className="bg-[var(--accent-primary)] px-2.5 py-1 text-white"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="font-medium text-[var(--text-primary)]">
                              {act.title}
                            </span>
                          )}

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveActivity(act.id, -1)}
                              aria-label={`Move ${act.title} up`}
                              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveActivity(act.id, 1)}
                              aria-label={`Move ${act.title} down`}
                              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingActivityId(act.id);
                                setEditingActivityTitle(act.title);
                              }}
                              className="px-2 py-0.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteActivity(act.id)}
                              aria-label={`Delete ${act.title}`}
                              className="p-1 text-[var(--text-muted)] hover:text-[var(--status-error)]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateConfig({
                        ...config,
                        dailyActivity: resetTodayActivityCompletions(
                          config.dailyActivity
                        ),
                      });
                      notify(
                        'success',
                        'Reset today’s checklist completion. Historical records remain preserved.'
                      );
                    }}
                    className="flex items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset Current-Day Completion Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob(
                        [JSON.stringify(config.dailyActivity, null, 2)],
                        { type: 'application/json' }
                      );
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `wingst-activity-history-${config.dailyActivity.activeDate}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      notify('success', 'Exported Daily Activity data.');
                    }}
                    className="flex items-center gap-1.5 border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Activity History JSON</span>
                  </button>
                </div>
              </div>
            )}

            {/* 6. SEARCH ENGINE */}
            {activeTab === 'search' && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                    Search Provider & History Controls
                  </h3>
                  <p className="mt-1 text-[var(--text-secondary)]">
                    Queries entered in the header are forwarded directly to your chosen search engine. No keystrokes are sent over the network while typing.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block font-semibold text-[var(--text-primary)]">
                    Active Search Engine
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {(Object.keys(SEARCH_PROVIDERS) as SearchProviderId[]).map(
                      (pid) => {
                        const p = SEARCH_PROVIDERS[pid];
                        const active = config.search.provider === pid;
                        return (
                          <button
                            key={pid}
                            type="button"
                            onClick={() =>
                              onUpdateConfig({
                                ...config,
                                search: { ...config.search, provider: pid },
                              })
                            }
                            className={`flex items-center justify-between border px-3 py-2 text-left text-xs ${
                              active
                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white font-semibold'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                            }`}
                            style={{ borderRadius: 'var(--radius-control)' }}
                          >
                            <span>{p.name}</span>
                            <span className="font-mono-tabular text-[10px] opacity-80">
                              {p.shortcutHint}
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.search.persistHistory}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          search: {
                            ...config.search,
                            persistHistory: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 accent-[var(--accent-primary)]"
                    />
                    <span>Save search history locally on this device</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.search.openInNewTab}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          search: {
                            ...config.search,
                            openInNewTab: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 accent-[var(--accent-primary)]"
                    />
                    <span>Open search results in a new tab</span>
                  </label>
                </div>

                <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text-primary)]">
                      Stored Search History ({config.search.history.length})
                    </span>
                    {config.search.history.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateConfig({
                            ...config,
                            search: { ...config.search, history: [] },
                          });
                          notify('success', 'Cleared all search history.');
                        }}
                        className="text-xs text-[var(--status-error)] underline"
                      >
                        Clear All History
                      </button>
                    )}
                  </div>

                  {config.search.history.length === 0 ? (
                    <p className="text-[var(--text-muted)]">
                      No local search queries recorded.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {config.search.history.map((h) => (
                        <div
                          key={h.id}
                          className="flex items-center justify-between border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 px-3 py-1.5"
                        >
                          <span>
                            {h.query}{' '}
                            <span className="text-[10px] text-[var(--text-muted)]">
                              ({h.provider})
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateConfig({
                                ...config,
                                search: {
                                  ...config.search,
                                  history: config.search.history.filter(
                                    (item) => item.id !== h.id
                                  ),
                                },
                              })
                            }
                            className="text-[var(--text-muted)] hover:text-[var(--status-error)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 7. MUSIC EMBEDS */}
            {activeTab === 'music' && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                    Official Music Embed Configuration
                  </h3>
                  <p className="mt-1 text-[var(--text-secondary)]">
                    Configure legitimate embedded players from Spotify, YouTube, Apple Music, or SoundCloud.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const parsed = parseOfficialMusicEmbed(
                      musicUrl,
                      config.music.provider
                    );
                    if (!parsed.valid) {
                      notify('error', parsed.error || 'Invalid music embed link.');
                      return;
                    }
                    const nextPl = {
                      id: `pl-${Date.now()}`,
                      title:
                        musicTitle.trim() || `${parsed.provider.toUpperCase()} Embed`,
                      provider: parsed.provider,
                      url: musicUrl.trim(),
                      embedUrl: parsed.embedUrl,
                    };
                    onUpdateConfig({
                      ...config,
                      music: {
                        ...config.music,
                        provider: parsed.provider,
                        activeEmbedUrl: parsed.embedUrl,
                        savedPlaylists: [nextPl, ...config.music.savedPlaylists],
                      },
                    });
                    setMusicTitle('');
                    setMusicUrl('');
                    notify('success', 'Official music embed added.');
                  }}
                  className="space-y-2 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3"
                >
                  <div className="font-semibold text-[var(--text-primary)]">
                    Add Playlist or Track URL
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      value={musicTitle}
                      onChange={(e) => setMusicTitle(e.target.value)}
                      placeholder="Playlist Title"
                      aria-label="Music playlist title"
                      className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      value={musicUrl}
                      onChange={(e) => setMusicUrl(e.target.value)}
                      placeholder="https://open.spotify.com/playlist/..."
                      aria-label="Music playlist URL"
                      className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 sm:col-span-2"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-[var(--accent-primary)] px-3 py-1.5 font-medium text-white"
                  >
                    Save & Activate Embed
                  </button>
                </form>
              </div>
            )}

            {/* 8. WEATHER & LOCATION */}
            {activeTab === 'location' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                      GPS Auto-Sync, Weather & Prayer Location
                    </h3>
                    <p className="mt-1 text-[var(--text-secondary)]">
                      Aktifkan bantuan GPS untuk otomatis mendeteksi titik koordinat Anda dan memperbarui Cuaca (Open-Meteo), Jadwal Sholat (Kemenag RI / Aladhan), serta Header Lokasi secara bersamaan.
                    </p>
                  </div>

                  {onTriggerGps && (
                    <button
                      type="button"
                      onClick={onTriggerGps}
                      disabled={isSyncingGps}
                      className="flex items-center gap-1.5 bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 shrink-0"
                      style={{ borderRadius: 'var(--radius-control)' }}
                    >
                      <Navigation
                        className={`h-3.5 w-3.5 ${
                          isSyncingGps ? 'animate-spin' : ''
                        }`}
                      />
                      <span>
                        {isSyncingGps
                          ? 'Mendeteksi GPS...'
                          : 'Deteksi & Sinkronkan Lokasi GPS'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block mb-1 font-medium text-[var(--text-primary)]">
                      City Label
                    </label>
                    <input
                      type="text"
                      value={config.location.city}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          location: { ...config.location, city: e.target.value },
                        })
                      }
                      className="w-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-[var(--text-primary)]">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={config.location.latitude}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          location: {
                            ...config.location,
                            latitude: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-[var(--text-primary)]">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={config.location.longitude}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          location: {
                            ...config.location,
                            longitude: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 font-mono-tabular"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block mb-1 font-medium text-[var(--text-primary)]">
                      Temperature Unit
                    </label>
                    <select
                      value={config.location.unit}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          location: {
                            ...config.location,
                            unit: e.target.value as 'celsius' | 'fahrenheit',
                          },
                        })
                      }
                      className="w-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5"
                    >
                      <option value="celsius">Celsius (°C)</option>
                      <option value="fahrenheit">Fahrenheit (°F)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 font-medium text-[var(--text-primary)]">
                      Wind Speed Unit
                    </label>
                    <select
                      value={config.location.windUnit}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...config,
                          location: {
                            ...config.location,
                            windUnit: e.target.value as 'kmh' | 'mph' | 'ms',
                          },
                        })
                      }
                      className="w-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5"
                    >
                      <option value="kmh">km/h</option>
                      <option value="mph">mph</option>
                      <option value="ms">m/s</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 9. DATA & PRIVACY */}
            {activeTab === 'data_privacy' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                    Local-First Data & Privacy Architecture
                  </h3>
                  <p className="mt-1 text-[var(--text-secondary)]">
                    Wingst requires no user account. Your notes, daily activities, quick links, search history, and layout configurations remain strictly on your device.
                  </p>
                </div>

                {/* Export / Import */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2">
                    <div className="font-semibold text-[var(--text-primary)]">
                      Export Complete Configuration
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Download a versioned JSON snapshot of your layout, shortcuts, notes, and daily activities.
                    </p>
                    <button
                      type="button"
                      onClick={handleExportFullConfig}
                      className="flex items-center gap-1.5 bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-medium text-white"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Export Configuration JSON</span>
                    </button>
                  </div>

                  <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2">
                    <div className="font-semibold text-[var(--text-primary)]">
                      Import & Validate Configuration
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Restore a previously exported Wingst JSON configuration file.
                    </p>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Select JSON File...</span>
                      <input
                        type="file"
                        accept="application/json"
                        onChange={handleImportFullConfig}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Clear Specific Categories or Reset All */}
                <div className="border border-[var(--status-error)]/40 bg-[var(--bg-elevated)] p-4 space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-[var(--status-error)]">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Selective & Full Local Data Reset</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateConfig({
                          ...config,
                          search: { ...config.search, history: [] },
                        });
                        notify('success', 'Cleared search history.');
                      }}
                      className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs hover:border-[var(--status-error)]"
                    >
                      Clear Search History
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onUpdateConfig({
                          ...config,
                          notepad: { notes: [], activeNoteId: null },
                        });
                        notify('success', 'Cleared all local notes.');
                      }}
                      className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs hover:border-[var(--status-error)]"
                    >
                      Clear All Notes
                    </button>

                    {!confirmFullReset ? (
                      <button
                        type="button"
                        onClick={() => setConfirmFullReset(true)}
                        className="border border-[var(--status-error)] bg-[var(--status-error)]/10 px-3 py-1.5 text-xs font-medium text-[var(--status-error)]"
                      >
                        Erase All Local Data...
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await clearAllWingstStorage();
                            onUpdateConfig(createDefaultConfig());
                            setConfirmFullReset(false);
                            notify('success', 'All local workspace data has been erased and reset.');
                          }}
                          className="bg-[var(--status-error)] px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Confirm Erase Everything
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmFullReset(false)}
                          className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transparent Architecture Disclosure */}
                <div className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-[11px] text-[var(--text-secondary)] space-y-1.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    Storage & Network Transparency
                  </div>
                  <p>
                    • <strong>Web Storage vs Extension Storage:</strong> Website preferences are stored in <code>localStorage</code> and <code>IndexedDB</code>. Chrome Extension preferences use <code>chrome.storage.local</code> and extension-scoped <code>IndexedDB</code>. They are separate by default; use Export/Import JSON above to transfer settings between them.
                  </p>
                  <p>
                    • <strong>External API Requests:</strong> Weather queries Open-Meteo (<code>api.open-meteo.com</code>), Forex queries ECB/Frankfurter reference rates (<code>api.frankfurter.dev</code>), and Prayer Times query MyQuran Kemenag RI (<code>api.myquran.com</code>) with Aladhan (<code>api.aladhan.com</code>) fallback. Private notes and daily activities are never transmitted over the network.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
  LayoutGrid,
  Clock,
  ArrowUpRight,
  ChevronDown,
  Puzzle,
  Trash2,
  Droplets,
  Navigation,
  Zap,
  Sparkles,
} from 'lucide-react';
import {
  LiquidOsConfig,
  LiquidVariant,
  SearchConfig,
  SearchProviderId,
} from '@/lib/types';
import {
  ACCENT_PRESETS,
  SEARCH_PROVIDERS,
  buildSearchUrl,
  recordSearchQuery,
} from '@/lib/wingst-core';

interface HeaderProps {
  searchConfig: SearchConfig;
  onUpdateSearch: (next: SearchConfig) => void;
  liquidConfig: LiquidOsConfig;
  onUpdateLiquid: (next: LiquidOsConfig) => void;
  primaryColor?: string;
  autoExtractAccent?: boolean;
  onUpdatePrimaryColor?: (hex: string) => void;
  onToggleAutoExtractAccent?: () => void;
  locationCity: string;
  isSyncingGps: boolean;
  onTriggerGps: () => void;
  isEditingLayout: boolean;
  onToggleEditLayout: () => void;
  onOpenSettings: (initialTab?: string) => void;
  onOpenExtensionModal: () => void;
  isPeekingCanvas?: boolean;
  onTogglePeekCanvas?: () => void;
}

const LIQUID_MODES: {
  id: LiquidVariant;
  label: string;
  sublabel: string;
}[] = [
  { id: 'frosted', label: 'Frosted', sublabel: 'Concept' },
  { id: 'clear', label: 'Clear', sublabel: 'iOS Glass' },
  { id: 'blur', label: 'Blur', sublabel: 'One UI' },
];

const QUICK_SUGGESTIONS: Record<string, string[]> = {
  usd: ['usd to idr exchange rate', 'usd index live chart', 'usd macro calendar'],
  weather: ['weather radar forecast', 'jakarta hourly weather', 'global wind map'],
  git: ['github trending repositories', 'git rebase interactive guide'],
  dev: ['mdn web docs', 'typescript handbook', 'chrome extension manifest v3'],
};

export default function Header({
  searchConfig,
  onUpdateSearch,
  liquidConfig,
  onUpdateLiquid,
  primaryColor = '#e11d48',
  autoExtractAccent = false,
  onUpdatePrimaryColor,
  onToggleAutoExtractAccent,
  locationCity,
  isSyncingGps,
  onTriggerGps,
  isEditingLayout,
  onToggleEditLayout,
  onOpenSettings,
  onOpenExtensionModal,
  isPeekingCanvas = false,
  onTogglePeekCanvas,
}: HeaderProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const [liquidMenuOpen, setLiquidMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const liquidMenuRef = useRef<HTMLDivElement>(null);

  const activeProvider =
    SEARCH_PROVIDERS[searchConfig.provider] || SEARCH_PROVIDERS.google;

  // Global keyboard shortcut '/' or Cmd/Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape' && (isFocused || liquidMenuOpen)) {
        setIsFocused(false);
        setLiquidMenuOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, liquidMenuOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
        setProviderMenuOpen(false);
      }
      if (
        liquidMenuRef.current &&
        !liquidMenuRef.current.contains(e.target as Node)
      ) {
        setLiquidMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmedQuery = query.trim().toLowerCase();
  const matchingHistory = searchConfig.history
    .filter((h) => !trimmedQuery || h.query.toLowerCase().includes(trimmedQuery))
    .slice(0, 5);

  const localSuggestions =
    searchConfig.showSuggestions && trimmedQuery.length >= 2
      ? Object.entries(QUICK_SUGGESTIONS)
          .filter(([k]) => trimmedQuery.startsWith(k) || k.startsWith(trimmedQuery))
          .flatMap(([, list]) => list)
          .filter(
            (s) =>
              !matchingHistory.some(
                (h) => h.query.toLowerCase() === s.toLowerCase()
              )
          )
          .slice(0, 3)
      : [];

  const combinedItems = [
    ...matchingHistory.map((h) => ({
      type: 'history' as const,
      id: h.id,
      text: h.query,
    })),
    ...localSuggestions.map((s) => ({
      type: 'suggestion' as const,
      id: `sug-${s}`,
      text: s,
    })),
  ];

  const executeSearch = (targetQuery: string) => {
    const finalQuery = targetQuery.trim();
    if (!finalQuery) return;

    const updatedSearch = recordSearchQuery(searchConfig, finalQuery);
    onUpdateSearch(updatedSearch);

    const targetUrl = buildSearchUrl(searchConfig.provider, finalQuery);
    setIsFocused(false);

    if (searchConfig.openInNewTab) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.location.assign(targetUrl);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeIndex >= 0 && activeIndex < combinedItems.length) {
      executeSearch(combinedItems[activeIndex].text);
    } else {
      executeSearch(query);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < combinedItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : combinedItems.length - 1
      );
    }
  };

  const removeHistoryEntry = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateSearch({
      ...searchConfig,
      history: searchConfig.history.filter((h) => h.id !== id),
    });
  };

  const clearAllHistory = () => {
    onUpdateSearch({
      ...searchConfig,
      history: [],
    });
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeLiquidLabel = !liquidConfig.enabled
    ? 'Off'
    : liquidConfig.liteMode
    ? 'Lite'
    : LIQUID_MODES.find((m) => m.id === liquidConfig.variant)?.label || 'Frosted';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[var(--bg-canvas)]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:flex-nowrap lg:gap-6">
        {/* Zone 1: Editorial Brand Wordmark */}
        <button
          type="button"
          onClick={handleScrollToTop}
          className="wingst-focus group flex items-center gap-2.5 text-left whitespace-nowrap shrink-0"
          aria-label="Return to Wingst main workspace"
        >
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center border border-[var(--border-strong)] bg-[var(--bg-surface)] transition-colors group-hover:border-[var(--accent-primary)]"
            style={{ borderRadius: '6px' }}
          >
            <span className="h-2 w-2 rounded-[2px] bg-[var(--accent-primary)]" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-[var(--text-primary)]">
            WINGST
          </span>
        </button>

        {/* Zone 2: Center Global Search Bar */}
        <div
          ref={searchContainerRef}
          className="relative order-3 w-full lg:order-2 lg:max-w-lg lg:flex-1"
        >
          <form
            onSubmit={handleFormSubmit}
            role="search"
            className={`flex items-center border bg-[var(--bg-surface)]/90 transition-colors ${
              isFocused
                ? 'border-[var(--accent-primary)]'
                : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
            }`}
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            {/* Provider Switcher Button */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setProviderMenuOpen((o) => !o)}
                aria-label={`Search provider: ${activeProvider.name}. Click to change provider`}
                aria-expanded={providerMenuOpen}
                className="wingst-focus flex items-center gap-1.5 border-r border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
              >
                <span className="font-mono-tabular text-[11px] font-semibold text-[var(--accent-primary)]">
                  {activeProvider.shortcutHint}
                </span>
                <span className="hidden sm:inline">{activeProvider.name}</span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>

              {providerMenuOpen && (
                <div
                  role="menu"
                  className="wingst-elevated absolute left-0 top-full z-50 mt-1 w-48 py-1 shadow-xl"
                >
                  <div className="px-3 py-1 text-[11px] font-medium text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                    Forward Query To
                  </div>
                  {(Object.keys(SEARCH_PROVIDERS) as SearchProviderId[]).map(
                    (pid) => {
                      const p = SEARCH_PROVIDERS[pid];
                      const active = pid === searchConfig.provider;
                      return (
                        <button
                          key={pid}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onUpdateSearch({ ...searchConfig, provider: pid });
                            setProviderMenuOpen(false);
                            inputRef.current?.focus();
                          }}
                          className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors ${
                            active
                              ? 'bg-[var(--accent-primary)] text-white font-semibold'
                              : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                          }`}
                        >
                          <span>{p.name}</span>
                          <span className="font-mono-tabular text-[10px] opacity-75">
                            {p.shortcutHint}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative flex flex-1 items-center">
              <Search
                aria-hidden="true"
                className="ml-2.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onFocus={() => {
                  setIsFocused(true);
                  setActiveIndex(-1);
                }}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder={`Search with ${activeProvider.name}... (Press / to focus)`}
                aria-label={`Search query via ${activeProvider.name}`}
                className="w-full bg-transparent px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none sm:text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search query"
                  className="wingst-focus mr-1 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="submit"
                aria-label="Submit search query"
                className="wingst-focus mr-1.5 px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] whitespace-nowrap shrink-0"
              >
                Go
              </button>
            </div>
          </form>

          {/* Search Suggestions, Quick Workspace Actions & Local History Dropdown */}
          {isFocused && (
            <div className="wingst-elevated absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden shadow-2xl">
              {query.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => executeSearch(query)}
                  className="flex w-full items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Search className="h-3.5 w-3.5 text-[var(--accent-primary)] shrink-0" />
                    <span>
                      Search <strong>{query.trim()}</strong> on{' '}
                      {activeProvider.name}
                    </span>
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                </button>
              )}

              {/* Quick Workspace Commands Bar */}
              <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 px-3 py-2">
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Quick Workspace Actions
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateLiquid({
                        ...liquidConfig,
                        enabled: true,
                        liteMode: !liquidConfig.liteMode,
                      });
                      setIsFocused(false);
                    }}
                    className={`border px-2 py-1 text-[11px] font-medium transition-colors ${
                      liquidConfig.liteMode
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    style={{ borderRadius: 'var(--radius-control)' }}
                  >
                    <Zap className="mr-1 inline h-3 w-3" />
                    {liquidConfig.liteMode ? 'Lite Mode: ON' : 'Mode Ringan (Kentang)'}
                  </button>

                  {onTogglePeekCanvas && (
                    <button
                      type="button"
                      onClick={() => {
                        onTogglePeekCanvas();
                        setIsFocused(false);
                      }}
                      className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      style={{ borderRadius: 'var(--radius-control)' }}
                    >
                      {isPeekingCanvas ? 'Tampilkan Modul' : 'Lihat Full BG'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onTriggerGps();
                      setIsFocused(false);
                    }}
                    className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    style={{ borderRadius: 'var(--radius-control)' }}
                  >
                    Sync GPS
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenSettings('appearance');
                      setIsFocused(false);
                    }}
                    className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    style={{ borderRadius: 'var(--radius-control)' }}
                  >
                    Liquid OS Settings
                  </button>
                </div>
              </div>

              {combinedItems.length > 0 && (
                <div className="py-1">
                  <div className="flex items-center justify-between px-3 py-1 text-[11px] text-[var(--text-muted)]">
                    <span>
                      {searchConfig.persistHistory
                        ? 'Recent Queries & Local Suggestions'
                        : 'Suggestions (History Paused)'}
                    </span>
                    {matchingHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllHistory}
                        className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--status-error)]"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Clear History</span>
                      </button>
                    )}
                  </div>

                  {combinedItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                        idx === activeIndex
                          ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(item.text);
                          executeSearch(item.text);
                        }}
                        className="flex flex-1 items-center gap-2 text-left truncate"
                      >
                        {item.type === 'history' ? (
                          <Clock className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                        ) : (
                          <Search className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                        )}
                        <span className="truncate">{item.text}</span>
                      </button>
                      {item.type === 'history' && (
                        <button
                          type="button"
                          onClick={(e) => removeHistoryEntry(item.id, e)}
                          aria-label={`Remove "${item.text}" from search history`}
                          className="ml-2 p-1 text-[var(--text-muted)] hover:text-[var(--status-error)]"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zone 3: Right Controls (GPS Sync + Liquid OS 3-Mode Button + Mosaic + Settings) */}
        <div className="order-2 flex items-center gap-2 shrink-0 lg:order-3">
          {/* 1-Click GPS Location Sync Button */}
          <button
            type="button"
            onClick={onTriggerGps}
            disabled={isSyncingGps}
            title="Deteksi koordinat GPS & sinkronkan Cuaca + Jadwal Sholat"
            className="wingst-focus flex items-center gap-1.5 border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <Navigation
              className={`h-3.5 w-3.5 text-[var(--accent-primary)] ${
                isSyncingGps ? 'animate-spin' : ''
              }`}
            />
            <span className="hidden md:inline max-w-[110px] truncate">
              {isSyncingGps ? 'Syncing GPS...' : locationCity}
            </span>
          </button>

          {/* Liquid OS Toggle & 3-Mode Selector Button (Frosted, Clear iOS, Blur One UI) */}
          <div ref={liquidMenuRef} className="relative">
            <div
              className="flex items-center border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              <button
                type="button"
                onClick={() =>
                  onUpdateLiquid({
                    ...liquidConfig,
                    enabled: !liquidConfig.enabled,
                  })
                }
                aria-pressed={liquidConfig.enabled}
                title="Matikan atau hidupkan efek kaca Liquid OS"
                className={`wingst-focus flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  liquidConfig.enabled
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                style={{
                  borderTopLeftRadius: 'calc(var(--radius-control) - 1px)',
                  borderBottomLeftRadius: 'calc(var(--radius-control) - 1px)',
                }}
              >
                <Droplets className="h-3.5 w-3.5" />
                <span>Liquid: {activeLiquidLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => setLiquidMenuOpen((v) => !v)}
                aria-label="Pilih jenis Liquid OS (Frosted, Clear iOS, Blur One UI)"
                aria-expanded={liquidMenuOpen}
                className="wingst-focus border-l border-[var(--border-subtle)] px-1.5 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {liquidMenuOpen && (
              <div
                role="menu"
                aria-label="Liquid OS Surface Modes"
                className="wingst-elevated absolute right-0 top-full z-50 mt-1.5 w-76 p-3 shadow-2xl space-y-3 text-xs"
              >
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                  <div>
                    <div className="font-display font-bold text-[var(--text-primary)]">
                      Liquid OS Surface Engine
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Pilih 3 jenis efek kaca atau matikan
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateLiquid({
                        ...liquidConfig,
                        enabled: !liquidConfig.enabled,
                      })
                    }
                    className={`border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      liquidConfig.enabled
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                    }`}
                    style={{ borderRadius: 'var(--radius-control)' }}
                  >
                    {liquidConfig.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* 3 Liquid OS Cards matching Reference Image 2 */}
                <div className="grid grid-cols-3 gap-1.5">
                  {LIQUID_MODES.map((m) => {
                    const isSelected =
                      liquidConfig.enabled &&
                      !liquidConfig.liteMode &&
                      liquidConfig.variant === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          onUpdateLiquid({
                            ...liquidConfig,
                            enabled: true,
                            liteMode: false,
                            variant: m.id,
                          })
                        }
                        className={`flex flex-col items-center justify-center border p-2.5 text-center transition-all ${
                          isSelected
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--text-primary)] font-semibold'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                        }`}
                        style={{ borderRadius: 'var(--radius-control)' }}
                      >
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {m.label}
                        </span>
                        <span className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                          {m.sublabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Mode Ringan (Device Kentang / Lite GPU) Toggle */}
                <div
                  className="flex items-center justify-between gap-2 border border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 p-2"
                  style={{ borderRadius: 'var(--radius-control)' }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 font-semibold text-[var(--text-primary)]">
                      <Zap className="h-3.5 w-3.5 text-[var(--accent-primary)] shrink-0" />
                      <span>Mode Ringan (Device Kentang)</span>
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      Hemat GPU & RAM tanpa multi-pass blur berat
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="liquid-lite-toggle"
                    onClick={() =>
                      onUpdateLiquid({
                        ...liquidConfig,
                        enabled: true,
                        liteMode: !liquidConfig.liteMode,
                      })
                    }
                    className={`border px-2.5 py-1 text-[11px] font-semibold shrink-0 transition-colors ${
                      liquidConfig.liteMode
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    }`}
                    style={{ borderRadius: 'var(--radius-control)' }}
                  >
                    {liquidConfig.liteMode ? 'AKTIF' : 'MATI'}
                  </button>
                </div>

                {/* Quick Sliders for Blur & Opacity right in popover */}
                <div className="space-y-2 border-t border-[var(--border-subtle)] pt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[var(--text-secondary)]">
                        Intensitas Blur
                      </span>
                      <span className="font-mono-tabular text-[var(--text-primary)]">
                        {liquidConfig.blurPx}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={48}
                      step={2}
                      value={liquidConfig.blurPx}
                      onChange={(e) =>
                        onUpdateLiquid({
                          ...liquidConfig,
                          enabled: true,
                          liteMode: false,
                          blurPx: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[var(--accent-primary)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[var(--text-secondary)]">
                        Transparansi Kaca
                      </span>
                      <span className="font-mono-tabular text-[var(--text-primary)]">
                        {Math.round(liquidConfig.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.15}
                      max={0.9}
                      step={0.05}
                      value={liquidConfig.opacity}
                      onChange={(e) =>
                        onUpdateLiquid({
                          ...liquidConfig,
                          enabled: true,
                          opacity: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[var(--accent-primary)]"
                    />
                  </div>
                </div>

                {/* Quick Primary Accent Color & Auto-Accent from BG */}
                {onUpdatePrimaryColor && (
                  <div className="space-y-1.5 border-t border-[var(--border-subtle)] pt-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-secondary)]">
                        Nuansa Aksen Utama
                      </span>
                      {onToggleAutoExtractAccent && (
                        <button
                          type="button"
                          data-testid="header-auto-accent-btn"
                          onClick={onToggleAutoExtractAccent}
                          className={`flex items-center gap-1 border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                            autoExtractAccent
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                          style={{ borderRadius: '4px' }}
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          <span>Auto dari BG</span>
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ACCENT_PRESETS.map((preset) => {
                        const active =
                          primaryColor.toLowerCase() === preset.hex.toLowerCase();
                        return (
                          <button
                            key={preset.hex}
                            type="button"
                            data-testid={`header-accent-${preset.hex.slice(1)}`}
                            title={preset.name}
                            onClick={() => onUpdatePrimaryColor(preset.hex)}
                            className={`h-5 w-5 border transition-transform ${
                              active
                                ? 'scale-110 border-white ring-1 ring-white'
                                : 'border-white/25 hover:scale-105'
                            }`}
                            style={{
                              backgroundColor: preset.hex,
                              borderRadius: '4px',
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-between border-t border-[var(--border-subtle)] pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLiquidMenuOpen(false);
                      onOpenSettings('appearance');
                    }}
                    className="text-[11px] text-[var(--accent-primary)] underline hover:opacity-90"
                  >
                    Pengaturan Detail Liquid OS →
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleEditLayout}
            aria-pressed={isEditingLayout}
            className={`wingst-focus hidden sm:flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isEditingLayout
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)]'
            }`}
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>{isEditingLayout ? 'Finish Layout' : 'Edit Mosaic'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenExtensionModal}
            className="wingst-focus flex items-center gap-1.5 border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
            style={{ borderRadius: 'var(--radius-control)' }}
            aria-label="Chrome Extension New Tab Package"
          >
            <Puzzle className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
            <span className="hidden xl:inline">Extension</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenSettings('appearance')}
            className="wingst-focus flex items-center gap-1.5 border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors whitespace-nowrap shrink-0"
            style={{ borderRadius: 'var(--radius-control)' }}
            aria-label="Open Wingst Settings Center"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}

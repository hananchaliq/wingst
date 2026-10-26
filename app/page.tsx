'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Eye } from 'lucide-react';
import { LiquidOsConfig, WingstConfig } from '@/lib/types';
import {
  DEFAULT_HERO_IMAGE,
  createDefaultConfig,
  extractVibrantColorFromImage,
  hexToRgbChannels,
  reconcileDailyActivityDay,
} from '@/lib/wingst-core';
import { loadWingstConfig, saveWingstConfig } from '@/lib/storage';
import { detectGpsAndResolveLocation } from '@/lib/api-clients';
import Header from '@/components/Header';
import HeroCanvas from '@/components/HeroCanvas';
import MosaicWorkspace from '@/components/MosaicWorkspace';
import SettingsModal, { SettingsTabId } from '@/components/SettingsModal';
import ExtensionModal from '@/components/ExtensionModal';

export default function WingstPage() {
  const [config, setConfig] = useState<WingstConfig>(() => createDefaultConfig());
  const [hydrated, setHydrated] = useState(false);
  const [storageSource, setStorageSource] = useState<'web' | 'extension'>('web');
  const [storageError, setStorageError] = useState<string | null>(null);

  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [isPeekingCanvas, setIsPeekingCanvas] = useState(false);
  const [isSyncingGps, setIsSyncingGps] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>('appearance');
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [resolvedBgUrl, setResolvedBgUrl] = useState<string>(DEFAULT_HERO_IMAGE);
  const latestConfigRef = useRef<WingstConfig>(config);

  useEffect(() => {
    latestConfigRef.current = config;
  }, [config]);

  // Hydrate configuration from local storage / chrome.storage.local on mount
  useEffect(() => {
    let mounted = true;
    async function init() {
      const loaded = await loadWingstConfig();
      if (!mounted) return;
      const reconciled = {
        ...loaded.config,
        dailyActivity: reconcileDailyActivityDay(loaded.config.dailyActivity),
      };
      setConfig(reconciled);
      setStorageSource(loaded.storageSource);
      if (loaded.error) {
        setStorageError(loaded.error);
      }
      setHydrated(true);
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // Apply CSS custom properties, theme attribute, and Liquid OS surface engine
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    const applyResolvedTheme = () => {
      let resolved = config.appearance.theme;
      if (resolved === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark';
      }
      root.setAttribute('data-theme', resolved);
    };

    applyResolvedTheme();

    // Liquid OS 3-Mode Surface Engine + Lite Mode (Device Kentang)
    const liquid = config.appearance.liquid;
    const blurPx = Number.isFinite(liquid.blurPx) ? liquid.blurPx : 20;
    const clearBlurPx = Math.max(8, Math.round(blurPx * 0.65));
    const deepBlurPx = Math.min(48, Math.round(blurPx * 1.35));

    root.setAttribute(
      'data-liquid',
      !liquid.enabled ? 'off' : liquid.liteMode ? 'lite' : liquid.variant
    );
    root.style.setProperty('--liquid-blur', `${blurPx}px`);
    root.style.setProperty('--liquid-blur-clear', `${clearBlurPx}px`);
    root.style.setProperty('--liquid-blur-blur', `${deepBlurPx}px`);
    root.style.setProperty('--liquid-opacity', `${liquid.opacity}`);
    root.style.setProperty('--liquid-specular', `${liquid.specularIntensity}`);

    // Balanced, non-AI-slop geometry tokens
    const radiusCard = config.appearance.borderRadius ?? 12;
    const radiusControl = Math.max(4, radiusCard - 4);
    root.style.setProperty('--radius-card', `${radiusCard}px`);
    root.style.setProperty('--radius-control', `${radiusControl}px`);

    root.style.setProperty('--accent-primary', config.appearance.primaryColor);
    root.style.setProperty(
      '--accent-rgb',
      hexToRgbChannels(config.appearance.primaryColor)
    );
    root.style.setProperty('--focus-ring', config.appearance.primaryColor);

    if (config.appearance.customBgColor) {
      root.style.setProperty('--bg-canvas', config.appearance.customBgColor);
    } else {
      root.style.removeProperty('--bg-canvas');
    }

    if (config.appearance.customSurfaceColor) {
      root.style.setProperty('--bg-surface', config.appearance.customSurfaceColor);
    } else {
      root.style.removeProperty('--bg-surface');
    }

    if (config.appearance.customBorderColor) {
      root.style.setProperty('--border-subtle', config.appearance.customBorderColor);
    } else {
      root.style.removeProperty('--border-subtle');
    }

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const listener = () => {
      if (config.appearance.theme === 'system') {
        applyResolvedTheme();
      }
    };
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [config.appearance]);

  const handleUpdateConfig = async (nextConfig: WingstConfig) => {
    setConfig(nextConfig);
    const saved = await saveWingstConfig(nextConfig);
    if (!saved.ok && saved.error) {
      setStorageError(saved.error);
    } else {
      setStorageError(null);
    }
  };

  const handleUpdateLiquid = (nextLiquid: LiquidOsConfig) => {
    void handleUpdateConfig({
      ...config,
      appearance: {
        ...config.appearance,
        liquid: nextLiquid,
      },
    });
  };

  const extractAndApplyBgAccent = useCallback(
    async (targetUrl?: string, forceEnableAuto?: boolean) => {
      const current = latestConfigRef.current;
      const src = targetUrl || resolvedBgUrl || current.background.mediaUrl;
      if (current.background.type === 'solid') {
        const solidHex = current.background.solidColor || '#e11d48';
        const nextCfg: WingstConfig = {
          ...current,
          appearance: {
            ...current.appearance,
            primaryColor: solidHex,
            autoExtractAccent:
              forceEnableAuto !== undefined
                ? forceEnableAuto
                : current.appearance.autoExtractAccent,
          },
        };
        setConfig(nextCfg);
        await saveWingstConfig(nextCfg);
        return;
      }

      if (!src || src === DEFAULT_HERO_IMAGE) {
        if (forceEnableAuto !== undefined) {
          const nextCfg: WingstConfig = {
            ...current,
            appearance: {
              ...current.appearance,
              autoExtractAccent: forceEnableAuto,
            },
          };
          setConfig(nextCfg);
          await saveWingstConfig(nextCfg);
        }
        return;
      }

      const extracted = await extractVibrantColorFromImage(src);
      const latest = latestConfigRef.current;
      if (extracted) {
        const nextCfg: WingstConfig = {
          ...latest,
          appearance: {
            ...latest.appearance,
            primaryColor: extracted,
            autoExtractAccent:
              forceEnableAuto !== undefined
                ? forceEnableAuto
                : latest.appearance.autoExtractAccent,
          },
        };
        setConfig(nextCfg);
        await saveWingstConfig(nextCfg);
      } else if (forceEnableAuto !== undefined) {
        const nextCfg: WingstConfig = {
          ...latest,
          appearance: {
            ...latest.appearance,
            autoExtractAccent: forceEnableAuto,
          },
        };
        setConfig(nextCfg);
        await saveWingstConfig(nextCfg);
      }
    },
    [resolvedBgUrl]
  );

  // Automatically extract accent when autoExtractAccent is enabled and background image changes
  useEffect(() => {
    if (!hydrated || !config.appearance.autoExtractAccent) return;
    if (
      config.background.type !== 'image' &&
      config.background.type !== 'gif'
    ) {
      return;
    }
    if (!resolvedBgUrl || resolvedBgUrl === DEFAULT_HERO_IMAGE) return;

    const timer = window.setTimeout(() => {
      void extractAndApplyBgAccent(resolvedBgUrl);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    config.appearance.autoExtractAccent,
    config.background.type,
    resolvedBgUrl,
    extractAndApplyBgAccent,
  ]);

  const handleTriggerGps = async () => {
    setIsSyncingGps(true);
    setStorageError(null);
    try {
      const resolved = await detectGpsAndResolveLocation();
      await handleUpdateConfig({
        ...config,
        location: {
          ...config.location,
          city: resolved.city,
          country: resolved.country,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          autoDetect: true,
          prayerCityId: resolved.prayerCityId,
          prayerCityName: resolved.prayerCityName,
        },
      });
    } catch (err) {
      setStorageError(
        err instanceof Error
          ? err.message
          : 'Gagal mendeteksi lokasi GPS. Pastikan izin lokasi browser diaktifkan.'
      );
    } finally {
      setIsSyncingGps(false);
    }
  };

  const openSettingsAt = (tab?: string) => {
    if (tab) {
      setSettingsTab(tab as SettingsTabId);
    }
    setSettingsOpen(true);
  };

  return (
    <div
      data-hydrated={hydrated ? 'true' : 'false'}
      className="relative min-h-screen flex flex-col text-[var(--text-primary)]"
    >
      {/* Global Header */}
      <Header
        searchConfig={config.search}
        onUpdateSearch={(nextSearch) =>
          handleUpdateConfig({ ...config, search: nextSearch })
        }
        liquidConfig={config.appearance.liquid}
        onUpdateLiquid={handleUpdateLiquid}
        primaryColor={config.appearance.primaryColor}
        autoExtractAccent={Boolean(config.appearance.autoExtractAccent)}
        onUpdatePrimaryColor={(hex) =>
          handleUpdateConfig({
            ...config,
            appearance: {
              ...config.appearance,
              primaryColor: hex,
              autoExtractAccent: false,
            },
          })
        }
        onToggleAutoExtractAccent={() => {
          const nextAuto = !config.appearance.autoExtractAccent;
          if (nextAuto) {
            void extractAndApplyBgAccent(resolvedBgUrl, true);
          } else {
            void handleUpdateConfig({
              ...config,
              appearance: {
                ...config.appearance,
                autoExtractAccent: false,
              },
            });
          }
        }}
        locationCity={config.location.city}
        isSyncingGps={isSyncingGps}
        onTriggerGps={handleTriggerGps}
        isEditingLayout={isEditingLayout}
        onToggleEditLayout={() => setIsEditingLayout((v) => !v)}
        onOpenSettings={openSettingsAt}
        onOpenExtensionModal={() => setExtensionModalOpen(true)}
        isPeekingCanvas={isPeekingCanvas}
        onTogglePeekCanvas={() => setIsPeekingCanvas((v) => !v)}
      />

      {/* Visible Storage / GPS Error Banner */}
      {storageError && (
        <div
          role="alert"
          className="relative z-20 mx-auto mt-3 flex w-full max-w-[1440px] items-center justify-between border border-[var(--status-warning)]/50 bg-[var(--bg-elevated)] px-4 py-2.5 text-xs text-[var(--status-warning)]"
          style={{ borderRadius: 'var(--radius-control)' }}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{storageError}</span>
          </span>
          <button
            type="button"
            onClick={() => setStorageError(null)}
            className="underline hover:text-[var(--text-primary)]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Fixed Stationary Background Layer + Unobstructed Hero Canvas Window */}
      <HeroCanvas
        background={config.background}
        onUpdateBackground={(nextBg) =>
          handleUpdateConfig({ ...config, background: nextBg })
        }
        liteMode={Boolean(config.appearance.liquid.liteMode)}
        locationCity={config.location.city}
        locationCountry={config.location.country}
        isSyncingGps={isSyncingGps}
        onTriggerGps={handleTriggerGps}
        onOpenBackgroundSettings={() => openSettingsAt('background')}
        onToggleEditLayout={() => setIsEditingLayout((v) => !v)}
        isEditingLayout={isEditingLayout}
        isPeekingCanvas={isPeekingCanvas}
        onTogglePeekCanvas={() => setIsPeekingCanvas((v) => !v)}
        onResolvedMediaUrl={setResolvedBgUrl}
      />

      {/* Modular Mosaic Workspace (No opacity/transform wrapper when visible so Liquid OS backdrop-filter samples fixed BG directly) */}
      <div
        className={`relative z-10 flex-1 ${
          isPeekingCanvas ? 'pointer-events-none opacity-0 h-0 overflow-hidden' : ''
        }`}
      >
        <MosaicWorkspace
          config={config}
          isEditingLayout={isEditingLayout}
          onToggleEditLayout={() => setIsEditingLayout((v) => !v)}
          onUpdateConfig={handleUpdateConfig}
          onOpenSettings={openSettingsAt}
        />
      </div>

      {/* Floating Restore Button when in Full Background Peek Mode */}
      {isPeekingCanvas && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            type="button"
            onClick={() => setIsPeekingCanvas(false)}
            className="wingst-surface flex items-center gap-2 border border-[var(--accent-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] shadow-2xl hover:bg-[var(--accent-primary)] hover:text-white transition-colors"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <Eye className="h-4 w-4" />
            <span>Kembali ke Workspace (Tampilkan Modul)</span>
          </button>
        </div>
      )}

      {/* Quiet Editorial Footer */}
      <footer className="relative z-10 border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)]/85 backdrop-blur-md py-6 text-xs text-[var(--text-muted)]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-[var(--text-primary)]">
              WINGST
            </span>
            <span aria-hidden="true">·</span>
            <span>Editorial Browser Workspace · Liquid OS Surface Engine</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => openSettingsAt('data_privacy')}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              Data & Privacy
            </button>
            <button
              type="button"
              onClick={() => setExtensionModalOpen(true)}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              Chrome Extension (Manifest V3)
            </button>
            <button
              type="button"
              onClick={() => openSettingsAt('appearance')}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              Settings Center
            </button>
          </div>
        </div>
      </footer>

      {/* Comprehensive Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        initialTab={settingsTab}
        config={config}
        storageSource={storageSource}
        onClose={() => setSettingsOpen(false)}
        onUpdateConfig={handleUpdateConfig}
        onTriggerGps={handleTriggerGps}
        isSyncingGps={isSyncingGps}
        onExtractBgAccent={() => {
          void extractAndApplyBgAccent(resolvedBgUrl, true);
        }}
      />

      {/* Chrome Extension Inspector Modal */}
      <ExtensionModal
        isOpen={extensionModalOpen}
        onClose={() => setExtensionModalOpen(false)}
      />
    </div>
  );
}

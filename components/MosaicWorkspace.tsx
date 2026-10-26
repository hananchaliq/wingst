'use client';

import React, { useState } from 'react';
import {
  GripVertical,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  RotateCcw,
  Maximize2,
  Check,
  Sliders,
} from 'lucide-react';
import {
  ModuleId,
  ModuleLayoutConfig,
  WingstConfig,
} from '@/lib/types';
import {
  clampModuleSpan,
  createDefaultLayout,
  reorderModules,
  resetSingleModuleLayout,
} from '@/lib/wingst-core';

import WeatherModule from './modules/WeatherModule';
import QuickLinksModule from './modules/QuickLinksModule';
import ForexModule from './modules/ForexModule';
import MusicModule from './modules/MusicModule';
import DailyActivityModule from './modules/DailyActivityModule';
import NotepadModule from './modules/NotepadModule';
import PrayerTimesModule from './modules/PrayerTimesModule';

interface MosaicWorkspaceProps {
  config: WingstConfig;
  isEditingLayout: boolean;
  onToggleEditLayout: () => void;
  onUpdateConfig: (next: WingstConfig) => void;
  onOpenSettings: (tab?: string) => void;
}

// Explicit mapping of colSpan (3..12) to Tailwind responsive classes so JIT compiler preserves every span
const COL_SPAN_CLASSES: Record<number, string> = {
  3: 'col-span-1 md:col-span-3 lg:col-span-3',
  4: 'col-span-1 md:col-span-3 lg:col-span-4',
  5: 'col-span-1 md:col-span-6 lg:col-span-5',
  6: 'col-span-1 md:col-span-6 lg:col-span-6',
  7: 'col-span-1 md:col-span-6 lg:col-span-7',
  8: 'col-span-1 md:col-span-6 lg:col-span-8',
  9: 'col-span-1 md:col-span-6 lg:col-span-9',
  10: 'col-span-1 md:col-span-6 lg:col-span-10',
  11: 'col-span-1 md:col-span-6 lg:col-span-11',
  12: 'col-span-1 md:col-span-6 lg:col-span-12',
};

const ROW_SPAN_CLASSES: Record<number, string> = {
  1: 'row-span-1',
  2: 'row-span-2',
  3: 'row-span-3',
};

export default function MosaicWorkspace({
  config,
  isEditingLayout,
  onToggleEditLayout,
  onUpdateConfig,
  onOpenSettings,
}: MosaicWorkspaceProps) {
  const [draggedId, setDraggedId] = useState<ModuleId | null>(null);
  const [dragOverId, setDragOverId] = useState<ModuleId | null>(null);

  const sortedLayout = [...config.layout].sort((a, b) => a.order - b.order);
  const visibleModules = sortedLayout.filter((m) => m.visible);
  const hiddenModules = sortedLayout.filter((m) => !m.visible);

  const updateLayout = (nextLayout: ModuleLayoutConfig[]) => {
    onUpdateConfig({
      ...config,
      layout: nextLayout,
    });
  };

  const handleMoveOrder = (id: ModuleId, delta: -1 | 1) => {
    const idx = sortedLayout.findIndex((m) => m.id === id);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= sortedLayout.length) return;
    const targetId = sortedLayout[targetIdx].id;
    updateLayout(reorderModules(sortedLayout, id, targetId));
  };

  const handleSpanChange = (id: ModuleId, colSpan: number, rowSpan: number) => {
    const clamped = clampModuleSpan(colSpan, rowSpan);
    updateLayout(
      sortedLayout.map((m) =>
        m.id === id
          ? { ...m, colSpan: clamped.colSpan, rowSpan: clamped.rowSpan }
          : m
      )
    );
  };

  const handleToggleVisibility = (id: ModuleId) => {
    updateLayout(
      sortedLayout.map((m) => (m.id === id ? { ...m, visible: !m.visible } : m))
    );
  };

  const handleToggleDensity = (id: ModuleId) => {
    updateLayout(
      sortedLayout.map((m) =>
        m.id === id
          ? {
              ...m,
              density: m.density === 'compact' ? 'comfortable' : 'compact',
            }
          : m
      )
    );
  };

  const handleResetModule = (id: ModuleId) => {
    updateLayout(resetSingleModuleLayout(sortedLayout, id));
  };

  const handleResetAllLayout = () => {
    updateLayout(createDefaultLayout());
  };

  const renderModuleBody = (mod: ModuleLayoutConfig) => {
    switch (mod.id) {
      case 'weather':
        return (
          <WeatherModule
            location={config.location}
            density={mod.density}
            onUpdateLocation={(nextLoc) =>
              onUpdateConfig({ ...config, location: nextLoc })
            }
          />
        );
      case 'quick_links':
        return (
          <QuickLinksModule
            config={config.quickLinks}
            density={mod.density}
            onUpdate={(nextQl) =>
              onUpdateConfig({ ...config, quickLinks: nextQl })
            }
            onOpenSettings={() => onOpenSettings('quick_links')}
          />
        );
      case 'forex':
        return (
          <ForexModule
            config={config.forex}
            density={mod.density}
            onUpdate={(nextFx) => onUpdateConfig({ ...config, forex: nextFx })}
          />
        );
      case 'music':
        return (
          <MusicModule
            config={config.music}
            density={mod.density}
            onUpdate={(nextMusic) =>
              onUpdateConfig({ ...config, music: nextMusic })
            }
          />
        );
      case 'daily_activity':
        return (
          <DailyActivityModule
            config={config.dailyActivity}
            density={mod.density}
            onUpdate={(nextDa) =>
              onUpdateConfig({ ...config, dailyActivity: nextDa })
            }
            onOpenActivitySettings={() => onOpenSettings('daily_activity')}
          />
        );
      case 'notepad':
        return (
          <NotepadModule
            config={config.notepad}
            density={mod.density}
            onUpdate={(nextNotes) =>
              onUpdateConfig({ ...config, notepad: nextNotes })
            }
          />
        );
      case 'prayer_times':
        return (
          <PrayerTimesModule
            location={config.location}
            density={mod.density}
            onUpdateLocation={(nextLoc) =>
              onUpdateConfig({ ...config, location: nextLoc })
            }
          />
        );
    }
  };

  return (
    <main
      aria-label="Wingst Mosaic Workspace"
      className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:py-10"
    >
      {/* Workspace Section Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            Personal Workspace Mosaic
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Asymmetrical 12-column modular grid · Local-first persistence ·{' '}
            {visibleModules.length} of {sortedLayout.length} modules active
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditingLayout && (
            <button
              type="button"
              onClick={handleResetAllLayout}
              className="wingst-focus flex items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Entire Layout</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleEditLayout}
            className={`wingst-focus flex items-center gap-1.5 border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              isEditingLayout
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
            }`}
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            {isEditingLayout ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Save & Exit Edit Mode</span>
              </>
            ) : (
              <>
                <Sliders className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span>Edit Mosaic Layout</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Edit Mode Banner & Hidden Modules Tray */}
      {isEditingLayout && (
        <div
          data-testid="mosaic-edit-banner"
          className="mb-6 border border-[var(--accent-primary)]/50 bg-[var(--bg-surface)] p-4 text-xs"
          style={{ borderRadius: 'var(--radius-card)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong className="text-[var(--text-primary)]">
                Mosaic Layout Editor Active:
              </strong>{' '}
              <span className="text-[var(--text-secondary)]">
                Drag module headers or use keyboard-accessible controls to reorder, adjust column/row spans (3–12 columns), change density, or hide modules.
              </span>
            </div>
          </div>

          {hiddenModules.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
              <span className="text-[11px] font-medium text-[var(--text-muted)]">
                Hidden Modules (Click to Restore):
              </span>
              {hiddenModules.map((hm) => (
                <button
                  key={hm.id}
                  type="button"
                  onClick={() => handleToggleVisibility(hm.id)}
                  className="flex items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
                  style={{ borderRadius: 'var(--radius-control)' }}
                >
                  <Eye className="h-3 w-3 text-[var(--accent-primary)]" />
                  <span>{hm.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Asymmetrical 12-Column CSS Grid Mosaic */}
      <div
        data-testid="mosaic-grid"
        className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12 lg:gap-5 auto-rows-auto"
      >
        {visibleModules.map((mod, visualIdx) => {
          const colClass =
            COL_SPAN_CLASSES[mod.colSpan] || COL_SPAN_CLASSES[6];
          const rowClass =
            ROW_SPAN_CLASSES[mod.rowSpan] || ROW_SPAN_CLASSES[1];
          const isBeingDraggedOver = dragOverId === mod.id && draggedId !== mod.id;
          const indexNumber = String(visualIdx + 1).padStart(2, '0');

          return (
            <section
              key={mod.id}
              data-testid={`module-${mod.id}`}
              data-col-span={mod.colSpan}
              data-row-span={mod.rowSpan}
              aria-label={mod.title}
              draggable={isEditingLayout}
              onDragStart={(e) => {
                if (!isEditingLayout) return;
                setDraggedId(mod.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', mod.id);
              }}
              onDragOver={(e) => {
                if (!isEditingLayout || !draggedId) return;
                e.preventDefault();
                setDragOverId(mod.id);
              }}
              onDragLeave={() => {
                if (dragOverId === mod.id) setDragOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!isEditingLayout || !draggedId) return;
                updateLayout(reorderModules(sortedLayout, draggedId, mod.id));
                setDraggedId(null);
                setDragOverId(null);
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
              className={`wingst-surface flex flex-col justify-between p-4 sm:p-5 transition-all ${colClass} ${rowClass} ${
                isBeingDraggedOver
                  ? 'ring-2 ring-[var(--accent-primary)]'
                  : isEditingLayout
                  ? 'border-[var(--border-strong)]'
                  : ''
              }`}
              style={{
                minHeight: mod.customHeight
                  ? `${mod.customHeight}px`
                  : mod.minHeight
                  ? `${mod.minHeight}px`
                  : '280px',
              }}
            >
              {/* Module Editorial Header */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isEditingLayout && (
                    <span
                      title="Drag to reorder module"
                      className="cursor-grab text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                  )}
                  <span className="font-mono-tabular text-xs font-semibold text-[var(--accent-primary)]">
                    {indexNumber}.
                  </span>
                  <h2 className="font-display text-sm font-bold tracking-tight text-[var(--text-primary)] sm:text-base">
                    {mod.title}
                  </h2>
                </div>

                {/* Layout Editing Controls Bar */}
                {isEditingLayout ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(mod.id, -1)}
                      aria-label={`Move ${mod.title} earlier`}
                      className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      title="Move Earlier"
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(mod.id, 1)}
                      aria-label={`Move ${mod.title} later`}
                      className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      title="Move Later"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </button>

                    {/* Column Span Selector */}
                    <label className="flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[var(--text-secondary)]">
                      <span>W:</span>
                      <select
                        aria-label={`${mod.title} column width`}
                        value={mod.colSpan}
                        onChange={(e) =>
                          handleSpanChange(
                            mod.id,
                            Number(e.target.value),
                            mod.rowSpan
                          )
                        }
                        className="font-mono-tabular bg-transparent font-semibold text-[var(--text-primary)] focus:outline-none"
                      >
                        {[3, 4, 5, 6, 7, 8, 9, 12].map((w) => (
                          <option key={w} value={w} className="bg-[var(--bg-surface)]">
                            {w} col
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* Row Span Selector */}
                    <label className="flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[var(--text-secondary)]">
                      <span>H:</span>
                      <select
                        aria-label={`${mod.title} row height`}
                        value={mod.rowSpan}
                        onChange={(e) =>
                          handleSpanChange(
                            mod.id,
                            mod.colSpan,
                            Number(e.target.value)
                          )
                        }
                        className="font-mono-tabular bg-transparent font-semibold text-[var(--text-primary)] focus:outline-none"
                      >
                        {[1, 2, 3].map((r) => (
                          <option key={r} value={r} className="bg-[var(--bg-surface)]">
                            {r} row
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* Density Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleDensity(mod.id)}
                      aria-label={`Toggle ${mod.title} density`}
                      className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      title="Toggle Display Density"
                    >
                      <Maximize2 className="h-3 w-3 inline mr-1" />
                      {mod.density === 'compact' ? 'Compact' : 'Full'}
                    </button>

                    {/* Reset Module */}
                    <button
                      type="button"
                      onClick={() => handleResetModule(mod.id)}
                      aria-label={`Reset ${mod.title} layout`}
                      className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      title="Reset Module Dimensions"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>

                    {/* Hide Module */}
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(mod.id)}
                      aria-label={`Hide ${mod.title}`}
                      className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 text-[var(--text-secondary)] hover:text-[var(--status-error)]"
                      title="Hide Module"
                    >
                      <EyeOff className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono-tabular text-[11px] text-[var(--text-muted)]">
                      {mod.colSpan}×{mod.rowSpan}
                    </span>
                    <div
                      aria-hidden="true"
                      className="grid grid-cols-3 gap-1 opacity-45"
                    >
                      {Array.from({ length: 6 }).map((_, dIdx) => (
                        <span
                          key={dIdx}
                          className="h-1 w-1 rounded-full bg-[var(--accent-primary)]"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Module Functional Content */}
              <div className="flex-1 flex flex-col">
                {renderModuleBody(mod)}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

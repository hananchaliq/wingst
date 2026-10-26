'use client';

import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  SlidersHorizontal,
  RotateCcw,
  Calendar,
  BarChart2,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { DailyActivityConfig, DisplayDensity } from '@/lib/types';
import {
  calculateDailyProgress,
  getLocalCalendarDate,
  resetTodayActivityCompletions,
  toggleActivityCompletion,
} from '@/lib/wingst-core';

interface DailyActivityModuleProps {
  config: DailyActivityConfig;
  density: DisplayDensity;
  onUpdate: (next: DailyActivityConfig) => void;
  onOpenActivitySettings: () => void;
}

const STARTER_HABITS = [
  'Deep work block (90 mins)',
  'Review daily priorities & notes',
  'Hydration & physical movement',
  'Read 20 pages of technical/editorial book',
];

export default function DailyActivityModule({
  config,
  density,
  onUpdate,
  onOpenActivitySettings,
}: DailyActivityModuleProps) {
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [showHistoryView, setShowHistoryView] = useState(false);

  const sortedActivities = [...config.activities].sort((a, b) => a.order - b.order);
  const progress = calculateDailyProgress(config);

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newActivityTitle.trim();
    if (!trimmed) return;
    const nextItem = {
      id: `act-${Date.now()}`,
      title: trimmed,
      order: config.activities.length,
      createdAt: new Date().toISOString(),
    };
    const nextActivities = [...config.activities, nextItem];
    const nextHistory = { ...config.history };
    if (nextHistory[config.activeDate]) {
      nextHistory[config.activeDate] = {
        ...nextHistory[config.activeDate],
        totalDefined: nextActivities.length,
      };
    }
    onUpdate({
      ...config,
      activities: nextActivities,
      history: nextHistory,
    });
    setNewActivityTitle('');
  };

  const handleLoadStarterHabits = () => {
    const nowIso = new Date().toISOString();
    const starterItems = STARTER_HABITS.map((title, idx) => ({
      id: `act-${Date.now()}-${idx}`,
      title,
      order: config.activities.length + idx,
      createdAt: nowIso,
    }));
    const nextActivities = [...config.activities, ...starterItems];
    const nextHistory = { ...config.history };
    nextHistory[config.activeDate] = {
      date: config.activeDate,
      completedIds: [...config.todayCompletedIds],
      totalDefined: nextActivities.length,
    };
    onUpdate({
      ...config,
      activities: nextActivities,
      history: nextHistory,
    });
  };

  const handleDeleteActivity = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextActivities = config.activities
      .filter((a) => a.id !== id)
      .map((a, idx) => ({ ...a, order: idx }));
    const nextCompleted = config.todayCompletedIds.filter((cid) => cid !== id);
    const nextHistory = { ...config.history };
    if (nextHistory[config.activeDate]) {
      nextHistory[config.activeDate] = {
        ...nextHistory[config.activeDate],
        completedIds: nextCompleted,
        totalDefined: nextActivities.length,
      };
    }
    onUpdate({
      ...config,
      activities: nextActivities,
      todayCompletedIds: nextCompleted,
      history: nextHistory,
    });
  };

  const handleToggle = (id: string) => {
    onUpdate(toggleActivityCompletion(config, id));
  };

  const handleResetToday = () => {
    onUpdate(resetTodayActivityCompletions(config));
  };

  // Build 7-day rolling timeline ending on activeDate so History chart always renders a complete 7-day view
  const rollingSevenDays = React.useMemo(() => {
    const days: {
      date: string;
      completedCount: number;
      totalDefined: number;
      pct: number;
      isToday: boolean;
    }[] = [];

    const baseDate = new Date();
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - offset);
      const key = getLocalCalendarDate(d);
      const isToday = key === config.activeDate;
      const rec = config.history[key];
      const completedCount = isToday
        ? config.todayCompletedIds.filter((id) =>
            sortedActivities.some((a) => a.id === id)
          ).length
        : rec
        ? rec.completedIds.length
        : 0;
      const totalDefined = isToday
        ? sortedActivities.length
        : rec && rec.totalDefined > 0
        ? rec.totalDefined
        : sortedActivities.length;
      const denom = Math.max(totalDefined, 1);
      const pct =
        totalDefined > 0
          ? Math.min(100, Math.round((completedCount / denom) * 100))
          : 0;
      days.push({
        date: key,
        completedCount,
        totalDefined,
        pct,
        isToday,
      });
    }
    return days;
  }, [config.activeDate, config.history, config.todayCompletedIds, sortedActivities]);

  return (
    <div className="flex h-full flex-col justify-between gap-3">
      {/* Top Bar: Date, Progress Summary & View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
            {config.activeDate}
          </span>
          {sortedActivities.length > 0 && (
            <span className="font-mono-tabular text-[var(--text-secondary)]">
              · {progress.completedCount}/{progress.totalCount} ({progress.percentage}%)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowHistoryView((v) => !v)}
            className={`wingst-focus flex items-center gap-1 border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              showHistoryView
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white'
                : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <BarChart2 className="h-3 w-3" />
            <span>{showHistoryView ? 'Checklist' : '7D History'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenActivitySettings}
            className="wingst-focus flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span>Manage</span>
          </button>
        </div>
      </div>

      {/* History View (7-Day Rolling Horizontal Crimson Bar Telemetry - Reference Image 1) */}
      {showHistoryView ? (
        <div className="flex flex-1 flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-[var(--text-muted)]">
              <span>7-Day Horizontal Telemetry</span>
              <span className="font-mono-tabular text-[var(--text-secondary)]">
                Today: {progress.percentage}%
              </span>
            </div>
            <div
              className="space-y-1.5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 p-3"
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              {rollingSevenDays.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center gap-2.5 text-xs"
                  title={`${day.date}: ${day.completedCount}/${day.totalDefined} (${day.pct}%)`}
                >
                  <div className="relative h-5 flex-1 overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)]/80" style={{ borderRadius: '4px' }}>
                    <div
                      className={`wingst-crimson-bar h-full transition-all flex items-center px-2 ${
                        day.isToday ? 'opacity-100' : 'opacity-80'
                      }`}
                      style={{ width: `${Math.max(day.pct, 14)}%` }}
                    >
                      <span className="font-mono-tabular text-[10px] font-bold text-white drop-shadow">
                        {day.pct}%
                      </span>
                    </div>
                  </div>
                  <span
                    className={`font-mono-tabular w-20 text-right text-[11px] ${
                      day.isToday
                        ? 'font-bold text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {day.date.slice(5)} · {day.completedCount}/{day.totalDefined}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : sortedActivities.length === 0 ? (
        /* Empty State when no activities exist */
        <div
          data-testid="daily-activity-empty"
          className="flex flex-1 flex-col items-center justify-center gap-3 border border-dashed border-[var(--border-subtle)] p-4 text-center text-xs"
          style={{ borderRadius: 'var(--radius-control)' }}
        >
          <div className="max-w-xs space-y-1">
            <p className="font-semibold text-[var(--text-primary)]">
              No daily activities configured yet
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              Add your personal habits below or load starter habits with one click.
            </p>
          </div>

          <form
            onSubmit={handleQuickAdd}
            className="flex w-full max-w-xs items-center gap-1.5"
          >
            <input
              type="text"
              value={newActivityTitle}
              onChange={(e) => setNewActivityTitle(e.target.value)}
              placeholder="New daily habit..."
              aria-label="New daily activity title"
              className="flex-1 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              style={{ borderRadius: 'var(--radius-control)' }}
            />
            <button
              type="submit"
              className="bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 whitespace-nowrap shrink-0"
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              Add
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleLoadStarterHabits}
              className="flex items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              <Sparkles className="h-3 w-3 text-[var(--accent-primary)]" />
              <span>Load Starter Habits</span>
            </button>

            <button
              type="button"
              onClick={onOpenActivitySettings}
              className="text-[11px] text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]"
            >
              Activity Settings
            </button>
          </div>
        </div>
      ) : (
        /* Active Checklist View */
        <div className="flex flex-1 flex-col justify-between gap-3">
          {/* Editorial Horizontal Crimson Progress Bar (Reference Image 1) */}
          <div className="flex items-center gap-2.5">
            <div
              className="relative h-5 flex-1 overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
              style={{ borderRadius: '4px' }}
            >
              <div
                className="wingst-crimson-bar flex h-full items-center px-2 transition-all"
                style={{ width: `${Math.max(progress.percentage, 12)}%` }}
              >
                <span className="font-mono-tabular text-[10px] font-bold text-white">
                  {progress.percentage}%
                </span>
              </div>
            </div>
            <span className="font-mono-tabular text-[11px] font-semibold text-[var(--text-secondary)] shrink-0">
              {progress.completedCount}/{progress.totalCount} DONE
            </span>
          </div>

          {/* Checklist Items */}
          <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto max-h-56 pr-1">
            {sortedActivities.map((act) => {
              const checked = config.todayCompletedIds.includes(act.id);
              return (
                <div
                  key={act.id}
                  className={`group flex w-full items-center justify-between border px-3 py-2 text-left text-xs transition-colors ${
                    checked
                      ? 'border-[var(--accent-primary)]/40 bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                  }`}
                  style={{ borderRadius: 'var(--radius-control)' }}
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(act.id)}
                    className="wingst-focus flex flex-1 items-center gap-2.5 truncate text-left"
                  >
                    {checked ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                    )}
                    <span className={checked ? 'line-through opacity-75 truncate' : 'font-medium truncate'}>
                      {act.title}
                    </span>
                  </button>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-mono-tabular text-[10px] text-[var(--text-muted)]">
                      {checked ? 'Done' : 'Pending'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteActivity(act.id, e)}
                      aria-label={`Delete ${act.title}`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--text-muted)] hover:text-[var(--status-error)] transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Add Row */}
          {density !== 'compact' && (
            <form onSubmit={handleQuickAdd} className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={newActivityTitle}
                onChange={(e) => setNewActivityTitle(e.target.value)}
                placeholder="Add another activity..."
                aria-label="Add another daily activity"
                className="flex-1 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Add activity"
                className="flex items-center gap-1 border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
              >
                <Plus className="h-3 w-3" />
                <span>Add</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* Footer Info & Reset Today Action */}
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-muted)]">
        <span>Resets automatically each local calendar day</span>
        {config.todayCompletedIds.length > 0 && (
          <button
            type="button"
            onClick={handleResetToday}
            className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Today</span>
          </button>
        )}
      </div>
    </div>
  );
}

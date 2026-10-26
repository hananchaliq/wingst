'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  ExternalLink,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Folder,
  Link2,
  Check,
  X,
  Globe,
} from 'lucide-react';
import { DisplayDensity, QuickLinkItem, QuickLinksConfig } from '@/lib/types';
import { getFaviconSources, validateSafeUrl } from '@/lib/wingst-core';
import { isExtensionContext } from '@/lib/storage';

interface QuickLinksModuleProps {
  config: QuickLinksConfig;
  density: DisplayDensity;
  onUpdate: (next: QuickLinksConfig) => void;
  onOpenSettings: () => void;
}

export function LinkFavicon({
  url,
  title,
  customIcon,
  sizeClass = 'h-6 w-6',
}: {
  url: string;
  title: string;
  customIcon?: string;
  sizeClass?: string;
}) {
  const sources = React.useMemo(
    () => getFaviconSources(url, customIcon, isExtensionContext()),
    [url, customIcon]
  );
  const [sourceIdx, setSourceIdx] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSourceIdx(0);
      setAllFailed(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [url, customIcon]);

  const monogram =
    title
      .trim()
      .replace(/^https?:\/\//i, '')
      .slice(0, 2)
      .toUpperCase() || 'LK';

  if (sources.length === 0 || allFailed) {
    return (
      <span
        aria-hidden="true"
        className={`font-mono-tabular flex ${sizeClass} shrink-0 items-center justify-center border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[10px] font-bold text-[var(--accent-primary)]`}
        style={{ borderRadius: 'var(--radius-control)' }}
      >
        {monogram}
      </span>
    );
  }

  const activeSrc = sources[sourceIdx] || sources[0];

  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-surface)] p-1`}
      style={{ borderRadius: 'var(--radius-control)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeSrc}
        alt={`${title} icon`}
        referrerPolicy="no-referrer"
        data-testid="quicklink-favicon"
        className="h-full w-full object-contain"
        onError={() => {
          if (sourceIdx + 1 < sources.length) {
            setSourceIdx((prev) => prev + 1);
          } else {
            setAllFailed(true);
          }
        }}
      />
    </span>
  );
}

export default function QuickLinksModule({
  config,
  density,
  onUpdate,
  onOpenSettings,
}: QuickLinksModuleProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [titleInput, setTitleInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [customIconInput, setCustomIconInput] = useState('');
  const [groupInput, setGroupInput] = useState(config.groups[0] || 'General');
  const [formError, setFormError] = useState<string | null>(null);

  const sortedItems = [...config.items].sort((a, b) => a.order - b.order);
  const allGroups = Array.from(
    new Set(['All', ...config.groups, ...sortedItems.map((i) => i.group)])
  );

  const visibleItems =
    selectedGroup === 'All'
      ? sortedItems
      : sortedItems.filter((i) => i.group === selectedGroup);

  const resetForm = () => {
    setTitleInput('');
    setUrlInput('');
    setCustomIconInput('');
    setGroupInput(config.groups[0] || 'General');
    setFormError(null);
    setIsAdding(false);
    setEditingId(null);
  };

  const inferTitleFromUrl = (rawUrl: string): string => {
    try {
      const check = validateSafeUrl(rawUrl);
      if (!check.valid) return '';
      const host = new URL(check.normalizedUrl).hostname.replace(/^www\./i, '');
      const base = host.split('.')[0] || host;
      return base.charAt(0).toUpperCase() + base.slice(1);
    } catch {
      return '';
    }
  };

  const handleSaveLink = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const urlCheck = validateSafeUrl(urlInput);
    if (!urlCheck.valid) {
      setFormError(urlCheck.error || 'Invalid URL.');
      return;
    }

    const trimmedTitle =
      titleInput.trim() || inferTitleFromUrl(urlCheck.normalizedUrl) || 'Shortcut';

    let validatedCustomIcon: string | undefined = undefined;
    if (customIconInput.trim()) {
      const iconCheck = validateSafeUrl(customIconInput.trim());
      if (!iconCheck.valid) {
        setFormError('Custom icon URL must be a valid http/https address.');
        return;
      }
      validatedCustomIcon = iconCheck.normalizedUrl;
    }

    const targetGroup = groupInput.trim() || 'General';
    const nextGroups = config.groups.includes(targetGroup)
      ? config.groups
      : [...config.groups, targetGroup];

    if (editingId) {
      const updated = config.items.map((item) =>
        item.id === editingId
          ? {
              ...item,
              title: trimmedTitle,
              url: urlCheck.normalizedUrl,
              group: targetGroup,
              icon: validatedCustomIcon,
            }
          : item
      );
      onUpdate({
        ...config,
        items: updated,
        groups: nextGroups,
      });
    } else {
      const newItem: QuickLinkItem = {
        id: `ql-${Date.now()}`,
        title: trimmedTitle,
        url: urlCheck.normalizedUrl,
        group: targetGroup,
        icon: validatedCustomIcon,
        order: config.items.length,
      };
      onUpdate({
        ...config,
        items: [...config.items, newItem],
        groups: nextGroups,
      });
    }

    resetForm();
  };

  const startEdit = (item: QuickLinkItem) => {
    setEditingId(item.id);
    setTitleInput(item.title);
    setUrlInput(item.url);
    setCustomIconInput(item.icon || '');
    setGroupInput(item.group);
    setFormError(null);
    setIsAdding(true);
  };

  const deleteLink = (id: string) => {
    onUpdate({
      ...config,
      items: config.items
        .filter((i) => i.id !== id)
        .map((item, idx) => ({ ...item, order: idx })),
    });
  };

  const moveLink = (id: string, direction: -1 | 1) => {
    const idx = sortedItems.findIndex((i) => i.id === id);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= sortedItems.length) return;
    const copy = [...sortedItems];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    onUpdate({
      ...config,
      items: copy.map((item, i) => ({ ...item, order: i })),
    });
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  };

  const isCompact = config.viewMode === 'compact' || density === 'compact';
  const previewValidUrl = validateSafeUrl(urlInput);

  return (
    <div className="flex h-full flex-col justify-between gap-3">
      {/* Top Group Filter & Add Trigger */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
        <select
          aria-label="Filter shortcuts by group"
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] font-medium text-[var(--text-primary)]"
          style={{ borderRadius: 'var(--radius-control)' }}
        >
          {allGroups.map((grp) => (
            <option key={grp} value={grp}>
              {grp === 'All' ? 'All Groups' : grp}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              onUpdate({
                ...config,
                viewMode: config.viewMode === 'compact' ? 'expanded' : 'compact',
              })
            }
            className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            {config.viewMode === 'compact' ? 'Expanded' : 'Compact'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (isAdding) resetForm();
              else setIsAdding(true);
            }}
            aria-label="Add Quick Link"
            className="wingst-focus flex items-center gap-1 bg-[var(--accent-primary)] px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 whitespace-nowrap shrink-0"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <Plus className="h-3 w-3" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Add / Edit Link Form with Live Auto-Favicon Preview */}
      {isAdding && (
        <form
          onSubmit={handleSaveLink}
          className="border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3 text-xs space-y-2"
          style={{ borderRadius: 'var(--radius-control)' }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-primary)]">
              {editingId ? 'Edit Shortcut' : 'New Shortcut'}
            </span>
            {previewValidUrl.valid && (
              <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                <span>Live Icon:</span>
                <LinkFavicon
                  url={previewValidUrl.normalizedUrl}
                  title={titleInput || previewValidUrl.normalizedUrl}
                  customIcon={customIconInput}
                  sizeClass="h-5 w-5"
                />
              </span>
            )}
          </div>

          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Link URL (e.g. https://figma.com or youtube.com)"
            aria-label="Shortcut URL"
            className="w-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Title (auto-detected if empty)"
              aria-label="Shortcut title"
              className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            <input
              type="text"
              value={groupInput}
              onChange={(e) => setGroupInput(e.target.value)}
              placeholder="Group (e.g. Work)"
              aria-label="Shortcut group"
              className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <Globe className="h-3 w-3 shrink-0 text-[var(--accent-primary)]" />
            <span>
              Icon is automatically fetched from the link domain.
            </span>
          </div>

          {formError && (
            <p className="text-[11px] text-[var(--status-error)]">{formError}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
            >
              <X className="h-3 w-3" />
              <span>Cancel</span>
            </button>
            <button
              type="submit"
              className="flex items-center gap-1 bg-[var(--accent-primary)] px-3 py-1 text-xs font-medium text-white"
            >
              <Check className="h-3 w-3" />
              <span>{editingId ? 'Update' : 'Save Link'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Links List or Empty State */}
      {visibleItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-dashed border-[var(--border-subtle)] p-6 text-center text-xs text-[var(--text-muted)]">
          <Link2 className="h-5 w-5 text-[var(--text-muted)]" />
          <p>No quick links in this view.</p>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="mt-1 border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
          >
            Create Shortcut
          </button>
        </div>
      ) : (
        <div
          className={
            isCompact
              ? 'grid grid-cols-2 gap-2'
              : 'flex flex-1 flex-col gap-1.5 overflow-y-auto max-h-64 pr-1'
          }
        >
          {visibleItems.map((item) => {
            return (
              <div
                key={item.id}
                className="group flex items-center justify-between border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 px-2.5 py-2 hover:border-[var(--border-strong)] transition-colors"
                style={{ borderRadius: 'var(--radius-control)' }}
              >
                <a
                  href={item.url}
                  target={config.openInNewTab ? '_blank' : '_self'}
                  rel={config.openInNewTab ? 'noopener noreferrer' : undefined}
                  className="wingst-focus flex flex-1 items-center gap-2.5 truncate"
                >
                  <LinkFavicon
                    url={item.url}
                    title={item.title}
                    customIcon={item.icon}
                  />
                  <div className="min-w-0 flex-1 truncate">
                    <div className="truncate text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                      {item.title}
                    </div>
                    {!isCompact && (
                      <div className="truncate text-[10px] text-[var(--text-muted)]">
                        {item.group} · {getHostname(item.url)}
                      </div>
                    )}
                  </div>
                  <ExternalLink className="h-3 w-3 shrink-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>

                {!isCompact ? (
                  <div className="ml-2 flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => moveLink(item.id, -1)}
                      aria-label={`Move ${item.title} up`}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveLink(item.id, 1)}
                      aria-label={`Move ${item.title} down`}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      aria-label={`Edit ${item.title}`}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLink(item.id)}
                      aria-label={`Delete ${item.title}`}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--status-error)]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => deleteLink(item.id)}
                    aria-label={`Delete ${item.title}`}
                    className="ml-1 p-1 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--status-error)]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <Folder className="h-3 w-3" />
          {config.items.length} shortcuts ·{' '}
          {config.openInNewTab ? 'New Tab' : 'Current Tab'}
        </span>
        <button
          type="button"
          onClick={onOpenSettings}
          className="hover:text-[var(--text-primary)] underline"
        >
          Manage & Export
        </button>
      </div>
    </div>
  );
}

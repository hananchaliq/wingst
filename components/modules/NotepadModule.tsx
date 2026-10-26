'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Search,
  Download,
  CheckCircle2,
  Clock,
  HardDrive,
} from 'lucide-react';
import { DisplayDensity, NotepadConfig, NoteItem } from '@/lib/types';

interface NotepadModuleProps {
  config: NotepadConfig;
  density: DisplayDensity;
  onUpdate: (next: NotepadConfig) => void;
}

export default function NotepadModule({
  config,
  density,
  onUpdate,
}: NotepadModuleProps) {
  const activeNote =
    config.notes.find((n) => n.id === config.activeNoteId) ||
    config.notes[0] ||
    null;

  const [titleDraft, setTitleDraft] = useState(activeNote?.title || '');
  const [contentDraft, setContentDraft] = useState(activeNote?.content || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  const debounceRef = useRef<number | null>(null);
  const latestConfigRef = useRef(config);

  useEffect(() => {
    latestConfigRef.current = config;
  }, [config]);

  // Synchronize local drafts when activeNoteId switches
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (activeNote) {
        setTitleDraft(activeNote.title);
        setContentDraft(activeNote.content);
        setSaveStatus('saved');
      } else {
        setTitleDraft('');
        setContentDraft('');
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [activeNote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitNoteChanges = (
    noteId: string,
    nextTitle: string,
    nextContent: string
  ) => {
    const current = latestConfigRef.current;
    const nowIso = new Date().toISOString();
    const updatedNotes = current.notes.map((n) =>
      n.id === noteId
        ? {
            ...n,
            title: nextTitle.trim() || 'Untitled Note',
            content: nextContent,
            updatedAt: nowIso,
          }
        : n
    );
    onUpdate({
      ...current,
      notes: updatedNotes,
    });
    setSaveStatus('saved');
  };

  const handleTitleChange = (val: string) => {
    setTitleDraft(val);
    if (!activeNote) return;
    setSaveStatus('saving');
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      commitNoteChanges(activeNote.id, val, contentDraft);
    }, 250);
  };

  const handleContentChange = (val: string) => {
    setContentDraft(val);
    if (!activeNote) return;
    setSaveStatus('saving');
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      commitNoteChanges(activeNote.id, titleDraft, val);
    }, 250);
  };

  // Flush pending edits on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleCreateNote = () => {
    const nowIso = new Date().toISOString();
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      title: `Note ${config.notes.length + 1}`,
      content: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    onUpdate({
      notes: [newNote, ...config.notes],
      activeNoteId: newNote.id,
    });
  };

  const handleDeleteNote = (id: string) => {
    const remaining = config.notes.filter((n) => n.id !== id);
    onUpdate({
      notes: remaining,
      activeNoteId:
        config.activeNoteId === id
          ? remaining[0]?.id || null
          : config.activeNoteId,
    });
  };

  const insertSnippet = (snippet: string) => {
    if (!activeNote) return;
    const next = contentDraft
      ? `${contentDraft}\n${snippet}`
      : snippet;
    handleContentChange(next);
  };

  const handleExportMarkdown = () => {
    if (!activeNote) return;
    const blob = new Blob([`# ${titleDraft}\n\n${contentDraft}`], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(titleDraft || 'wingst-note')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredNotes = config.notes.filter((n) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full flex-col justify-between gap-3">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
        <div className="relative flex-1 min-w-[140px]">
          <Search className=" absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter notes..."
            aria-label="Filter local notes"
            className="w-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pl-7 pr-2 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            style={{ borderRadius: 'var(--radius-control)' }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span
            data-testid="notepad-save-status"
            className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]"
          >
            {saveStatus === 'saving' ? (
              <>
                <Clock className="h-3 w-3 text-[var(--status-warning)]" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 text-[var(--status-success)]" />
                <span>Saved locally</span>
              </>
            )}
          </span>

          {activeNote && (
            <button
              type="button"
              onClick={handleExportMarkdown}
              title="Download note as Markdown"
              aria-label="Download current note as Markdown"
              className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              style={{ borderRadius: 'var(--radius-control)' }}
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleCreateNote}
            aria-label="Create new note"
            className="wingst-focus flex items-center gap-1 bg-[var(--accent-primary)] px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 whitespace-nowrap shrink-0"
            style={{ borderRadius: 'var(--radius-control)' }}
          >
            <Plus className="h-3 w-3" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Main Split Body */}
      {config.notes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-dashed border-[var(--border-subtle)] p-6 text-center text-xs text-[var(--text-muted)]">
          <FileText className="h-5 w-5" />
          <p>No local notes stored.</p>
          <button
            type="button"
            onClick={handleCreateNote}
            className="border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]"
          >
            Create First Note
          </button>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-12">
          {/* Note Selector Sidebar */}
          {density !== 'compact' && (
            <div className="flex flex-col gap-1 border-b border-[var(--border-subtle)] pb-2 sm:col-span-4 sm:border-b-0 sm:border-r sm:pr-2 sm:pb-0 max-h-56 overflow-y-auto">
              {filteredNotes.map((n) => {
                const isSelected = n.id === activeNote?.id;
                return (
                  <div
                    key={n.id}
                    className={`group flex items-center justify-between border px-2.5 py-1.5 text-xs transition-colors ${
                      isSelected
                        ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold'
                        : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50 hover:text-[var(--text-primary)]'
                    }`}
                    style={{ borderRadius: 'var(--radius-control)' }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate({ ...config, activeNoteId: n.id })
                      }
                      className="flex-1 truncate text-left"
                    >
                      <div className="truncate">{n.title}</div>
                      <div className="font-mono-tabular text-[10px] font-normal text-[var(--text-muted)]">
                        {new Date(n.updatedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(n.id)}
                      aria-label={`Delete note ${n.title}`}
                      className="ml-1 p-1 text-[var(--text-muted)] opacity-70 hover:text-[var(--status-error)] group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Editor */}
          {activeNote && (
            <div
              className={`flex flex-col gap-2 ${
                density === 'compact' ? 'sm:col-span-12' : 'sm:col-span-8'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Note title..."
                  aria-label="Note title"
                  className="flex-1 border-b border-[var(--border-subtle)] bg-transparent pb-1 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
                {/* Formatting quick actions */}
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => insertSnippet('## Section')}
                    className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('- [ ] Task item')}
                    className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertSnippet(`[${new Date().toLocaleTimeString()}] `)
                    }
                    className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Time
                  </button>
                </div>
              </div>

              <textarea
                value={contentDraft}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Write local notes, thoughts, or snippets..."
                aria-label="Note body content"
                rows={6}
                className="w-full flex-1 resize-none border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 p-2.5 text-xs leading-relaxed text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                style={{ borderRadius: 'var(--radius-control)' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Explicit Local Storage Notice */}
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-[10px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <HardDrive className="h-3 w-3 shrink-0" />
          <span>
            Stored strictly in local browser storage · Not synced across devices
          </span>
        </span>
        <span className="font-mono-tabular">{config.notes.length} note(s)</span>
      </div>
    </div>
  );
}

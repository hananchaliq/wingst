'use client';

import React from 'react';
import {
  X,
  Puzzle,
  CheckCircle2,
  ShieldCheck,
  Terminal,
  FolderOpen,
  Download,
} from 'lucide-react';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MANIFEST_V3_PREVIEW = {
  manifest_version: 3,
  name: 'Wingst — Modular Personal Workspace & New Tab',
  short_name: 'Wingst',
  version: '2.0.0',
  description:
    'Editorial, local-first personal browser workspace and customizable mosaic New Tab experience.',
  chrome_url_overrides: {
    newtab: 'newtab.html',
  },
  permissions: ['storage'],
  optional_permissions: ['geolocation'],
  host_permissions: [
    'https://api.open-meteo.com/*',
    'https://geocoding-api.open-meteo.com/*',
    'https://api.frankfurter.dev/*',
    'https://api.frankfurter.app/*',
    'https://api.myquran.com/*',
    'https://api.aladhan.com/*',
  ],
  background: {
    service_worker: 'service-worker.js',
  },
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
  content_security_policy: {
    extension_pages:
      "script-src 'self'; object-src 'self'; frame-src https://open.spotify.com https://www.youtube.com https://embed.music.apple.com https://w.soundcloud.com;",
  },
};

export default function ExtensionModal({
  isOpen,
  onClose,
}: ExtensionModalProps) {
  if (!isOpen) return null;

  const handleDownloadManifest = () => {
    const blob = new Blob([JSON.stringify(MANIFEST_V3_PREVIEW, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manifest.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wingst Chrome Extension Package"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
    >
      <div
        className="wingst-surface flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl"
        style={{ borderRadius: 'var(--radius-card)' }}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Puzzle className="h-4 w-4 text-[var(--accent-primary)]" />
            <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
              Wingst Chrome Extension (Manifest V3)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Extension dialog"
            className="wingst-focus border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-xs space-y-5">
          <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
              <span>Ready-to-Load Unpacked Extension in /extension</span>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Wingst ships with a complete Manifest V3 Chrome Extension target located in the repository&apos;s <code className="font-mono-tabular text-[var(--text-primary)]">/extension</code> directory. It overrides Chrome&apos;s New Tab page (<code className="font-mono-tabular">chrome_url_overrides.newtab</code>) and persists data independently in <code className="font-mono-tabular">chrome.storage.local</code> and extension-scoped <code className="font-mono-tabular">IndexedDB</code>.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>Build & Developer-Mode Installation</span>
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-[var(--text-secondary)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <li>
                Run <code className="font-mono-tabular bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[var(--text-primary)]">npm run build:extension</code> to generate and verify the <code className="font-mono-tabular">/extension</code> package.
              </li>
              <li>
                Open Google Chrome and navigate to <code className="font-mono-tabular bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[var(--text-primary)]">chrome://extensions</code>.
              </li>
              <li>
                Enable <strong>Developer mode</strong> using the toggle in the top-right corner.
              </li>
              <li>
                Click <strong>Load unpacked</strong> and select the <code className="font-mono-tabular bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[var(--text-primary)]">extension/</code> directory inside this repository.
              </li>
              <li>
                Open a new tab (<code className="font-mono-tabular">Ctrl+T</code> / <code className="font-mono-tabular">Cmd+T</code>) to launch the Wingst New Tab workspace.
              </li>
            </ol>
          </div>

          <div className="space-y-2">
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>Manifest V3 Permissions & API Verification</span>
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 p-3">
                <div className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                  storage (chrome.storage.local)
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  Persists extension-specific layout, quick links, notes, and daily activities locally without server accounts.
                </p>
              </div>
              <div className="border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 p-3">
                <div className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                  HTTPS Host Permissions
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  Direct CORS-compatible HTTPS access to Open-Meteo, Frankfurter ECB FX, MyQuran Kemenag, and Aladhan APIs. Zero secret keys exposed.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span>extension/manifest.json</span>
              </span>
              <button
                type="button"
                onClick={handleDownloadManifest}
                className="flex items-center gap-1 border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
              >
                <Download className="h-3 w-3" />
                <span>Download manifest.json</span>
              </button>
            </div>
            <pre className="font-mono-tabular overflow-x-auto border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 text-[11px] text-[var(--text-secondary)]">
              {JSON.stringify(MANIFEST_V3_PREVIEW, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

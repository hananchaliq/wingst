import { LocalAudioTrackMeta, WingstConfig } from './types';
import { createDefaultConfig, validateAndMigrateConfig } from './wingst-core';

const STORAGE_KEY = 'wingst_workspace_config_v2';
const LEGACY_LUMILIST_KEY = 'lumilist_config_v1';
const IDB_NAME = 'wingst_local_media_db';
const IDB_STORE = 'background_assets';
const IDB_AUDIO_STORE = 'audio_tracks';
const IDB_VERSION = 2;

declare const chrome: {
  storage?: {
    local?: {
      get: (keys: string[], cb: (items: Record<string, unknown>) => void) => void;
      set: (items: Record<string, unknown>, cb?: () => void) => void;
      remove: (keys: string[], cb?: () => void) => void;
    };
  };
  runtime?: {
    lastError?: { message?: string };
  };
};

export function isExtensionContext(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof chrome !== 'undefined' &&
    Boolean(chrome?.storage?.local)
  );
}

/**
 * Loads configuration from chrome.storage.local (if running as a Chrome Extension)
 * or localStorage (if running as a web application), migrating legacy data safely.
 */
export async function loadWingstConfig(): Promise<{
  config: WingstConfig;
  storageSource: 'extension' | 'web';
  error?: string;
}> {
  if (typeof window === 'undefined') {
    return { config: createDefaultConfig(), storageSource: 'web' };
  }

  if (isExtensionContext() && chrome.storage?.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage!.local!.get([STORAGE_KEY], (result) => {
          const err = chrome.runtime?.lastError;
          if (err) {
            resolve({
              config: createDefaultConfig(),
              storageSource: 'extension',
              error: `Extension storage read failed: ${err.message || 'Unknown error'}`,
            });
            return;
          }
          const raw = result[STORAGE_KEY];
          if (!raw) {
            const initial = createDefaultConfig();
            resolve({ config: initial, storageSource: 'extension' });
            return;
          }
          const migrated = validateAndMigrateConfig(raw);
          resolve({
            config: migrated.config,
            storageSource: 'extension',
            error: migrated.error,
          });
        });
      } catch (e) {
        resolve({
          config: createDefaultConfig(),
          storageSource: 'extension',
          error: e instanceof Error ? e.message : 'Failed to access chrome.storage.local',
        });
      }
    });
  }

  try {
    const rawStr =
      window.localStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_LUMILIST_KEY);

    if (!rawStr) {
      return { config: createDefaultConfig(), storageSource: 'web' };
    }
    const parsed = JSON.parse(rawStr);
    const migrated = validateAndMigrateConfig(parsed);
    return {
      config: migrated.config,
      storageSource: 'web',
      error: migrated.error,
    };
  } catch (e) {
    return {
      config: createDefaultConfig(),
      storageSource: 'web',
      error:
        e instanceof Error
          ? `Stored configuration was corrupted and reset safely: ${e.message}`
          : 'Failed to parse local configuration.',
    };
  }
}

export async function saveWingstConfig(
  config: WingstConfig
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined') return { ok: true };

  if (isExtensionContext() && chrome.storage?.local) {
    return new Promise((resolve) => {
      try {
        chrome.storage!.local!.set({ [STORAGE_KEY]: config }, () => {
          const err = chrome.runtime?.lastError;
          if (err) {
            resolve({
              ok: false,
              error: `Extension storage write failed: ${err.message || 'Quota exceeded'}`,
            });
          } else {
            resolve({ ok: true });
          }
        });
      } catch (e) {
        resolve({
          ok: false,
          error: e instanceof Error ? e.message : 'Failed to write to chrome.storage.local',
        });
      }
    });
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? `Local storage write failed (quota or permissions): ${e.message}`
          : 'Failed to write to localStorage.',
    };
  }
}

export async function clearAllWingstStorage(): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined') return { ok: true };
  try {
    if (isExtensionContext() && chrome.storage?.local) {
      await new Promise<void>((resolve) => {
        chrome.storage!.local!.remove([STORAGE_KEY], () => resolve());
      });
    }
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_LUMILIST_KEY);
    await clearLocalMediaAssets();
    await clearAllLocalAudioTracks();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to clear local data.',
    };
  }
}

// IndexedDB for large local background media AND local MP3 audio tracks
function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }
    const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IDB_AUDIO_STORE)) {
        db.createObjectStore(IDB_AUDIO_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB.'));
  });
}

export interface StoredMediaAsset {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: string;
}

export interface StoredAudioTrack extends LocalAudioTrackMeta {
  blob: Blob;
}

export async function saveLocalMediaAsset(
  file: File
): Promise<{ ok: boolean; assetId?: string; error?: string }> {
  const MAX_BYTES = 45 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: 'File exceeds the 45 MB local IndexedDB limit. Please choose a smaller asset.',
    };
  }

  try {
    const db = await openMediaDb();
    const assetId = `media-${Date.now()}`;
    const record: StoredMediaAsset = {
      id: assetId,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      blob: file,
      createdAt: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.clear();
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });
    db.close();
    return { ok: true, assetId };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? `IndexedDB media storage failed: ${e.message}`
          : 'Failed to store media file in IndexedDB.',
    };
  }
}

export async function loadLocalMediaObjectUrl(
  assetId: string
): Promise<{ objectUrl: string | null; mimeType?: string; error?: string }> {
  try {
    const db = await openMediaDb();
    const record = await new Promise<StoredMediaAsset | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const getReq = store.get(assetId);
      getReq.onsuccess = () => resolve(getReq.result as StoredMediaAsset | undefined);
      getReq.onerror = () => reject(getReq.error);
    });
    db.close();

    if (!record || !record.blob) {
      return { objectUrl: null, error: 'Local media asset not found in IndexedDB.' };
    }
    const objectUrl = URL.createObjectURL(record.blob);
    return { objectUrl, mimeType: record.mimeType };
  } catch (e) {
    return {
      objectUrl: null,
      error: e instanceof Error ? e.message : 'Could not read local media from IndexedDB.',
    };
  }
}

export async function clearLocalMediaAssets(): Promise<void> {
  try {
    const db = await openMediaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    // Ignore if IndexedDB unavailable
  }
}

// --- Local MP3 Audio Track Storage in IndexedDB ---

export async function saveLocalAudioTrack(
  file: File,
  customTitle?: string,
  customArtist?: string
): Promise<{ ok: boolean; track?: LocalAudioTrackMeta; error?: string }> {
  const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
  if (file.size > MAX_AUDIO_BYTES) {
    return {
      ok: false,
      error: 'Ukuran file lagu melebihi batas 50 MB per lagu.',
    };
  }

  try {
    const db = await openMediaDb();
    const cleanFileName = file.name.replace(/\.[^/.]+$/, '');
    const parts = cleanFileName.split(' - ');
    const inferredArtist =
      customArtist?.trim() || (parts.length > 1 ? parts[0].trim() : 'Local Audio');
    const inferredTitle =
      customTitle?.trim() ||
      (parts.length > 1 ? parts.slice(1).join(' - ').trim() : cleanFileName);

    const meta: LocalAudioTrackMeta = {
      id: `mp3-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: inferredTitle || 'Untitled Track',
      artist: inferredArtist,
      fileName: file.name,
      mimeType: file.type || 'audio/mpeg',
      size: file.size,
      addedAt: new Date().toISOString(),
    };

    const record: StoredAudioTrack = {
      ...meta,
      blob: file,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_AUDIO_STORE, 'readwrite');
      const store = tx.objectStore(IDB_AUDIO_STORE);
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });
    db.close();
    return { ok: true, track: meta };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? `Gagal menyimpan MP3 ke IndexedDB: ${e.message}`
          : 'Gagal menyimpan file audio.',
    };
  }
}

export async function loadLocalAudioObjectUrl(
  trackId: string
): Promise<{ objectUrl: string | null; track?: LocalAudioTrackMeta; error?: string }> {
  try {
    const db = await openMediaDb();
    const record = await new Promise<StoredAudioTrack | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_AUDIO_STORE, 'readonly');
      const store = tx.objectStore(IDB_AUDIO_STORE);
      const getReq = store.get(trackId);
      getReq.onsuccess = () => resolve(getReq.result as StoredAudioTrack | undefined);
      getReq.onerror = () => reject(getReq.error);
    });
    db.close();

    if (!record || !record.blob) {
      return { objectUrl: null, error: 'File lagu lokal tidak ditemukan di IndexedDB.' };
    }
    const objectUrl = URL.createObjectURL(record.blob);
    const { blob: _unusedBlob, ...meta } = record;
    void _unusedBlob;
    return { objectUrl, track: meta };
  } catch (e) {
    return {
      objectUrl: null,
      error: e instanceof Error ? e.message : 'Gagal memuat lagu dari IndexedDB.',
    };
  }
}

export async function deleteLocalAudioTrack(trackId: string): Promise<void> {
  try {
    const db = await openMediaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_AUDIO_STORE, 'readwrite');
      const req = tx.objectStore(IDB_AUDIO_STORE).delete(trackId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}

export async function clearAllLocalAudioTracks(): Promise<void> {
  try {
    const db = await openMediaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_AUDIO_STORE, 'readwrite');
      const req = tx.objectStore(IDB_AUDIO_STORE).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}

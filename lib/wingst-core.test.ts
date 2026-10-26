import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultConfig,
  validateSafeUrl,
  buildSearchUrl,
  recordSearchQuery,
  reconcileDailyActivityDay,
  toggleActivityCompletion,
  resetTodayActivityCompletions,
  calculateDailyProgress,
  reorderModules,
  parseOfficialMusicEmbed,
  evaluatePrayerStatus,
  validateAndMigrateConfig,
  getFaviconSources,
} from './wingst-core';

test('default config starts with static image background, fixed attachment, Liquid OS Frosted, and empty daily activity', () => {
  const cfg = createDefaultConfig(new Date('2026-10-24T09:00:00'));
  assert.equal(cfg.background.type, 'image');
  assert.equal(cfg.background.fixedAttachment, true);
  assert.equal(cfg.background.heroHeight, 460);
  assert.equal(cfg.appearance.borderRadius, 12);
  assert.equal(cfg.appearance.liquid.enabled, true);
  assert.equal(cfg.appearance.liquid.variant, 'frosted');
  assert.equal(cfg.dailyActivity.activities.length, 0);
  assert.deepEqual(cfg.dailyActivity.todayCompletedIds, []);
  assert.deepEqual(cfg.dailyActivity.history, {});
  assert.equal(cfg.layout.length, 7);
});

test('validateSafeUrl accepts http/https and rejects javascript/data schemes', () => {
  const ok = validateSafeUrl('github.com/torvalds');
  assert.equal(ok.valid, true);
  assert.equal(ok.normalizedUrl, 'https://github.com/torvalds');

  const badJs = validateSafeUrl('javascript:alert(1)');
  assert.equal(badJs.valid, false);

  const badData = validateSafeUrl('data:text/html,<script>alert(1)</script>');
  assert.equal(badData.valid, false);
});

test('search history respects persistHistory flag and deduplicates queries', () => {
  const cfg = createDefaultConfig();
  const s1 = recordSearchQuery(cfg.search, 'usd to idr', new Date('2026-10-24T10:00:00Z'));
  assert.equal(s1.history.length, 1);
  assert.equal(s1.history[0].query, 'usd to idr');

  const disabled = { ...s1, persistHistory: false };
  const s2 = recordSearchQuery(disabled, 'secret query', new Date('2026-10-24T10:05:00Z'));
  assert.equal(s2.history.length, 1);

  assert.equal(
    buildSearchUrl('duckduckgo', 'wingst workspace'),
    'https://duckduckgo.com/?q=wingst%20workspace'
  );
});

test('daily activity day rollover and daily reset preserve historical completion records', () => {
  const day1 = new Date(2026, 9, 23, 14, 0, 0); // Oct 23, 2026
  const day2 = new Date(2026, 9, 24, 8, 30, 0); // Oct 24, 2026

  let da = createDefaultConfig(day1).dailyActivity;
  da = {
    ...da,
    activities: [
      { id: 'act-1', title: 'Deep work block', order: 0, createdAt: day1.toISOString() },
      { id: 'act-2', title: 'Review FX positions', order: 1, createdAt: day1.toISOString() },
    ],
  };

  da = toggleActivityCompletion(da, 'act-1', day1);
  assert.equal(calculateDailyProgress(da).percentage, 50);
  assert.deepEqual(da.history['2026-10-23'].completedIds, ['act-1']);

  // Rollover to Oct 24
  const rolled = reconcileDailyActivityDay(da, day2);
  assert.equal(rolled.activeDate, '2026-10-24');
  assert.deepEqual(rolled.todayCompletedIds, []);
  // History for Oct 23 must still exist intact!
  assert.deepEqual(rolled.history['2026-10-23'].completedIds, ['act-1']);

  // Complete both on Oct 24, then reset today's completion
  let onDay2 = toggleActivityCompletion(rolled, 'act-1', day2);
  onDay2 = toggleActivityCompletion(onDay2, 'act-2', day2);
  assert.equal(calculateDailyProgress(onDay2).percentage, 100);

  const afterTodayReset = resetTodayActivityCompletions(onDay2, day2);
  assert.equal(calculateDailyProgress(afterTodayReset).percentage, 0);
  // Oct 23 history is still untouched
  assert.deepEqual(afterTodayReset.history['2026-10-23'].completedIds, ['act-1']);
});

test('reorderModules updates module order deterministically', () => {
  const cfg = createDefaultConfig();
  const reordered = reorderModules(cfg.layout, 'prayer_times', 'weather');
  assert.equal(reordered[0].id, 'prayer_times');
  assert.equal(reordered[0].order, 0);
  assert.equal(reordered[1].id, 'weather');
  assert.equal(reordered[1].order, 1);
});

test('parseOfficialMusicEmbed converts official URLs to embed endpoints', () => {
  const sp = parseOfficialMusicEmbed('https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO');
  assert.equal(sp.valid, true);
  assert.equal(sp.provider, 'spotify');
  assert.ok(sp.embedUrl.includes('open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO'));

  const yt = parseOfficialMusicEmbed('https://www.youtube.com/watch?v=jfKfPfyJRdk');
  assert.equal(yt.valid, true);
  assert.equal(yt.provider, 'youtube');
  assert.equal(yt.embedUrl, 'https://www.youtube.com/embed/jfKfPfyJRdk');

  const invalid = parseOfficialMusicEmbed('https://example.com/pirated-audio.mp3');
  assert.equal(invalid.valid, false);
});

test('evaluatePrayerStatus distinguishes current prayer period from next scheduled prayer', () => {
  const schedule = {
    Fajr: '04:30',
    Dhuhr: '11:55',
    Asr: '15:15',
    Maghrib: '17:58',
    Isha: '19:08',
  };

  const atNoon = new Date(2026, 9, 24, 12, 15, 0);
  const status = evaluatePrayerStatus(schedule, atNoon);
  assert.equal(status.currentPrayer, 'Dhuhr');
  assert.equal(status.nextPrayer, 'Asr');
  assert.equal(status.nextPrayerTime, '15:15');
  assert.equal(status.secondsUntilNext, 3 * 3600);
});

test('validateAndMigrateConfig recovers missing modules while preserving user data', () => {
  const partial = {
    version: 1,
    appearance: { theme: 'light', primaryColor: '#2563eb' },
    layout: [{ id: 'weather', visible: false, order: 0, colSpan: 8, rowSpan: 2 }],
    notepad: {
      notes: [
        {
          id: 'n1',
          title: 'Preserved Note',
          content: 'Important content',
          createdAt: '2026-10-24T00:00:00Z',
          updatedAt: '2026-10-24T00:00:00Z',
        },
      ],
      activeNoteId: 'n1',
    },
  };

  const result = validateAndMigrateConfig(partial);
  assert.equal(result.valid, true);
  assert.equal(result.config.appearance.theme, 'light');
  assert.equal(result.config.appearance.primaryColor, '#2563eb');
  assert.equal(result.config.layout.length, 7);
  assert.equal(result.config.notepad.notes[0].title, 'Preserved Note');
});

test('getFaviconSources extracts domain and builds multi-stage favicon URLs from entered link', () => {
  const sources = getFaviconSources('https://github.com/vercel/next.js');
  assert.ok(sources.length >= 4);
  assert.ok(sources[0].startsWith('/api/favicon?url='));
  assert.ok(sources.some((s) => s.includes('google.com/s2/favicons?domain=github.com')));
  assert.ok(sources.some((s) => s.includes('icons.duckduckgo.com/ip3/github.com.ico')));
  assert.ok(sources.some((s) => s === 'https://github.com/favicon.ico'));
});

test('validateAndMigrateConfig preserves liteMode, focusTarget, and visualizerEnabled', () => {
  const cfg = createDefaultConfig();
  assert.equal(cfg.appearance.liquid.liteMode, false);
  assert.equal(cfg.music.visualizerEnabled, true);
  assert.equal(cfg.background.focusTarget, '');

  const migrated = validateAndMigrateConfig({
    ...cfg,
    appearance: {
      ...cfg.appearance,
      liquid: {
        ...cfg.appearance.liquid,
        liteMode: true,
      },
    },
    background: {
      ...cfg.background,
      focusTarget: 'Deploy Wingst ke Vercel dengan blur aktif',
    },
    music: {
      ...cfg.music,
      visualizerEnabled: false,
    },
  });
  assert.equal(migrated.valid, true);
  assert.equal(migrated.config.appearance.liquid.liteMode, true);
  assert.equal(
    migrated.config.background.focusTarget,
    'Deploy Wingst ke Vercel dengan blur aktif'
  );
  assert.equal(migrated.config.music.visualizerEnabled, false);
});



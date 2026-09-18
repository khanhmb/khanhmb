const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  aggregateMergedPullRequests,
  buildChartSvg,
  getPeriods,
  parseArgs,
} = require('./generate-merged-prs');

const NOW = new Date('2026-09-18T12:00:00Z');

test('aggregates merged pull requests by UTC day', () => {
  const counts = aggregateMergedPullRequests([
    { mergedAt: '2026-09-18T01:00:00Z' },
    { mergedAt: '2026-09-18T23:59:00Z' },
    { mergedAt: '2026-09-17T23:59:00Z' },
    { mergedAt: null },
  ]);

  assert.equal(counts.get('2026-09-18'), 2);
  assert.equal(counts.get('2026-09-17'), 1);
  assert.equal(counts.size, 2);
});

test('creates the requested daily, weekly, and monthly windows', () => {
  assert.equal(getPeriods(NOW, 'daily').length, 30);
  assert.equal(getPeriods(NOW, 'weekly').length, 12);
  assert.equal(getPeriods(NOW, 'monthly').length, 12);
  assert.equal(getPeriods(NOW, 'weekly')[11].key, '2026-09-14');
  assert.equal(getPeriods(NOW, 'monthly')[0].key, '2025-10-01');
});

test('builds separate SVG bar charts for each granularity', () => {
  const items = [
    { mergedAt: '2026-09-18T01:00:00Z' },
    { mergedAt: '2026-09-18T23:59:00Z' },
    { mergedAt: '2026-09-14T12:00:00Z' },
    { mergedAt: '2026-06-04T12:00:00Z' },
  ];

  const daily = buildChartSvg(items, NOW, 'daily');
  const weekly = buildChartSvg(items, NOW, 'weekly');
  const monthly = buildChartSvg(items, NOW, 'monthly');

  assert.match(daily, /3 merged PRs in the last 30 days/);
  assert.match(daily, /Merged pull requests by day/);
  assert.match(weekly, /3 merged PRs in the last 12 weeks/);
  assert.match(weekly, /Merged pull requests by week/);
  assert.match(monthly, /4 merged PRs in the last 12 months/);
  assert.match(monthly, /Merged pull requests by month/);
  assert.match(daily, /data-count="2"/);
  assert.match(weekly, /data-count="3"/);
  assert.match(monthly, /data-count="3"/);
});

test('parses a fixed now date, output directory, and fixture path', () => {
  assert.deepEqual(parseArgs([
    '--now', '2026-09-18T12:00:00Z',
    '--output-dir', 'assets',
    '--fixture', 'fixtures/prs.json',
  ]), {
    now: NOW,
    outputDir: 'assets',
    fixture: 'fixtures/prs.json',
  });
});

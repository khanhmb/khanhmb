const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  aggregateMergedPullRequests,
  buildSvg,
  parseArgs,
} = require('./generate-merged-prs');

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

test('builds a twelve-month SVG timeline with total and month labels', () => {
  const svg = buildSvg([
    { mergedAt: '2026-09-18T01:00:00Z' },
    { mergedAt: '2026-09-18T23:59:00Z' },
    { mergedAt: '2026-06-04T12:00:00Z' },
    { mergedAt: '2025-01-01T12:00:00Z' },
  ], new Date('2026-09-18T12:00:00Z'));

  assert.match(svg, /<title id="chart-title">3 merged PRs in the last 12 months<\/title>/);
  assert.match(svg, /Oct 25/);
  assert.match(svg, /Sep 26/);
  assert.match(svg, /data-count="2"/);
  assert.doesNotMatch(svg, /2025-01-01/);
});

test('parses a fixed now date and output path', () => {
  assert.deepEqual(parseArgs([
    '--now', '2026-09-18T12:00:00Z',
    '--output', 'assets/chart.svg',
  ]), {
    now: new Date('2026-09-18T12:00:00Z'),
    output: 'assets/chart.svg',
    fixture: null,
  });
});

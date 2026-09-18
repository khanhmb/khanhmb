const fs = require('node:fs');
const path = require('node:path');

const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const SEARCH_QUERY = `author:khanhmb is:pr is:merged merged:>={start}`;
const GRAPHQL_QUERY = `
  query($query: String!, $cursor: String) {
    search(query: $query, type: ISSUE, first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ... on PullRequest {
          mergedAt
        }
      }
    }
  }
`;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayUtc(date) {
  const value = new Date(date);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function startOfMonthUtc(date) {
  const value = new Date(date);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function startOfWeekUtc(date) {
  const value = startOfDayUtc(date);
  const day = value.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return new Date(value.valueOf() - daysSinceMonday * DAY_MS);
}

function addMonthsUtc(date, amount) {
  const value = startOfMonthUtc(date);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + amount, 1));
}

function addDaysUtc(date, amount) {
  return new Date(date.valueOf() + amount * DAY_MS);
}

function toDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function aggregateMergedPullRequests(items) {
  const counts = new Map();

  for (const item of items) {
    if (!item?.mergedAt) continue;
    const date = new Date(item.mergedAt);
    if (Number.isNaN(date.valueOf())) continue;

    const key = toDayKey(date);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return counts;
}

function getPeriods(now, granularity) {
  const end = startOfDayUtc(now);

  if (granularity === 'daily') {
    const first = addDaysUtc(end, -29);
    return Array.from({ length: 30 }, (_, index) => {
      const start = addDaysUtc(first, index);
      return { key: toDayKey(start), label: `${MONTH_NAMES[start.getUTCMonth()]} ${String(start.getUTCDate()).padStart(2, '0')}`, start, end: start };
    });
  }

  if (granularity === 'weekly') {
    const first = addDaysUtc(startOfWeekUtc(end), -11 * 7);
    return Array.from({ length: 12 }, (_, index) => {
      const start = addDaysUtc(first, index * 7);
      return { key: toDayKey(start), label: `${MONTH_NAMES[start.getUTCMonth()]} ${String(start.getUTCDate()).padStart(2, '0')}`, start, end: addDaysUtc(start, 6) };
    });
  }

  const first = addMonthsUtc(end, -11);
  return Array.from({ length: 12 }, (_, index) => {
    const start = addMonthsUtc(first, index);
    return { key: toDayKey(start), label: `${MONTH_NAMES[start.getUTCMonth()]} ${String(start.getUTCFullYear()).slice(-2)}`, start, end: addDaysUtc(addMonthsUtc(start, 1), -1) };
  });
}

function buildChartSvg(items, now = new Date(), granularity = 'monthly') {
  const periods = getPeriods(now, granularity);
  const counts = aggregateMergedPullRequests(items);
  const periodCounts = periods.map((period) => {
    let count = 0;
    for (let date = period.start; date <= period.end; date = addDaysUtc(date, 1)) {
      count += counts.get(toDayKey(date)) || 0;
    }
    return count;
  });

  const total = periodCounts.reduce((sum, count) => sum + count, 0);
  const maxCount = Math.max(1, ...periodCounts);
  const width = 960;
  const height = 280;
  const plot = { left: 42, top: 72, width: 880, height: 150 };
  const baseline = plot.top + plot.height;
  const periodWidth = plot.width / periods.length;
  const barWidth = Math.max(12, periodWidth - 18);
  const labels = { daily: 'day', weekly: 'week', monthly: 'month' };
  const range = { daily: 'last 30 days', weekly: 'last 12 weeks', monthly: 'last 12 months' };
  const title = `${total} merged PR${total === 1 ? '' : 's'} in the ${range[granularity]}`;
  const bars = periods.map((period, index) => {
    const count = periodCounts[index];
    const barHeight = count === 0 ? 0 : Math.max(2, (count / maxCount) * plot.height);
    const x = plot.left + index * periodWidth + (periodWidth - barWidth) / 2;
    const y = baseline - barHeight;
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="3" fill="#0969da" data-period="${period.key}" data-count="${count}"><title>${period.label}: ${count}</title></rect>`;
  }).join('');

  const periodLabels = periods.map((period, index) => {
    const x = plot.left + index * periodWidth + periodWidth / 2;
    return `<text x="${x.toFixed(2)}" y="${baseline + 32}" fill="#57606a" font-size="13" text-anchor="middle">${escapeXml(period.label)}</text>`;
  }).join('');

  const yTicks = [0, 0.5, 1].map((ratio) => {
    const y = baseline - ratio * plot.height;
    const label = Math.round(maxCount * ratio);
    return `<line x1="${plot.left}" y1="${y.toFixed(2)}" x2="${plot.left + plot.width}" y2="${y.toFixed(2)}" stroke="#d8dee4" stroke-dasharray="3 5"/><text x="${width - 18}" y="${(y + 4).toFixed(2)}" fill="#57606a" font-size="12" text-anchor="end">${label}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-description">
  <title id="chart-title">${escapeXml(title)}</title>
  <desc id="chart-description">Merged pull requests by ${labels[granularity]}.</desc>
  <rect width="${width}" height="${height}" rx="12" fill="#ffffff" stroke="#d0d7de"/>
  <text x="28" y="34" fill="#24292f" font-size="20" font-weight="700">${escapeXml(title)}</text>
  <text x="28" y="54" fill="#57606a" font-size="12">Merged pull requests by ${labels[granularity]} · UTC</text>
  ${yTicks}
  <line x1="${plot.left}" y1="${baseline}" x2="${plot.left + plot.width}" y2="${baseline}" stroke="#d0d7de"/>
  ${bars}
  ${periodLabels}
  <text x="${width - 12}" y="${plot.top + plot.height / 2}" fill="#57606a" font-size="13" text-anchor="middle" transform="rotate(90 ${width - 12} ${plot.top + plot.height / 2})">Merged PRs</text>
</svg>
`;
}

function buildSvg(items, now = new Date()) {
  return buildChartSvg(items, now, 'monthly');
}

function parseArgs(argv) {
  const args = { now: new Date(), outputDir: path.join(process.cwd(), 'assets'), fixture: null };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === '--now') {
      args.now = new Date(value);
      if (Number.isNaN(args.now.valueOf())) throw new Error(`Invalid --now value: ${value}`);
      index += 1;
    } else if (flag === '--output-dir') {
      args.outputDir = value;
      index += 1;
    } else if (flag === '--fixture') {
      args.fixture = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  return args;
}

async function fetchMergedPullRequests(token, now) {
  if (!token) throw new Error('GH_TOKEN is required to query merged PRs');

  const start = toDayKey(addMonthsUtc(now, -11));
  const query = SEARCH_QUERY.replace('{start}', start);
  const items = [];
  let cursor = null;

  do {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: GRAPHQL_QUERY, variables: { query, cursor } }),
    });

    if (!response.ok) throw new Error(`GitHub GraphQL request failed with HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error('GitHub GraphQL request returned errors');

    const search = payload.data.search;
    items.push(...search.nodes.filter((item) => item.mergedAt));
    cursor = search.pageInfo.hasNextPage ? search.pageInfo.endCursor : null;
  } while (cursor);

  return items;
}

function readFixture(fixturePath) {
  const payload = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  return Array.isArray(payload) ? payload : payload.items || [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const items = args.fixture
    ? readFixture(args.fixture)
    : await fetchMergedPullRequests(process.env.GH_TOKEN || process.env.GITHUB_TOKEN, args.now);

  fs.mkdirSync(args.outputDir, { recursive: true });
  for (const granularity of ['daily', 'weekly', 'monthly']) {
    const filename = path.join(args.outputDir, `merged-prs-${granularity}.svg`);
    fs.writeFileSync(filename, buildChartSvg(items, args.now, granularity));
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  aggregateMergedPullRequests,
  buildChartSvg,
  buildSvg,
  getPeriods,
  parseArgs,
};

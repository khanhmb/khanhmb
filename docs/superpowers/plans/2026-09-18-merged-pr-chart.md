# Merged PR Timeline Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and publish a GitHub profile SVG showing `khanhmb`'s merged PR count by day over the last 12 months, including private repositories.

**Architecture:** A Node.js script calls GitHub GraphQL with `GH_TOKEN`, aggregates merged PR timestamps into UTC-day buckets, and writes a self-contained SVG. A scheduled GitHub Actions workflow runs the script and commits the generated asset; the profile README embeds that asset.

**Tech Stack:** Node.js built-in `fetch`, GitHub GraphQL API, GitHub Actions, inline SVG.

---

### Task 1: Add a deterministic chart generator

**Files:**
- Create: `scripts/generate-merged-prs.js`
- Create: `scripts/generate-merged-prs.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write a fixture-driven test**

  Test that two merged timestamps on the same UTC day produce one bar with value `2`, that the SVG includes the total and month labels, and that the generator accepts a fixed `--now` value.

- [ ] **Step 2: Run the test to verify it fails**

  Run: `node --test scripts/generate-merged-prs.test.js`
  Expected: FAIL because the generator does not exist.

- [ ] **Step 3: Implement the generator**

  Export `aggregateMergedPullRequests`, `buildSvg`, and `parseArgs`. Use the following behavior:

  ```js
  const fs = require('node:fs');
  const path = require('node:path');

  function aggregateMergedPullRequests(items) {
    const counts = new Map();
    for (const item of items) {
      const date = new Date(item.mergedAt);
      if (Number.isNaN(date.valueOf())) continue;
      const key = date.toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }
  ```

  `buildSvg` must render a 12-month window ending at `--now`, include a `<title>` with the total, use green bars, and escape all text before inserting it into SVG markup.

- [ ] **Step 4: Add the test command and run it**

  Add `"test": "node --test scripts/generate-merged-prs.test.js"` to `package.json` and run `npm test`.
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add package.json scripts
  git commit -m "feat: generate merged PR timeline SVG"
  ```

### Task 2: Add GitHub GraphQL pagination and scheduled automation

**Files:**
- Modify: `scripts/generate-merged-prs.js`
- Create: `.github/workflows/update-merged-pr-chart.yml`

- [ ] **Step 1: Add the GraphQL query**

  Query `author:khanhmb is:pr is:merged` with `first: 100`, `after`, `mergedAt`, and `repository.nameWithOwner`; continue until `pageInfo.hasNextPage` is false. Send `GH_TOKEN` as a bearer token to `https://api.github.com/graphql`.

- [ ] **Step 2: Keep private data out of the SVG**

  Use only `mergedAt` for chart aggregation. Do not write PR titles, repository names, URLs, tokens, or response payloads to generated files or logs.

- [ ] **Step 3: Add the workflow**

  Run on `workflow_dispatch` and daily at `17:00 UTC`; check out the repository; run `node scripts/generate-merged-prs.js`; commit only `assets/merged-prs.svg` when changed; push using `GITHUB_TOKEN`. Read the API token from `${{ secrets.PR_ANALYTICS_TOKEN }}` and fail with a clear message if it is missing.

- [ ] **Step 4: Run local syntax and unit checks**

  Run: `node --check scripts/generate-merged-prs.js && npm test`
  Expected: exit 0 and all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add scripts/generate-merged-prs.js .github/workflows/update-merged-pr-chart.yml
  git commit -m "ci: update merged PR chart daily"
  ```

### Task 3: Add the profile README and first generated asset

**Files:**
- Create: `README.md`
- Create: `assets/merged-prs.svg`

- [ ] **Step 1: Generate an initial chart**

  Run the generator with `GH_TOKEN` and write `assets/merged-prs.svg`. If the token is unavailable locally, use an explicit empty fixture only for the initial shape; the first workflow run must replace it with authenticated data.

- [ ] **Step 2: Write the README**

  Add a short profile introduction and embed `assets/merged-prs.svg` with an accessible alt label. State that the chart counts merged PRs by UTC day and refreshes daily.

- [ ] **Step 3: Verify the artifact**

  Run: `npm test && rg -n "merged-prs\.svg|merged PR" README.md && test -s assets/merged-prs.svg`
  Expected: all tests pass, README contains the image reference, and the SVG is non-empty.

- [ ] **Step 4: Commit**

  ```bash
  git add README.md assets/merged-prs.svg
  git commit -m "feat: add GitHub profile merged PR chart"
  ```

### Task 4: Configure secrets, push, and verify GitHub Actions

**Files:**
- Remote repository settings: `khanhmb/khanhmb` secret `PR_ANALYTICS_TOKEN`

- [ ] **Step 1: Configure the private-repository token**

  Use a fine-grained GitHub token with read access to the account's private repositories and metadata. Store it only as the repository secret `PR_ANALYTICS_TOKEN`; never commit or print it.

- [ ] **Step 2: Push the profile repository**

  ```bash
  git push -u origin main
  ```

- [ ] **Step 3: Dispatch the workflow**

  ```bash
  gh workflow run update-merged-pr-chart.yml --repo khanhmb/khanhmb
  ```

- [ ] **Step 4: Verify the run and profile asset**

  Confirm the workflow completes successfully, `assets/merged-prs.svg` is updated remotely, and `https://github.com/khanhmb` renders the chart from the profile README.

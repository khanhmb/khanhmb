# Merged PR Timeline Chart

## Goal

Show the GitHub account's merged pull requests in the profile README as a single bar-chart timeline, covering public and private repositories.

## Design

- The profile repository is public and named `khanhmb/khanhmb` so GitHub renders its `README.md` on the user profile.
- A GitHub Actions workflow runs daily and can also be started manually.
- The workflow queries GitHub's GraphQL API for pull requests authored by `khanhmb` with a merged timestamp, using a repository secret token with read access to private repositories.
- A small Node.js generator aggregates merged PRs by UTC day and writes a self-contained SVG to `assets/merged-prs.svg`.
- The SVG includes the total merged count, a 12-month time axis, monthly labels, and one GitHub-blue bar per day. Empty days remain visible as zero-height positions so the timeline keeps a consistent scale.
- `README.md` embeds the SVG and explains the update cadence. No token or private repository names are written to the generated asset.

## Data and failure behavior

- The GraphQL query paginates through all matching PRs, so the chart is not limited to the first API page.
- If the API request fails, the workflow exits non-zero and leaves the last successful chart in place.
- If no merged PRs are found, the generator still produces a valid empty 12-month chart with a total of zero.

## Verification

- Run the generator locally with a fixture response or a GitHub token and verify that the SVG contains the total, month labels, and bars.
- Run the workflow's Node.js syntax checks and confirm the README references the generated SVG.
- Verify the repository's Actions workflow file and generated asset are committed and pushed.

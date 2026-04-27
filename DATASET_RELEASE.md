# Dataset Release

This repo can publish curated dataset updates without shipping a new mobile app binary.

## Hosting Model

The app should read a stable remote manifest URL such as:

- `https://cdn.example.com/datasets/latest/manifest.json`

Each release is published into a versioned folder and can optionally also be promoted to `latest/`.

Example object layout:

- `datasets/2026.04.27/dataset.json`
- `datasets/2026.04.27/manifest.json`
- `datasets/latest/dataset.json`
- `datasets/latest/manifest.json`

The runtime app fetches `manifest.json`, then resolves `dataset.json` relative to that manifest URL.

## Workflow

The GitHub Actions workflow is [publish-dataset.yml](./.github/workflows/publish-dataset.yml).

It is configured to run automatically every day at `05:17 UTC`, and it can also be started manually from the Actions tab.

It does the following:

1. Checks out the repo.
2. Installs Node dependencies with `npm ci`.
3. Runs `npm run build:dataset` against Google Sheets.
4. Uploads the generated JSON files as a workflow artifact.
5. Publishes `dataset.json` before `manifest.json`.
6. Optionally promotes the same pair to `latest/`, again uploading `dataset.json` before `manifest.json`.

Publishing the manifest last is important because the manifest is the activation pointer for clients.

## Required GitHub Configuration

Repository secrets:

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_API_KEY`

Or, for a private sheet:

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_CLIENT_EMAIL`
- `GOOGLE_SHEETS_PRIVATE_KEY`

Repository secrets for publishing:

- `DATASET_S3_ACCESS_KEY_ID`
- `DATASET_S3_SECRET_ACCESS_KEY`

Repository variables:

- `DATASET_S3_BUCKET`
- `DATASET_S3_REGION`
- `DATASET_S3_PREFIX`
  Recommended: `datasets`
- `DATASET_S3_ENDPOINT_URL`
  Leave empty for AWS S3. Set it for S3-compatible storage such as Cloudflare R2.

## Supported Storage Targets

The workflow uses `aws s3 cp`, so it works with:

- AWS S3
- Cloudflare R2
- MinIO
- Backblaze B2 S3-compatible API
- Other S3-compatible object stores

## Recommended App Configuration

Point the app at the stable manifest URL, not at a versioned release path.

Example:

- `EXPO_PUBLIC_DATASET_MANIFEST_URL=https://cdn.example.com/datasets/latest/manifest.json`

Or set the same URL in [app.json](/Users/mohamedkhairy/dev/allergolib/app.json:1) under `expo.extra.datasetManifestUrl`.

## Running A Release

Open the GitHub Actions tab and run `Publish Dataset`.

Inputs:

- `promote_latest`
  Keep this enabled for normal releases so beta users move to the new dataset automatically.
- `dry_run`
  Enable this to validate export/build without uploading anything.

For scheduled runs, GitHub Actions uses UTC cron scheduling and executes the workflow from the default branch.

## Beta Gate

Before promoting a dataset to `latest/`, complete the manual beta checklist in [BETA_READINESS.md](/Users/mohamedkhairy/dev/allergolib/BETA_READINESS.md:1).

Minimum gate for a limited clinician beta:

1. `npm run build:dataset` succeeds against the source sheet.
2. `npm run typecheck` succeeds on the app bundle that will ship to testers.
3. The generated dataset contains preferred-source provenance for every seeded test that surfaces recommendation content.
4. Offline launch, background rollover, and failed-update fallback have been exercised on real iOS and Android beta devices.

## Operational Notes

- The mobile app always has the bundled dataset as a fallback.
- If remote fetch, checksum validation, or schema validation fails, the app keeps the previous local dataset.
- If a release should not be exposed broadly yet, publish only the versioned path and leave `promote_latest` disabled.
- The app now suppresses recommendation content if the active dataset lacks valid preferred-source provenance for the selected test.

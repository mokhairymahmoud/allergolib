# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PeriopSkinTest** (package slug: `allergolib`) is an offline-first React Native / Expo cross-platform app (iOS, Android, Web) for allergologists to look up validated skin test concentrations for perioperative drugs. The app supports English and French.

## Commands

```bash
# Start dev server (choose platform interactively)
npm start

# Platform-specific
npm run ios
npm run android
npm run web

# Type checking (no test runner configured)
npm run typecheck

# Data pipeline (requires Google service account in .env.local)
npm run build:dataset          # Export Google Sheets → src/data/generated/
npm run verify:admin-fixture   # Validate exported dataset schema

# Admin panel (Google Apps Script)
npm run admin:clasp:push       # Deploy admin code to Apps Script
npm run admin:clasp:pull       # Pull admin code from Apps Script
npm run admin:clasp:open       # Open admin panel in browser
```

## Architecture

### Entry Point & Navigation

`App.tsx` is a ~2,700-line monolithic component containing all screens, state, and UI logic. Navigation is state-driven (no React Navigation): `homeTab` controls which tab is visible, `selectedDrugId` controls whether the drug detail overlay is shown.

There is no routing library. All application state lives in the root `App` component and flows down via props.

### Key Source Directories

- `src/types.ts` — Domain models: `Drug`, `Test`, `Source`, `Dataset`, `Manifest`
- `src/data/runtimeDataset.ts` — Dataset loading, remote sync, AsyncStorage caching
- `src/data/loadBundledDataset.ts` — Imports the static bundled JSON
- `src/data/generated/` — Auto-generated `dataset.json` and `manifest.json` (do not edit manually)
- `src/lib/drugSearch.ts` — Ranked full-text search (exact → prefix → substring → fuzzy)
- `src/lib/dilutionCalculator.ts` — Offline dilution ratio calculations
- `src/lib/favorites.ts` — AsyncStorage persistence for favorited drugs
- `src/lib/recentSearches.ts` — AsyncStorage persistence for recently viewed drugs
- `src/lib/filterDrugs.ts` — Drug classification and category filtering
- `src/lib/i18n.ts` — All UI and medical content strings in `en`/`fr`
- `admin/apps-script/` — Google Apps Script backend + web UI for data curation

### Dataset Pipeline

Medical data is curated in Google Sheets by doctors, then published to the app:

1. Doctors edit the source Google Spreadsheet
2. `npm run build:dataset` uses the Apps Script backend to export → `src/data/generated/dataset.json` + `manifest.json`
3. `npm run verify:admin-fixture` validates schema compliance
4. Files are published to a CDN; the manifest URL is set via `EXPO_PUBLIC_DATASET_MANIFEST_URL`
5. At startup the app silently polls the manifest, downloads newer datasets, and caches them in AsyncStorage

### Offline-First & Storage

All features must work without a network connection. Storage keys:
- `@periop-skin-test/active-dataset` — cached remote dataset
- `@periop-skin-test/favorite-drugs` — user favorites
- `@periop-skin-test/recent-drugs` — recently viewed drugs

### Localization

All user-facing strings (UI labels and medical content) must support both `"en"` and `"fr"`. Translations live in `src/lib/i18n.ts`. The `copy()` helper resolves strings for the active language. The `LocalizedString` type is `Record<Language, string>`.

### Theming

A custom theme context provides light/dark mode (with system preference detection). No external theme library is used. Any new screens or components must respect the theme context.

### TypeScript

Strict mode is enabled (`tsconfig.json` extends `expo/tsconfig.base` with `"strict": true`). Run `npm run typecheck` before considering a change complete.

## Environment Variables

Create `.env.local` for local development:

```
GOOGLE_SHEETS_SPREADSHEET_ID=...
GOOGLE_SHEETS_CLIENT_EMAIL=...
GOOGLE_SHEETS_PRIVATE_KEY=...
EXPO_PUBLIC_DATASET_MANIFEST_URL=...
```

## Build & Release

EAS is configured in `eas.json` with three profiles: `development` (internal, dev client), `preview` (internal distribution), and `production` (auto-increment version). App owner is `mokhairy` on Expo.

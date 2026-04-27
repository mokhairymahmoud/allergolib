# Plan: PeriopSkinTest MVP

> Source PRD: [prd-mvp.md](./prd-mvp.md) plus the locked source document `2025 SFAR/SFA Diagnostic et prise en charge des réactions d’hypersensibilité immédiate périopératoires`

## Summary
This plan breaks the MVP into five thin vertical slices. Each phase delivers a usable end-to-end increment across mobile UI, local data handling, validation, and clinical-source traceability.

## Architectural Decisions
Durable decisions that apply across all phases:

- **Mobile stack**: `Expo React Native` for iOS and Android.
- **Offline model**: App always ships with an embedded dataset and must work fully offline on first launch.
- **Update model**: Online devices silently check a remote `manifest.json` and download a newer dataset in the background; failures keep the current local dataset.
- **Medical source of truth**: Clinicians curate data in `Google Sheets`.
- **Publish path**: A scripted export/validation step produces versioned static JSON plus a manifest, hosted on static storage/CDN.
- **Source handling**: Every test entry stores a `preferred source` and optional `alternate source`.
- **Localization**: UI and curated content are bilingual in English and French.
- **Governance**: One medical owner approves every dataset release before publication.

---

## Phase 1: Reference Slice

**Status**: Done

**User stories**: search a drug, open a detail screen, read core concentration data offline

### What to build
Build the first end-to-end reference slice with a minimal bundled dataset from the SFAR/SFA 2025 guideline. The app should support home, search, and drug detail for a very small seeded set of drugs, with offline access, bilingual UI framing, and visible source attribution.

### Acceptance criteria
- [x] The app launches offline and shows bundled data without any network dependency.
- [x] A clinician can search and open at least one seeded drug in two taps or less.
- [x] Drug detail shows test sections, concentration data, notes, and source citation/excerpt.
- [x] The slice is bilingual at the UI level and supports localized medical content fields.

---

## Phase 2: Curated Dataset Pipeline v1

**Status**: Done

**User stories**: expand beyond a demo slice into a clinically curated MVP dataset

### What to build
Define the Google Sheets structure and the export/validation pipeline that turns curated rows into the app dataset. Seed the first real dataset manually from the SFAR/SFA 2025 guideline because the key concentration appendix is not reliably machine-readable.

### Acceptance criteria
- [x] The sheet structure supports drugs, aliases, test entries, notes, sources, and release metadata.
- [x] The export step validates required fields, source references, language completeness, and dilution formatting.
- [x] The pipeline emits a production-shaped dataset JSON and manifest JSON.
- [x] The app can run entirely on the exported bundled dataset instead of a hand-written fixture.
- [x] The seeded dataset covers the agreed MVP drug list from the PRD.

---

## Phase 3: Background Updates And Multi-Source Readiness

**User stories**: receive corrected or newer data without requiring a mobile app release

### What to build
Add remote manifest checking, dataset download, local caching, and safe activation of new dataset versions. Extend the data contract so each entry can carry preferred and alternate authorities, even if the exact EAACI document is added later.

### Acceptance criteria
- [ ] On online launch, the app checks a remote manifest in the background without blocking usage.
- [ ] A newer valid dataset downloads, verifies, and replaces the current cached dataset atomically.
- [ ] Failed download, checksum mismatch, or schema failure leaves the previous dataset intact.
- [ ] The dataset contract supports preferred and alternate source display per test entry.
- [ ] A republished dataset hotfix can reach beta users without an app-store release.

---

## Phase 4: Clinical Utility Features

**User stories**: find drugs faster, calculate dilutions, save frequent entries, use bilingual medical content

### What to build
Add the features that make the app practical in workflow: alias-aware search, favorites, dilution calculator, and richer note presentation. This phase should feel like the first clinically useful beta.

### Acceptance criteria
- [ ] Search supports canonical names plus curated aliases and spelling variants.
- [ ] Favorites persist locally across app restarts and are accessible from the home screen.
- [ ] The dilution calculator works offline for common ratios such as `1:10` and `1:100`.
- [ ] Drug detail clearly distinguishes test-type data, warnings, and source provenance.
- [ ] English and French content render correctly for curated medical entries.

---

## Phase 5: Beta Hardening And Release Readiness

**User stories**: use the app safely in a private clinical beta with confidence in provenance and behavior

### What to build
Harden the product for beta distribution with compliance wording, edge-case handling, content QA, and operational dataset-release discipline. This phase closes the loop between curator workflow and clinician consumption.

### Acceptance criteria
- [ ] The informational-use disclaimer is visible in the agreed locations.
- [ ] Offline-first behavior, dataset rollover, and content fallback paths are verified on real beta devices.
- [ ] Source provenance is present for every displayed recommendation in the seeded dataset.
- [ ] Dataset release steps are documented well enough for repeated curator-to-publish cycles.
- [ ] The app is ready for limited clinician beta distribution.

## Assumptions
- The SFAR/SFA 2025 PDF is the first locked authority for dataset seeding.
- The exact EAACI source is deferred, but the schema must support adding it without redesign.
- MVP excludes patient data, decision support, EHR integration, and an admin dashboard.
- The first dataset is manually seeded into Google Sheets, then maintained through the structured publish flow.

# Beta Readiness

This checklist closes the loop between curator release work and clinician beta use.

## Exit Criteria

- The home screen shows the "Informational use only" disclaimer.
- The search-first landing screen opens on the `Search` tab with the language switcher visible.
- Recent searches appear when the search field is empty after at least one successful lookup.
- Favorites remain isolated in the `Favorites` tab and reopen saved drugs correctly.
- The `Info` tab loads without interfering with search and detail flows.
- Every drug detail screen shows the same disclaimer before test data.
- Every seeded test with displayed content resolves to a preferred source with localized document name and excerpt.
- The bundled dataset loads with network disabled.
- A newer remote dataset can activate without breaking favorites or search.
- A failed remote dataset fetch leaves the previous dataset active.

## Device Verification Matrix

Run these checks on at least one iOS beta device and one Android beta device before widening access.

1. Fresh install, airplane mode on:
   Confirm the home screen loads on `Search`, search works, recent searches appear after one lookup, and at least one drug detail opens with source provenance.
2. Existing install with cached dataset, airplane mode on:
   Confirm the last active dataset still loads, favorites remain intact, and saved drugs still open from the `Favorites` tab.
3. Existing install with network on and newer remote manifest available:
   Launch the app, wait for background sync, relaunch, and confirm the new manifest version appears on the home screen without breaking search ranking or detail navigation.
4. Existing install with network on and intentionally broken remote dataset:
   Use a checksum mismatch or schema-invalid payload and confirm the app keeps the prior active dataset.
5. English and French spot check:
   Open the home screen, `Favorites`, `Info`, plus two drug detail screens in both languages and verify disclaimer, source excerpt, note copy, and tab labels render correctly.

## Release Operator Steps

1. Update the Google Sheet tabs and obtain clinical owner approval for the new release metadata.
2. Run `npm run build:dataset`.
3. Run `npm run typecheck`.
4. Review `src/data/generated/dataset.json` and `src/data/generated/manifest.json` for version, approver, and seeded-source coverage.
5. Run the GitHub Actions workflow in dry-run mode for an artifact-only validation pass.
6. Publish the versioned dataset.
7. Promote `latest/` only after device verification passes.

## Rollback

If beta users report a regression:

1. Leave the app binaries unchanged.
2. Re-publish the last known-good `dataset.json` first, then its `manifest.json`.
3. If needed, promote the same pair back to `latest/`.
4. Re-test offline launch and one updated-device flow before resuming beta distribution.

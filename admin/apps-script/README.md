# Apps Script Admin Skeleton

This folder contains the Phase 4 Google Apps Script web app for admin curation.

## What it supports

- desktop-first web app shell
- lookup by `id`, French name, English name, and class
- unified create/edit form for `drugs`, `aliases`, `test_entries`, and `notes`
- save directly into the normalized sheet tabs
- reuse of existing preferred and alternate sources

This slice intentionally does **not** publish a dataset after save. It only updates the sheet.

## Sheet contract

The app writes against the same normalized tabs used by [`scripts/export-dataset.mjs`](/Users/mohamedkhairy/dev/allergolib/scripts/export-dataset.mjs):

- `drugs`
- `aliases`
- `test_entries`
- `notes`
- `sources`

Phase 4 keeps compatibility with the current exporter by persisting one `test_entries` row for each of:

- `prick`
- `idr`
- `patch`

## Deployment

1. Create an Apps Script project, or bind one to the target spreadsheet.
2. Copy the files from this folder into the Apps Script project.
3. If the script is standalone, set the script property `SPREADSHEET_ID` to the target sheet id.
4. Deploy as a web app.

Suggested web app settings:

- Execute as: `User accessing the web app`
- Access: restricted to the intended admin account(s)

## Notes

- The script preserves the current export contract and current sheet headers.
- `alternate_source_id` and `note_kind` are supported when those columns exist, but the current production sheet does not yet expose them.
- Delete flow, inline source creation, and stricter phase-specific validation belong to Phase 5.

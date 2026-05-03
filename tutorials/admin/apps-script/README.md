# Apps Script Admin Curation App

This folder contains the Google Apps Script web app for admin curation.

For day-to-day maintenance and recovery guidance, use
[OPERATIONS.md](/Users/mohamedkhairy/dev/allergolib/admin/apps-script/OPERATIONS.md:1).

For a step-by-step UI walkthrough with screenshots, use
[ADMIN_UI_TUTORIAL.md](/Users/mohamedkhairy/dev/allergolib/admin/apps-script/ADMIN_UI_TUTORIAL.md:1).

## What it supports

- desktop-first web app shell
- lookup by `id`, French name, English name, and class
- unified create/edit form for `drugs`, `aliases`, `test_entries`, `notes`, and inline source drafts
- save directly into the normalized sheet tabs
- reuse of existing preferred and alternate sources
- strict bilingual and required-field validation before save
- selective applicable-test writes instead of forcing all three test rows
- typed-confirm permanent delete for a drug and its linked child rows
- optional GitHub Actions dispatch after a successful save
The admin app always writes to the sheet first. It can optionally dispatch the dataset GitHub
workflow after a successful save, depending on Apps Script script properties.

## Sheet contract

The app writes against the same normalized tabs used by [`scripts/export-dataset.mjs`](/Users/mohamedkhairy/dev/allergolib/scripts/export-dataset.mjs):

- `drugs`
- `aliases`
- `test_entries`
- `notes`
- `sources`

The app keeps compatibility with the current exporter by writing only the applicable `test_entries`
rows that the admin selected for the drug.

## Deployment

1. Create an Apps Script project, or bind one to the target spreadsheet.
2. Copy the files from this folder into the Apps Script project.
3. If the script is standalone, set the script property `SPREADSHEET_ID` to the target sheet id.
4. Deploy as a web app.

Optional script properties for GitHub Actions dispatch after save:

- `GITHUB_TRIGGER_ON_SAVE=true`
- `GITHUB_TRIGGER_OWNER=<github-owner>`
- `GITHUB_TRIGGER_REPO=<github-repo>`
- `GITHUB_TRIGGER_TOKEN=<github-token-with-actions:write>`

Optional overrides:

- `GITHUB_TRIGGER_WORKFLOW_FILE=publish-dataset.yml`
- `GITHUB_TRIGGER_REF=master`
- `GITHUB_TRIGGER_DRY_RUN=true`
- `GITHUB_TRIGGER_PROMOTE_LATEST=false`

Behavior notes:

- The Apps Script backend dispatches GitHub only after `SpreadsheetApp.flush()` succeeds.
- The default safe trigger mode is a workflow dry run, not a publish.
- If GitHub dispatch fails, the sheet save still succeeds and the admin UI shows the dispatch error.

Suggested web app settings:

- Execute as: `User accessing the web app`
- Access: restricted to the intended admin account(s)

## `clasp` workflow

You can manage this Apps Script project from the repo root with `clasp`.

1. Install dependencies:
   - `npm install`
2. Log in to Google Apps Script:
   - `npm run admin:clasp:login`
3. Copy the target Apps Script `scriptId` from the Apps Script URL.
4. Create the local link file:
   - `npm run admin:clasp:link -- <SCRIPT_ID>`
5. Push the admin app files:
   - `npm run admin:clasp:push`
6. Open the linked Apps Script project:
   - `npm run admin:clasp:open`

Other useful commands:

- `npm run admin:clasp:status`
- `npm run admin:clasp:pull`
- `npm run admin:clasp:deploy`

The repo keeps a template at [admin/apps-script/.clasp.json.example](/Users/mohamedkhairy/dev/allergolib/admin/apps-script/.clasp.json.example:1). Your real `admin/apps-script/.clasp.json` stays local and is ignored by git.

Internally this wrapper maps the local `open` alias to the upstream `clasp open-script` command used by `@google/clasp` 3.x.

## Notes

- The script preserves the current export contract and current sheet headers.
- `alternate_source_id` and `note_kind` are supported when those columns exist.
- Delete does not remove rows from `sources`; it only removes the drug row and linked `aliases`,
  `test_entries`, and `notes` rows.
- Phase 6 verification now includes `npm run verify:admin-fixture`, which proves the exporter still
  accepts a representative admin-written row shape with selective applicable tests.

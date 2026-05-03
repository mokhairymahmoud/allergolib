# Admin Curation Operations

This guide is the normal operating path for one curator maintaining the dataset through the Apps
Script admin app.

## Normal Flow

1. Open the admin web app and confirm the status banner shows the target spreadsheet name.
2. Search by drug `id`, French name, English name, or class.
3. Choose `New drug` for create mode or load an existing record for edit mode.
4. Complete `Core drug info` in French and English.
5. Add at least one alias.
6. Select only the applicable test kinds for the drug.
7. For each selected test:
   - choose a preferred source
   - optionally choose a different alternate source
   - enter concentration, max concentration, dilution ratios, bilingual vehicle, and bilingual notes as needed
8. If a required source does not exist yet, add it in the inline `Sources` section before saving.
9. Review the validation summary and field errors.
10. Save to sheet.

The admin app always writes to the normalized tabs first. If GitHub dispatch-on-save is enabled in
Apps Script script properties, save may then trigger the repo workflow as a dry run or publish
action.

## Delete Flow

1. Load the existing drug in edit mode.
2. Confirm the record is the one you intend to remove.
3. Type the exact current drug `id` in the delete confirmation field.
4. Trigger `Delete drug`.

Delete removes the matching row from `drugs` plus linked rows from `aliases`, `test_entries`, and
`notes`. It does not remove rows from `sources`.

## Failure And Recovery

If save fails with validation errors:

- fix the highlighted field errors in the form
- use the validation summary to catch missing bilingual content, source references, or malformed dilutions
- save again once the banner returns to a non-error state

If save fails because a source id already exists:

- remove the duplicate inline source draft
- switch the affected test to the existing reusable source id instead
- save again

If a drug was deleted by mistake:

- recreate it immediately through `New drug`
- reuse the same `id` only if you are restoring the original record intentionally
- re-enter aliases, applicable tests, notes, and source references
- run `npm run build:dataset` before publishing to ensure the restored rows still satisfy exporter rules

If the admin app cannot access the spreadsheet:

- confirm the Apps Script project is bound to the correct sheet or `SPREADSHEET_ID` is set
- confirm the current user still has spreadsheet access
- reload the web app after fixing project configuration

If the sheet save succeeds but the GitHub workflow trigger fails:

- treat the row changes as saved unless the banner says the sheet write itself failed
- read the returned dispatch error for missing properties, bad token scope, or wrong repo/ref values
- fix the Apps Script script properties and save again only if you want a new workflow run

If the export pipeline rejects sheet data after an admin save:

1. Run `npm run verify:admin-fixture` to confirm the local contract checker is healthy.
2. Run `npm run build:dataset` against the real sheet to get the exact exporter error.
3. Fix the offending row through the admin app when possible.
4. If the error concerns unsupported sheet headers or manual tab edits, repair the sheet structure before retrying.

## Release Handoff

After curation is complete:

1. Run `npm run verify:admin-fixture`.
2. Run `npm run build:dataset`.
3. Run `npm run typecheck`.
4. Review [DATASET_RELEASE.md](/Users/mohamedkhairy/dev/allergolib/DATASET_RELEASE.md:1) and [BETA_READINESS.md](/Users/mohamedkhairy/dev/allergolib/BETA_READINESS.md:1) before promoting a dataset release.
5. If save already triggers a GitHub dry run, review that run before doing a manual publish.

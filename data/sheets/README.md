# Google Sheet Source

The dataset source of truth is now the Google Sheet configured by:

- `GOOGLE_SHEETS_SPREADSHEET_ID`
  Default: `1s2fAK0GokMk7hrWrXu6y4Av5au-cwQR0BND58ERbt9Q`

Expected tab names in that spreadsheet:

- `release_metadata`
- `sources`
- `drugs`
- `aliases`
- `test_entries`
- `notes`

Authentication for `npm run build:dataset`:

- Private sheet:
  - `GOOGLE_SHEETS_CLIENT_EMAIL`
  - `GOOGLE_SHEETS_PRIVATE_KEY`
  - Share the sheet with the service account email as a viewer or editor.
- Public sheet:
  - `GOOGLE_SHEETS_API_KEY`

The build script reads these tabs through the Google Sheets API and generates:

- `src/data/generated/dataset.json`
- `src/data/generated/manifest.json`

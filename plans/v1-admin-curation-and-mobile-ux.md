# V1 Plan: Admin Curation Workflow And Mobile UX Refresh

## Context

This plan defines the next version of the existing app. The goal is to improve the clinician-facing mobile experience for allergologists while adding a practical admin-only workflow for maintaining the medicine dataset.

The current app already:

- ships an offline-first mobile drug reference
- reads curated data from Google Sheets
- exports that sheet into the bundled dataset
- supports bilingual content, source provenance, favorites, and search

This v1 does not introduce clinician editing inside the mobile app. Dataset maintenance remains an admin responsibility.

## Problem Statement

The current app is clinically useful but still feels early in product maturity. The visual design and interaction quality are not yet strong enough for repeated clinical use. Search works, but it is basic and does not feel fast or polished enough for lookup-driven workflows. Drug listing and navigation do not yet feel modern or intentionally designed for mobile clinical reference.

At the same time, the current data maintenance model is centered on spreadsheet tabs. That is workable for engineering and structured export, but it is not a natural editing experience for a single admin who needs to add or modify drugs, test entries, notes, aliases, and sources quickly while preserving validation quality.

## Solution

Deliver a focused v1 in two parts:

1. Redesign the mobile app around a cleaner, more clinical, minimal interface inspired by the general product qualities of Doctolib: reduced visual noise, stronger hierarchy, clearer spacing, and faster task completion.
2. Add a desktop-first admin curation workflow as a single guided form layered on top of the existing Google Sheets source of truth.

The admin workflow will not be built as a plain Google Form. Instead, it will be implemented as a Google Apps Script web app backed by the existing spreadsheet tabs. This preserves the current export pipeline while providing a real edit experience, structured validation, and safer handling of existing records.

## User Stories

1. As an allergologist, I want the app to open directly into search, so that I can reach a drug with minimal friction.
2. As an allergologist, I want search results to prioritize exact and prefix matches, so that the most likely drug appears first.
3. As an allergologist, I want typo-tolerant lookup, so that imperfect spelling still gets me to the right drug.
4. As an allergologist, I want autocomplete to react quickly while typing, so that I can identify a drug before finishing the full term.
5. As an allergologist, I want a cleaner and more minimal interface, so that the app feels trustworthy and easier to scan in clinical use.
6. As an allergologist, I want favorites to live in their own tab, so that common drugs are easier to reopen.
7. As an allergologist, I want recent searches available from the empty search state, so that repeated lookups are faster.
8. As an allergologist, I want French to be the default language while keeping language switching visible on the main screen, so that the app better reflects primary usage.
9. As an allergologist, I want a dedicated Info tab, so that informational context and app framing do not compete with search.
10. As an allergologist, I want drug details on a separate screen, so that I can focus on one medicine at a time.
11. As an admin, I want one natural desktop form to create a new drug, so that I do not have to manually manipulate multiple spreadsheet tabs.
12. As an admin, I want to search by drug name or id before editing, so that I can quickly load the right existing medicine.
13. As an admin, I want the form to support both creating new entries and editing existing ones, so that all dataset maintenance happens in one place.
14. As an admin, I want to manage sources in the same flow, so that a test entry can be completed without switching tools.
15. As an admin, I want to reuse an existing source or create a new one inline, so that I can move quickly when curating.
16. As an admin, I want French and English to be required for all clinical text, with French treated as the primary content path, so that the bilingual dataset remains complete.
17. As an admin, I want strict validation before save, so that malformed rows never enter the structured sheet.
18. As an admin, I want only test types that exist for a drug to be entered, so that the form stays fast and avoids unnecessary noise.
19. As an admin, I want save to update the sheet only, so that publication remains a separate controlled step.
20. As an admin, I want immediate delete with typed confirmation, so that I can remove incorrect entries without an approval queue.

## Admin Workflow Options

### Option A: Plain Google Form

Pros:

- very fast to set up
- familiar to non-technical users
- low maintenance

Cons:

- poor fit for editing existing relational data
- weak handling of multiple linked entities such as aliases, tests, notes, and sources
- awkward hard-delete behavior
- difficult to keep responses synchronized with normalized tabs
- validation can be improved, but still remains limited

Conclusion:

Good for intake. Weak for true maintenance.

### Option B: Google Apps Script Web App Backed By Google Sheets

Pros:

- keeps Google Sheets as the source of truth
- provides one natural desktop form
- can search existing drugs by id or name
- can load and edit a drug across all linked tabs
- can perform strict validation before write
- can support inline source creation and source reuse
- can handle typed-confirm deletion
- avoids introducing separate hosting infrastructure

Cons:

- more setup than a plain form
- UI flexibility is moderate compared with a custom web app

Conclusion:

Best v1 fit.

### Option C: Small Internal Admin Web App

Pros:

- best long-term UX and extensibility
- strongest control over validation and workflows
- easiest to evolve into richer admin capabilities later

Cons:

- introduces deployment, auth, hosting, and maintenance overhead
- larger build surface than needed for one admin in v1

Conclusion:

Strong later option, but unnecessary for v1.

### Decision

Build the admin maintenance workflow as a Google Apps Script web app on top of the current spreadsheet tabs.

## Implementation Decisions

- Mobile remains the only product surface for clinicians.
- Admin curation is desktop-first.
- Clinicians do not edit data in-app.
- Google Sheets remains the dataset source of truth.
- The existing export pipeline remains the publication boundary.
- Save in the admin tool updates the sheet only. It does not publish a dataset automatically.
- The admin tool supports create, edit, and delete for drugs.
- Delete is permanent and requires typed confirmation.
- The admin tool must support searching for existing drugs by both `id` and localized name.
- The admin tool must support both reusing an existing source and creating a new source inline.
- French and English are mandatory for all localized content, and French is treated as the primary authoring path.
- A drug cannot be saved unless it includes at least one alias, at least one test entry, and at least one source.
- Only existing test types are entered for a given drug. Empty unused test sections are not required.
- The mobile app opens into search first.
- The mobile app uses three top-level tabs: `Search`, `Favorites`, and `Info`.
- Search ranking prioritizes exact match, then prefix match, then strong fuzzy/typo-tolerant candidates.
- Drug detail remains a separate screen.
- Language switching remains visible on the main screen, with French as the default language.
- The app should stay simple and clean. No in-app settings or configuration surface is introduced in v1.

## Functional Scope

### Mobile App

- Search-first landing experience
- New tab structure: Search, Favorites, Info
- Default language set to French
- Visible main-screen language switcher
- Better autocomplete behavior
- Better ranking for exact and prefix matches
- Typo tolerance in search
- Improved visual design system for cards, typography, spacing, and hierarchy
- Modernized drug list presentation
- Cleaner detail screen hierarchy and presentation
- Recent searches in the empty search state

### Admin Curation Tool

- Search existing drug by name or id
- Create new drug
- Edit existing drug
- Delete existing drug with typed confirmation
- Edit localized drug name and class name
- Manage aliases
- Manage only the applicable test types
- Manage test concentrations, max concentrations, dilutions, vehicles, and notes
- Manage note kinds: `info`, `warning`, `cross-reactivity`
- Reuse an existing source from a searchable list
- Create a new source inline
- Validate all required bilingual fields before save
- Write structured updates into `drugs`, `aliases`, `test_entries`, `notes`, and `sources`

## Proposed Admin Form Shape

The admin experience should behave as one guided desktop form with these sections:

1. Lookup
   Search existing drug by id or name, or choose to create a new drug.

2. Core Drug Info
   Drug id, French name, English name, French class name, English class name.

3. Aliases
   Repeatable alias list. At least one required.

4. Applicable Test Types
   Choose which of `prick`, `idr`, and `patch` exist for this drug.

5. Test Sections
   One structured block per selected test type:
   concentration, max concentration, dilution list, optional bilingual vehicle, preferred source, optional alternate source.

6. Notes
   Repeatable note blocks attached to a selected test type, with bilingual content and note kind.

7. Sources
   Reuse an existing source or add a new source inline with required bilingual metadata.

8. Review
   Validation summary and save action.

9. Delete
   Separate destructive section for permanent delete with typed confirmation.

## Data Model Mapping

The current schema remains the baseline:

- `drugs`
  One row per drug core record.

- `aliases`
  One row per alias linked by `drug_id`.

- `test_entries`
  One row per applicable test kind linked by `drug_id`.

- `notes`
  One row per note linked by `drug_id` and `test_kind`.

- `sources`
  Reused source records referenced by `source_id` and `alternate_source_id`.

The admin app should write to these normalized tabs instead of inventing a second storage model.

## Search UX Direction

The current search scores exact, prefix, and substring matches, but does not yet handle typo tolerance and still feels like a raw searchable list. V1 should move to a search-first clinical lookup experience:

- search input is the primary hero element on launch
- autocomplete updates quickly as the user types
- ranking prioritizes exact and prefix matches
- typo tolerance covers common single-edit misspellings and accent-insensitive matching
- results show stronger hierarchy: drug name, class, and compact match context
- recent searches appear when query is empty
- favorites remain accessible in a dedicated tab, not mixed into the search surface

## Visual Direction

The interface should move toward a more clinical and minimal product language:

- restrained medical-blue dominant palette
- warmer neutral backgrounds instead of flat harsh white
- clearer card boundaries with soft elevation
- larger spacing rhythm and stronger section separation
- more deliberate typography hierarchy
- fewer competing labels on a single screen
- cleaner segmentation between validated data, warnings, notes, and provenance

The aim is not to copy Doctolib directly, but to match its general qualities of clarity, calmness, and professional polish.

## Phased Implementation Plan

## Phase 1: UX And Information Architecture Refresh

Goal:
Reshape the mobile app around the new top-level experience without changing the clinical dataset model.

Build:

- introduce top-level tabs: Search, Favorites, Info
- make Search the default landing tab
- set French as default language
- keep visible language switching on the main screen
- move non-search framing content out of the search flow and into Info where appropriate
- introduce empty-state recent searches
- redesign layout primitives, spacing, cards, and section hierarchy

Acceptance criteria:

- app opens on Search by default
- Favorites and Info are reachable in one tap
- French is the default language on first launch
- recent searches appear when query is empty
- overall visual hierarchy is measurably cleaner than the current home/search composition

## Phase 2: Search Engine Upgrade

Goal:
Make search materially faster and more reliable for clinical lookup.

Build:

- keep current exact and prefix ranking strengths
- add typo tolerance on top of accent-insensitive matching
- refine ranking across name, alias, id, and class
- tune autocomplete responsiveness and result ordering
- improve result-card design for quick scanning

Acceptance criteria:

- exact matches appear before prefix matches
- prefix matches appear before weaker fuzzy matches
- common misspellings still return the intended drug
- results remain fast enough for mobile typing
- autocomplete feels immediate on a typical device

## Phase 3: Detail Screen Modernization

Goal:
Improve the readability and trustworthiness of drug detail presentation.

Build:

- redesign detail header and tab controls
- tighten grouping of concentrations, dilutions, notes, warnings, and sources
- improve readability of provenance and note sections
- preserve separate detail-screen navigation

Acceptance criteria:

- detail screen is easier to scan than the current version
- validated data, warnings, and notes are visually distinct
- source provenance remains visible and understandable

## Phase 4: Admin Curation App Skeleton

Goal:
Stand up the desktop-first admin workflow on Google Apps Script without changing the export contract.

Build:

- Apps Script web app shell
- spreadsheet access layer
- lookup by drug id or name
- load existing drug across normalized tabs
- create mode and edit mode
- save to sheet only

Acceptance criteria:

- admin can find an existing drug by id or name
- admin can load a drug into one unified form
- admin can create a new drug and write it into the expected tabs
- existing dataset export still works after admin-created records

## Phase 5: Admin Validation, Sources, And Delete

Goal:
Make the admin tool safe and practical for real maintenance.

Build:

- strict required-field validation
- enforce bilingual localized fields
- enforce at least one alias, one test entry, and one source before save
- inline source creation
- existing source reuse
- typed-confirm permanent delete
- field-level and form-level validation messaging

Acceptance criteria:

- incomplete drugs cannot be saved
- malformed dilution values cannot be saved
- source references remain valid across linked rows
- delete removes the drug and linked child rows only after typed confirmation

## Phase 6: Workflow Hardening And Documentation

Goal:
Make the new curation flow operationally usable.

Build:

- document admin usage flow
- document failure and recovery paths
- verify export compatibility with admin-generated sheet data
- verify clinician-facing flows after UI/search overhaul

Acceptance criteria:

- one admin can maintain the dataset without direct tab editing in normal cases
- the dataset export pipeline accepts valid admin-written rows
- the clinician app remains stable after the redesign

## Testing Decisions

- Prefer testing external behavior over implementation details.
- Search tests should validate ranking behavior, accent normalization, and typo tolerance.
- Admin workflow tests should validate normalized writes into sheet-backed structures rather than UI implementation details alone.
- Dataset export validation remains a critical guardrail and should continue to reject malformed curated content.
- Good tests in this area prove:
  - required bilingual fields are enforced
  - drugs cannot be saved without alias, source, and at least one test entry
  - delete removes the expected linked records only
  - search ordering behaves as specified
  - mobile empty states and tab flows remain coherent

## Out Of Scope

- clinician editing inside the mobile app
- automatic publish-to-dataset on admin save
- multi-admin collaboration workflows
- approval queues
- rollback/version history UI
- authentication redesign beyond what is needed for the admin surface
- web or tablet clinician product beyond the admin desktop workflow
- app settings or configuration screens
- patient data, EHR integration, or decision support

## Risks And Tradeoffs

- Google Apps Script is the right size for v1, but it is still less flexible than a custom internal admin app.
- Permanent delete is simple, but it increases recovery risk without archival safeguards.
- One guided form is good for speed, but the form must be carefully sectioned to avoid becoming too long.
- French-first authoring reduces ambiguity for the main audience, but bilingual strictness increases admin effort.

## Recommended Next Step

Start with Phase 1 and Phase 2 in the mobile app, while defining the exact spreadsheet write contract for the Apps Script admin tool in parallel. The highest-value early milestone is a redesigned search-first mobile experience plus a working admin create/edit flow that writes valid rows into the current sheet model.

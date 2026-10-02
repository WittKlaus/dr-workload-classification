# Architecture

`DR_Workload_Classification.html` is a single file on purpose: it has to run from a USB stick in a
customer meeting room, with no installation and no network. This page is the map for anyone who
wants to read, review or change it.

## How the file is built

The deliverable is one HTML document with embedded CSS and 20 `<script>` blocks. It is assembled by
`tools/build.mjs` from these sources:

| Source | Becomes |
|---|---|
| `src/index.html` | the page: head, markup of all tabs and dialogs, one `/* @include … */` marker per block |
| `src/styles.css` | the `<style>` block |
| `src/app/NN-*.js` | application blocks 4–15 and 17–20, one file each, `NN` = block number = load order |
| `vendor/*.js` | blocks 1–3 and 16, the libraries SheetJS, Chart.js, D3 and fflate, unmodified |
| `Outputs/DR_Workload_Classification_Tool (template).xlsx` | the base64 string `TEMPLATE_XLSX_B64` in block 17 |

The build replaces each marker with the file's bytes and the `/* @base64 … */` marker with the encoded
template. Nothing else is transformed, so a line in `src/app/` is the line that runs in the browser.
`dist/DR_Workload_Classification.html` is committed and must equal the build output; CI checks this.
Edit the sources, never `dist/`.

Every application file starts with a header comment (`BLOCK n · …`) that states its purpose, what it
depends on and which functions it provides. Top-level code of a block runs when the browser parses it.
A block may therefore only *call* later blocks at runtime (event handlers, renders), which is why a few
places guard with `typeof fn === 'function'`.

## Block map

| # | File | Area | Entry points |
|---|---|---|---|
| 4 | `src/app/04-core.js` | Core: language helper, version and release notes, tier model, scoring, view-only Excel import | `tr()`, `TOOL_VERSION`, `CHANGELOG`, `tierColor()`, `classifyScore()`, `parseWorkloadRows()` |
| 5 | `src/app/05-view-overview.js` | Tab 2 view: KPIs, chart, register | `renderAll()`, `escapeHtml()` |
| 6 | `src/app/06-view-findings.js` | Tab 2 findings and recommendations | `computeFindings()`, `renderFindings()` |
| 7 | `src/app/07-view-network.js` | Tab 2 dependency network | `renderGraph()` |
| 8 | `src/app/08-tabs.js` | Tab switching | tab buttons, `setViewSourceNote()` |
| 9 | `src/app/09-options-panel.js` | Tab 1 options panel | `renderOptionsTable()` |
| 10 | `src/app/10-import.js` | Tab 1 import | `TARGET_FIELDS`, `classifyImportRows()`, `applyMappingFromUI()`, `commitImport()` |
| 11 | `src/app/11-assessment-table.js` | Tab 1 assessment table | `renderCollectTable()`, `resolveDepsText()`, `deleteItems()` |
| 12 | `src/app/12-persistence.js` | Persistence | `snapshotState()`, `restoreState()`, `sanitizeProgressData()`, `confirmVersionCompat()` |
| 13 | `src/app/13-export-model.js` | Excel export model, tab bridge | `buildWorkloadRegisterSheet()`, `exportPlainXlsx()`, `buildViewItemsFromCollect()` |
| 14 | `src/app/14-validation.js` | Validation against the source file (same pipeline as the import, source-aware, tombstones) | `handleValidateFile()`, `runValidation()` |
| 15 | `src/app/15-runbook.js` | Tab 3 runbook planning | `computeRunbookStructure()`, `renderRunbookTab()` |
| 17 | `src/app/17-excel-export.js` | Formatted Excel export | `exportViaTemplate()` |
| 18 | `src/app/18-prequalification.js` | Prequalification assistant | `defaultPrequalRules()`, `prequalDetect()`, `prequalOpenWizard()` |
| 19 | `src/app/19-settings-shell.js` | Settings and UX shell | `applyTheme()`, `openFeedback()`, `showRuntimeError()`, `openWelcome()` |
| 20 | `src/app/20-i18n-about.js` | Internationalization, About | `STATIC_I18N`, `applyLanguage()`, `renderAboutChangelog()` |
| 1–3, 16 | `vendor/` | SheetJS, Chart.js, D3, fflate | see [vendor/README.md](vendor/README.md) |

## Data flow

```
inventory file ──► block 10  classifyImportRows()  ──► collectState.items  (tab 1, block 11)
                                                            │
                     autosave / progress JSON  ◄── block 12 ┼──► block 13  buildViewItemsFromCollect()
                     (sanitizeProgressData on load)         │              │
                                                            │              ├──► tab 2: KPIs, findings, graph (5–7)
                                                            │              └──► tab 3: runbook groups (15)
                                                            └──► Excel export: block 13 (model) → block 17 (template patch)
```

`collectState.items` is the single source of truth while the tool runs. Tab 2 and tab 3 are derived
views; the Excel export and the progress file are serializations of the same state.

## The methodology in code

- Score = BI × 0.45 + Reg × 0.35 + DS × 0.20 (`computeScore`). Weights are fixed.
- Thresholds (default 4.3 / 3.5 / 2.5) and target RPO/RTO are data in `SCORE_THRESHOLDS` and
  `CLASS_DEFS`, editable in the options panel and stored with the progress file.
- Recovery complexity (`rk`) is captured but never part of the score.
- `foundational === 'Ja'` forces Tier 0; `outOfScope` overrides everything (`effectiveClass`).
- Dependencies are stored as free text (`depsText`, IDs or names) and resolved by name at render time
  (`resolveDepsText`); "required by" is always derived, never stored.

## Stable keys — do not rename

These strings are part of every saved progress file and of the Excel schema. Renaming them breaks
re-import of files that customers already have:

- Tier keys: `Tier 0 – Foundation` … `Tier 4 – Bronze` (with an en dash, U+2013)
- `OUT_OF_SCOPE_CLASS = "Out of Scope – kein Backup"`
- Item field names: `istRpo`, `istRto`, `clsOverride`, `depsText`, `foundational` (`'Ja'`/`'Nein'`), `source`, …
- Progress-file sections: `items`, `classDefs`, `scoreThresholds`, `tierLabels`, `runbook*`, `prequalRules`, `prequalEnv`, `deletedTombstones`
- Export sheet names (Instructions, Class-Matrix, Workload-Register, Dashboard, Runbook-Plan) and the
  first 18 columns (A–R) of the Workload-Register sheet; new columns are appended only.

Some of these are German for historical reasons. Display names are separate (`TIER_LABELS`, `tr()`),
so the UI can say whatever the customer prefers while the keys stay put.

## Untrusted input

Everything the user loads is treated as untrusted:

- `sanitizeProgressData()` (block 12) gives every field of a progress file a fixed type, drops unknown
  fields, reassigns duplicate IDs and ignores prototype-pollution keys.
- `confirmVersionCompat()` asks before loading a file written by a newer tool version.
- `classifyImportRows()` (block 10) coerces imported cells; `parseWorkloadRows()` coerces the ID column
  of the view-only Excel import.
- Every render path escapes with `escapeHtml()`; the template export escapes XML with `xmlEsc()`.

## Internationalization

- `tr(de, en)` for dynamic text with variables.
- `STATIC_I18N` for static HTML and variable-free dynamic text. The key is the exact,
  whitespace-normalized German text; `applyLanguage()` re-renders the dynamic views on a switch.
- Data is English regardless of UI language: export file names, sheet names, note markers
  (`[Auto proposal …]`), catalog labels, release notes.

## Persistence

- Autosave to `localStorage` (`dr_workload_collect_autosave_v2`) 600 ms after every edit.
- Progress file = `snapshotState()` as JSON, including rules and options. Loaded through
  `restoreState()` → `sanitizeProgressData()`.
- Device settings (theme, hidden columns, welcome acknowledgement) live in
  `localStorage` only and are never part of the progress file.

Adding state means touching three functions: `snapshotState`, `restoreState` and
`sanitizeProgressData`. A field missing from the sanitizer is silently dropped on load.

## Verifying a change

1. Syntax: `node --check` on every file in `src/app/`, then `node tools/build.mjs`.
2. Logic: the pure functions (`classifyImportRows`, `sanitizeProgressData`, `removeItemsFromState`,
   `computeRunbookStructure`, …) can be extracted from `src/app/` and executed in Node against the files in
   `Examples/`. Expected numbers for the example imports: RVTools 210 → 199 workloads, 2,000 → 1,992,
   5,000 → 4,985; Veeam ONE vSphere report → 238 workloads, 63 replicas, 15 structural rows skipped;
   Hyper-V report → 12 workloads, 18 replicas, 1 section row.
3. Browser: load the file, import an example, walk through all three tabs, export.
4. i18n: a new static German text needs a dictionary entry; a new `getElementById` needs its element.

## Why a concatenating build and not modules or a bundler?

The single file is the deliverable: it must open from a USB stick, without a server and without network
access. A plain concatenation keeps that trivially true, keeps the shipped code identical to the source
lines, and needs no toolchain beyond Node. Splitting the application into ES modules is possible later,
but it would change load order and global scope, so it is a separate, deliberate step.

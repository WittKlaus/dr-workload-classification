# Architecture

`DR_Workload_Classification.html` is a single file on purpose: it has to run from a USB stick in a
customer meeting room, with no installation and no network. This page is the map for anyone who
wants to read, review or change it.

## How the file is built

One HTML document with embedded CSS and 20 `<script>` blocks. Blocks 1–3 and 16 are the unmodified,
minified libraries (SheetJS, Chart.js, D3, fflate) with their license banners. Blocks 4–15 and 17–20
are the application. Every application block starts with a header comment (`BLOCK n · …`) that
states its purpose, what it depends on and which functions it provides. A source map at the top of
the file lists all blocks.

Top-level code of a block runs when the browser parses it. A block may therefore only *call* later
blocks at runtime (event handlers, renders), which is why a few places guard with
`typeof fn === 'function'`.

## Block map

| # | Area | Entry points |
|---|---|---|
| 4 | Core: language helper, version and release notes, tier model, scoring, view-only Excel import | `tr()`, `TOOL_VERSION`, `CHANGELOG`, `tierColor()`, `classifyScore()`, `parseWorkloadRows()` |
| 5 | Tab 2 view: KPIs, chart, register | `renderAll()`, `escapeHtml()` |
| 6 | Tab 2 findings and recommendations | `computeFindings()`, `renderFindings()` |
| 7 | Tab 2 dependency network | `renderGraph()` |
| 8 | Tab switching | tab buttons, `setViewSourceNote()` |
| 9 | Tab 1 options panel | `renderOptionsTable()` |
| 10 | Tab 1 import | `TARGET_FIELDS`, `classifyImportRows()`, `applyMappingFromUI()`, `commitImport()` |
| 11 | Tab 1 assessment table | `renderCollectTable()`, `resolveDepsText()`, `deleteItems()` |
| 12 | Persistence | `snapshotState()`, `restoreState()`, `sanitizeProgressData()`, `confirmVersionCompat()` |
| 13 | Excel export model, tab bridge | `buildWorkloadRegisterSheet()`, `exportPlainXlsx()`, `buildViewItemsFromCollect()` |
| 14 | Validation against the source file (same pipeline as the import, source-aware, tombstones) | `handleValidateFile()`, `runValidation()` |
| 15 | Tab 3 runbook planning | `computeRunbookStructure()`, `renderRunbookTab()` |
| 17 | Formatted Excel export | `exportViaTemplate()` |
| 18 | Prequalification assistant | `defaultPrequalRules()`, `prequalDetect()`, `prequalOpenWizard()` |
| 19 | Settings and UX shell | `applyTheme()`, `openFeedback()`, `showRuntimeError()`, `openWelcome()` |
| 20 | Internationalization, About | `STATIC_I18N`, `applyLanguage()`, `renderAboutChangelog()` |

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

1. Syntax: extract every `<script>` block and run `node --check` on each.
2. Logic: the pure functions (`classifyImportRows`, `sanitizeProgressData`, `removeItemsFromState`,
   `computeRunbookStructure`, …) can be extracted by regex and executed in Node against the files in
   `Examples/`. Expected numbers for the example imports: RVTools 210 → 203 workloads, 2,000 → 1,993,
   5,000 → 4,986; Veeam ONE vSphere report → 238 workloads, 63 replicas, 15 structural rows skipped.
3. Browser: load the file, import an example, walk through all three tabs, export.
4. i18n: a new static German text needs a dictionary entry; a new `getElementById` needs its element.

## Why not modules and a build step?

Contributors would expect it, and it is on the roadmap. Today the single file is the deliverable and
the source at the same time, which keeps the offline promise trivially true and lets a reviewer read
exactly what runs. The block headers and this page are the compromise until a build step exists.

# Changelog

All notable changes to this project are documented here.

---

## [Unreleased]
- Backlog (next): bulk-edit "Depends on" for a selection, editable Excel re-import into tab ①,
  recovery-plan type per runbook group

## [2026-09-28] — v0.16.0-beta
One tier palette for everyone, bulk edit for dependencies, a readable dependency network, and validation results that stay reachable.

- One tier palette for everyone: the Okabe-Ito colours (until now the optional colorblind palette) are the only
  palette, with lightened variants in dark mode. Foundation (near-black) and Silver (bluish green) can no longer
  be confused, and the colorblind switch in the options menu is gone — there is nothing left to switch. Weaker-
  dependency edges in the network are vermilion instead of orange so they do not collide with Gold
- Bulk edit: "Depends on" for all selected rows with the modes add / replace / remove. IDs are resolved
  to names exactly like in the table cell (on leaving the field), names are matched case-insensitively and
  written in their canonical spelling, a selected row never gets itself as a dependency, and an unknown
  entry stops the whole action before anything changes
- Dependency network: arrowheads are larger and darker and the edge now ends at the node's edge, so the
  direction (arrow = depends on) is visible for every node size; weaker-dependency edges carry an orange
  arrowhead. Hovering a workload highlights what it depends on (solid) and what requires it (dashed),
  fades everything else and the tooltip shows both counts; the legend explains arrow and hover

- The coverage line's badges become buttons for every source file validated in this session; a click shows
  that source's result. The result is always recomputed against the current list, never shown from a cache.
  A "Re-check" button next to the legend re-runs all validated sources after edits, without uploading again
- The ✅/⚠ marks of all validated sources are recomputed on every validation run, so a workload deleted
  after a green check is visible immediately. A mark reflects deviations against the file only (missing,
  extra, field values); the internal consistency check (duplicates, unnamed rows, unresolvable
  dependencies) is still reported but no longer flips a source's mark
- Session only by design: the parsed files and the marks are not written to the progress file

## [2026-09-28] — v0.15.0-beta
Validation against the source file rebuilt for multi-source assessments.

- The source file is read through the same pipeline as the import (CSV encoding sniff, best sheet,
  header-row detection, the three import filters with their current settings, size unit from the
  column name). Rows the import skips — templates, SRM placeholders, vSphere system VMs, structural
  rows, replicas — are reported as skipped, never as missing
- Source-aware comparison: a file is compared only against the workloads that carry it as their
  source (`item.source`); workloads from other sources are listed as coverage, not as extras. Several
  files can be validated one after another; the coverage line marks each validated source. States
  without source information fall back to the whole list and say so
- Deleted workloads are remembered (name, source, time) and reported as "deliberately deleted"
  instead of "missing"; undo or re-import clears the marker. The markers are saved with the progress
  file and type-checked on load
- Severities: skipped and deleted are notes, truly missing or extra workloads and field deviations
  are warnings; a "Import missing workloads" button adds the missing ones through the normal import
  path

## [2026-09-28] — v0.14.2-beta
Import filter for vSphere system VMs and a readability pass over the source. No change to the
assessment logic.

- Import: vSphere system VMs are excluded together with templates and SRM placeholders — vCLS
  (`vCLS-<uuid>`, `vCLS (n)`) and the Supervisor control plane VMs of vSphere with Tanzu
  (`SupervisorControlPlaneVM`, legacy `stCtlVM`). They are managed by vCenter and are never workloads
  to protect; the count is shown in the import summary. Switching the checkbox off restores the
  previous behaviour
- Source readability: every comment in the file is English; each of the 16 application script blocks
  starts with a header stating purpose, dependencies and entry points; a source map at the top of
  the file lists all blocks; `ARCHITECTURE.md` documents the structure, data flow, stable keys and
  how to verify a change. Identifiers and stored field names are unchanged on purpose (progress files
  and Excel exports of earlier versions keep working)
- README: screenshots of the import step, assessment table, dependency network, overview and runbook
  groups (light and dark mode); example TEST_C now carries English class-definition texts
- Backlog (next): bulk-edit "Depends on" for a selection, editable Excel re-import into tab ①,
  recovery-plan type per runbook group, tags/custom attributes and vNetwork as inventory signals

## [2026-09-22] — v0.14.1-beta
Public build for the open-source release. No functional changes to the assessment.

- Feedback now goes to GitHub Issues: "Report issue" (status bar, ⚙ menu, welcome dialog, error banner)
  opens a prefilled issue form in a new tab; no mail address remains in the tool
- Top bar shows the tool's own icon instead of a vendor logo; the sender line reads "Community project"
- Disclaimer (welcome dialog and About) states the community-project status explicitly: created by a
  Veeam Technical Account Manager, shared under the MIT license, not created by Veeam R&D, not validated
  by Veeam QA, not part of the Veeam product portfolio, not covered by Veeam Support
- About: owner line links to the public repository (source code, license, releases)
- Examples: RVTools test exports re-generated without lab remnants (host/vCenter domain, license keys,
  vCenter UUID replaced); anonymized Veeam ONE reports added

## [2026-09-21] — v0.14.0-beta
Delete workloads, and a clean import of hierarchical reports (Veeam ONE "VMs Configuration").

- Delete workloads: ✕ per row in the # column and "Delete selected" in bulk edit; confirmation
  with count and name preview; one-step undo (session); dependency references (IDs or names) of
  other workloads to the deleted systems are removed and counted — names only when no surviving
  workload carries the same name; IDs are never reused
- Import: structural rows of hierarchical reports are skipped and counted — repeated header rows,
  cluster/host subtotals (numeric VM counter in the name column with all other text fields
  empty) and section headers ("vCenter Server:", "Cluster:", "SCVMM:" …). On the real Veeam ONE
  "VMs Configuration" report (vSphere) this removes 15 structural rows that previously appeared
  as phantom workloads such as "51" or "VM Name"; flat sources (RVTools, CSV, synthetic reports)
  are unaffected
- Import: cluster/host names from those section rows are inherited as "Location/cluster" for the
  VMs below (Veeam ONE reports carry the host only in the subtotal line); a Veeam ONE report is
  recognized and named in the import summary
- Import: Veeam replicas (name suffix "_replica", also "_replica_001") are excluded by default
  like templates/SRM placeholders — DR copies are not workloads to classify; new checkbox,
  counted in the summary
- Both new import filters are checkboxes in the mapping step (default on); switching them off
  restores the previous behaviour exactly
- About: "What's new & history" moved to the end and shows only the current release; older
  entries open via "Show version history" — the disclaimer part is readable without scrolling
- Claude skill package rebuilt with the current HTML as asset

## [2026-09-18] — v0.13.0-beta
Field/MVP feedback round: column chooser, graph layout switch, in-tool release notes, library
security update.

- Tab ① "Columns" panel: hide the columns you do not need; a device setting (browser storage,
  like dark mode), not part of the progress file; #, name and protection class always stay
  visible; presets "Assessment only" and "Show all"
- Dependency graph: new "Layout" selector — automatic (animated up to 600 nodes, static above),
  or forced animated/static; a live note shows the active mode and node count (the static mode
  above 600 nodes had been introduced in v0.9.1 for performance and could look "stiff")
- "What's new": full release history in the About dialog (latest entry expanded) and the latest
  release in the "Before you begin" dialog; About now lists the live versions of the embedded
  libraries
- Security: SheetJS Community Edition updated 0.18.5 → 0.20.3 (fixes CVE-2023-30533 prototype
  pollution and CVE-2024-22363 ReDoS in file parsing). Parse regression over all example files
  identical; imports are roughly twice as fast with about a third of the memory. Library versions
  are checked against published advisories before each release
- Examples: new `Progress_JSONs/DR_Assessment_Progress_TEST_E_1993_newer_tool_version.json` —
  a progress file stamped with a newer tool version to exercise the version guard (see v0.12.1)
- Repo: the Claude skill package now carries the current HTML and workbook as assets; example
  workbooks in Outputs/ and Examples/ were re-synced from the maintainer's working copies
  (cell-for-cell identical; the SharePoint library adds document properties to Office files on
  upload, so file hashes differ by design)

## [2026-09-18] — v0.12.1-beta
Hardening round after a code review (input trust, error visibility, privacy note).

- Progress JSON and autosave are type-checked on load: IDs become positive integers, scales 1–5,
  class overrides only known tier keys, texts bounded, unknown fields dropped; duplicate or
  missing IDs are reassigned; the Excel view import coerces the ID column
- Version guard: loading a progress file (or autosave) written by a NEWER tool version asks for
  confirmation, because fields unknown to this build would be lost and overwritten by the next
  autosave/export
- Runtime-error banner: uncaught errors and unhandled promise rejections surface visibly with a
  short message, a hint to save progress as JSON, and a "Report error" button (mailto with the
  error text prefilled)
- Formatted Excel export strips XML-invalid control characters from cell values (Excel would
  otherwise offer to "repair" the file)
- About → Privacy & Runtime: new note on autosave persistence in browser storage and on loading
  files from unknown sources; `<html lang>` follows the UI language

## [2026-09-02] — v0.12.0-beta
Multi-source import (validated against real Veeam ONE reports), service owners, export fixes,
VRO field knowledge, UI polish.

- Multi-source import hardened: importing several sources one after another now has a duplicate
  dialog on name collisions (skip / fill empty fields of existing workloads / add anyway), every
  workload remembers its source (tooltip on the name, new export column V "Source"), and CSV
  encoding is sniffed (UTF-8 with/without BOM, cp1252)
- Header-row detection + manual "header row is row N" picker: report exports with cover/title
  blocks map correctly now; sheet-picker heuristic skips cover sheets automatically
- Size unit detected from the column name (MiB/MB and TB/TiB converted to GiB, GB/GiB unchanged) —
  fixes silently wrong sizes for non-RVTools sources
- Veeam ONE validated with real v13 reports: the recommended report is "VMs Configuration"
  (vSphere AND Hyper-V — Hyper-V import thereby validated); the "Inventory" report is a
  property-list format and unsuitable (documented in the import description). ServiceNow/CSV
  mappings extended (location, class, assigned to, business service)
- Tab ③ service owners: each runbook group can carry a service-level owner/responsible/email —
  a separate layer next to the per-VM owners, saved with progress, shown in the runbook-plan
  export; optional write-back to the workload list (empty fields only / overwrite / none)
- Excel export fixes: dashboard counts and chart now carry fresh cached values (correct numbers
  even before recalculation) and use wildcard COUNTIF (counts manually overridden classes too);
  Class-Matrix sheet now receives the live thresholds and target RPO/RTO/configuration from the
  options (previously exported stale template defaults); runbook-plan sheet is now formatted
  (header bands, borders, column widths)
- Tab ③ readability: groups are now clearly separated cards with a header band, a numbered chip
  and a left accent bar in the tier color of the weakest link (the class that determines the
  achievable plan RTO); consistent in dark/colorblind modes
- New foundation guidance in tab ③: collapsible note "Foundation in a DR event vs. in a DataLab
  test" (own recovery plan first vs. lab group as test infrastructure, incl. the "Prepare VM as
  Domain Controller" step) plus a curated "VRO field knowledge & sources (FAQ)" panel with
  official links; foundation wording unified across card text, checkbox and badges
- UI: top bar and tab navigation stay fixed while scrolling; switching tabs always starts at the
  top of the view
- "Before you begin" now shows on every start by default; a "remember my decision" checkbox lets
  users opt out until the next release; the modal can be reopened any time from the ⚙ menu
- Default language is now English (incl. the disclaimer); German remains available via DE|EN and
  is remembered
- Examples/ restructured into subfolders: RVTools/, Progress_JSONs/, CMDB_CSV/ (new: synthetic
  ServiceNow + German semicolon-CSV test data), VeeamONE/ (real "VMs Configuration" reports for
  vSphere and Hyper-V from the demo lab, plus a synthetic report test file), and
  Manual_Workbook/ (the two filled Northwind examples of the manual-entry workbook)

## [2026-08-05] — v0.11.0-beta
UX round: onboarding, settings menu, themes, feedback channel.

- New "Before you begin" modal: beta status, disclaimer summary, offline promise and a feedback
  contact — shown once per browser and once again after each new release (acknowledged version is
  remembered); replaces the permanent beta banner in the page body
- New ⚙ options menu in the top bar: dark mode, colorblind mode, feedback, About, and "start over"
  (moved out of the top bar — destructive action no longer one accidental click away)
- Dark mode: full variable-based theme (surfaces, tables incl. sticky columns, dependency graph,
  charts, native widgets via color-scheme); dark tier colors are auto-lightened for contrast;
  input fields switch to dark surface with light text; print output always stays light
- Colorblind mode: Okabe-Ito tier color palette, one switch re-renders all views; both modes are
  device settings (localStorage), deliberately not part of the progress JSON
- "Report issue / feedback" in the status bar, the options menu and the welcome modal: opens the
  local mail client (mailto — offline-safe) with prefilled subject (incl. version) and body
  template (what happened, steps to reproduce, version/language/browser)
- About consolidated from three entry points to two (options menu + status bar)
- A small easter egg is hiding somewhere in the status bar
- Fix: six render paths (KPIs, chart bars, graph legend, tier chips, options table, filter chips)
  read tier colors directly from the palette map and bypassed theme adjustment — now unified
  through tierColor()

## [2026-08-05] — v0.10.0-beta
New: rule-based prequalification assistant ("auto-prequalify") — an optional accelerator for the
assessment, proposed by TAM field feedback. Proposals, never results: nothing is set without
explicit confirmation, and existing values are never overwritten.

- Wizard (overlay, 5 steps): mandatory disclaimer with consent checkbox (proposals based on
  generic name/inventory patterns, no knowledge of business processes, does not replace a BIA,
  customer validation mandatory, no liability) → detection summary → group review → foundational
  & out-of-scope review lists → summary. Reachable from the import step ("Add + auto-prequalify")
  and from the tab ① toolbar
- Detection engine: ~27 categories (word-boundary keyword matching on names; OS/location/note as
  secondary confidence signals), precedence out-of-scope > foundational > specific > generic,
  environment modifiers (non-prod lowers BI/Reg, prod raises confidence only), per-group "why"
  line and confidence chip; low-confidence groups default to skip
- Group cards: editable BI/Reg/DS/RK values with live resulting-class preview and optional manual
  class override; optional ownership fields (team/owner, responsible, email) applied to empty
  fields only — deliberately not stored in the catalog (no customer data in reusable rules);
  category auto-fills the workload type field when empty
- Applied proposals stay visibly marked: blue "auto" badge until "validated by customer", note
  marker `[Auto proposal <version>: <category>, <confidence>]` (travels into Excel/JSON), and an
  unconfirmed-proposals counter in the toolbar
- Catalog editable in options: patterns and values per category, add/remove custom categories,
  editable environment patterns (e.g. clear non-prod patterns to treat DEV/TST as full workloads);
  saved with progress, reset to defaults available
- Formatted Excel export: the corporate-styled template workbook is now embedded in the HTML and
  filled via direct XML patching (fflate, MIT, embedded) — colors, borders, frozen header,
  auto-filter, dropdowns and conditional formatting survive; ranges and dashboard formulas grow
  with the data; automatic fallback to the plain export if patching fails
- Language hygiene: tool is primarily English — catalog labels/notes, note markers, export file
  names (`DR_Workload_Classification_Tool_surveyed_*.xlsx`, `DR_Assessment_Progress_*.json`) and
  sheet names (Instructions/Class-Matrix/Workload-Register/Dashboard/Runbook-Plan) are always
  English regardless of UI language; UI itself remains bilingual DE/EN
- Bulk edit: new team/owner, responsible and email fields (empty = don't change)
- Fix: register export formulas still referenced the old German sheet name ('Klassen-Matrix')
  after the sheet rename — now 'Class-Matrix', and the class formula accepts Ja/Yes
- Fix: prequalification catalog headers now switch language with the UI
- Repo: Outputs/ now carries the customer manual-entry workbook ("fill manually") and the export
  template source ("template" — maintainer artifact, users never need it; the tool embeds a copy);
  Examples/ extended with four progress JSONs (dependency/breaker tests A/B, 210 and 2,000 VMs)
  and the 210-VM RVTools test export

## [2026-08-05] — v0.9.1-beta
Performance round: the tool now stays fluid with large inventories (tested with synthetic
2,000- and 5,000-workload RVTools exports, both included in `Examples/`).

- Tab ① table: pagination (100/250/500/1000/all per page, default 250), debounced search,
  indexed dependency-name resolution, event delegation instead of per-row listeners —
  selection, bulk edit and "select all" always operate on the full filtered set, not the page
- Tab ② workload register: same pagination controls plus scroll frame with sticky header and
  pinned #/name columns
- Dependency graph circuit breaker (above 1,500 workloads): nodes without recorded
  dependencies are excluded from simulation and DOM, announced via a visible banner above the
  graph; implicit foundation edges are aggregated through a bundling hub node (N+F instead of
  N×F edges — 5,000 VMs × 50 tier-0 systems would otherwise mean 247,500 simulation edges);
  above 600 nodes the layout is pre-computed statically instead of live-animated (labels on
  hover, dragging moves the node without reheating the simulation)
- Memory fix: the previous graph simulation is now stopped and released on every re-render
  (tab switch, language switch, data load) — before, superseded simulations kept ticking in
  the background and pinned their full node/edge structures in memory
- Import: new checkbox to exclude templates & SRM placeholders (default: on, with counter);
  "Upload file" button now opens the file dialog directly, and re-selecting the same file works
- New "↺ Start over" button in the top bar: full reset including auto-save, with confirmation
  dialog (language preference is kept) — replaces the F5 workaround
- Bulk edit: setting fields return to "don't change" after Apply; the row selection is kept
- Protection-class cell: the class name keeps its tier color on manual override — only the
  "manual" badge stays magenta
- About: new "Limits & performance" section (tested up to 5,000 workloads; roughly 10,000
  computationally; recommendation to split very large environments into survey waves)
- Examples: synthetic RVTools exports (2,000/5,000 VMs) and two pre-classified dependency
  test datasets (1,450 workloads = breaker off / 1,993 workloads = breaker on)

## [2026-08-04] — v0.9.0-beta
- Version scheme introduced (SemVer, beta phase 0.x): version shown in status bar and About
  dialog, embedded in every progress JSON (`toolVersion`) and Excel export for feedback triage
- New About dialog (ⓘ in status bar, top bar and beta banner) bundling: version, owner, full
  disclaimer, privacy & runtime facts (fully local, no server/telemetry, no AI at runtime),
  transparency note (developed with assistance of Anthropic Claude; the tool contains no AI),
  and open-source library licenses; top banner and status bar slimmed accordingly
- Open-source libraries (SheetJS Apache-2.0, Chart.js MIT, D3 ISC) now embedded in the HTML —
  the tool runs 100% offline with no internet access at any point (~1.5 MB single file)
- Skill package updated with the current tool as asset

## [2026-07-24] — Internal release polish (tool v8–v16)
- Tab order swapped: ① New assessment is now the landing tab, ② View classification second
- Status bar with owner + disclaimer; embedded scroll table with sticky header/corner
- Options panel: live calculation-basis line + "where does this model come from" help (DE/EN)
- Runbook tab: mixed-class warnings with recommendation, per-group class override with confirm
  dialog (Tier 0) and global undo; English workbook set (`DR_Workload_Classification_Tool*.xlsx`)
- Skill repackaged (v3): current assets only, scope focused on classification/runbook workflow
- Score formula fix: rows 3+ of the master workbook still carried the pre-v3 weighting

## [2026-07-16] — Major feature round (tool v5–v7)
- Bilingual UI (DE/EN toggle, persisted; Excel exports follow selected language)
- VRO runbook planning tab: dependency-based grouping, topological start order, editable group names, "Runbook-Plan" sheet in Excel export
- Numeric actual RPO/RTO in hours (0 = CDP), automatic gap findings vs. class targets
- Responsible person + email per workload; "Depends on foundation" flag with implicit graph edges
- Bulk edit: clear values, class override for multi-select; labeled Filter / Bulk-edit sections
- Validation card: cross-check against original source file + internal consistency checks
- Print/PDF management view; white Veeam logo, favicon, beta disclaimer
- Sortable tables, per-column filters, sticky ID/name columns
- Fix: manually overridden classes survive Excel re-import; multi-line texts now translate correctly

## [2026-07-15/16] — Import workflow (tool v3–v4)
- Tab ②: RVTools/vCenter/CMDB import with automatic column mapping, CSV/paste import, manual rows
- Template/SRM-placeholder auto-exclusion; foundational candidate suggestions
- Out-of-scope flag (not a sixth tier); autosave + progress file (JSON) round-trip
- Methodology change: Recovery Complexity removed from score (now separate modifier); weights 45/35/20
- Consistent "Tier 0–4" naming with Uptime Institute disclaimer; GiB units

## [2026-07-15] — Initial Setup (tool v1–v2)
- Classification methodology, master Excel tool, dependency graph visualizer (HTML)
- Nordwind example datasets, Claude skill package (dr-concept-builder)
- Internal project set up, README created

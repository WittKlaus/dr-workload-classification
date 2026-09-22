# DR Workload Classification

**Classify customer workloads into DR protection classes (Tier 0–4), capture the dependencies that form a service, and derive Veeam Recovery Orchestrator runbook groups — in one offline HTML file.**

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-v0.14.1--beta-blue.svg)
![Runs offline](https://img.shields.io/badge/runs-100%25%20offline-informational.svg)

> **Community project — not an official Veeam product.** This tool is a working aid created by a Veeam
> Technical Account Manager and shared in the spirit of open source. It is not created by Veeam R&D,
> not validated by Veeam QA and not covered by Veeam Support. Results are a structured basis for
> discussion and are validated together with the customer — without warranty.

<!-- TODO before publishing: add 2–3 screenshots (tab ①, dependency graph, runbook groups) -->

## Why

DR concept workshops tend to start from scratch: the inventory arrives as a raw RVTools export,
classification happens ad hoc in throwaway spreadsheets, and dependency knowledge stays in people's
heads. This tool standardizes that path — import, classify, validate, hand over — so a consistent,
customer-ready DR classification and a runbook proposal exist at the end of the workshop, not weeks
later.

## Quick start

1. Download `DR_Workload_Classification.html` (from the latest [release](../../releases) or this repository).
2. Open it in a current browser (Chrome, Edge, Firefox). No installation, no internet.
3. Drop an RVTools export onto tab ① — try `Examples/RVTools/RVTools_export_TESTDATA_210_VMs.xlsx`.
4. Rate the workloads, enter dependencies, look at tab ② and ③, export to Excel.

To explore without importing, load `Examples/Progress_JSONs/DR_Assessment_Progress_TEST_C_203_VMs.json`:
203 pre-classified workloads with dependencies, ready for the runbook tab.

## What it does

**Tab ① New assessment.** Import an inventory — validated sources are RVTools (`vInfo`) and the
Veeam ONE report *VMs Configuration* (vSphere and Hyper-V, exported as Excel); CMDB/ServiceNow lists
and CSV work through the generic column mapping. Several sources can be imported one after another
with a duplicate dialog. Hierarchical reports are handled: header repeats, cluster/host subtotals and
section headers are skipped, the cluster/host is inherited as location, Veeam replicas are excluded
by default. Then rate each workload on three criteria (1–5):

| Criterion | Weight |
|---|---|
| Business Impact (BI) | 45 % |
| Regulatory (Reg) | 35 % |
| Data Sensitivity (DS) | 20 % |

Score = BI × 0.45 + Reg × 0.35 + DS × 0.20. Recovery Complexity (RK) is captured as well but is
**documentation only** — hard to restore does not mean critical. Flags: *Foundational* (AD/DNS/PKI-type
systems everything depends on → always Tier 0), *Out of scope*, *Depends on foundation*,
*Validated by customer*. Actual RPO/RTO in hours produce gap findings against the class targets.
Dependencies are entered as names or list numbers; "Required by" fills itself. An optional
rule-based **prequalification wizard** proposes ratings from naming patterns (SQL, Oracle, SAP,
Exchange, AD/DNS, file, print, VDI …) — proposals only, applied after confirmation and marked until
validated.

**Tab ② View classification.** KPIs, distribution chart, sortable register and the dependency
network with findings: weakest-link RTO risks (a system depends on something in a lower class),
circular dependencies, RPO/RTO gaps. Print view for a PDF hand-out.

**Tab ③ Runbook planning (VRO).** Dependency-connected groups as orchestration-plan candidates with
a topological start order, editable group names, a service owner per group, a foundation block that
always starts first, and warnings when protection classes are mixed inside a group. Includes field
guidance on how foundation systems are handled in a DR event versus in a DataLab test.

**Export.** A formatted Excel workbook (Instructions, Class-Matrix, Workload-Register, Dashboard,
Runbook-Plan) that round-trips back into the tool, plus a progress file (JSON) for resuming later.

## Protection classes (default calibration)

| Class | Score | Target RPO | Target RTO |
|---|---|---|---|
| Tier 0 – Foundation | Foundational flag | ≈ 0 (continuous) | < 30 min |
| Tier 1 – Platinum | ≥ 4.3 | < 15 min | < 1 h |
| Tier 2 – Gold | ≥ 3.5 | < 1 h | < 4 h |
| Tier 3 – Silver | ≥ 2.5 | < 4 h | < 24 h |
| Tier 4 – Bronze | below | < 24 h | < 72 h / best effort |

Weighted multi-criteria scoring is established BIA practice; ISO 22301/22317, BSI 200-4,
NIST SP 800-34, BCI GPG and DORA/NIS2 require criticality classes with RTO/RPO targets but prescribe
no formula. **The defaults are a starting point — the binding calibration belongs to the customer.**
Weights stay fixed; thresholds, target RPO/RTO and display names are editable in the options panel.
"Tier" here means workload protection classes and is unrelated to Uptime Institute data-center tiers.

## Data and privacy

Everything runs locally in the browser. No server, no telemetry, no AI at runtime, no data
retrieval from the internet. All libraries are embedded. Inventories and assessments never leave the
machine; the only outbound actions are documentation links and the "Report issue" button, which opens a prefilled issue form on GitHub in your browser. Files
you load are treated as untrusted input and type-checked. Details in [SECURITY.md](SECURITY.md).

## Repository layout

| Path | Content |
|---|---|
| `DR_Workload_Classification.html` | The tool. One file, ~1.9 MB, bilingual EN/DE (English default) |
| `Examples/RVTools/` | Synthetic RVTools exports with 210 / 2,000 / 5,000 VMs |
| `Examples/VeeamONE/` | Anonymized real Veeam ONE *VMs Configuration* reports (vSphere, Hyper-V) and a synthetic report |
| `Examples/CMDB_CSV/` | Synthetic ServiceNow-style and German semicolon CSV lists |
| `Examples/Progress_JSONs/` | Pre-classified datasets (203 / 1,450 / 1,993 workloads) and one with a newer tool version to try the version guard |
| `Examples/Manual_Workbook/` | Filled examples of the manual-entry workbook |
| `Outputs/` | The customer manual-entry workbook (for engagements without RVTools) and the export template |
| `CHANGELOG.md` | Release history; the current release is also shown in the tool's About dialog |

## Limits

Tested with synthetic inventories up to 5,000 workloads. Tables are paginated; the dependency graph
protects itself above 1,500 workloads (unconnected nodes are dropped) and switches to a static layout
above 600 nodes (a selector forces animated or static). For very large environments, split the
survey into waves, for example per site or cluster.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Field feedback on the
methodology is as valuable as code. Commits are signed off (DCO).

## License

MIT — see [LICENSE](LICENSE). Embedded libraries: SheetJS Community Edition (Apache-2.0),
Chart.js (MIT), D3.js (ISC), fflate (MIT).

## Author

Klaus Wittenberg, Technical Account Management (Professional Services), Veeam Software.
Built with the assistance of Anthropic Claude; the tool itself contains no AI functionality.

<!-- TODO before publishing: acknowledgements (community reviewers) — with their consent -->

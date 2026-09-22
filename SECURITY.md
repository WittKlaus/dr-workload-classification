# Security

## The offline promise

`DR_Workload_Classification.html` is a single file that runs entirely in your browser.

- No server, no telemetry, no analytics, no data retrieval from the internet at runtime.
- All libraries (SheetJS, Chart.js, D3, fflate) are embedded in the file. Nothing is loaded from a CDN.
- Customer inventories and assessments never leave the machine. State lives in the browser's local
  storage (autosave) and in files you save yourself (progress JSON, Excel export).
- The only outbound actions are documentation links you click yourself and the "Report issue"
  button, which opens a prefilled issue form on GitHub in a new browser tab. Nothing is sent until
  you submit that form yourself.

You can verify this yourself: open the browser's developer tools, switch to the Network tab and use
the tool. Apart from loading the HTML file there are no requests.

## Handling of untrusted input

Files you load are treated as untrusted input:

- Progress files (JSON) and the autosave are type-checked on load. Unknown fields are dropped;
  IDs, scales and class keys are coerced; text lengths are bounded.
- Everything rendered from file content is HTML-escaped.
- A progress file written by a newer tool version asks before loading.
- Spreadsheet parsing uses SheetJS Community Edition 0.20.3, which fixes CVE-2023-30533 (prototype
  pollution) and CVE-2024-22363 (ReDoS). Library versions are checked against published advisories
  before each release and are listed in the About dialog.

Autosave data is stored unencrypted in the browser profile. On shared or customer machines, save
your progress as JSON and use "Start over" before leaving.

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private vulnerability
reporting on this repository (Security tab, "Report a vulnerability"). You will get a response
within a few working days. Once fixed, the issue is documented in the changelog.

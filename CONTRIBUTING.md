# Contributing

Thank you for considering a contribution. This is a community project maintained in spare time.
Please keep that in mind when waiting for a reply.

## Ways to contribute

- **Report a bug or propose a feature** by opening an issue. Use the templates. A sanitized
  progress JSON or a small inventory export that reproduces the problem helps a lot.
- **Field feedback on the methodology** (weights, thresholds, tier semantics) is welcome as an
  issue labelled `methodology`. The scoring model is guidance, not a standard. Changes to it are
  discussed before any code is written.
- **Translations and wording** (DE/EN). The UI is bilingual. Data such as export file names, sheet
  names and note markers stays English on purpose.
- **Code**, see below.

## Working on the code

Start with [ARCHITECTURE.md](ARCHITECTURE.md): it maps the source files, the data flow and the stable
keys. The tool ships as a single HTML file by design. The offline promise means it must run from a USB stick in
a customer meeting room. Please keep it that way:

- Edit the sources in `src/`, never `dist/` directly. Run `node tools/build.mjs` and commit the sources
  together with the rebuilt `dist/DR_Workload_Classification.html`; CI fails if they do not match.

- No external resources at runtime, no network calls, no telemetry.
- Libraries live unmodified in `vendor/`. An update replaces the file there, updates
  [vendor/README.md](vendor/README.md) and is noted in the changelog with version and reason.
- Internal keys are stable and must not be renamed: the tier keys (`Tier 0 – Foundation` to
  `Tier 4 – Bronze`, with an en dash), `Out of Scope – kein Backup`, the export sheet names, and
  the first 18 columns of the Workload-Register export schema. New columns are appended.
- New UI text goes into both languages: `tr(de, en)` for dynamic text, the `STATIC_I18N`
  dictionary for static HTML.
- New state must be added to `snapshotState`, `restoreState` **and** `sanitizeProgressData`.
- Before opening a pull request, run `node --check` on the files in `src/app/`, build, and load
  `dist/DR_Workload_Classification.html` in a browser with the examples in `Examples/`.

## Pull requests

1. Fork the repository, create a branch, keep the change focused.
2. Describe what changes for the user and why. Add a changelog line under "Unreleased".
3. Sign off your commits, see below.

## Developer Certificate of Origin

Contributions must be signed off with `git commit -s`, which adds a line

    Signed-off-by: Your Name <your@email>

certifying that you wrote the contribution or otherwise have the right to submit it under the
project license (MIT). See https://developercertificate.org/.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind and constructive.

# Embedded third-party libraries

The tool runs offline, so these four libraries are embedded into the single HTML file by
`tools/build.mjs`. This project does **not modify** them: they are the minified distribution builds of the
listed versions, and the build copies them byte for byte into the output. A short license banner in
`src/index.html` precedes each of them. The checksums below are those of the files in this folder.

| File | Library | Version | License (full text) | Upstream | SHA-256 |
|---|---|---|---|---|---|
| `xlsx.full.min.js` | SheetJS Community Edition | 0.20.3 | [Apache-2.0](licenses/SheetJS-Apache-2.0.txt) | https://cdn.sheetjs.com/ | `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41` |
| `chart.umd.min.js` | Chart.js | 4.4.0 | [MIT](licenses/Chart.js-MIT.txt) | https://github.com/chartjs/Chart.js | `e9b0f875106021fb3d58120ad8ebdd3e7d32135a4452fd8918c72ac6475f2bd3` |
| `d3.min.js` | D3.js | 7.8.5 | [ISC](licenses/D3-ISC.txt) | https://github.com/d3/d3 | `d6b03aefc9f6c44c7bc78713679c78c295028fa914319119e5cc4b4954855b1c` |
| `fflate.min.js` | fflate | 0.8.2 | [MIT](licenses/fflate-MIT.txt) | https://github.com/101arrowz/fflate | `c3b34f2e9f5e74d4d7d64e01cac7a0c01954c6c406414d42185c7b53d6875ddf` |

The license texts in `licenses/` are the official files of the respective release tags (SheetJS from
cdn.sheetjs.com, the others from the projects' GitHub repositories). SheetJS ships no NOTICE file.
All four licenses are permissive and allow redistribution, also inside an MIT-licensed project,
provided the copyright notice and the license text travel with the code — which is what this folder
and the banners in the built file do.

What they are used for:

- **SheetJS** reads RVTools, Veeam ONE and CSV inventories and writes the plain Excel fallback export.
  Version 0.20.3 is used because the npm/CDN line ends at 0.18.5, which is affected by CVE-2023-30533 and
  CVE-2024-22363; 0.20.3 is distributed by SheetJS from cdn.sheetjs.com.
- **Chart.js** draws the distribution chart in tab ②.
- **D3.js** draws the dependency network in tab ②.
- **fflate** unzips and rezips the embedded Excel template for the formatted export.

## Updating a library

1. Replace the file here with the new upstream distribution file (same file name).
2. Update the version, the SHA-256 and, if needed, the banner line in `src/index.html`.
3. Run `node tools/build.mjs`, test the affected features in the browser, and note the update with version
   and reason in `CHANGELOG.md`.

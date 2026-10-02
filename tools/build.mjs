#!/usr/bin/env node
// Build script for DR Workload Classification.
//
// Assembles the single-file, offline tool from the readable sources:
//
//   src/index.html    page shell: markup, plus one "@include" marker per <script>/<style> block
//   src/styles.css    all styles
//   src/app/*.js      application code, one file per script block (numbered in load order)
//   vendor/*.js       the four third-party libraries, unmodified (see vendor/README.md)
//   Outputs/DR_Workload_Classification_Tool (template).xlsx
//                     the Excel export template, embedded as base64
//
// Usage:
//   node tools/build.mjs           writes dist/DR_Workload_Classification.html
//   node tools/build.mjs --check   builds in memory and fails if dist/ is not exactly the build output
//
// No dependencies, no network access. Every input file is copied byte for byte; the only
// transformation is base64-encoding the template workbook. Files are handled as Latin-1 strings,
// which maps every byte to one character, so UTF-8 text and the raw control bytes inside the
// minified libraries pass through unchanged.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = 'src/index.html';
const OUT = 'dist/DR_Workload_Classification.html';

// "/* @include path */" is replaced by the content of the file; "/* @base64 path */" by the file's
// base64 encoding. Paths are relative to the repository root.
const INCLUDE = /\/\* @include ([^*]+?) \*\//g;
const BASE64 = /\/\* @base64 ([^*]+?) \*\//g;

const read = (rel) => {
  const p = join(ROOT, rel);
  if (!existsSync(p)) throw new Error('missing input file: ' + rel);
  return readFileSync(p);
};
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function build() {
  const inputs = [];
  let html = read(SHELL).toString('latin1');
  // A replacer function (not a string) so that "$" sequences inside the libraries stay literal
  html = html.replace(INCLUDE, (_, rel) => {
    const buf = read(rel);
    inputs.push({ file: rel, bytes: buf.length, sha256: sha256(buf) });
    return buf.toString('latin1');
  });
  html = html.replace(BASE64, (_, rel) => {
    const buf = read(rel);
    inputs.push({ file: rel + '  (base64)', bytes: buf.length, sha256: sha256(buf) });
    return buf.toString('base64');
  });
  if (INCLUDE.test(html) || BASE64.test(html)) throw new Error('unresolved marker in the output');
  return { out: Buffer.from(html, 'latin1'), inputs };
}

const check = process.argv.includes('--check');
const { out, inputs } = build();
for (const i of inputs) console.log(String(i.bytes).padStart(9) + '  ' + i.sha256.slice(0, 12) + '  ' + i.file);
console.log('\n' + String(out.length).padStart(9) + '  ' + sha256(out) + '  ' + OUT);

if (check) {
  const existing = existsSync(join(ROOT, OUT)) ? readFileSync(join(ROOT, OUT)) : null;
  if (!existing || !existing.equals(out)) {
    console.error('\nFAIL: ' + OUT + ' is not the build output of the current sources. Run "node tools/build.mjs" and commit the result.');
    process.exit(1);
  }
  console.log('\nOK: ' + OUT + ' is exactly the build output of src/, vendor/ and the template.');
} else {
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  writeFileSync(join(ROOT, OUT), out);
  console.log('\nwritten: ' + OUT);
}

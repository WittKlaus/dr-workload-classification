// ================================================================================================
// BLOCK 17 · Formatted Excel export: embedded template patched at XML level (fflate)
// ------------------------------------------------------------------------------------------------
// Depends : Blocks 13 (sheet models), 15, 16 (fflate), TEMPLATE_XLSX_B64.
// Provides: exportViaTemplate() (entry point), xmlEsc(), tmplReplaceCell(), wsToRunbookSheetXml()
// Note    : styles.xml stays byte-identical; on any failure the button handler falls back to exportPlainXlsx().
// ================================================================================================
// ---------------- Formatted Excel export: embedded template + XML patch ----------------
// SheetJS CE drops all cell formats when writing. Therefore the bundled, fully formatted template
// (embedded as base64) is opened as a ZIP and ONLY the Workload-Register sheet XML is replaced;
// styles.xml, theme, charts etc. remain byte-identical. Values come from
// buildWorkloadRegisterSheet() (including formulas + cached values), strings as inline strings
// (no sharedStrings patch needed). Style references are cloned from template row 2, ranges
// (auto filter, conditional formatting, validation, dashboard COUNTIFs) are extended to the real
// row count, calcChain is removed + fullCalcOnLoad set (Excel recalculates on opening). If anything
// fails, the button handler catches it (failover: plain export). Template source:
// DR_Workload_Classification_Tool (template).xlsx; after changes to the template it must be re-embedded.
const TEMPLATE_XLSX_B64 = '/* @base64 Outputs/DR_Workload_Classification_Tool (template).xlsx */';

function tmplB64ToU8(b64s) {
  const bin = atob(b64s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function xmlEsc(s) {
  // Control characters other than tab/LF/CR are forbidden in XML 1.0; Excel would want to "repair" the file.
  // \p{Cc} (Unicode category Control) instead of a character range: no raw control characters in the
  // source text. The HTML parser rewrites NUL to U+FFFD and thereby breaks the regex literal (found in a browser test).
  return String(s).replace(/\p{Cc}/gu, c => (c === '\t' || c === '\n' || c === '\r') ? c : '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// Translate an unformatted sheet (Runbook-Plan) from a SheetJS ws into sheet XML
function wsToPlainSheetXml(ws) {
  const range = XLSX.utils.decode_range(ws['!ref']);
  let rows = '';
  for (let R = range.s.r; R <= range.e.r; R++) {
    let cells = '';
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell || cell.v === null || cell.v === undefined || cell.v === '') continue;
      if (cell.t === 'n') cells += '<c r="' + addr + '"><v>' + cell.v + '</v></c>';
      else cells += '<c r="' + addr + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(cell.v) + '</t></is></c>';
    }
    if (cells) rows += '<row r="' + (R + 1) + '">' + cells + '</row>';
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetData>' + rows + '</sheetData></worksheet>';
}

// Replaces a single cell in the sheet XML while keeping its style reference.
// strVal set -> inline string; otherwise innerXml (e.g. "<f>…</f><v>…</v>" or "<v>…</v>").
function tmplReplaceCell(xml, addr, innerXml, strVal) {
  const re = new RegExp('<c r="' + addr + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)');
  if (!re.test(xml)) return xml; // cell does not exist -> untouched
  return xml.replace(re, (m, attrs) => {
    const sAttr = (attrs.match(/ s="\d+"/) || [''])[0];
    if (strVal !== undefined && strVal !== null) {
      return '<c r="' + addr + '"' + sAttr + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(strVal) + '</t></is></c>';
    }
    return '<c r="' + addr + '"' + sAttr + '>' + innerXml + '</c>';
  });
}

// Runbook plan with formatting: title/header rows in the register header style (band across A–I),
// data rows in the register cell style (borders); reuses the template's styles.xml.
function wsToRunbookSheetXml(ws, headS, dataS) {
  const range = XLSX.utils.decode_range(ws['!ref']);
  const NCOLS = 9; // A–I as in the runbook layout
  const sAttr = id => id ? ' s="' + id + '"' : '';
  let rows = '';
  for (let R = range.s.r; R <= range.e.r; R++) {
    const vals = [];
    for (let C = 0; C < Math.max(NCOLS, range.e.c + 1); C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      vals.push(cell && cell.v !== null && cell.v !== undefined && cell.v !== '' ? cell : null);
    }
    if (!vals.some(Boolean)) continue; // blank line as spacing; no cells needed
    const nonEmpty = vals.filter(Boolean).length;
    const isColHead = vals[1] && String(vals[1].v) === 'Workload';
    const isTitle = !isColHead && nonEmpty === 1 && vals[0];
    const rowStyle = (isColHead || isTitle) ? headS : dataS;
    let cells = '';
    for (let C = 0; C < NCOLS; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = vals[C];
      if (!cell) { cells += '<c r="' + addr + '"' + sAttr(rowStyle) + '/>'; continue; }
      if (cell.t === 'n') cells += '<c r="' + addr + '"' + sAttr(rowStyle) + '><v>' + cell.v + '</v></c>';
      else cells += '<c r="' + addr + '"' + sAttr(rowStyle) + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(cell.v) + '</t></is></c>';
    }
    rows += '<row r="' + (R + 1) + '" spans="1:' + NCOLS + '">' + cells + '</row>';
  }
  const widths = (ws['!cols'] || []).slice(0, NCOLS).map((c, i) =>
    '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + ((c && c.wch) || 12) + '" customWidth="1"/>').join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    (widths ? '<cols>' + widths + '</cols>' : '') +
    '<sheetData>' + rows + '</sheetData></worksheet>';
}

function exportViaTemplate(items, fname) {
  const files = fflate.unzipSync(tmplB64ToU8(TEMPLATE_XLSX_B64));
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let sx = dec.decode(files['xl/worksheets/sheet4.xml']); // Workload-Register laut workbook.xml
  const ws = buildWorkloadRegisterSheet(items);
  const last = items.length + 1;
  const COLS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V'];

  // Style map + row attributes from template row 2
  const row2m = sx.match(/<row r="2"[^>]*>([\s\S]*?)<\/row>/);
  if (!row2m) throw new Error('Template: Datenzeile 2 nicht gefunden');
  const styleMap = {};
  row2m[1].replace(/<c r="([A-Z]+)2"(?: s="(\d+)")?/g, (m, col, st) => { styleMap[col] = st || ''; return m; });
  ['S','T','U','V'].forEach(c => { styleMap[c] = styleMap['R'] || ''; });
  let rowAttrs = (sx.match(/<row r="2"([^>]*)>/) || ['', ''])[1].replace(/ spans="[^"]*"/, '');

  // Header row: take over template row 1, add columns S-U (Responsible/E-Mail/Foundation)
  let row1 = (sx.match(/<row r="1"[^>]*>[\s\S]*?<\/row>/) || [null])[0];
  if (!row1) throw new Error('Template: Kopfzeile nicht gefunden');
  const r1s = (row1.match(/<c r="R1"(?: s="(\d+)")?/) || [])[1] || '';
  const r1sAttr = r1s ? ' s="' + r1s + '"' : '';
  const extraHead = ['S','T','U','V'].map(c => {
    const cell = ws[c + '1'];
    return '<c r="' + c + '1"' + r1sAttr + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(cell ? cell.v : '') + '</t></is></c>';
  }).join('');
  row1 = row1.replace(/ spans="[^"]*"/, ' spans="1:22"').replace('</row>', extraHead + '</row>');

  // Generate data rows from the ws object (formulas + cached values are preserved)
  let rowsXml = '';
  for (let r = 2; r <= last; r++) {
    let cells = '';
    COLS.forEach(col => {
      const cell = ws[col + r];
      const sAttr = styleMap[col] ? ' s="' + styleMap[col] + '"' : '';
      if (!cell || ((cell.v === null || cell.v === undefined || cell.v === '') && !cell.f)) {
        cells += '<c r="' + col + r + '"' + sAttr + '/>';
        return;
      }
      if (cell.f) {
        const tAttr = cell.t === 's' ? ' t="str"' : '';
        const vXml = (cell.v === '' || cell.v === null || cell.v === undefined) ? '<v/>' : '<v>' + xmlEsc(cell.v) + '</v>';
        cells += '<c r="' + col + r + '"' + sAttr + tAttr + '><f>' + xmlEsc(cell.f) + '</f>' + vXml + '</c>';
      } else if (cell.t === 'n') {
        cells += '<c r="' + col + r + '"' + sAttr + '><v>' + cell.v + '</v></c>';
      } else {
        cells += '<c r="' + col + r + '"' + sAttr + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(cell.v) + '</t></is></c>';
      }
    });
    rowsXml += '<row r="' + r + '" spans="1:22"' + rowAttrs + '>' + cells + '</row>';
  }

  sx = sx.replace(/<sheetData>[\s\S]*<\/sheetData>/, '<sheetData>' + row1 + rowsXml + '</sheetData>');
  sx = sx.replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:V' + last + '"/>');
  sx = sx.replace(/<autoFilter ref="A1:[A-Z]+\d+"/, '<autoFilter ref="A1:V' + last + '"');
  sx = sx.replace(/sqref="K2:K\d+"/, 'sqref="K2:K' + last + '"');
  sx = sx.replace(/sqref="E2:E\d+"/, 'sqref="E2:E' + last + '"');
  sx = sx.replace(/sqref="F2:I\d+"/, 'sqref="F2:I' + last + '"');
  files['xl/worksheets/sheet4.xml'] = enc.encode(sx);

  // ---- Dashboard: extend the formulas to the real row count AND write fresh cached values
  // (so the numbers are right even WITHOUT recalculation); the wildcard criterion also counts cells
  // with the "… [manuell überschrieben]" suffix ----
  const tierCounts = TIER_ORDER.map(t => items.filter(it => !it.outOfScope &&
    (it.clsOverride || classifyScore(computeScore(it.bi, it.reg, it.ds), it.foundational)) === t).length);
  let s5 = dec.decode(files['xl/worksheets/sheet5.xml']);
  TIER_ORDER.forEach((t, i) => {
    const r = 4 + i;
    const f = "COUNTIF('Workload-Register'!$K$2:$K$" + last + ',A' + r + '&"*")';
    s5 = tmplReplaceCell(s5, 'B' + r, '<f>' + xmlEsc(f) + '</f><v>' + tierCounts[i] + '</v>');
  });
  s5 = tmplReplaceCell(s5, 'B9', '<f>' + xmlEsc("COUNTA('Workload-Register'!$B$2:$B$" + last + ')') + '</f><v>' + items.length + '</v>');
  files['xl/worksheets/sheet5.xml'] = enc.encode(s5);

  // Chart cache: set the cached series values to the fresh counts (otherwise the chart shows the
  // template zeros until the first recalculation)
  if (files['xl/charts/chart1.xml']) {
    let ch = dec.decode(files['xl/charts/chart1.xml']);
    const valBlock = ch.match(/<c:val>[\s\S]*?<\/c:val>/);
    if (valBlock) {
      let vb = valBlock[0];
      tierCounts.forEach((c, i) => {
        vb = vb.replace(new RegExp('(<c:pt idx="' + i + '"><c:v>)[^<]*(</c:v>)'), '$1' + c + '$2');
      });
      ch = ch.replace(valBlock[0], vb);
      files['xl/charts/chart1.xml'] = enc.encode(ch);
    }
  }

  // ---- Class-Matrix: take over live values from the options (thresholds A4:A7, target RPO/RTO/
  // configuration C12:E16); otherwise the template exports stale defaults and the VLOOKUPs fetch
  // wrong targets on recalculation ----
  let s3 = dec.decode(files['xl/worksheets/sheet3.xml']);
  s3 = tmplReplaceCell(s3, 'A4', '<v>' + (SCORE_THRESHOLDS['Tier 4 – Bronze'] || 0) + '</v>');
  s3 = tmplReplaceCell(s3, 'A5', '<v>' + SCORE_THRESHOLDS['Tier 3 – Silver'] + '</v>');
  s3 = tmplReplaceCell(s3, 'A6', '<v>' + SCORE_THRESHOLDS['Tier 2 – Gold'] + '</v>');
  s3 = tmplReplaceCell(s3, 'A7', '<v>' + SCORE_THRESHOLDS['Tier 1 – Platinum'] + '</v>');
  TIER_ORDER.forEach((t, i) => {
    const r = 12 + i;
    const def = CLASS_DEFS[t] || {};
    s3 = tmplReplaceCell(s3, 'C' + r, null, def.rpo || '');
    s3 = tmplReplaceCell(s3, 'D' + r, null, def.rto || '');
    s3 = tmplReplaceCell(s3, 'E' + r, null, def.config || '');
  });
  files['xl/worksheets/sheet3.xml'] = enc.encode(s3);

  // Remove calcChain (Excel rebuilds it), force a full recalculation on opening
  delete files['xl/calcChain.xml'];
  files['[Content_Types].xml'] = enc.encode(dec.decode(files['[Content_Types].xml'])
    .replace(/<Override[^>]*calcChain\.xml[^>]*\/>/, ''));
  files['xl/_rels/workbook.xml.rels'] = enc.encode(dec.decode(files['xl/_rels/workbook.xml.rels'])
    .replace(/<Relationship[^>]*calcChain\.xml[^>]*\/>/, ''));
  let wbx = dec.decode(files['xl/workbook.xml']);
  wbx = /<calcPr /.test(wbx) ? wbx.replace(/<calcPr /, '<calcPr fullCalcOnLoad="1" ')
                             : wbx.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');

  // Append the runbook plan as an additional (unformatted) sheet when there is data
  const viewItems = buildViewItemsFromCollect();
  if (viewItems.length) {
    files['xl/worksheets/sheet9.xml'] = enc.encode(wsToRunbookSheetXml(buildRunbookPlanSheet(viewItems), r1s, styleMap['B'] || ''));
    files['[Content_Types].xml'] = enc.encode(dec.decode(files['[Content_Types].xml'])
      .replace('</Types>', '<Override PartName="/xl/worksheets/sheet9.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'));
    files['xl/_rels/workbook.xml.rels'] = enc.encode(dec.decode(files['xl/_rels/workbook.xml.rels'])
      .replace('</Relationships>', '<Relationship Id="rIdRunbook" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet9.xml"/></Relationships>'));
    wbx = wbx.replace('</sheets>', '<sheet name="Runbook-Plan" sheetId="9" r:id="rIdRunbook"/></sheets>');
  }
  files['xl/workbook.xml'] = enc.encode(wbx);

  const zipped = fflate.zipSync(files, { level: 6 });
  const blob = new Blob([zipped], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fname;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ═══════════════════════════════════════════════════════════════
// EXPORT.JS — all download functions
// ═══════════════════════════════════════════════════════════════
import { esc, dlFile, stamp, lines, state, searchLog, DB_LABELS } from './state.js';
import { getActiveSchema, LIVE_SCHEMA, customFields } from './schema.js';
import { scoreSchemaFit, scoreTermRelevance, getExportOptions } from './scores.js';
import { getExtractionFields } from './extraction.js';

function getPaywalled() {
  return state.records.filter(r => r.doi && r.doi !== 'not reported' && (r.pdf_available === 'paywalled' || r.pdf_available === 'no' || r.pdf_available === 'unknown'));
}
function sc(r) { return { decision: r._screen_decision || '', reason: r._screen_reason || '' }; }

// AI-extracted field columns, shared by every CSV/JSON export below
function aiFieldLabels() {
  const fromReq = getExtractionFields().map(f => f.label);
  const seen = new Set(fromReq);
  [...state.records, ...state.excludedRecords].forEach(r => { if (r._ai_fields) Object.keys(r._ai_fields).forEach(k => seen.add(k)); });
  return [...seen];
}
function aiCellText(r, label) {
  const v = r._ai_fields?.[label];
  if (!v) return '';
  const conflict = r._ai_conflicts?.[label];
  return conflict ? `${v.value} [CONFLICT]` : v.value;
}

export function exportCSV(cat) {
  const opts = getExportOptions();
  const data = state.records.filter(r => cat === 'all' || r.category === cat);
  if (!data.length) { alert('No records. Run a search first.'); return; }
  const active = getActiveSchema();
  const aiLabels = aiFieldLabels();
  const extraH = [];
  if (opts.includeSchemaFit) extraH.push('Schema fit %');
  if (opts.includeTermRelevance) extraH.push('Term relevance %');
  if (opts.includeAbstract) extraH.push('Abstract');
  const headers = [...active.map(s => s.label || s.field), ...extraH, ...aiLabels.map(l => `AI: ${l}`)];
  const rows = data.map(r => {
    const s2 = sc(r);
    const full = { ...r, screening_decision: s2.decision, screening_reason: s2.reason };
    const base = active.map(s => `"${String(full[s.field] || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`);
    const extra = [];
    if (opts.includeSchemaFit) extra.push(`"${scoreSchemaFit(r)}"`);
    if (opts.includeTermRelevance) extra.push(`"${scoreTermRelevance(r)}"`);
    if (opts.includeAbstract) extra.push(`"${(r._abstract || '[No abstract available]').replace(/"/g, '""').replace(/\n/g, ' ')}"`);
    const aiCols = aiLabels.map(l => `"${aiCellText(r, l).replace(/"/g, '""')}"`);
    return [...base, ...extra, ...aiCols].join(',');
  });
  dlFile([headers.join(','), ...rows].join('\r\n'), `sciwide_records${cat !== 'all' ? '_cat' + cat : ''}_${stamp()}.csv`, 'text/csv;charset=utf-8;');
}

export function exportJSON() {
  if (!state.records.length) { alert('No records.'); return; }
  const out = state.records.map(r => {
    const s2 = sc(r);
    return { ...r, screening_decision: s2.decision, screening_reason: s2.reason, abstract: r._abstract || null, schema_fit_pct: scoreSchemaFit(r), term_relevance_pct: scoreTermRelevance(r), ai_fields: r._ai_fields || null, ai_conflicts: r._ai_conflicts || null };
  });
  dlFile(JSON.stringify(out, null, 2), `sciwide_records_${stamp()}.json`, 'application/json');
}

// Quick download of the CURRENT FILTERED VIEW in Results — separate from the full multi-format Export tab
export function exportFilteredCSV() {
  const data = state.filteredView && state.filteredView.length ? state.filteredView : state.records;
  if (!data.length) { alert('No records match the current filters.'); return; }
  const active = getActiveSchema();
  const aiLabels = aiFieldLabels();
  const headers = [...active.map(s => s.label || s.field), ...aiLabels.map(l => `AI: ${l}`)];
  const rows = data.map(r => {
    const base = active.map(s => `"${String(r[s.field] || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`);
    const aiCols = aiLabels.map(l => `"${aiCellText(r, l).replace(/"/g, '""')}"`);
    return [...base, ...aiCols].join(',');
  });
  dlFile([headers.join(','), ...rows].join('\r\n'), `sciwide_results_filtered_${stamp()}.csv`, 'text/csv;charset=utf-8;');
}
export function exportFilteredJSON() {
  const data = state.filteredView && state.filteredView.length ? state.filteredView : state.records;
  if (!data.length) { alert('No records match the current filters.'); return; }
  const out = data.map(r => ({ ...r, ai_fields: r._ai_fields || null, ai_conflicts: r._ai_conflicts || null }));
  dlFile(JSON.stringify(out, null, 2), `sciwide_results_filtered_${stamp()}.json`, 'application/json');
}

export function exportBibtex() {
  const data = state.records.filter(r => r.doi && r.doi !== 'not reported');
  if (!data.length) { alert('No records with DOIs.'); return; }
  const entries = data.map((r, i) => {
    const key = `record${r.pub_year || 'nd'}_${i + 1}`;
    const au = (r.full_citation || '').split('(')[0].trim().replace(/,\s*$/, '');
    const m = (r.full_citation || '').match(/\)\.\s+(.+?)\.\s+DOI:/);
    return `@article{${key},\n  author={${au}},\n  year={${r.pub_year || ''}},\n  title={${m ? m[1] : 'Study'}},\n  doi={${r.doi}}\n}`;
  });
  dlFile(entries.join('\n\n'), `sciwide_${stamp()}.bib`, 'text/plain;charset=utf-8;');
}

export function exportRIS() {
  if (!state.records.length) { alert('No records.'); return; }
  const ris = state.records.map(r => {
    const au = (r.full_citation || '').split('(')[0].trim().split(';').map(a => a.trim()).filter(Boolean);
    const m = (r.full_citation || '').match(/\)\.\s+(.+?)\.\s+DOI:/);
    const title = m ? m[1].trim() : (r.full_citation || '').slice(0, 120);
    const s2 = sc(r);
    const ln = ['TY  - JOUR'];
    au.forEach(a => ln.push(`AU  - ${a}`));
    ln.push(`PY  - ${r.pub_year || ''}`, `TI  - ${title}`);
    if (r.doi && r.doi !== 'not reported') ln.push(`DO  - ${r.doi}`);
    if (r.url && r.url !== 'not reported') ln.push(`UR  - ${r.url}`);
    if (r.country && r.country !== 'not reported') ln.push(`CY  - ${r.country}`);
    ln.push(`N1  - Cat: ${r.category} | Verif: ${r.verification_status} | DB: ${r.source_db}`);
    if (r.notes) ln.push(`N2  - ${r.notes}`);
    if (s2.decision) ln.push(`KW  - screening:${s2.decision}`);
    if (s2.reason) ln.push(`KW  - reason:${s2.reason}`);
    ln.push('ER  - ');
    return ln.join('\r\n');
  });
  dlFile(ris.join('\r\n\r\n'), `sciwide_${stamp()}.ris`, 'application/x-research-info-systems;charset=utf-8;');
}

export function exportEndNoteXML() {
  if (!state.records.length) { alert('No records.'); return; }
  function x(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  const records = state.records.map((r, i) => {
    const au = (r.full_citation || '').split('(')[0].trim().split(';').map(a => a.trim()).filter(Boolean);
    const m = (r.full_citation || '').match(/\)\.\s+(.+?)\.\s+DOI:/);
    const title = m ? m[1].trim() : (r.full_citation || '').slice(0, 200);
    const s2 = sc(r);
    const auXml = au.map(a => `<author>${x(a)}</author>`).join('');
    return `  <record>\n    <ref-type name="Journal Article">17</ref-type>\n    <contributors><authors>${auXml}</authors></contributors>\n    <titles><title>${x(title)}</title></titles>\n    <dates><year>${x(String(r.pub_year || ''))}</year></dates>\n    <place-published>${x(r.country || '')}</place-published>\n    <isbn>${x(r.doi && r.doi !== 'not reported' ? r.doi : '')}</isbn>\n    <urls><related-urls><url>${x(r.url && r.url !== 'not reported' ? r.url : '')}</url></related-urls></urls>\n    <electronic-resource-num>${x(r.doi && r.doi !== 'not reported' ? r.doi : '')}</electronic-resource-num>\n    <abstract>${x(r.excerpt && r.excerpt !== 'not reported' ? r.excerpt : '')}</abstract>\n    <notes>${x(`Cat: ${r.category} | DB: ${r.source_db}${s2.decision ? ' | Screen: ' + s2.decision : ''}`)}</notes>\n    <keywords>${s2.decision ? `<keyword>screening:${x(s2.decision)}</keyword>` : ''}</keywords>\n    <language>${x(r.language || 'en')}</language>\n  </record>`;
  }).join('\n');
  dlFile(`<?xml version="1.0" encoding="UTF-8"?>\n<xml><records>\n${records}\n</records></xml>`, `sciwide_${stamp()}.xml`, 'application/xml;charset=utf-8;');
}

export function exportGeoJSON() {
  const data = state.records.filter(r => r.coordinates && r.coordinates !== 'not reported');
  if (!data.length) { alert('No records with coordinates.'); return; }
  const active = getActiveSchema();
  const features = data.map(r => {
    const [lat, lon] = r.coordinates.split(',').map(s => parseFloat(s.trim()));
    const props = {}; active.forEach(s => props[s.label || s.field] = r[s.field] || '');
    return { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props };
  });
  dlFile(JSON.stringify({ type: 'FeatureCollection', features }, null, 2), `sciwide_geo_${stamp()}.geojson`, 'application/json');
}

export function exportSchema() {
  dlFile(JSON.stringify([...LIVE_SCHEMA, ...customFields], null, 2), `sciwide_schema_${stamp()}.json`, 'application/json');
}

export function exportMissing() {
  const items = lines('cfg-missing');
  if (!items.length) { alert('No known-gap sources listed yet.'); return; }
  dlFile(['Known gaps / hard-to-access sources', '═'.repeat(56), 'Generated: ' + new Date().toISOString(), '', ...items.map((s, i) => `${i + 1}. ${s}`)].join('\n'), `missing_sources_${stamp()}.txt`, 'text/plain;charset=utf-8;');
}

export function exportSearchLog() {
  if (!searchLog.length) { alert('No search log yet. Run a search first.'); return; }
  const s = state.lastSettings || {};
  const terms = [...(s.primaryTerms || []), ...(s.synonymTerms || []), ...(s.extraTerms || [])];
  const dbs = [...new Set(searchLog.map(l => l.db))];
  const inc = state.records.filter(r => r._screen_decision === 'include').length;
  const exc = state.excludedRecords.length;
  const maybe = state.records.filter(r => r._screen_decision === 'maybe').length;
  const un = state.records.filter(r => !r._screen_decision).length;
  const hdr = [
    'SciWide Search — PRISMA-style Search Report', '═'.repeat(60),
    `Generated: ${new Date().toISOString()}`, '',
    '── SEARCH STRATEGY ─────────────────────────────────────',
    `Primary terms (${terms.length}):`, ...terms.map(t => `  • ${t}`), '',
    `Databases searched (${dbs.length}):`, ...dbs.map(d => `  • ${DB_LABELS[d] || d}`), '',
    `Year range: ${s.yearFrom || '(all)'} – ${s.yearTo || '(all)'}`,
    `Total queries: ${searchLog.length}`,
    `Total raw hits: ${searchLog.reduce((a, l) => a + l.hits, 0)}`,
    `After deduplication: ${searchLog.reduce((a, l) => a + (l.new || 0), 0)}`,
    `Records in session: ${state.records.length + state.excludedRecords.length}`, '',
    '── EXTRACTION FILTER SUMMARY ───────────────────────────',
    `Included: ${inc}  Paywall/inconclusive: ${maybe}  Removed (no match): ${exc}  Not yet checked: ${un}`, '',
    '── QUERY-BY-QUERY LOG ──────────────────────────────────',
    'Timestamp                | Database                      | Term                          | Hits | New | Dupes',
    '─'.repeat(105),
  ];
  const rows = searchLog.map(l =>
    `${l.ts.replace('T', ' ').slice(0, 19)} | ${(DB_LABELS[l.db] || l.db).padEnd(29)} | ${(l.term || '(occurrence)').slice(0, 29).padEnd(29)} | ${String(l.hits).padStart(4)} | ${String(l.new || 0).padStart(3)} | ${String(l.dupes || 0).padStart(5)}`
  );
  dlFile([...hdr, ...rows].join('\n'), `sciwide_search_log_${stamp()}.txt`, 'text/plain;charset=utf-8;');
}

export function exportScreened(decision) {
  const data = state.records.filter(r => (r._screen_decision || '') === decision);
  if (!data.length) { alert(`No records marked as "${decision}".`); return; }
  const active = getActiveSchema();
  const headers = [...active.map(s => s.label || s.field), 'Screening', 'Reason'];
  const rows = data.map(r => [...active.map(s => `"${String(r[s.field] || '').replace(/"/g, '""')}"`), `"${r._screen_decision || ''}"`, `"${(r._screen_reason || '').replace(/"/g, '""')}"`].join(','));
  dlFile([headers.join(','), ...rows].join('\r\n'), `sciwide_${decision}_${stamp()}.csv`, 'text/csv;charset=utf-8;');
}

// Records the Extraction Filter checked fully and confirmed have NO parameter match — removed from main view
export function exportExcludedRemoved() {
  const data = state.excludedRecords;
  if (!data.length) { alert('No removed records yet. Run the Extraction Filter first — nothing has been removed.'); return; }
  const active = getActiveSchema();
  const headers = [...active.map(s => s.label || s.field), 'Reason removed'];
  const rows = data.map(r => [...active.map(s => `"${String(r[s.field] || '').replace(/"/g, '""')}"`), `"${(r._screen_reason || '').replace(/"/g, '""')}"`].join(','));
  dlFile([headers.join(','), ...rows].join('\r\n'), `sciwide_removed_no_match_${stamp()}.csv`, 'text/csv;charset=utf-8;');
}

export function exportMarkdown() {
  if (!state.records.length) { alert('No records.'); return; }
  const s = state.lastSettings || {};
  const terms = [...(s.primaryTerms || []), ...(s.synonymTerms || []), ...(s.extraTerms || [])];
  const inc = state.records.filter(r => r._screen_decision === 'include').length;
  const exc = state.excludedRecords.length;
  const catMap = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  state.records.forEach(r => { if (catMap[r.category] !== undefined) catMap[r.category]++; });
  const countryMap = {};
  state.records.forEach(r => { if (r.country && r.country !== 'not reported') countryMap[r.country] = (countryMap[r.country] || 0) + 1; });
  const topC = Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const dbs = [...new Set(state.records.map(r => r.source_db).filter(Boolean))];
  const out = [
    `# SciWide Search — Session Summary`, ``,
    `**Generated:** ${new Date().toISOString()}  `,
    `**Citation:** Ebrahimi, M. (2026). *SciWide Search* [Software]. https://github.com/mehregan59/Sc_wide_Search`, ``,
    `## Search strategy`, ``,
    terms.length ? `**Terms:** ${terms.map(t => `\`${t}\``).join(', ')}` : '*No terms recorded.*', ``,
    `**Year range:** ${s.yearFrom || '(all)'} – ${s.yearTo || '(all)'}`, ``,
    `**Databases:** ${dbs.join(', ') || '(none recorded)'}`, ``,
    `## Records overview`, ``,
    `| Metric | Count |`, `|---|---|`,
    `| Included | ${inc} |`, `| Removed (no parameter match) | ${exc} |`, ``,
    `## Category breakdown`, ``,
    `| Category | Label | Count |`, `|---|---|---|`,
    `| A | Primary location records | ${catMap.A} |`, `| B | Useful sampling locations | ${catMap.B} |`,
    `| C | Lab / strain origin | ${catMap.C} |`, `| D | Modelling / review | ${catMap.D} |`,
    `| E | No usable location | ${catMap.E} |`, `| F | Pre-1980 records | ${catMap.F} |`, ``,
    `## Top countries`, ``, `| Country | Records |`, `|---|---|`,
    ...topC.map(([c, n]) => `| ${c} | ${n} |`), ``,
    `## Included records`, ``,
  ];
  const incData = state.records.filter(r => r._screen_decision === 'include');
  if (incData.length) {
    out.push(`| # | Authors | Year | Country | DOI |`, `|---|---|---|---|---|`);
    incData.forEach((r, i) => { const au = (r.full_citation || '').split('(')[0].trim().slice(0, 60); const doi = r.doi && r.doi !== 'not reported' ? `[${r.doi}](https://doi.org/${r.doi})` : '—'; out.push(`| ${i + 1} | ${au} | ${r.pub_year || '—'} | ${r.country || '—'} | ${doi} |`); });
  } else { out.push('*No records marked as included yet — run the Extraction Filter.*'); }
  out.push('');
  dlFile(out.join('\n'), `sciwide_summary_${stamp()}.md`, 'text/markdown;charset=utf-8;');
}

export function exportPaywallTxt() {
  const data = getPaywalled();
  if (!data.length) { alert('No paywalled records.'); return; }
  dlFile(['Paywalled papers — DOI list', '═'.repeat(40), `Generated: ${new Date().toISOString()}`, `Total: ${data.length}`, '', ...data.map((r, i) => `[${i + 1}] DOI: ${r.doi}\n    Authors: ${(r.full_citation || '').split('(')[0].trim().slice(0, 100)}\n    Year: ${r.pub_year || 'n.d.'} | Category: ${r.category}\n    Unpaywall: https://unpaywall.org/${r.doi}\n`)].join('\n'), `paywalled_dois_${stamp()}.txt`, 'text/plain;charset=utf-8;');
}

export function exportPaywallCsv() {
  const data = getPaywalled();
  if (!data.length) { alert('No paywalled records.'); return; }
  const rows = data.map(r => [`"${r.doi}"`, `"${r.pub_year || ''}"`, `"${(r.full_citation || '').split('(')[0].trim().slice(0, 120).replace(/"/g, '""')}"`, `"${r.country}"`, `"${r.category}"`, `"https://doi.org/${r.doi}"`, `"https://unpaywall.org/${r.doi}"`].join(','));
  dlFile(['doi,pub_year,authors,country,category,doi_url,unpaywall_url', ...rows].join('\r\n'), `paywalled_dois_${stamp()}.csv`, 'text/csv;charset=utf-8;');
}

export function exportDelimited() {
  if (!state.records.length) { alert('No records.'); return; }
  const delimRaw = document.getElementById('custom-delim')?.value || 'tab';
  const delim = delimRaw === 'tab' ? '\t' : delimRaw === 'semicolon' ? ';' : delimRaw === 'pipe' ? '|' : ',';
  const doQuote = document.getElementById('custom-quote')?.value !== 'none';
  const includeHeader = document.getElementById('custom-header')?.value !== 'no';
  const active = getActiveSchema();
  function cell(v) { const s = String(v || '').replace(/\n/g, ' '); return doQuote ? '"' + s.replace(/"/g, '""') + '"' : s.replace(new RegExp('\\' + delim, 'g'), ' '); }
  const rows = state.records.map(r => { const s2 = sc(r); const full = { ...r, screening_decision: s2.decision, screening_reason: s2.reason }; return active.map(s => cell(full[s.field] || '')).join(delim); });
  const header = active.map(s => cell(s.label || s.field)).join(delim);
  const ext = delim === '\t' ? 'tsv' : 'csv';
  dlFile([...(includeHeader ? [header] : []), ...rows].join('\r\n'), `sciwide_records_${stamp()}.${ext}`, 'text/plain;charset=utf-8;');
}

export const SWDExportFn = {
  csv: exportCSV, delimited: exportDelimited, json: exportJSON, bibtex: exportBibtex,
  ris: exportRIS, endnotexml: exportEndNoteXML, markdown: exportMarkdown,
  geojson: exportGeoJSON, missing: exportMissing, schema: exportSchema,
  searchLog: exportSearchLog, screened: exportScreened, excludedRemoved: exportExcludedRemoved,
  paywallTxt: exportPaywallTxt, paywallCsv: exportPaywallCsv,
};

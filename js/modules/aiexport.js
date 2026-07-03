// ═══════════════════════════════════════════════════════════════
// AIEXPORT.JS — batch export for external AI extraction + merge import
// Asks the AI about each individual TERM (via extraction.js's shared
// termEntries), then re-aggregates per-term answers back up to the
// Requirement FIELD level (found beats not-found beats unable-to-access),
// storing the result keyed by field label — same key export.js already reads.
// ═══════════════════════════════════════════════════════════════
import { state, dlFile, stamp } from './state.js';
import { requirements } from './requirements.js';
import { termEntries } from './extraction.js';

function csvSlug(s) { return String(s || '').replace(/[^a-z0-9 ]/gi, '').trim().replace(/\s+/g, '_'); }
function csvCell(v) { return `"${String(v == null ? '' : v).replace(/"/g, '""').replace(/\n/g, ' ')}"`; }

function fieldLabelMap() {
  const m = new Map();
  requirements.forEach(r => m.set(r.id, r.label));
  return m;
}

function leanRows() {
  return state.records.map(r => ({
    doi: r.doi && r.doi !== 'not reported' ? r.doi : '',
    title: (r.full_citation || '').split('(')[0].trim() || (r.full_citation || '').slice(0, 120),
    url: r.url && r.url !== 'not reported' ? r.url : (r.doi && r.doi !== 'not reported' ? `https://doi.org/${r.doi}` : ''),
    source_db: r.source_db || '',
  }));
}

export function buildExtractionPrompt() {
  const entries = termEntries();
  if (!entries.length) return 'No search parameters configured \u2014 add at least one requirement in Configure first.';
  const termList = entries.map(e => `- ${e.term}`).join('\n');
  const cols = entries.map(e => csvSlug(e.term)).join(',');
  return [
    'You are helping extract structured data from a list of scientific papers.',
    'For EACH row (paper) below, retrieve the paper using its DOI or URL (use web browsing/search \u2014 do not rely on memory alone),',
    'then check SEPARATELY whether it reports each of the following DISTINCT concepts. Treat each one independently \u2014 do not merge them.',
    '',
    termList,
    '',
    'Return your answer as CSV with EXACTLY this header row, one output row per input paper:',
    `doi,${cols},evidence`,
    '',
    'Rules:',
    '- Each concept column must contain exactly one of: found, not-found, unable-to-access',
    '- "unable-to-access" means you could not retrieve the paper at all \u2014 in that case set EVERY concept column to unable-to-access',
    '- "evidence" is one shared field: for any concept marked "found", include a short quoted phrase prefixed with the concept name,',
    '  e.g. distribution: "occurrence records were compiled from..."; semicolon-separate if multiple concepts were found',
    '- Do not guess \u2014 if genuinely unsure for a concept, use not-found rather than found',
    '',
    'IMPORTANT: this only works if your AI tool can actually browse/retrieve the paper text.',
    'Upload-only tools (like NotebookLM) will NOT work here since no paper text is provided \u2014 only DOIs/URLs.',
  ].join('\n');
}

function toCSV(rows) {
  const header = 'doi,title,url,source_db';
  const body = rows.map(r => [csvCell(r.doi), csvCell(r.title), csvCell(r.url), csvCell(r.source_db)].join(','));
  return [header, ...body].join('\r\n');
}

export async function downloadAIExport(batchSizeInput) {
  const rows = leanRows();
  if (!rows.length) { alert('No records to export. Run a search first.'); return; }
  const prompt = buildExtractionPrompt();
  const size = (!batchSizeInput || batchSizeInput === 'all') ? rows.length : Math.max(1, parseInt(batchSizeInput) || rows.length);

  const batches = [];
  for (let i = 0; i < rows.length; i += size) batches.push(rows.slice(i, i + size));

  if (batches.length <= 1) {
    dlFile(toCSV(rows), `sciwide_ai_export_${stamp()}.csv`, 'text/csv;charset=utf-8;');
    dlFile(prompt, `sciwide_ai_prompt_${stamp()}.txt`, 'text/plain;charset=utf-8;');
    return;
  }

  if (!window.JSZip) { alert('ZIP library failed to load \u2014 try refreshing the page and retrying.'); return; }
  const zip = new window.JSZip();
  batches.forEach((b, i) => {
    const n = String(i + 1).padStart(String(batches.length).length, '0');
    zip.file(`batch_${n}_of_${batches.length}.csv`, toCSV(b));
  });
  zip.file('README.txt', [
    'SciWide Search \u2014 AI extraction batch export',
    `Generated: ${new Date().toISOString()}`,
    `Total records: ${rows.length}`,
    `Batch size: ${size}`,
    `Number of files: ${batches.length}`,
    '',
    'PROMPT (use with each batch file):',
    '\u2500'.repeat(60),
    prompt,
  ].join('\n'));
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sciwide_ai_batches_${stamp()}.zip`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ── Parse AI's returned CSV/JSON ─────────────────────────────────
function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const splitRow = line => {
    const out = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { out.push(cur); cur = ''; }
        else cur += c;
      }
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const header = splitRow(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(line => {
    const cells = splitRow(line);
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i] || ''; });
    return row;
  });
}

export function parseAIResponse(text) {
  const t = (text || '').trim();
  if (!t) return [];
  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      const j = JSON.parse(t);
      const arr = Array.isArray(j) ? j : (j.rows || j.data || []);
      return arr.map(o => { const row = {}; Object.keys(o).forEach(k => { row[k.toLowerCase()] = String(o[k] ?? ''); }); return row; });
    } catch (e) { /* fall through to CSV parsing */ }
  }
  return parseCSVText(t);
}

function normDOI(d) {
  return String(d || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}
function findRecord(doi) {
  const nd = normDOI(doi);
  if (!nd) return null;
  return state.records.find(r => normDOI(r.doi) === nd) || null;
}

// Merges parsed AI rows into matching records (by DOI).
// Per-term answers are aggregated to field level: found > not-found > unable-to-access.
// - empty/unrecognized field result → skipped
// - same aggregated value already present → collected, user gets ONE batch-level dialog
// - different value already present → both kept, record flagged with a conflict badge
export function mergeAIResults(rows) {
  const entries = termEntries();
  const termKeyToEntry = new Map(entries.map(e => [csvSlug(e.term).toLowerCase(), e]));
  const labelById = fieldLabelMap();
  const rank = { found: 3, 'not-found': 2, 'unable-to-access': 1 };

  let filled = 0, conflicts = 0, unmatched = 0;
  const exactDuplicates = [];

  rows.forEach(row => {
    const rec = findRecord(row.doi);
    if (!rec) { unmatched++; return; }
    if (!rec._ai_fields) rec._ai_fields = {};
    if (!rec._ai_conflicts) rec._ai_conflicts = {};

    const fieldBest = new Map(); // fieldId -> { status, term }
    termKeyToEntry.forEach((entry, key) => {
      const status = (row[key] || '').trim().toLowerCase();
      if (!rank[status]) return;
      entry.fieldIds.forEach(fid => {
        const cur = fieldBest.get(fid);
        if (!cur || rank[status] > rank[cur.status]) fieldBest.set(fid, { status, term: entry.term });
      });
    });

    fieldBest.forEach((info, fid) => {
      const label = labelById.get(fid);
      if (!label) return;
      const val = info.status === 'found' ? `found (${info.term})` : info.status;
      const evid = (row.evidence || '').trim();
      const existing = rec._ai_fields[label];
      if (!existing) {
        rec._ai_fields[label] = { value: val, confidence: info.status, evidence: evid, ts: Date.now() };
        filled++;
      } else if (existing.value === val) {
        exactDuplicates.push({ record: rec, field: label, value: val });
      } else {
        if (!rec._ai_conflicts[label]) rec._ai_conflicts[label] = [existing];
        if (!rec._ai_conflicts[label].some(c => c.value === val)) {
          rec._ai_conflicts[label].push({ value: val, confidence: info.status, evidence: evid, ts: Date.now() });
        }
        rec._has_conflict = true;
        conflicts++;
      }
    });
  });

  if (exactDuplicates.length) {
    const skip = confirm(
      `${exactDuplicates.length} field value(s) from this import exactly match values already stored.\n\n` +
      `OK = ignore duplicates (values already correct, nothing to do)\n` +
      `Cancel = flag those records as "duplicate \u2014 check manually"`
    );
    if (!skip) exactDuplicates.forEach(d => { d.record._ai_duplicate_flag = true; });
  }

  return { filled, conflicts, unmatched, duplicates: exactDuplicates.length, total: rows.length };
}

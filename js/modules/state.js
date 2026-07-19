// ═══════════════════════════════════════════════════════════════
// STATE.JS — shared state, helpers, constants
// ═══════════════════════════════════════════════════════════════

export function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export const stamp = () => new Date().toISOString().slice(0, 10);
export function lines(id) {
  const el = document.getElementById(id);
  return (el && el.value || '').split('\n').map(s => s.trim()).filter(Boolean);
}
export function setLines(id, arr) {
  const el = document.getElementById(id);
  if (el) el.value = (arr || []).join('\n');
}
export function checked(sel) {
  return [...document.querySelectorAll(sel)].filter(e => e.checked).map(e => e.value);
}
export function setChecked(sel, values) {
  if (!Array.isArray(values)) return;
  const set = new Set(values);
  document.querySelectorAll(sel).forEach(e => { e.checked = set.has(e.value); });
}
export function dlFile(content, name, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: mime }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export const state = {
  records: [],
  selection: new Set(),
  filteredView: [],
  lastSettings: null,
  isRunning: false,
  abortCtrl: null,
  midTerms: [],
  currentCat: 'all',
  screenFilter: '',
  paginationSize: 50,
  paginationPage: 1,
  stats: { queries: 0, raw: 0, dedup: 0, records: 0, noloc: 0, errors: 0, skipped: 0 },
  catCounts: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 },
};

export const DB_LABELS = {
  semanticscholar: 'Semantic Scholar', openalex: 'OpenAlex', europepmc: 'Europe PMC',
  crossref: 'Crossref', pubmed: 'PubMed (via Europe PMC)', arxiv: 'arXiv',
  biorxiv: 'bioRxiv / medRxiv', zenodo: 'Zenodo', unpaywall: 'Unpaywall', base: 'BASE',
  eppo: 'EPPO Global DB', cabi: 'CABI', usda: 'USDA/NAL', jki: 'JKI Germany',
  naro: 'NARO Japan', caas: 'CAAS China', rda: 'RDA Korea',
  gbif: 'GBIF', inat: 'iNaturalist', bold: 'BOLD', ncbi: 'NCBI', lens: 'Lens.org',
  plos: 'PLOS', chemrxiv: 'ChemRxiv', eartharxiv: 'EarthArXiv', psyarxiv: 'PsyArXiv',
  socarxiv: 'SocArXiv', ssrn: 'SSRN', repec: 'EconPapers/RePEC', engrxiv: 'engrXiv',
  nasaads: 'NASA ADS', inspire: 'INSPIRE-HEP', zbmath: 'zbMATH Open',
  pubchem: 'PubChem', pangaea: 'PANGAEA',
};

export const VERIF_CLASS = {
  'Verified': 'verif-verified', 'Partly verified': 'verif-partly',
  'Needs manual check': 'verif-manual', 'Secondary citation only': 'verif-secondary',
  'No usable location': 'verif-noloc',
};
export const SCREEN_CLASS = {
  include: 'screen-badge include', exclude: 'screen-badge exclude', maybe: 'screen-badge maybe',
};

export const STUB_DBS = new Set(['unpaywall','base','eppo','cabi','usda','jki','naro','caas','rda','bold','ncbi','lens']);
// gbif/inat used to live here (queried once, no term filter — that was the bug).
// They now go through the normal per-term search loop like every other database.
export const ONCE_DBS = new Set([]);

export const searchLog = [];
export function logSearch(db, term, hits, newN, dupes) {
  searchLog.push({ ts: new Date().toISOString(), db, term, hits, new: newN, dupes });
}
export function clearSearchLog() { searchLog.length = 0; }

export function screeningKey(r) {
  return (r.doi && r.doi !== 'not reported')
    ? r.doi
    : (r.full_citation || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
}
export function getScreening(r) { return { decision: r._screen_decision || '', reason: r._screen_reason || '' }; }
export function setScreening(r, decision, reason) { r._screen_decision = decision || ''; r._screen_reason = reason || ''; }
export function clearScreening() {}

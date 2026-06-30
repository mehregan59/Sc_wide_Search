// ═══════════════════════════════════════════════════════════════
// DATABASES.JS — discipline DB map, selector, scope presets
// ═══════════════════════════════════════════════════════════════
import { esc } from './state.js';

export const DISCIPLINE_DB_MAP = {
  general:     { label: 'General / All disciplines',        defaultOn: ['semanticscholar','openalex','europepmc','crossref','zenodo','gbif','inat','arxiv','biorxiv','pubmed'], available: [] },
  biology:     { label: 'Biology & Life Sciences',          defaultOn: ['europepmc','pubmed','biorxiv','openalex','gbif','inat','ncbi'], available: [
    {id:'europepmc', label:'Europe PMC', status:'live', note:'Primary biology/life sci DB'},
    {id:'pubmed', label:'PubMed (via EPMC)', status:'live', note:'36M+ biomedical citations'},
    {id:'biorxiv', label:'bioRxiv / medRxiv', status:'live', note:'Life science preprints'},
    {id:'openalex', label:'OpenAlex', status:'live', note:'Broad coverage incl. biology'},
    {id:'gbif', label:'GBIF', status:'live', note:'Species occurrence data'},
    {id:'inat', label:'iNaturalist', status:'live', note:'Biodiversity observations'},
    {id:'ncbi', label:'NCBI / GenBank', status:'stub', note:'Genomics, sequences, taxonomy'},
    {id:'bold', label:'BOLD Systems', status:'stub', note:'Barcode of Life data'},
    {id:'plos', label:'PLOS ONE', status:'stub', note:'Open-access biology journals'},
    {id:'zenodo', label:'Zenodo', status:'live', note:'Research data & preprints'},
  ]},
  ecology:     { label: 'Ecology & Environmental Science',  defaultOn: ['openalex','europepmc','gbif','inat','zenodo'], available: [
    {id:'openalex', label:'OpenAlex', status:'live', note:'Strong ecology coverage'},
    {id:'europepmc', label:'Europe PMC', status:'live', note:'Environmental journals'},
    {id:'gbif', label:'GBIF', status:'live', note:'Species distributions'},
    {id:'inat', label:'iNaturalist', status:'live', note:'Field observations'},
    {id:'zenodo', label:'Zenodo', status:'live', note:'Environmental datasets'},
    {id:'eartharxiv', label:'EarthArXiv', status:'stub', note:'Earth & environ. preprints'},
    {id:'crossref', label:'Crossref', status:'live', note:'Journal metadata'},
    {id:'eppo', label:'EPPO Global DB', status:'stub', note:'Pest & plant health data'},
    {id:'bold', label:'BOLD Systems', status:'stub', note:'Barcode ecology studies'},
  ]},
  medicine:    { label: 'Medicine & Health Sciences',       defaultOn: ['pubmed','europepmc','biorxiv','openalex','crossref'], available: [
    {id:'pubmed', label:'PubMed (via EPMC)', status:'live', note:'Gold standard for medicine'},
    {id:'europepmc', label:'Europe PMC', status:'live', note:'Open access medical papers'},
    {id:'biorxiv', label:'medRxiv', status:'live', note:'Medical preprints'},
    {id:'openalex', label:'OpenAlex', status:'live', note:'Broad medical coverage'},
    {id:'crossref', label:'Crossref', status:'live', note:'Clinical trial registrations'},
    {id:'zenodo', label:'Zenodo', status:'live', note:'Health datasets & grey lit.'},
    {id:'plos', label:'PLOS Medicine', status:'stub', note:'Open-access medical journals'},
    {id:'ncbi', label:'NCBI / PubMed Central', status:'stub', note:'Full-text medical articles'},
  ]},
  physics:     { label: 'Physics & Astronomy',              defaultOn: ['arxiv','openalex','crossref','zenodo'], available: [
    {id:'arxiv', label:'arXiv', status:'live', note:'Primary physics preprint server'},
    {id:'openalex', label:'OpenAlex', status:'live', note:'Broad physics literature'},
    {id:'crossref', label:'Crossref', status:'live', note:'Published journal articles'},
    {id:'zenodo', label:'Zenodo', status:'live', note:'CERN-hosted open data'},
    {id:'nasaads', label:'NASA ADS', status:'stub', note:'Astronomy — requires free API key'},
    {id:'inspire', label:'INSPIRE-HEP', status:'stub', note:'High-energy physics literature'},
  ]},
  mathematics: { label: 'Mathematics & Statistics',         defaultOn: ['arxiv','openalex','crossref','zenodo'], available: [
    {id:'arxiv', label:'arXiv (math)', status:'live', note:'Primary math preprint server'},
    {id:'openalex', label:'OpenAlex', status:'live', note:'Covers pure & applied math'},
    {id:'crossref', label:'Crossref', status:'live', note:'Mathematical journals'},
    {id:'zenodo', label:'Zenodo', status:'live', note:'Math software & datasets'},
    {id:'zbmath', label:'zbMATH Open', status:'stub', note:'Mathematics literature database'},
    {id:'semanticscholar', label:'Semantic Scholar', status:'live', note:'Good math & CS coverage'},
  ]},
  cs:          { label: 'Computer Science & Engineering',   defaultOn: ['arxiv','semanticscholar','openalex','crossref','zenodo'], available: [
    {id:'arxiv', label:'arXiv (cs)', status:'live', note:'Primary CS preprint server'},
    {id:'semanticscholar', label:'Semantic Scholar', status:'live', note:'Strong AI/ML/CS coverage'},
    {id:'openalex', label:'OpenAlex', status:'live', note:'Broad CS literature'},
    {id:'crossref', label:'Crossref', status:'live', note:'IEEE, ACM proceedings'},
    {id:'zenodo', label:'Zenodo', status:'live', note:'Code, datasets, preprints'},
    {id:'biorxiv', label:'bioRxiv (bioinf.)', status:'live', note:'Bioinformatics preprints'},
    {id:'engrxiv', label:'engrXiv', status:'stub', note:'Engineering preprints'},
  ]},
  chemistry:   { label: 'Chemistry & Materials Science',    defaultOn: ['openalex','crossref','zenodo','arxiv'], available: [
    {id:'openalex', label:'OpenAlex', status:'live', note:'Chemistry journal coverage'},
    {id:'crossref', label:'Crossref', status:'live', note:'ACS, RSC, Wiley journals'},
    {id:'zenodo', label:'Zenodo', status:'live', note:'Chemistry datasets'},
    {id:'arxiv', label:'arXiv (chem-ph)', status:'live', note:'Chemical physics preprints'},
    {id:'chemrxiv', label:'ChemRxiv', status:'stub', note:'Chemistry preprints via Crossref'},
    {id:'pubchem', label:'PubChem', status:'stub', note:'Chemical compound database'},
  ]},
  social:      { label: 'Social Sciences & Humanities',     defaultOn: ['openalex','crossref','zenodo','semanticscholar'], available: [
    {id:'openalex', label:'OpenAlex', status:'live', note:'Growing social sciences coverage'},
    {id:'crossref', label:'Crossref', status:'live', note:'Social science journals'},
    {id:'zenodo', label:'Zenodo', status:'live', note:'Social data & grey lit.'},
    {id:'semanticscholar', label:'Semantic Scholar', status:'live', note:'Social science papers'},
    {id:'ssrn', label:'SSRN', status:'stub', note:'Working papers via Crossref'},
    {id:'socarxiv', label:'SocArXiv', status:'stub', note:'Social sciences preprints'},
    {id:'psyarxiv', label:'PsyArXiv', status:'stub', note:'Psychology preprints'},
  ]},
  economics:   { label: 'Economics & Business',             defaultOn: ['openalex','crossref','zenodo','arxiv'], available: [
    {id:'openalex', label:'OpenAlex', status:'live', note:'Economics journal coverage'},
    {id:'crossref', label:'Crossref', status:'live', note:'Economics journals & books'},
    {id:'zenodo', label:'Zenodo', status:'live', note:'Economic datasets'},
    {id:'arxiv', label:'arXiv (econ)', status:'live', note:'Economics preprints since 2017'},
    {id:'ssrn', label:'SSRN', status:'stub', note:'Working papers via Crossref'},
    {id:'repec', label:'EconPapers / RePEC', status:'stub', note:'OAI-PMH, CORS issues'},
  ]},
  geosciences: { label: 'Geosciences & Earth Sciences',     defaultOn: ['openalex','crossref','zenodo','gbif'], available: [
    {id:'openalex', label:'OpenAlex', status:'live', note:'Geoscience journal coverage'},
    {id:'crossref', label:'Crossref', status:'live', note:'Earth science journals'},
    {id:'zenodo', label:'Zenodo', status:'live', note:'Geo datasets & models'},
    {id:'gbif', label:'GBIF', status:'live', note:'Species / geo occurrence'},
    {id:'eartharxiv', label:'EarthArXiv', status:'stub', note:'Earth science preprints'},
    {id:'nasaads', label:'NASA ADS', status:'stub', note:'Space & atmospheric science'},
    {id:'pangaea', label:'PANGAEA', status:'stub', note:'Earth & environmental data'},
  ]},
};

// Build General = superset of all DBs, no ResearchGate
(function buildGeneral() {
  const allDBs = new Map();
  Object.values(DISCIPLINE_DB_MAP).forEach(disc =>
    (disc.available || []).forEach(db => { if (!allDBs.has(db.id)) allDBs.set(db.id, db); })
  );
  DISCIPLINE_DB_MAP.general.available = [...allDBs.values()];
})();

// ── MULTI-SELECT DISCIPLINES ─────────────────────────────────────
// Multiple disciplines can now be checked at once. Their database
// lists and default-on sets are MERGED (union), not replaced.
let _checkedDisciplines = new Set(['general']);
let _currentDisciplineChecked = new Set(DISCIPLINE_DB_MAP.general.defaultOn);

function mergedAvailableDBs(disciplineKeys) {
  const merged = new Map();
  disciplineKeys.forEach(key => {
    const map = DISCIPLINE_DB_MAP[key];
    if (!map) return;
    (map.available || []).forEach(db => { if (!merged.has(db.id)) merged.set(db.id, db); });
  });
  return [...merged.values()];
}
function mergedDefaultOn(disciplineKeys) {
  const set = new Set();
  disciplineKeys.forEach(key => { (DISCIPLINE_DB_MAP[key]?.defaultOn || []).forEach(id => set.add(id)); });
  return set;
}

export function renderDisciplinePicker() {
  const container = document.getElementById('discipline-picker');
  if (!container) return;
  container.innerHTML = Object.entries(DISCIPLINE_DB_MAP).map(([key, map]) => {
    const isChecked = _checkedDisciplines.has(key);
    return `<label class="chip">
      <input type="checkbox" value="${key}" ${isChecked ? 'checked' : ''} onchange="SWDDiscipline.onDisciplineToggle()" />
      ${esc(map.label)}
    </label>`;
  }).join('');
}

export function renderDisciplineSelector() {
  const container = document.getElementById('discipline-db-panel');
  if (!container) return;
  const keys = [..._checkedDisciplines];
  const available = mergedAvailableDBs(keys.length ? keys : ['general']);
  container.innerHTML = available.map(db => {
    const isChecked = _currentDisciplineChecked.has(db.id);
    const statusNote = db.status === 'stub' ? ' <span class="db-stub-note">(stub)</span>' : '';
    const isDisabled = db.status === 'noapl';
    return `<label class="chip" style="${isDisabled ? 'opacity:.4;cursor:not-allowed' : ''}">
      <input type="checkbox" value="${db.id}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} onchange="SWDDiscipline.onChipChange()" />
      ${esc(db.label)}${statusNote}
    </label>`;
  }).join('');
}

export const SWDDiscipline = {
  // Called when a discipline checkbox is toggled — merges DB lists
  onDisciplineToggle() {
    const chips = document.querySelectorAll('#discipline-picker input[type="checkbox"]');
    _checkedDisciplines = new Set([...chips].filter(c => c.checked).map(c => c.value));
    if (!_checkedDisciplines.size) _checkedDisciplines.add('general');
    _currentDisciplineChecked = mergedDefaultOn([..._checkedDisciplines]);
    renderDisciplineSelector();
    SWDDiscipline.syncToSettings();
  },
  onChipChange() {
    const chips = document.querySelectorAll('#discipline-db-panel input[type="checkbox"]');
    _currentDisciplineChecked = new Set([...chips].filter(c => c.checked).map(c => c.value));
    SWDDiscipline.syncToSettings();
  },
  syncToSettings() {
    document.querySelectorAll('#chips-academic input, #chips-gov input, #chips-bio input').forEach(c => {
      c.checked = _currentDisciplineChecked.has(c.value);
    });
  },
  getChecked() { return [..._currentDisciplineChecked]; },
  getCheckedDisciplines() { return [..._checkedDisciplines]; },
  setDisciplines(keys) {
    _checkedDisciplines = new Set(Array.isArray(keys) && keys.length ? keys : ['general']);
    _currentDisciplineChecked = mergedDefaultOn([..._checkedDisciplines]);
    renderDisciplinePicker();
    renderDisciplineSelector();
    SWDDiscipline.syncToSettings();
  },
  requestNewDB() {
    const body = `Hi Mehregan,\n\nI would like to request a new database connector.\n\nDatabase name: \nURL / API docs: \nFree public API: \nDiscipline(s): \nWhy useful: \n\nThank you!`;
    window.open(`mailto:?subject=${encodeURIComponent('SciWide Search — Database connector request')}&body=${encodeURIComponent(body)}`);
  },
};

// ── Content scope presets ────────────────────────────────────────
export const SCOPE_PRESETS = {
  general:     ['field study','monitoring','first record','distribution survey','review','meta-analysis','modelling','grey literature','thesis','conference paper','observational study'],
  biology:     ['field study','trapping','specimen collection','DNA barcoding','first record','host plant survey','lab colony origin','monitoring','review','meta-analysis','morphological identification'],
  ecology:     ['field survey','monitoring','occurrence data','distribution mapping','species inventory','population study','habitat assessment','review','modelling','citizen science','abundance estimate'],
  medicine:    ['randomised controlled trial','systematic review','clinical trial','cohort study','case-control study','meta-analysis','observational study','case report','in vitro','in vivo','cross-sectional study'],
  physics:     ['experimental study','theoretical analysis','simulation','observational astronomy','telescope survey','particle physics','quantum mechanics','review','conference proceedings','numerical modelling'],
  mathematics: ['theorem','proof','algorithm','numerical analysis','statistical method','computational model','survey paper','applied mathematics','pure mathematics','combinatorics'],
  cs:          ['algorithm','machine learning','deep learning','software engineering','benchmark','experimental evaluation','system design','review','preprint','neural network','dataset'],
  chemistry:   ['synthesis','spectroscopy','crystallography','reaction study','computational chemistry','materials characterisation','in vitro','review','quantum chemistry','catalysis'],
  social:      ['qualitative study','quantitative survey','ethnography','discourse analysis','systematic review','historical analysis','policy analysis','case study','interview study','mixed methods'],
  economics:   ['empirical study','econometric analysis','experimental economics','policy evaluation','working paper','systematic review','case study','modelling','regression analysis','field experiment'],
  geosciences: ['field survey','geophysical measurement','remote sensing','climate model','palaeoclimatology','geochemistry','stratigraphy','review','satellite data','sediment core'],
};

let _scopeTerms = new Set();

function _syncScopeToLegacy() {
  const hidden = document.getElementById('chips-scope');
  if (!hidden) return;
  hidden.innerHTML = [..._scopeTerms].map(t =>
    `<label><input type="checkbox" value="${esc(t)}" checked /></label>`
  ).join('');
}

// FIX: scope chip delete bug. The old version embedded JSON.stringify(t)
// (which produces double quotes) inside an onclick="..." HTML attribute
// that is ALSO double-quote delimited — this broke the attribute parsing
// and silently failed. Now we use a data-term attribute + a single
// delegated click listener (wired once in app.js / here on first render),
// so no string ever has to be safely embedded inside an inline handler.
export function renderScopeChips() {
  const container = document.getElementById('scope-chips');
  if (!container) return;
  if (!_scopeTerms.size) {
    container.innerHTML = '<span class="scope-empty">No scope terms yet — select a preset or add your own.</span>';
    _syncScopeToLegacy(); return;
  }
  container.innerHTML = [..._scopeTerms].map(t =>
    `<span class="scope-chip">${esc(t)}<button class="scope-chip-remove" data-term="${esc(t)}" title="Remove">&times;</button></span>`
  ).join('');
  _syncScopeToLegacy();
}

// Event delegation: one listener on the container handles all remove clicks,
// reading the raw (non-HTML-escaped) term from a WeakMap keyed by the escaped
// label is unnecessary — dataset.term is already HTML-decoded by the browser
// when read via .dataset, so esc() round-trips safely here.
let _scopeDelegationWired = false;
function wireScopeDelegation() {
  if (_scopeDelegationWired) return;
  const container = document.getElementById('scope-chips');
  if (!container) return;
  container.addEventListener('click', e => {
    const btn = e.target.closest('.scope-chip-remove');
    if (!btn) return;
    const term = btn.dataset.term;
    if (term) SWDScope.remove(term);
  });
  _scopeDelegationWired = true;
}

export const SWDScope = {
  loadPreset(key) {
    const terms = SCOPE_PRESETS[key] || SCOPE_PRESETS.general;
    const allPreset = new Set(Object.values(SCOPE_PRESETS).flat());
    const custom = [..._scopeTerms].filter(t => !allPreset.has(t));
    if (custom.length && !confirm(`Loading a preset will replace ${custom.length} custom term(s). Continue?`)) return;
    _scopeTerms = new Set(terms);
    renderScopeChips();
    wireScopeDelegation();
  },
  add(term) {
    const t = (term || '').trim();
    if (!t) return;
    _scopeTerms.add(t);
    renderScopeChips();
    wireScopeDelegation();
  },
  remove(term) { _scopeTerms.delete(term); renderScopeChips(); },
  clear() { _scopeTerms.clear(); renderScopeChips(); },
  getTerms() { return [..._scopeTerms]; },
  restore(arr) {
    if (Array.isArray(arr)) { _scopeTerms = new Set(arr); renderScopeChips(); wireScopeDelegation(); }
  },
};

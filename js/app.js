// ═══════════════════════════════════════════════════════════════
// APP.JS — entry point (ES module)
// ═══════════════════════════════════════════════════════════════
import { state, lines, esc, DB_LABELS, STUB_DBS, ONCE_DBS, logSearch, clearSearchLog } from './modules/state.js';
import { LIVE_SCHEMA, customFields, getActiveSchema, renderSchemaEditor, renderSchemaPreview, SWDSchema } from './modules/schema.js';
import { engineQuery, resetEngineCache } from './modules/engines.js';
import { processHit, isDuplicate, resetSeen } from './modules/extractor.js';
import { SWDExportFn, exportFilteredCSV, exportFilteredJSON } from './modules/export.js';
import { serializePreset, applyPreset, savePreset, loadPresetFile, handlePresetFile, loadPresetFromUrl, loadBundledPreset, connectPresetDeps } from './modules/presets.js';
import { SWDSlots, slots, renderSlots, applySlots } from './modules/slots.js';
import { scoreSchemaFit, scoreTermRelevance, getExportOptions, updateSizeWarning, SWDScores } from './modules/scores.js';
import { SWDReq, renderRequirements, applyRequirementsWithFullText } from './modules/requirements.js';
import { DISCIPLINE_DB_MAP, SWDDiscipline, renderDisciplinePicker, renderDisciplineSelector, SWDScope, SCOPE_PRESETS } from './modules/databases.js';
import { SWDSelection, renderSelectionBar, withScopeCheck, initScopeModal } from './modules/selection.js';
import { switchTab, renderTable, renderPaywallPanel, renderScreeningCounts, renderMissingSources, initAccordions, logMsg, setProgress, setStatus, updateStats } from './modules/ui.js';
import { generateSynonymPrompt, parseSynonymReplyAndApply } from './modules/extraction.js';
import { downloadAIExport, parseAIResponse, mergeAIResults } from './modules/aiexport.js';

// ── Expose globals for inline HTML handlers ─────────────────────
window.SWDSchema    = SWDSchema;
window.SWDSlots     = SWDSlots;
window.SWDScores    = SWDScores;
window.SWDReq       = SWDReq;
window.SWDDiscipline = SWDDiscipline;
window.SWDScope     = SWDScope;
window.SWDSelection = SWDSelection;
window.SWDExportFn  = SWDExportFn;
window._renderTable = renderTable;

// Wrap export fns with scope check (session-summary exports bypass it)
(function wrapExports() {
  const NO_SCOPE = new Set(['passing','flagged','searchLog','markdown','missing','schema']);
  const orig = { ...SWDExportFn };
  Object.keys(orig).forEach(k => {
    SWDExportFn[k] = NO_SCOPE.has(k) ? (...args) => orig[k](...args) : (...args) => withScopeCheck(orig[k], args);
  });
  const origSlotExport = SWDSlots.exportSlot.bind(SWDSlots);
  const origSlotAll   = SWDSlots.exportAll.bind(SWDSlots);
  SWDSlots.exportSlot = id => withScopeCheck(origSlotExport, [id]);
  SWDSlots.exportAll  = ()  => withScopeCheck(origSlotAll,   []);
})();

window.copyDOI = function(doi, codeId) {
  navigator.clipboard.writeText(doi).then(() => {
    const el = document.getElementById(codeId);
    if (el) { el.style.background = 'var(--accent-lt)'; setTimeout(() => el.style.background = '', 1200); }
  });
};
window.copyCitation = function(btn) {
  navigator.clipboard.writeText('Ebrahimi, M. (2026). SciWide Search [Software]. https://github.com/mehregan59/Sc_wide_Search').then(() => {
    if (btn) { const o = btn.textContent; btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = o, 1500); }
  });
};

// ── Settings ─────────────────────────────────────────────────────
function getSettings() {
  return {
    primaryTerms:  lines('cfg-primary'),
    synonymTerms:  lines('cfg-synonyms'),
    extraTerms:    lines('cfg-extra'),
    excludeTerms:  lines('cfg-exclude'),
    yearFrom:      parseInt(document.getElementById('cfg-yr-from').value) || null,
    yearTo:        parseInt(document.getElementById('cfg-yr-to').value)   || null,
    maxPerQuery:   parseInt(document.getElementById('cfg-max').value)     || 500,
    languages:     document.getElementById('cfg-langs').value.split(',').map(s => s.trim()).filter(Boolean),
    geoReq:        0,
    databases:     SWDDiscipline.getChecked(),
    scope:         SWDScope.getTerms(),
  };
}

// ── Sync scope presets when discipline set changes ───────────────
function syncScopeToDisciplines() {
  const keys = SWDDiscipline.getCheckedDisciplines();
  const mergedTerms = new Set();
  keys.forEach(k => (SCOPE_PRESETS[k] || []).forEach(t => mergedTerms.add(t)));
  if (!mergedTerms.size) return;
  const allPresetTerms = new Set(Object.values(SCOPE_PRESETS).flat());
  const customTerms = SWDScope.getTerms().filter(t => !allPresetTerms.has(t));
  SWDScope.restore([...mergedTerms, ...customTerms]);
  const sel = document.getElementById('scope-preset-select');
  if (sel) sel.value = '';
}

// ── Synonym prompt modal (Configure tab) ──────────────────────────
function openSynonymModal() {
  const modal = document.getElementById('synonym-modal');
  const out = document.getElementById('synonym-modal-prompt');
  const prompt = generateSynonymPrompt();
  if (out) out.value = prompt || 'No text-matching requirements yet \u2014 add at least one "Abstract contains", "Title contains", or "Custom rule" requirement first, then reopen this.';
  const reply = document.getElementById('synonym-modal-reply');
  if (reply) reply.value = '';
  if (modal) modal.classList.add('visible');
}
function closeSynonymModal() {
  document.getElementById('synonym-modal')?.classList.remove('visible');
}

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  connectPresetDeps({ renderMissingSources, renderTable, logMsg });
  renderSchemaEditor();
  renderSchemaPreview();
  renderMissingSources();
  renderSlots();
  renderRequirements();
  renderDisciplinePicker();
  renderDisciplineSelector();
  SWDScope.loadPreset('general');
  initScopeModal();
  initAccordions();
  renderSelectionBar();

  document.querySelectorAll('.nav-tab').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  );

  document.getElementById('btn-start-from-config')?.addEventListener('click', () => { switchTab('run'); guardedStartSearch(); });
  document.getElementById('btn-reset-config')?.addEventListener('click', () => {
    ['cfg-yr-from','cfg-yr-to','cfg-extra','cfg-exclude'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('cfg-max').value = '500';
    SWDDiscipline.setDisciplines(['general']);
    SWDScope.loadPreset('general');
  });

  document.getElementById('discipline-picker')?.addEventListener('change', e => {
    if (e.target && e.target.matches('input[type="checkbox"]')) syncScopeToDisciplines();
  });

  document.getElementById('scope-preset-select')?.addEventListener('change', e => {
    if (e.target.value) { SWDScope.loadPreset(e.target.value); e.target.value = ''; }
  });
  const scopeAddInput = document.getElementById('scope-add-input');
  document.getElementById('btn-add-scope')?.addEventListener('click', () => { SWDScope.add(scopeAddInput?.value || ''); if (scopeAddInput) scopeAddInput.value = ''; });
  scopeAddInput?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); SWDScope.add(e.target.value); e.target.value = ''; } });

  document.getElementById('btn-save-preset')?.addEventListener('click', savePreset);
  document.getElementById('btn-load-preset-file')?.addEventListener('click', loadPresetFile);
  document.getElementById('preset-file-input')?.addEventListener('change', handlePresetFile);
  document.getElementById('btn-load-preset-url')?.addEventListener('click', loadPresetFromUrl);
  document.getElementById('btn-load-bundled-preset')?.addEventListener('click', loadBundledPreset);

  document.getElementById('btn-add-custom-field')?.addEventListener('click', () => SWDSchema.addCustomField());
  document.getElementById('btn-add-slot')?.addEventListener('click', () => SWDSlots.add());
  document.getElementById('kw-modal-cancel')?.addEventListener('click', () => { document.getElementById('kw-modal').style.display = 'none'; });
  document.getElementById('kw-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });

  document.getElementById('btn-add-req')?.addEventListener('click', () => SWDReq.add());
  document.querySelectorAll('.req-suggestion-chip').forEach(chip => chip.addEventListener('click', () =>
    SWDReq.add(chip.dataset.type, chip.dataset.label, chip.dataset.value || '')
  ));

  // ── Synonym prompt modal ────────────────────────────────────────
  document.getElementById('btn-open-synonym-modal')?.addEventListener('click', openSynonymModal);
  document.getElementById('synonym-modal-close')?.addEventListener('click', closeSynonymModal);
  document.getElementById('synonym-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeSynonymModal(); });
  document.getElementById('btn-synonym-modal-apply')?.addEventListener('click', () => {
    const text = document.getElementById('synonym-modal-reply')?.value || '';
    if (!text.trim()) { alert('Paste the AI\u2019s reply first.'); return; }
    const added = parseSynonymReplyAndApply(text);
    renderRequirements();
    if (added) { alert(`Added ${added} synonym term(s) to your requirements.`); closeSynonymModal(); }
    else alert('No matching requirement labels found in that reply \u2014 check the format matches "Label: term1, term2, ...".');
  });

  document.getElementById('btn-run')?.addEventListener('click', guardedStartSearch);
  document.getElementById('btn-stop')?.addEventListener('click', () => { if (state.abortCtrl) state.abortCtrl.abort(); });
  document.getElementById('btn-add-term')?.addEventListener('click', addMidTerm);
  document.getElementById('mid-term')?.addEventListener('keydown', e => { if (e.key === 'Enter') addMidTerm(); });
  document.getElementById('btn-apply-yr')?.addEventListener('click', () => {
    const f = document.getElementById('mid-yr-from').value, t = document.getElementById('mid-yr-to').value;
    if (f) document.getElementById('cfg-yr-from').value = f;
    if (t) document.getElementById('cfg-yr-to').value = t;
    logMsg(`Year range updated: ${f || '\u2014'}\u2013${t || '\u2014'}`, 'warn');
  });
  document.getElementById('btn-add-db')?.addEventListener('click', () => {
    const db = document.getElementById('mid-db-select').value; if (!db) return;
    logMsg(`Database queued: ${DB_LABELS[db] || db}`, 'ok');
    const el = document.querySelector(`input[value="${db}"]`); if (el) el.checked = true;
  });

  // ── AI Extraction tab ───────────────────────────────────────────
  document.getElementById('ai-batch-preset')?.addEventListener('change', e => {
    document.getElementById('ai-batch-custom-wrap').style.display = e.target.value === 'custom' ? '' : 'none';
  });
  document.getElementById('btn-ai-generate')?.addEventListener('click', async () => {
    const preset = document.getElementById('ai-batch-preset')?.value || 'all';
    const size = preset === 'custom' ? (document.getElementById('ai-batch-custom')?.value || 'all') : preset;
    await downloadAIExport(size);
  });
  document.getElementById('ai-import-file')?.addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { const ta = document.getElementById('ai-import-text'); if (ta) ta.value = ev.target.result; };
    reader.readAsText(file);
  });
  document.getElementById('btn-ai-merge')?.addEventListener('click', () => {
    const text = document.getElementById('ai-import-text')?.value || '';
    if (!text.trim()) { alert('Paste or upload the AI\u2019s response first.'); return; }
    const rows = parseAIResponse(text);
    if (!rows.length) { alert('Could not parse any rows from that text \u2014 check it\u2019s valid CSV or JSON.'); return; }
    const summary = mergeAIResults(rows);
    renderTable();
    const el = document.getElementById('ai-merge-summary');
    if (el) el.innerHTML = `
      <div class="req-panel-info" style="background:var(--accent-lt);border-color:var(--accent)">
        Parsed ${summary.total} row(s) &mdash;
        <strong>${summary.filled}</strong> fields filled,
        <strong>${summary.conflicts}</strong> conflicts flagged,
        <strong>${summary.duplicates}</strong> exact duplicates,
        <strong>${summary.unmatched}</strong> unmatched DOI(s).
      </div>`;
  });

  // ── Results tab ──────────────────────────────────────────────
  document.getElementById('res-search')?.addEventListener('input', renderTable);
  document.getElementById('res-verif')?.addEventListener('change', renderTable);
  document.getElementById('res-sort')?.addEventListener('change', renderTable);
  document.getElementById('res-req-filter')?.addEventListener('change', renderTable);
  document.getElementById('res-min-relevance')?.addEventListener('input', renderTable);
  document.querySelectorAll('.cat-filter-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); state.currentCat = btn.dataset.cat; renderTable();
  }));
  document.getElementById('res-download-csv')?.addEventListener('click', exportFilteredCSV);
  document.getElementById('res-download-json')?.addEventListener('click', exportFilteredJSON);
  document.getElementById('pagination-size')?.addEventListener('change', e => {
    const val = e.target.value;
    state.paginationSize = val === 'all' ? Infinity : parseInt(val);
    state.paginationPage = 1;
    const warnEl = document.getElementById('pagination-allwarn');
    if (warnEl) warnEl.style.display = (val === 'all' && state.records.length > 1000) ? 'inline' : 'none';
    renderTable();
  });

  document.getElementById('paywall-search')?.addEventListener('input', renderPaywallPanel);

  ['opt-abstract','opt-schema-fit','opt-term-rel'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { updateSizeWarning(); if (state.records.length) renderTable(); });
  });

  document.getElementById('cfg-missing')?.addEventListener('input', renderMissingSources);

  document.getElementById('clear-sel-confirm')?.addEventListener('click', () => {
    document.getElementById('clear-sel-modal')?.classList.remove('visible');
    state.selection.clear(); renderSelectionBar(); startSearch();
  });
  document.getElementById('clear-sel-cancel')?.addEventListener('click', () => {
    document.getElementById('clear-sel-modal')?.classList.remove('visible');
  });
  document.getElementById('clear-sel-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('visible');
  });
});

function addMidTerm() {
  const inp = document.getElementById('mid-term');
  const t = inp.value.trim(); if (!t) return;
  state.midTerms.push(t); inp.value = '';
  const chip = document.createElement('label');
  chip.className = 'chip'; chip.style.cursor = 'pointer';
  chip.innerHTML = `${esc(t)} <span style="opacity:.5;margin-left:4px">\u00d7</span>`;
  chip.addEventListener('click', () => { state.midTerms = state.midTerms.filter(x => x !== t); chip.remove(); });
  document.getElementById('mid-term-list').appendChild(chip);
  logMsg(`Added term: "${t}"`);
}

function guardedStartSearch() {
  if (state.isRunning) return;
  if (state.selection.size > 0) {
    const modal = document.getElementById('clear-sel-modal');
    const countEl = document.getElementById('clear-sel-count');
    if (countEl) countEl.textContent = state.selection.size;
    if (modal) modal.classList.add('visible');
    return;
  }
  startSearch();
}

async function startSearch() {
  if (state.isRunning) return;
  state.isRunning = true;
  state.abortCtrl = new AbortController();
  state.records.length = 0;
  state.selection.clear();
  renderSelectionBar();
  resetSeen();
  resetEngineCache();
  clearSearchLog();
  state.stats = { queries: 0, raw: 0, dedup: 0, records: 0, noloc: 0, errors: 0, skipped: 0 };
  Object.keys(state.catCounts).forEach(k => state.catCounts[k] = 0);
  document.getElementById('log-box').innerHTML = '';
  setProgress(0, 'Initialising\u2026');
  setStatus('running', 'Running');
  document.getElementById('btn-run').disabled = true;
  document.getElementById('btn-stop').disabled = false;

  const s = getSettings();
  state.lastSettings = s;
  const signal = state.abortCtrl.signal;
  const allTerms = [...s.primaryTerms, ...s.synonymTerms, ...s.extraTerms, ...state.midTerms].filter(Boolean);

  if (!allTerms.length) {
    logMsg('No search terms entered. Add terms in Configure, or load a preset.', 'err');
    setStatus('stopped', 'No terms'); setProgress(null, 'No terms');
    state.isRunning = false;
    document.getElementById('btn-run').disabled = false;
    document.getElementById('btn-stop').disabled = true;
    return;
  }

  const searchDBs = s.databases.filter(db => !STUB_DBS.has(db) && !ONCE_DBS.has(db));
  const occDBs   = s.databases.filter(db => ONCE_DBS.has(db));
  const stubDBs  = s.databases.filter(db => STUB_DBS.has(db));
  const total = (searchDBs.length * allTerms.length) + occDBs.length;
  let done = 0;

  logMsg(`Search started \u2014 ${searchDBs.length} search DBs \u00d7 ${allTerms.length} terms + ${occDBs.length} occurrence DBs`);
  if (stubDBs.length) logMsg(`Stubs (not yet wired): ${stubDBs.map(d => DB_LABELS[d] || d).join(', ')}`, 'warn');
  if (s.yearFrom || s.yearTo) logMsg(`Year range: ${s.yearFrom || 'open'}\u2013${s.yearTo || 'open'}`);

  async function processResults(db, term, hits) {
    state.stats.raw += hits.length;
    let n = 0, dupes = 0;
    for (const h of hits) {
      for (const r of processHit(h)) {
        if (isDuplicate(r)) { dupes++; continue; }
        state.records.push(r);
        n++; state.stats.dedup++;
        if (r.category === 'E') state.stats.noloc++;
        else { state.stats.records++; state.catCounts[r.category] = (state.catCounts[r.category] || 0) + 1; }
      }
    }
    logSearch(db, term, hits.length, n, dupes);
    return { n, dupes };
  }

  for (const db of occDBs) {
    if (signal.aborted) break;
    const label = DB_LABELS[db] || db;
    logMsg(`Fetching ${label}\u2026`); state.stats.queries++;
    try {
      const hits = await engineQuery(db, '', s, signal);
      if (hits === null) { logMsg(`  \u26a0 ${label} unreachable`, 'warn'); state.stats.skipped++; }
      else { const { n } = await processResults(db, '', hits); logMsg(`  \u2192 ${hits.length} occurrences \u00b7 ${n} new`, hits.length ? 'ok' : 'warn'); }
    } catch (e) { if (e.name === 'AbortError') break; state.stats.errors++; logMsg(`  \u2716 ${label}: ${e.message}`, 'err'); }
    updateStats(); done++; setProgress((done / total) * 100, label);
  }

  for (const db of searchDBs) {
    if (signal.aborted) break;
    const label = DB_LABELS[db] || db;
    for (const term of allTerms) {
      if (signal.aborted) break;
      logMsg(`${label} \u2190 "${term.slice(0, 55)}${term.length > 55 ? '\u2026' : ''}"`); state.stats.queries++; updateStats();
      try {
        const hits = await engineQuery(db, term, s, signal);
        if (hits === null) { logMsg(`  \u26a0 ${label} unreachable \u2014 skipped`, 'warn'); state.stats.skipped++; }
        else {
          const { n, dupes } = await processResults(db, term, hits);
          if (hits.length === 0) logMsg(`  \u2192 0 results`, 'warn');
          else logMsg(`  \u2192 ${hits.length} hits \u00b7 ${n} new \u00b7 ${dupes} dupes`, 'ok');
        }
      } catch (e) { if (e.name === 'AbortError') break; state.stats.errors++; logMsg(`  \u2716 ${label}: ${e.message}`, 'err'); }
      updateStats(); done++; setProgress((done / total) * 100, `${label} \u00b7 "${term.slice(0, 28)}"`);
    }
  }

  if (!signal.aborted && state.records.length) {
    logMsg('Checking requirements (with full-text fallback for open-access records)\u2026');
    const reqResult = await applyRequirementsWithFullText(state.records, (d, t) => {
      setProgress(null, `Checking requirements \u2014 record ${d} of ${t}\u2026`);
    });
    logMsg(`Requirements check complete \u2014 ${reqResult.fullTextFetched} full-text fetch(es) attempted.`, 'ok');
  }
  applySlots(state.records);
  SWDSlots.renderExportPanel();
  updateSizeWarning();

  const stopped = signal.aborted;
  setProgress(stopped ? null : 100, stopped ? 'Stopped' : 'Complete');
  setStatus(stopped ? 'stopped' : 'done', stopped ? 'Stopped' : 'Done');
  logMsg(stopped
    ? `Stopped. ${state.records.length} records.`
    : `Complete \u2014 ${state.records.length} records \u00b7 ${state.stats.errors} errors \u00b7 ${state.stats.skipped} skipped`,
    stopped ? 'warn' : 'ok');
  state.isRunning = false;
  document.getElementById('btn-run').disabled = false;
  document.getElementById('btn-stop').disabled = true;

  const badge = document.getElementById('badge-results');
  badge.textContent = state.records.length; badge.hidden = !state.records.length;
  const pwBadge = document.getElementById('badge-paywall');
  if (pwBadge) {
    const n = state.records.filter(r => r.doi && r.doi !== 'not reported' &&
      (r.pdf_available === 'paywalled' || r.pdf_available === 'no' || r.pdf_available === 'unknown')).length;
    pwBadge.textContent = n; pwBadge.hidden = !n;
  }
  renderTable(); renderPaywallPanel(); renderScreeningCounts();
  if (!stopped) switchTab('results');
}

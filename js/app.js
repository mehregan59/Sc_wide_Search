// ═══════════════════════════════════════════════════════════════
// APP.JS — entry point (ES module)
// Imports all modules, wires events, runs the search loop
// ═══════════════════════════════════════════════════════════════
import { state, lines, checked, setChecked, esc, DB_LABELS, STUB_DBS, ONCE_DBS, logSearch, clearSearchLog, screeningKey, getScreening, setScreening, clearScreening } from './modules/state.js';
import { LIVE_SCHEMA, customFields, getActiveSchema, renderSchemaEditor, renderSchemaPreview, SWDSchema } from './modules/schema.js';
import { engineQuery, resetEngineCache, sleep } from './modules/engines.js';
import { processHit, isDuplicate, resetSeen, applyRequirements as _applyReq } from './modules/extractor.js';
import { SWDExportFn, exportCSV, exportJSON } from './modules/export.js';
import { serializePreset, applyPreset, savePreset, loadPresetFile, handlePresetFile, loadPresetFromUrl, loadBundledPreset, connectPresetDeps } from './modules/presets.js';
import { SWDSlots, slots, renderSlots, applySlots } from './modules/slots.js';
import { scoreSchemaFit, scoreTermRelevance, getExportOptions, updateSizeWarning, SWDScores } from './modules/scores.js';
import { requirements, SWDReq, renderRequirements, applyRequirements } from './modules/requirements.js';
import { DISCIPLINE_DB_MAP, SWDDiscipline, renderDisciplineSelector, SWDScope, renderScopeChips, SCOPE_PRESETS } from './modules/databases.js';
import { SWDSelection, renderSelectionBar, renderPaginationControls, withScopeCheck, initScopeModal, getSelectedRecords } from './modules/selection.js';
import { switchTab, renderTable, renderPaywallPanel, renderScreeningCounts, renderMissingSources, initAccordions, logMsg, setProgress, setStatus, updateStats } from './modules/ui.js';

// ── Expose globals for inline HTML event handlers ───────────────
window.SWDSchema = SWDSchema;
window.SWDSlots = SWDSlots;
window.SWDScores = SWDScores;
window.SWDReq = SWDReq;
window.SWDDiscipline = SWDDiscipline;
window.SWDScope = SWDScope;
window.SWDSelection = SWDSelection;
window.SWDExportFn = SWDExportFn;
window._renderTable = renderTable; // used by selection.js

// Wrap every export fn with scope check
(function wrapExports() {
  const orig = { ...SWDExportFn };
  Object.keys(orig).forEach(k => { SWDExportFn[k] = (...args) => withScopeCheck(orig[k], args); });
  const origSlotExport = SWDSlots.exportSlot.bind(SWDSlots);
  const origSlotAll = SWDSlots.exportAll.bind(SWDSlots);
  SWDSlots.exportSlot = id => withScopeCheck(origSlotExport, [id]);
  SWDSlots.exportAll = () => withScopeCheck(origSlotAll, []);
})();

// ── Screening (global for inline handlers) ───────────────────────
window.applyScreening = function(key, decision, reasonId) {
  const reason = (document.getElementById(reasonId)?.value || '').trim();
  const r = state.records.find(rec => screeningKey(rec) === key);
  if (r) setScreening(r, decision, reason);
  renderTable();
  renderScreeningCounts();
};
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
    primaryTerms: lines('cfg-primary'), synonymTerms: lines('cfg-synonyms'),
    extraTerms: lines('cfg-extra'), excludeTerms: lines('cfg-exclude'),
    yearFrom: parseInt(document.getElementById('cfg-yr-from').value) || null,
    yearTo: parseInt(document.getElementById('cfg-yr-to').value) || null,
    maxPerQuery: parseInt(document.getElementById('cfg-max').value) || 500,
    languages: document.getElementById('cfg-langs').value.split(',').map(s => s.trim()).filter(Boolean),
    geoReq: 0,
    databases: SWDDiscipline.getChecked(),
    scope: SWDScope.getTerms(),
  };
}

// ── Init UI ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  connectPresetDeps({ renderMissingSources, renderTable, logMsg });
  renderSchemaEditor();
  renderSchemaPreview();
  renderMissingSources();
  renderSlots();
  renderRequirements();
  renderDisciplineSelector();
  SWDScope.loadPreset('general');
  initScopeModal();
  initAccordions();
  renderSelectionBar();

  // ── Nav tabs ────────────────────────────────────────────────
  document.querySelectorAll('.nav-tab').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  );

  // ── Configure tab ───────────────────────────────────────────
  document.getElementById('btn-start-from-config')?.addEventListener('click', () => { switchTab('run'); guardedStartSearch(); });
  document.getElementById('btn-reset-config')?.addEventListener('click', () => {
    document.getElementById('cfg-yr-from').value = '';
    document.getElementById('cfg-yr-to').value = '';
    document.getElementById('cfg-max').value = '500';
    document.getElementById('cfg-extra').value = '';
    document.getElementById('cfg-exclude').value = '';
    SWDScope.loadPreset('general');
  });

  // ── Discipline selector ─────────────────────────────────────
  document.getElementById('db-discipline-select')?.addEventListener('change', () => {
    SWDDiscipline.onDisciplineChange();
    const disc = document.getElementById('db-discipline-select').value;
    if (SCOPE_PRESETS[disc]) {
      SWDScope.loadPreset(disc);
      const sel = document.getElementById('scope-preset-select');
      if (sel) sel.value = '';
    }
  });

  // ── Scope preset + add ──────────────────────────────────────
  document.getElementById('scope-preset-select')?.addEventListener('change', e => {
    if (e.target.value) { SWDScope.loadPreset(e.target.value); e.target.value = ''; }
  });
  const scopeAddInput = document.getElementById('scope-add-input');
  document.getElementById('btn-add-scope')?.addEventListener('click', () => {
    SWDScope.add(scopeAddInput?.value || ''); if (scopeAddInput) scopeAddInput.value = '';
  });
  scopeAddInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); SWDScope.add(e.target.value); e.target.value = ''; }
  });

  // ── Presets ─────────────────────────────────────────────────
  document.getElementById('btn-save-preset')?.addEventListener('click', savePreset);
  document.getElementById('btn-load-preset-file')?.addEventListener('click', loadPresetFile);
  document.getElementById('preset-file-input')?.addEventListener('change', handlePresetFile);
  document.getElementById('btn-load-preset-url')?.addEventListener('click', loadPresetFromUrl);
  document.getElementById('btn-load-bundled-preset')?.addEventListener('click', loadBundledPreset);

  // ── Schema tab ───────────────────────────────────────────────
  document.getElementById('btn-add-custom-field')?.addEventListener('click', () => SWDSchema.addCustomField());
  document.getElementById('btn-add-slot')?.addEventListener('click', () => SWDSlots.add());
  document.getElementById('kw-modal-cancel')?.addEventListener('click', () => { document.getElementById('kw-modal').style.display = 'none'; });
  document.getElementById('kw-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });

  // ── Requirements ────────────────────────────────────────────
  document.getElementById('btn-add-req')?.addEventListener('click', () => SWDReq.add());
  document.querySelectorAll('.req-suggestion-chip').forEach(chip => chip.addEventListener('click', () =>
    SWDReq.add(chip.dataset.type, chip.dataset.label, chip.dataset.value || '')
  ));

  // ── Run tab ──────────────────────────────────────────────────
  document.getElementById('btn-run')?.addEventListener('click', guardedStartSearch);
  document.getElementById('btn-stop')?.addEventListener('click', () => { if (state.abortCtrl) state.abortCtrl.abort(); });
  document.getElementById('btn-add-term')?.addEventListener('click', addMidTerm);
  document.getElementById('mid-term')?.addEventListener('keydown', e => { if (e.key === 'Enter') addMidTerm(); });
  document.getElementById('btn-apply-yr')?.addEventListener('click', () => {
    const f = document.getElementById('mid-yr-from').value, t = document.getElementById('mid-yr-to').value;
    if (f) document.getElementById('cfg-yr-from').value = f;
    if (t) document.getElementById('cfg-yr-to').value = t;
    logMsg(`Year range updated: ${f || '—'}–${t || '—'}`, 'warn');
  });
  document.getElementById('btn-add-db')?.addEventListener('click', () => {
    const db = document.getElementById('mid-db-select').value;
    if (!db) return;
    logMsg(`Database queued: ${DB_LABELS[db] || db}`, 'ok');
    const el = document.querySelector(`input[value="${db}"]`);
    if (el) el.checked = true;
  });

  // ── Results tab ──────────────────────────────────────────────
  document.getElementById('res-search')?.addEventListener('input', renderTable);
  document.getElementById('res-verif')?.addEventListener('change', renderTable);
  document.getElementById('res-sort')?.addEventListener('change', renderTable);
  document.getElementById('res-req-filter')?.addEventListener('change', renderTable);
  document.getElementById('res-screen-filter')?.addEventListener('change', e => { state.screenFilter = e.target.value; renderTable(); });
  document.querySelectorAll('.cat-filter-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); state.currentCat = btn.dataset.cat; renderTable();
  }));
  document.getElementById('btn-clear-selection')?.addEventListener('click', () => SWDSelection.clear());
  document.getElementById('pagination-size')?.addEventListener('change', e => {
    const val = e.target.value;
    state.paginationSize = val === 'all' ? Infinity : parseInt(val);
    state.paginationPage = 1;
    const warnEl = document.getElementById('pagination-allwarn');
    if (warnEl) warnEl.style.display = (val === 'all' && state.records.length > 1000) ? 'inline' : 'none';
    renderTable();
  });

  // ── Paywall tab ──────────────────────────────────────────────
  document.getElementById('paywall-search')?.addEventListener('input', renderPaywallPanel);

  // ── Export tab ───────────────────────────────────────────────
  ['opt-abstract','opt-schema-fit','opt-term-rel'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      updateSizeWarning();
      if (state.records.length) renderTable();
    });
  });

  // ── Missing sources ──────────────────────────────────────────
  document.getElementById('cfg-missing')?.addEventListener('input', renderMissingSources);

  // ── Clear-selection confirm modal ────────────────────────────
  document.getElementById('clear-sel-confirm')?.addEventListener('click', () => {
    document.getElementById('clear-sel-modal')?.classList.remove('visible');
    state.selection.clear();
    renderSelectionBar();
    startSearch();
  });
  document.getElementById('clear-sel-cancel')?.addEventListener('click', () => {
    document.getElementById('clear-sel-modal')?.classList.remove('visible');
  });
  document.getElementById('clear-sel-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('visible');
  });
});

// ── Mid-run term injection ───────────────────────────────────────
function addMidTerm() {
  const inp = document.getElementById('mid-term');
  const t = inp.value.trim();
  if (!t) return;
  state.midTerms.push(t);
  inp.value = '';
  const chip = document.createElement('label');
  chip.className = 'chip';
  chip.style.cursor = 'pointer';
  chip.innerHTML = `${esc(t)} <span style="opacity:.5;margin-left:4px">×</span>`;
  chip.addEventListener('click', () => { state.midTerms = state.midTerms.filter(x => x !== t); chip.remove(); });
  document.getElementById('mid-term-list').appendChild(chip);
  logMsg(`Added term: "${t}"`);
}

// ── Clear-selection guard ────────────────────────────────────────
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

// ── Main search loop ─────────────────────────────────────────────
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
  clearScreening();
  state.stats = { queries: 0, raw: 0, dedup: 0, records: 0, noloc: 0, errors: 0, skipped: 0 };
  Object.keys(state.catCounts).forEach(k => state.catCounts[k] = 0);
  document.getElementById('log-box').innerHTML = '';
  setProgress(0, 'Initialising…');
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

  logMsg(`Search started — ${searchDBs.length} search DBs × ${allTerms.length} terms + ${occDBs.length} occurrence DBs`);
  if (stubDBs.length) logMsg(`Stubs (not yet wired): ${stubDBs.map(d => DB_LABELS[d] || d).join(', ')}`, 'warn');
  if (s.yearFrom || s.yearTo) logMsg(`Year range: ${s.yearFrom || 'open'}–${s.yearTo || 'open'}`);

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
    logMsg(`Fetching ${label}…`); state.stats.queries++;
    try {
      const hits = await engineQuery(db, '', s, signal);
      if (hits === null) { logMsg(`  ⚠ ${label} unreachable`, 'warn'); state.stats.skipped++; }
      else { const { n, dupes } = await processResults(db, '', hits); logMsg(`  → ${hits.length} occurrences · ${n} new`, hits.length ? 'ok' : 'warn'); }
    } catch (e) { if (e.name === 'AbortError') break; state.stats.errors++; logMsg(`  ✖ ${label}: ${e.message}`, 'err'); }
    updateStats(); done++; setProgress((done / total) * 100, label);
  }

  for (const db of searchDBs) {
    if (signal.aborted) break;
    const label = DB_LABELS[db] || db;
    for (const term of allTerms) {
      if (signal.aborted) break;
      logMsg(`${label} ← "${term.slice(0, 55)}${term.length > 55 ? '…' : ''}"`); state.stats.queries++; updateStats();
      try {
        const hits = await engineQuery(db, term, s, signal);
        if (hits === null) { logMsg(`  ⚠ ${label} unreachable — skipped`, 'warn'); state.stats.skipped++; }
        else {
          const { n, dupes } = await processResults(db, term, hits);
          if (hits.length === 0) logMsg(`  → 0 results`, 'warn');
          else logMsg(`  → ${hits.length} hits · ${n} new · ${dupes} dupes`, 'ok');
        }
      } catch (e) { if (e.name === 'AbortError') break; state.stats.errors++; logMsg(`  ✖ ${label}: ${e.message}`, 'err'); }
      updateStats(); done++; setProgress((done / total) * 100, `${label} · "${term.slice(0, 28)}"`);
    }
  }

  // Post-search: apply requirements, slots
  applyRequirements(state.records);
  applySlots(state.records);
  SWDSlots.renderExportPanel();
  updateSizeWarning();

  const stopped = signal.aborted;
  setProgress(stopped ? null : 100, stopped ? 'Stopped' : 'Complete');
  setStatus(stopped ? 'stopped' : 'done', stopped ? 'Stopped' : 'Done');
  logMsg(stopped ? `Stopped. ${state.records.length} records.` : `Complete — ${state.records.length} records · ${state.stats.errors} errors · ${state.stats.skipped} skipped`, stopped ? 'warn' : 'ok');
  state.isRunning = false;
  document.getElementById('btn-run').disabled = false;
  document.getElementById('btn-stop').disabled = true;

  const badge = document.getElementById('badge-results');
  badge.textContent = state.records.length; badge.hidden = !state.records.length;
  const pwBadge = document.getElementById('badge-paywall');
  if (pwBadge) {
    const n = state.records.filter(r => r.doi && r.doi !== 'not reported' && (r.pdf_available === 'paywalled' || r.pdf_available === 'no' || r.pdf_available === 'unknown')).length;
    pwBadge.textContent = n; pwBadge.hidden = !n;
  }
  renderTable(); renderPaywallPanel(); renderScreeningCounts();
  if (!stopped) switchTab('results');
}

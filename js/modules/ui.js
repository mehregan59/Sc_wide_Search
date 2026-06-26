// ═══════════════════════════════════════════════════════════════
// UI.JS — renderTable, renderPaywallPanel, screening UI, tabs
// ═══════════════════════════════════════════════════════════════
import { esc, state, screeningKey, getScreening, VERIF_CLASS, SCREEN_CLASS, DB_LABELS } from './state.js';
import { getActiveSchema } from './schema.js';
import { slots } from './slots.js';
import { scoreSchemaFit, scoreTermRelevance, getExportOptions } from './scores.js';
import { renderPaginationControls, SWDSelection, renderSelectionBar } from './selection.js';
import { requirements } from './requirements.js';

let _lastOpenAccordion = null;

export function switchTab(id) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const btn = document.querySelector(`.nav-tab[data-tab="${id}"]`);
  if (btn) btn.classList.add('active');
  const panel = document.getElementById(`panel-${id}`);
  if (panel) panel.classList.add('active');
  if (id === 'paywall') renderPaywallPanel();
  if (id === 'schema') { import('./schema.js').then(m => { m.renderSchemaEditor(); }); }
  if (id === 'export' && _lastOpenAccordion) {
    const g = document.getElementById(_lastOpenAccordion);
    if (g) g.classList.add('open');
  }
}

export function renderTable() {
  const active = getActiveSchema();
  const slotCols = slots.map(sl => ({ field: `slot_${sl.id}`, label: sl.label }));
  const opts = getExportOptions();
  const scoreCols = [];
  if (opts.includeSchemaFit) scoreCols.push({ field: '_schemaFit', label: 'Schema fit %' });
  if (opts.includeTermRelevance) scoreCols.push({ field: '_termRel', label: 'Term relevance %' });
  const reqFilter = document.getElementById('res-req-filter')?.value || '';
  const allCols = [...active, ...slotCols, ...scoreCols];
  const q = (document.getElementById('res-search')?.value || '').toLowerCase();
  const v = document.getElementById('res-verif')?.value || '';
  const sort = document.getElementById('res-sort')?.value || 'year_desc';

  let data = state.records.filter(r => {
    if (state.currentCat !== 'all' && r.category !== state.currentCat) return false;
    if (v && r.verification_status !== v) return false;
    if (state.screenFilter) {
      const dec = r._screen_decision || '';
      if (state.screenFilter === 'unscreened' && dec) return false;
      if (state.screenFilter !== 'unscreened' && dec !== state.screenFilter) return false;
    }
    if (reqFilter === 'fail' && !r._req_fail) return false;
    if (reqFilter === 'pass' && r._req_fail) return false;
    if (q) { const h = allCols.map(s => String(r[s.field] || '')).join(' ').toLowerCase(); if (!h.includes(q)) return false; }
    return true;
  });

  if (sort === 'year_desc') data.sort((a, b) => (b.pub_year || 0) - (a.pub_year || 0));
  if (sort === 'year_asc')  data.sort((a, b) => (a.pub_year || 0) - (b.pub_year || 0));
  if (sort === 'country_asc') data.sort((a, b) => (a.country || '').localeCompare(b.country || ''));
  if (sort === 'verif') data.sort((a, b) => (a.verification_status || '').localeCompare(b.verification_status || ''));

  state.filteredView = data;

  const thead = document.getElementById('results-thead');
  const allSel = data.length > 0 && data.every(r => state.selection.has(screeningKey(r)));
  if (thead) thead.innerHTML = '<tr><th class="row-select-cell"><input type="checkbox" class="select-all-checkbox" id="select-all-cb" ' + (allSel ? 'checked' : '') + ' /></th>' +
    allCols.map(s => `<th>${esc(s.label || s.field)}</th>`).join('') + '<th>Screen</th></tr>';
  const selectAllCb = document.getElementById('select-all-cb');
  if (selectAllCb) selectAllCb.addEventListener('change', e => {
    if (e.target.checked) SWDSelection.selectAllFiltered(data);
    else SWDSelection.deselectAllFiltered(data);
  });

  const tbody = document.getElementById('results-tbody');
  const totalCols = allCols.length + 2;
  if (!data.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${totalCols}">${state.records.length === 0 ? 'Run a search to see results.' : 'No records match the filter.'}</td></tr>`;
    document.getElementById('table-footer').textContent = '';
    renderPaginationControls(0);
    return;
  }

  const totalFiltered = data.length;
  const pageSize = state.paginationSize === Infinity ? totalFiltered : state.paginationSize;
  const startIdx = (state.paginationPage - 1) * pageSize;
  const pageData = data.slice(startIdx, startIdx + pageSize);

  // Use array index as the onclick identifier — avoids all key-encoding issues
  tbody.innerHTML = pageData.map((r, pageIdx) => {
    const globalIdx = state.records.indexOf(r);
    const dec = r._screen_decision || '';
    const reason = r._screen_reason || '';
    const rId = `sr-${globalIdx}-${Math.random().toString(36).slice(2, 5)}`;
    const isSelected = state.selection.has(screeningKey(r));
    const reqFail = r._req_fail;
    const selCell = `<td class="row-select-cell"><input type="checkbox" ${isSelected ? 'checked' : ''} onchange="SWDSelection.toggle('${esc(screeningKey(r))}')" /></td>`;
    const screenCell = `<td class="screen-cell">
      <div class="screen-btns">
        <button class="screen-btn ${dec === 'include' ? 'active-include' : ''}" onclick="applyScreening(${globalIdx},'include','${rId}')">\u2713</button>
        <button class="screen-btn ${dec === 'maybe'   ? 'active-maybe'   : ''}" onclick="applyScreening(${globalIdx},'maybe','${rId}')">?</button>
        <button class="screen-btn ${dec === 'exclude' ? 'active-exclude' : ''}" onclick="applyScreening(${globalIdx},'exclude','${rId}')">\u2717</button>
      </div>
      <input type="text" id="${rId}" class="screen-reason-input" value="${esc(reason)}" placeholder="reason" />
    </td>`;
    const rowClass = [dec ? 'row-' + dec : '', isSelected ? 'row-selected' : '', reqFail ? 'req-fail-row' : ''].filter(Boolean).join(' ');
    return `<tr class="${rowClass}">` + selCell + allCols.map(s => {
      if (s.field === '_schemaFit') return `<td style="font-family:var(--mono);font-size:11px;color:var(--accent)">${scoreSchemaFit(r)}%</td>`;
      if (s.field === '_termRel') return `<td style="font-family:var(--mono);font-size:11px;color:var(--blue)">${scoreTermRelevance(r)}%</td>`;
      const val = r[s.field];
      if (s.field === 'category') return `<td><span class="cat-pill cat-${(val || 'e').toLowerCase()}">${val || '?'}</span>${reqFail ? ' <span class="req-fail-badge" title="' + esc(r._req_fail_labels || '') + '">⚠ req</span>' : ''}</td>`;
      if (s.field === 'verification_status') return `<td><span class="verif-badge ${VERIF_CLASS[val] || 'verif-secondary'}" style="font-size:10px">${esc(val || '')}</span></td>`;
      if (s.field === 'screening_decision') return `<td><span class="${SCREEN_CLASS[dec] || 'screen-badge unscreened'}">${esc(dec || '\u2014')}</span></td>`;
      if (s.field === 'screening_reason') return `<td style="font-size:11px;color:var(--ink-3)">${esc(reason)}</td>`;
      if (s.field === 'doi' && val && val !== 'not reported') return `<td><a class="doi-link" href="https://doi.org/${val}" target="_blank" rel="noopener">DOI \u2192</a></td>`;
      if (s.field === 'url' && val && val !== 'not reported') return `<td><a class="doi-link" href="${esc(val)}" target="_blank" rel="noopener">URL \u2192</a></td>`;
      if (s.field === 'full_citation') return `<td class="truncate" title="${esc(String(val || ''))}">${esc(String(val || '').split('(')[0].trim().slice(0, 40))}</td>`;
      if (s.field.startsWith('slot_')) { const sv = val || ''; return `<td class="truncate" title="${esc(sv)}" style="font-size:11px;color:${sv === 'not found' ? 'var(--ink-3)' : 'var(--accent)'}">${esc(sv.slice(0, 50))}</td>`; }
      return `<td class="truncate">${esc(String(val || '\u2014'))}</td>`;
    }).join('') + screenCell + '</tr>';
  }).join('');

  document.getElementById('table-footer').textContent = `Showing ${startIdx + 1}\u2013${Math.min(startIdx + pageSize, totalFiltered)} of ${totalFiltered} records${totalFiltered !== state.records.length ? ` (filtered from ${state.records.length})` : ''}`;
  renderPaginationControls(totalFiltered);
}

export function renderPaywallPanel() {
  const el = document.getElementById('paywall-list');
  const countEl = document.getElementById('paywall-count');
  if (!el) return;
  const q = (document.getElementById('paywall-search')?.value || '').toLowerCase();
  let data = state.records.filter(r => r.doi && r.doi !== 'not reported' && (r.pdf_available === 'paywalled' || r.pdf_available === 'no' || r.pdf_available === 'unknown'));
  if (q) data = data.filter(r => [r.full_citation, r.country, String(r.pub_year || '')].join(' ').toLowerCase().includes(q));
  if (countEl) countEl.textContent = data.length ? `${data.length} papers` : '';
  if (!data.length) { el.innerHTML = '<div class="paywall-empty">No paywalled papers found. Run a search first.</div>'; return; }
  el.innerHTML = data.map((r, i) => {
    const au = (r.full_citation || '').split('(')[0].trim().slice(0, 80);
    const m = (r.full_citation || '').match(/\)\.\s+(.+?)\.\s+DOI:/);
    const title = m ? m[1].slice(0, 200) : (r.full_citation || '').slice(0, 120);
    return `<div class="paywall-row"><div class="paywall-index">${i + 1}</div><div class="paywall-body"><div class="paywall-title">${esc(title)}</div><div class="paywall-meta">${esc(au)} \u00b7 ${r.pub_year || 'n.d.'} \u00b7 ${esc(r.country || '\u2014')}</div><div class="paywall-doi"><code class="doi-code" id="doi-code-${i}">${esc(r.doi)}</code><button class="btn btn-sm paywall-copy" onclick="copyDOI('${r.doi}','doi-code-${i}')">Copy DOI</button></div><div class="paywall-actions"><a class="paywall-action-link" href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener">Publisher \u2192</a> <a class="paywall-action-link" href="https://scholar.google.com/scholar?q=${encodeURIComponent(r.doi)}" target="_blank" rel="noopener">Google Scholar \u2192</a> <a class="paywall-action-link" href="https://europepmc.org/search?query=${encodeURIComponent(r.doi)}" target="_blank" rel="noopener">Europe PMC \u2192</a> <a class="paywall-action-link" href="https://unpaywall.org/${esc(r.doi)}" target="_blank" rel="noopener">Unpaywall \u2192</a></div></div></div>`;
  }).join('');
}

export function renderScreeningCounts() {
  const records = state.records;
  const inc   = records.filter(r => r._screen_decision === 'include').length;
  const exc   = records.filter(r => r._screen_decision === 'exclude').length;
  const maybe = records.filter(r => r._screen_decision === 'maybe').length;
  const un    = records.filter(r => !r._screen_decision).length;
  const el = document.getElementById('screening-counts');
  if (el) el.innerHTML = `<span class="screen-badge include">${inc} included</span> <span class="screen-badge exclude">${exc} excluded</span> <span class="screen-badge maybe">${maybe} maybe</span> <span class="screen-badge unscreened">${un} unscreened</span>`;
}

export function renderMissingSources() {
  const el = document.getElementById('missing-list');
  if (!el) return;
  const items = (document.getElementById('cfg-missing')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  el.innerHTML = items.length ? items.map(s => `<div class="missing-item">${esc(s)}</div>`).join('') : '<div class="missing-item" style="opacity:.65">No known gaps listed yet.</div>';
}

export function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(h => h.addEventListener('click', () => {
    const g = h.closest('.accordion-group');
    if (!g) return;
    const wasOpen = g.classList.contains('open');
    document.querySelectorAll('.accordion-group').forEach(x => x.classList.remove('open'));
    if (!wasOpen) { g.classList.add('open'); _lastOpenAccordion = g.id; }
    else _lastOpenAccordion = null;
  }));
}

export function logMsg(msg, cls = '') {
  const box = document.getElementById('log-box');
  const p = document.createElement('p');
  if (cls) p.className = `log-${cls}`;
  p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  box.appendChild(p);
  box.scrollTop = box.scrollHeight;
}

export function setProgress(pct, label) {
  if (pct !== null) document.getElementById('prog-fill').style.width = Math.min(100, pct) + '%';
  document.getElementById('prog-label').textContent = label || '';
  document.getElementById('prog-pct').textContent = pct !== null ? Math.round(pct) + '%' : '';
}

export function setStatus(state2, text) {
  const el = document.getElementById('run-status-label');
  el.className = `run-status ${state2}`;
  el.textContent = text;
}

export function updateStats() {
  document.getElementById('s-queries').textContent = state.stats.queries;
  document.getElementById('s-raw').textContent = state.stats.raw;
  document.getElementById('s-dedup').textContent = state.stats.dedup;
  document.getElementById('s-records').textContent = state.stats.records;
  document.getElementById('s-noloc').textContent = state.stats.noloc;
  document.getElementById('s-errors').textContent = state.stats.errors;
  for (const k of Object.keys(state.catCounts)) {
    const el = document.getElementById(`cat-${k.toLowerCase()}`);
    if (el) el.textContent = state.catCounts[k] || 0;
  }
}

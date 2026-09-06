// ═══════════════════════════════════════════════════════════════
// UI.JS — renderTable, renderPaywallPanel, tabs
// ═══════════════════════════════════════════════════════════════
import { esc, state, VERIF_CLASS } from './state.js';
import { getActiveSchema } from './schema.js';
import { slots } from './slots.js';
import { scoreSchemaFit, scoreTermRelevance, scoreTermRelevanceDetail, getExportOptions } from './scores.js';
import { renderPaginationControls } from './selection.js';

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

function relevanceTooltip(r) {
  const { concepts } = scoreTermRelevanceDetail(r);
  if (!concepts.length) return 'No search parameters configured yet.';
  return concepts.map(c =>
    c.matched ? `\u2713 ${c.label} \u2014 matched via "${c.matchedTerm}"` : `\u2717 ${c.label} \u2014 no match (${c.termCount} term(s) checked)`
  ).join('\n');
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
  // Set in Configure ("Min term relevance %"), applied automatically here.
  // 0 (default) = no filtering, unchanged behaviour.
  const minRel = state.minTermRelevance || 0;

  let data = state.records.filter(r => {
    if (state.currentCat !== 'all' && r.category !== state.currentCat) return false;
    if (v && r.verification_status !== v) return false;
    if (reqFilter === 'fail' && !r._req_fail) return false;
    if (reqFilter === 'pass' && r._req_fail) return false;
    if (minRel > 0 && scoreTermRelevance(r) < minRel) return false;
    if (q) { const h = allCols.map(s => String(r[s.field] || '')).join(' ').toLowerCase(); if (!h.includes(q)) return false; }
    return true;
  });

  if (sort === 'year_desc') data.sort((a, b) => (b.pub_year || 0) - (a.pub_year || 0));
  if (sort === 'year_asc')  data.sort((a, b) => (a.pub_year || 0) - (b.pub_year || 0));
  if (sort === 'country_asc') data.sort((a, b) => (a.country || '').localeCompare(b.country || ''));
  if (sort === 'verif') data.sort((a, b) => (a.verification_status || '').localeCompare(b.verification_status || ''));

  state.filteredView = data;

  const thead = document.getElementById('results-thead');
  if (thead) thead.innerHTML = '<tr><th style="min-width:70px">Flags</th>' +
    allCols.map(s => `<th>${esc(s.label || s.field)}</th>`).join('') + '</tr>';

  const tbody = document.getElementById('results-tbody');
  const totalCols = allCols.length + 1;
  if (!data.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${totalCols}">${state.records.length === 0 ? 'Run a search to see results here.' : 'No records match the filter.'}</td></tr>`;
    document.getElementById('table-footer').textContent = '';
    renderPaginationControls(0);
    return;
  }

  const totalFiltered = data.length;
  const pageSize = state.paginationSize === Infinity ? totalFiltered : state.paginationSize;
  const startIdx = (state.paginationPage - 1) * pageSize;
  const pageData = data.slice(startIdx, startIdx + pageSize);

  tbody.innerHTML = pageData.map(r => {
    const reqFail = r._req_fail;
    const conflictBadge = r._has_conflict ? `<span class="conflict-badge" title="AI-extracted values conflict — see AI Extraction tab">&#9888; conflict</span>` : '';
    const dupBadge = r._ai_duplicate_flag ? `<span class="dup-badge" title="Flagged as duplicate on import — check manually">&#9868; dup</span>` : '';
    const reqBadge = reqFail ? `<span class="req-fail-badge" title="${esc(r._req_fail_labels || '')}">\u26a0 req</span>` : `<span class="req-pass-badge">\u2713 req</span>`;
    const flagsCell = `<td class="screen-cell">${reqBadge}${conflictBadge}${dupBadge}</td>`;

    const rowClass = reqFail ? 'req-fail-row' : '';

    return `<tr class="${rowClass}">` + flagsCell + allCols.map(s => {
      if (s.field === '_schemaFit') return `<td style="font-family:var(--mono);font-size:11px;color:var(--accent)">${scoreSchemaFit(r)}%</td>`;
      if (s.field === '_termRel')  return `<td style="font-family:var(--mono);font-size:11px;color:var(--blue);cursor:help" title="${esc(relevanceTooltip(r))}">${scoreTermRelevance(r)}%</td>`;
      const val = r[s.field];
      if (s.field === 'category') return `<td><span class="cat-pill cat-${(val || 'e').toLowerCase()}">${val || '?'}</span></td>`;
      if (s.field === 'verification_status') return `<td><span class="verif-badge ${VERIF_CLASS[val] || 'verif-secondary'}" style="font-size:10px">${esc(val || '')}</span></td>`;
      if (s.field === 'screening_decision') return `<td style="font-size:11px;color:var(--ink-3)">\u2014</td>`;
      if (s.field === 'screening_reason')  return `<td style="font-size:11px;color:var(--ink-3)">\u2014</td>`;
      if (s.field === 'doi' && val && val !== 'not reported') return `<td><a class="doi-link" href="https://doi.org/${val}" target="_blank" rel="noopener">DOI \u2192</a></td>`;
      if (s.field === 'url' && val && val !== 'not reported') return `<td><a class="doi-link" href="${esc(val)}" target="_blank" rel="noopener">URL \u2192</a></td>`;
      if (s.field === 'title') return `<td class="truncate" title="${esc(String(val || ''))}">${esc(String(val || '').slice(0, 60))}</td>`;
      if (s.field === 'full_citation') return `<td class="truncate" title="${esc(String(val || ''))}">${esc(String(val || '').split('(')[0].trim().slice(0, 40))}</td>`;
      if (s.field.startsWith('slot_')) { const sv = val || ''; return `<td class="truncate" title="${esc(sv)}" style="font-size:11px;color:${sv === 'not found' ? 'var(--ink-3)' : 'var(--accent)'}">${esc(sv.slice(0, 50))}</td>`; }
      return `<td class="truncate">${esc(String(val || '\u2014'))}</td>`;
    }).join('') + '</tr>';
  }).join('');

  document.getElementById('table-footer').textContent =
    `Showing ${startIdx + 1}\u2013${Math.min(startIdx + pageSize, totalFiltered)} of ${totalFiltered} records` +
    (totalFiltered !== state.records.length ? ` (filtered from ${state.records.length})` : '') +
    (minRel > 0 ? ` \u2014 min term relevance ${minRel}%` : '');
  renderPaginationControls(totalFiltered);
}

export function renderPaywallPanel() {
  const el = document.getElementById('paywall-list');
  const countEl = document.getElementById('paywall-count');
  if (!el) return;
  const q = (document.getElementById('paywall-search')?.value || '').toLowerCase();
  let data = state.records.filter(r => r.doi && r.doi !== 'not reported' &&
    (r.pdf_available === 'paywalled' || r.pdf_available === 'no' || r.pdf_available === 'unknown'));
  if (q) data = data.filter(r => [r.full_citation, r.country, String(r.pub_year || '')].join(' ').toLowerCase().includes(q));
  if (countEl) countEl.textContent = data.length ? `${data.length} papers` : '';
  if (!data.length) { el.innerHTML = '<div class="paywall-empty">No paywalled papers found. Run a search first.</div>'; return; }
  el.innerHTML = data.map((r, i) => {
    const au = (r.full_citation || '').split('(')[0].trim().slice(0, 80);
    const title = r.title && r.title !== 'Untitled' ? r.title : (r.full_citation || '').slice(0, 120);
    return `<div class="paywall-row"><div class="paywall-index">${i + 1}</div><div class="paywall-body"><div class="paywall-title">${esc(title.slice(0, 200))}</div><div class="paywall-meta">${esc(au)} \u00b7 ${r.pub_year || 'n.d.'} \u00b7 ${esc(r.country || '\u2014')}</div><div class="paywall-doi"><code class="doi-code" id="doi-code-${i}">${esc(r.doi)}</code><button class="btn btn-sm paywall-copy" onclick="copyDOI('${r.doi}','doi-code-${i}')">Copy DOI</button></div><div class="paywall-actions"><a class="paywall-action-link" href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener">Publisher \u2192</a> <a class="paywall-action-link" href="https://scholar.google.com/scholar?q=${encodeURIComponent(r.doi)}" target="_blank" rel="noopener">Google Scholar \u2192</a> <a class="paywall-action-link" href="https://europepmc.org/search?query=${encodeURIComponent(r.doi)}" target="_blank" rel="noopener">Europe PMC \u2192</a> <a class="paywall-action-link" href="https://unpaywall.org/${esc(r.doi)}" target="_blank" rel="noopener">Unpaywall \u2192</a></div></div></div>`;
  }).join('');
}

export function renderScreeningCounts() {
  const records = state.records;
  const pass = records.filter(r => !r._req_fail).length;
  const fail = records.filter(r => r._req_fail).length;
  const conflicts = records.filter(r => r._has_conflict).length;
  const el = document.getElementById('screening-counts');
  if (el) el.innerHTML =
    `<span class="screen-badge include">${pass} passing all requirements</span> ` +
    `<span class="screen-badge maybe">${fail} flagged</span>` +
    (conflicts ? ` <span class="screen-badge exclude">${conflicts} AI conflicts</span>` : '');
}

export function renderMissingSources() {
  const el = document.getElementById('missing-list');
  if (!el) return;
  const items = (document.getElementById('cfg-missing')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
  el.innerHTML = items.length
    ? items.map(s => `<div class="missing-item">${esc(s)}</div>`).join('')
    : '<div class="missing-item" style="opacity:.65">No known gaps listed yet.</div>';
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
  document.getElementById('s-raw').textContent     = state.stats.raw;
  document.getElementById('s-dedup').textContent   = state.stats.dedup;
  document.getElementById('s-records').textContent = state.stats.records;
  document.getElementById('s-noloc').textContent   = state.stats.noloc;
  document.getElementById('s-errors').textContent  = state.stats.errors;
  for (const k of Object.keys(state.catCounts)) {
    const el = document.getElementById(`cat-${k.toLowerCase()}`);
    if (el) el.textContent = state.catCounts[k] || 0;
  }
}

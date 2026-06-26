// ═══════════════════════════════════════════════════════════════
// SELECTION.JS — row selection, pagination, export scope modal
// ═══════════════════════════════════════════════════════════════
import { state, screeningKey } from './state.js';

export function renderSelectionBar() {
  const bar = document.getElementById('selection-bar');
  const countEl = document.getElementById('sel-count');
  if (!bar) return;
  const n = state.selection.size;
  if (countEl) countEl.textContent = n;
  bar.classList.toggle('visible', n > 0);
}

export function getSelectedRecords() {
  return state.records.filter(r => state.selection.has(screeningKey(r)));
}

export const SWDSelection = {
  toggle(key) {
    if (state.selection.has(key)) state.selection.delete(key);
    else state.selection.add(key);
    renderSelectionBar();
    if (window._renderTable) window._renderTable();
  },
  clear() {
    state.selection.clear();
    renderSelectionBar();
    if (window._renderTable) window._renderTable();
  },
  selectAllFiltered(filteredRecords) {
    filteredRecords.forEach(r => state.selection.add(screeningKey(r)));
    renderSelectionBar();
    if (window._renderTable) window._renderTable();
  },
  deselectAllFiltered(filteredRecords) {
    filteredRecords.forEach(r => state.selection.delete(screeningKey(r)));
    renderSelectionBar();
    if (window._renderTable) window._renderTable();
  },
};

export function renderPaginationControls(totalFiltered) {
  const container = document.getElementById('pagination-controls');
  if (!container) return;
  const totalPages = state.paginationSize === Infinity ? 1 : Math.max(1, Math.ceil(totalFiltered / state.paginationSize));
  if (state.paginationPage > totalPages) state.paginationPage = totalPages;
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  let html = `<button id="pg-prev" ${state.paginationPage <= 1 ? 'disabled' : ''}>&laquo; Prev</button>`;
  const maxButtons = 7;
  let start = Math.max(1, state.paginationPage - 3);
  let end = Math.min(totalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);
  if (start > 1) html += `<button data-pg="1">1</button>${start > 2 ? '<span style="padding:0 4px;color:var(--ink-3)">…</span>' : ''}`;
  for (let p = start; p <= end; p++) html += `<button data-pg="${p}" class="${p === state.paginationPage ? 'current-page' : ''}">${p}</button>`;
  if (end < totalPages) html += `${end < totalPages - 1 ? '<span style="padding:0 4px;color:var(--ink-3)">…</span>' : ''}<button data-pg="${totalPages}">${totalPages}</button>`;
  html += `<button id="pg-next" ${state.paginationPage >= totalPages ? 'disabled' : ''}>Next &raquo;</button>`;
  container.innerHTML = html;
  container.querySelectorAll('button[data-pg]').forEach(btn => btn.addEventListener('click', () => { state.paginationPage = parseInt(btn.dataset.pg); if (window._renderTable) window._renderTable(); }));
  document.getElementById('pg-prev')?.addEventListener('click', () => { if (state.paginationPage > 1) { state.paginationPage--; if (window._renderTable) window._renderTable(); } });
  document.getElementById('pg-next')?.addEventListener('click', () => { if (state.paginationPage < totalPages) { state.paginationPage++; if (window._renderTable) window._renderTable(); } });
}

// Export scope modal
let _pendingExportCall = null;

export function withScopeCheck(fn, args) {
  const n = state.selection.size;
  if (n === 0) { fn(...args); return; }
  const modal = document.getElementById('scope-modal');
  const countEl = document.getElementById('scope-modal-count');
  if (countEl) countEl.textContent = n;
  if (modal) modal.classList.add('visible');
  _pendingExportCall = { fn, args };
}

export function initScopeModal() {
  document.getElementById('scope-modal-all')?.addEventListener('click', () => {
    document.getElementById('scope-modal')?.classList.remove('visible');
    if (_pendingExportCall) _pendingExportCall.fn(..._pendingExportCall.args);
    _pendingExportCall = null;
  });
  document.getElementById('scope-modal-selected')?.addEventListener('click', () => {
    document.getElementById('scope-modal')?.classList.remove('visible');
    if (_pendingExportCall) {
      const selected = getSelectedRecords();
      if (!selected.length) { alert('No selected records match this export type.'); _pendingExportCall = null; return; }
      const original = state.records;
      state.records = selected;
      try { _pendingExportCall.fn(..._pendingExportCall.args); }
      finally { state.records = original; }
    }
    _pendingExportCall = null;
  });
  document.getElementById('scope-modal-cancel')?.addEventListener('click', () => {
    document.getElementById('scope-modal')?.classList.remove('visible');
    _pendingExportCall = null;
  });
  document.getElementById('scope-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) { e.currentTarget.classList.remove('visible'); _pendingExportCall = null; }
  });
}

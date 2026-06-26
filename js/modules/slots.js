// ═══════════════════════════════════════════════════════════════
// SLOTS.JS — extraction slots
// ═══════════════════════════════════════════════════════════════
import { esc, dlFile, stamp } from './state.js';
import { state } from './state.js';

export const MAX_SLOTS = 10, WARN_SLOTS = 8;
export const slots = []; // _SWDSlots
let _slotId = 0;

const SLOT_TIPS = [
  { tip: 'Geographic location',       ex: 'Place names, regions, countries.\nExample:\nPacific Ocean\nSouth-East Asia' },
  { tip: 'Methodology / study design', ex: 'Study design terms.\nExample:\nrandomised controlled trial\nmeta-analysis' },
  { tip: 'Species / organism',         ex: 'Taxon or common names.\nExample:\nDrosophila suzukii' },
  { tip: 'Chemical / compound',        ex: 'Compound names.\nExample:\npolystyrene\nbisphenol A' },
  { tip: 'Health endpoint',            ex: 'Clinical outcomes.\nExample:\noxidative stress\ngenotoxicity' },
];

export function renderSlots() {
  const container = document.getElementById('slot-list');
  if (!container) return;
  if (!slots.length) {
    container.innerHTML = '<p style="font-size:13px;color:var(--ink-3)">No extraction slots yet. Click <strong>+ Add slot</strong> to create one.</p>';
  } else {
    container.innerHTML = slots.map((sl, idx) => {
      const tip = SLOT_TIPS[idx % SLOT_TIPS.length];
      return `<div class="slot-card" id="slot-card-${sl.id}">
        <div class="slot-card-header">
          <span class="slot-number">Slot ${idx + 1}</span>
          <input type="text" class="slot-label-input" value="${esc(sl.label)}" placeholder="Label" onchange="SWDSlots.rename(${sl.id},this.value)" />
          <label class="slot-partial-toggle"><input type="checkbox" ${sl.partial ? 'checked' : ''} onchange="SWDSlots.setPartial(${sl.id},this.checked)" /> Partial match</label>
          <span class="slot-tip"><span class="slot-tip-icon">? guide</span><span class="slot-tip-box"><strong>${esc(tip.tip)}</strong><br><br>${esc(tip.ex).replace(/\n/g, '<br>')}</span></span>
          <button class="slot-remove" onclick="SWDSlots.remove(${sl.id})">✕ Remove</button>
        </div>
        <textarea class="slot-phrases" placeholder="One phrase per line…" onchange="SWDSlots.setPhrases(${sl.id},this.value)">${esc(sl.phrases.join('\n'))}</textarea>
        <div class="slot-hint">One phrase per line. ${sl.partial ? '<em>Partial match</em>' : '<em>Whole-word match</em>'}</div>
      </div>`;
    }).join('');
  }
  const warnEl = document.getElementById('slot-warn');
  const capEl = document.getElementById('slot-cap');
  if (warnEl) warnEl.classList.toggle('visible', slots.length >= WARN_SLOTS && slots.length < MAX_SLOTS);
  if (capEl) capEl.classList.toggle('visible', slots.length >= MAX_SLOTS);
  const addBtn = document.getElementById('btn-add-slot');
  if (addBtn) addBtn.disabled = slots.length >= MAX_SLOTS;
}

export function applySlots(records) {
  if (!records || !records.length || !slots.length) return;
  records.forEach(r => {
    const hay = [r.full_citation || '', r._abstract || r.excerpt || '', r.notes || ''].join(' ');
    slots.forEach(sl => {
      if (!sl.phrases.length) { r[`slot_${sl.id}`] = '[No phrases defined]'; return; }
      const hits = sl.phrases.filter(p =>
        sl.partial ? hay.toLowerCase().includes(p.toLowerCase())
          : new RegExp('\\b' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(hay)
      );
      r[`slot_${sl.id}`] = hits.length ? hits.join('; ') : 'not found';
    });
  });
}

export const SWDSlots = {
  add() {
    if (slots.length >= MAX_SLOTS) return;
    slots.push({ id: ++_slotId, label: `Extraction slot ${_slotId}`, phrases: [], partial: false });
    renderSlots();
  },
  remove(id) { slots.splice(slots.findIndex(s => s.id === id), 1); renderSlots(); },
  rename(id, label) { const sl = slots.find(s => s.id === id); if (sl) sl.label = label; },
  setPhrases(id, text) { const sl = slots.find(s => s.id === id); if (sl) sl.phrases = text.split('\n').map(p => p.trim()).filter(Boolean); },
  setPartial(id, val) { const sl = slots.find(s => s.id === id); if (sl) { sl.partial = val; renderSlots(); } },
  exportSlot(id) {
    const sl = slots.find(s => s.id === id);
    if (!sl) { alert('Slot not found.'); return; }
    if (!state.records.length) { alert('No records. Run a search first.'); return; }
    const field = `slot_${sl.id}`;
    const rows = state.records.map(r => [
      `"${String(r.full_citation || '').replace(/"/g, '""')}"`,
      `"${r.pub_year || ''}"`, `"${r.country || ''}"`, `"${r.doi || ''}"`,
      `"${String(r[field] || 'not found').replace(/"/g, '""')}"`
    ].join(','));
    const name = sl.label.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 30) || `slot${sl.id}`;
    dlFile([`Full citation,Year,Country,DOI,${sl.label}`, ...rows].join('\r\n'),
      `sciwide_extraction_${name}_${stamp()}.csv`, 'text/csv;charset=utf-8;');
  },
  exportAll() {
    if (!state.records.length) { alert('No records.'); return; }
    if (!slots.length) { alert('No extraction slots defined.'); return; }
    const rows = state.records.map(r => [
      `"${String(r.full_citation || '').replace(/"/g, '""')}"`,
      `"${r.pub_year || ''}"`, `"${r.country || ''}"`, `"${r.doi || ''}"`,
      ...slots.map(sl => `"${String(r[`slot_${sl.id}`] || 'not found').replace(/"/g, '""')}"`)
    ].join(','));
    dlFile([['Full citation', 'Year', 'Country', 'DOI', ...slots.map(sl => sl.label)].join(','), ...rows].join('\r\n'),
      `sciwide_all_extractions_${stamp()}.csv`, 'text/csv;charset=utf-8;');
  },
  renderExportPanel() {
    const el = document.getElementById('acc-slots-export');
    if (!el) return;
    if (!slots.length) {
      el.innerHTML = '<p style="font-size:12.5px;color:var(--ink-3)">No extraction slots defined. Add slots in the Schema tab, then run a search.</p>';
      return;
    }
    el.innerHTML = `<div class="accordion-grid">${slots.map(sl =>
      `<div class="acc-card"><div class="acc-card-icon">⬇</div><div class="acc-card-name">${esc(sl.label)}</div><div class="acc-card-desc">Matched phrases across all records.</div><button class="btn btn-ghost" onclick="SWDSlots.exportSlot(${sl.id})">Download CSV</button></div>`
    ).join('')}<div class="acc-card acc-card-featured"><div class="acc-card-icon">⬇</div><div class="acc-card-name">All slots combined</div><div class="acc-card-desc">All ${slots.length} slot${slots.length > 1 ? 's' : ''} as columns in one CSV.</div><button class="btn btn-primary" onclick="SWDSlots.exportAll()">Download all slots CSV</button></div></div>`;
  },
  serialize() { return slots.map(sl => ({ label: sl.label, phrases: sl.phrases, partial: sl.partial })); },
  restore(arr) {
    if (!Array.isArray(arr)) return;
    slots.length = 0;
    arr.forEach(sl => slots.push({ id: ++_slotId, label: sl.label || 'Slot', phrases: sl.phrases || [], partial: !!sl.partial }));
    renderSlots();
  },
};

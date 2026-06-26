// ═══════════════════════════════════════════════════════════════
// REQUIREMENTS.JS — custom multi-requirement filter engine
// ═══════════════════════════════════════════════════════════════
import { esc } from './state.js';

export const requirements = []; // _SWDRequirements
let _reqId = 0;

export const REQ_TYPES = [
  { value: 'abstract_contains',  label: 'Abstract contains phrase' },
  { value: 'title_contains',     label: 'Title contains phrase' },
  { value: 'any_field_contains', label: 'Any field contains phrase' },
  { value: 'has_doi',            label: 'Has DOI' },
  { value: 'has_coordinates',    label: 'Has coordinates' },
  { value: 'has_country',        label: 'Has country extracted' },
  { value: 'has_abstract',       label: 'Has abstract text' },
  { value: 'year_from',          label: 'Year ≥ value' },
  { value: 'year_to',            label: 'Year ≤ value' },
  { value: 'source_type_is',     label: 'Source type equals' },
  { value: 'language_is',        label: 'Language code equals' },
  { value: 'category_is',        label: 'Category equals (A/B/C/D/E/F)' },
  { value: 'custom_text',        label: 'Custom rule (text description)' },
];

export function testRequirement(r, req) {
  if (!req.enabled) return true;
  const ft = [r.full_citation || '', r._abstract || '', r.excerpt || '', r.notes || ''].join(' ').toLowerCase();
  const val = (req.value || '').trim().toLowerCase();
  switch (req.type) {
    case 'abstract_contains':   return val ? (r._abstract || '').toLowerCase().includes(val) : true;
    case 'title_contains':      return val ? (r.full_citation || '').toLowerCase().includes(val) : true;
    case 'any_field_contains':  return val ? ft.includes(val) : true;
    case 'has_doi':             return !!(r.doi && r.doi !== 'not reported' && r.doi !== '');
    case 'has_coordinates':     return !!(r.coordinates && r.coordinates !== 'not reported');
    case 'has_country':         return !!(r.country && r.country !== 'not reported');
    case 'has_abstract':        return !!(r._abstract && r._abstract.trim().length > 10);
    case 'year_from':           return val ? (!r.pub_year || r.pub_year >= parseInt(val)) : true;
    case 'year_to':             return val ? (!r.pub_year || r.pub_year <= parseInt(val)) : true;
    case 'source_type_is':      return val ? (r.source_type || '').toLowerCase() === val : true;
    case 'language_is':         return val ? (r.language || '').toLowerCase().startsWith(val) : true;
    case 'category_is':         return val ? (r.category || '').toUpperCase() === val.toUpperCase() : true;
    case 'custom_text':         return true;
    default:                    return true;
  }
}

export function applyRequirements(records) {
  const enabled = requirements.filter(r => r.enabled && r.type !== 'custom_text');
  if (!enabled.length) return;
  records.forEach(r => {
    const failed = enabled.filter(req => !testRequirement(r, req));
    r._req_fail = failed.length > 0;
    r._req_fail_labels = failed.map(req => req.label || req.type).join('; ');
  });
}

export function renderRequirements() {
  const list = document.getElementById('req-list');
  if (!list) return;
  if (!requirements.length) {
    list.innerHTML = '<p style="font-size:12.5px;color:var(--ink-3)">No requirements set. All records will pass. Add one below or click a suggestion.</p>';
    return;
  }
  list.innerHTML = requirements.map(req => {
    const typeOpts = REQ_TYPES.map(t => `<option value="${t.value}" ${req.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('');
    const needsValue = !['has_doi','has_coordinates','has_country','has_abstract'].includes(req.type);
    return `<div class="req-row ${req.enabled ? 'req-enabled' : 'req-disabled'}" id="req-row-${req.id}">
      <input type="checkbox" class="req-enable-toggle" ${req.enabled ? 'checked' : ''} onchange="SWDReq.toggle(${req.id},this.checked)" />
      <input type="text" class="req-label" value="${esc(req.label)}" placeholder="Requirement label" onchange="SWDReq.rename(${req.id},this.value)" />
      <select class="req-type-select" onchange="SWDReq.setType(${req.id},this.value)">${typeOpts}</select>
      ${needsValue ? `<input type="text" class="req-value" value="${esc(req.value || '')}" placeholder="value" onchange="SWDReq.setValue(${req.id},this.value)" />` : ''}
      <button class="req-remove" onclick="SWDReq.remove(${req.id})">✕</button>
    </div>`;
  }).join('');
}

export const SWDReq = {
  add(type, label, value) {
    const t = type || 'abstract_contains';
    const tDef = REQ_TYPES.find(x => x.value === t);
    requirements.push({ id: ++_reqId, type: t, label: label || (tDef?.label || 'New requirement'), value: value || '', enabled: true });
    renderRequirements();
  },
  remove(id) { requirements.splice(requirements.findIndex(r => r.id === id), 1); renderRequirements(); },
  toggle(id, val) { const r = requirements.find(r => r.id === id); if (r) { r.enabled = val; renderRequirements(); } },
  rename(id, label) { const r = requirements.find(r => r.id === id); if (r) r.label = label; },
  setType(id, type) { const r = requirements.find(r => r.id === id); if (r) { r.type = type; renderRequirements(); } },
  setValue(id, val) { const r = requirements.find(r => r.id === id); if (r) r.value = val; },
  serialize() { return requirements.map(r => ({ type: r.type, label: r.label, value: r.value, enabled: r.enabled })); },
  restore(arr) {
    if (!Array.isArray(arr)) return;
    requirements.length = 0;
    arr.forEach(r => requirements.push({ id: ++_reqId, type: r.type || 'custom_text', label: r.label || '', value: r.value || '', enabled: r.enabled !== false }));
    renderRequirements();
  },
};

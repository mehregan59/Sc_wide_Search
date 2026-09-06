// ═══════════════════════════════════════════════════════════════
// REQUIREMENTS.JS — requirement filter engine
// Multi-value OR/AND matching. Optional full-text fallback: if a record
// fails on abstract alone AND has open-access full text available, it is
// re-checked against the full text before being flagged failed. This never
// removes records — it only widens what counts as a pass. No full-text
// access → falls straight back to abstract-only behaviour, unchanged.
// ═══════════════════════════════════════════════════════════════
import { esc } from './state.js';
import { fetchFullTextEPMC } from './engines.js';

export const requirements = [];
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

// Types whose value field is the thing synonyms get appended to
export const TEXT_TYPES = new Set(['abstract_contains', 'title_contains', 'any_field_contains', 'custom_text']);
const MULTI_VALUE_TYPES = new Set(['abstract_contains','title_contains','any_field_contains','source_type_is','language_is','category_is']);
// Beyond this many comma-separated values, AND is unlikely to ever match — a field this
// large is almost always one concept's full synonym list, which needs ANY (OR), not ALL.
const AND_WARN_THRESHOLD = 5;

function parseValues(val) { return (val || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean); }

function testMultiValue(haystack, val, op, fullText) {
  const vals = parseValues(val);
  if (!vals.length) return true;
  const hay = (haystack || '').toLowerCase();
  const abstractPass = op === 'and' ? vals.every(v => hay.includes(v)) : vals.some(v => hay.includes(v));
  if (abstractPass) return true;
  if (!fullText) return false;
  const fh = fullText.toLowerCase();
  return op === 'and' ? vals.every(v => fh.includes(v)) : vals.some(v => fh.includes(v));
}
function testMultiEquals(field, val, op) {
  const vals = parseValues(val);
  if (!vals.length) return true;
  const f = (field || '').toLowerCase();
  return op === 'and' ? vals.every(v => f === v) : vals.some(v => f === v);
}

// fullText param is optional — only passed in during the async full-text pass
export function testRequirement(r, req, fullText) {
  if (!req.enabled) return true;
  const ft = [r.full_citation || '', r._abstract || '', r.excerpt || '', r.notes || ''].join(' ');
  const op = req.op === 'and' ? 'and' : 'or';
  switch (req.type) {
    case 'abstract_contains':   return testMultiValue(r._abstract, req.value, op, fullText);
    case 'title_contains':      return testMultiValue(r.full_citation, req.value, op, fullText);
    case 'any_field_contains':  return testMultiValue(ft, req.value, op, fullText);
    case 'has_doi':             return !!(r.doi && r.doi !== 'not reported' && r.doi !== '');
    case 'has_coordinates':     return !!(r.coordinates && r.coordinates !== 'not reported');
    case 'has_country':         return !!(r.country && r.country !== 'not reported');
    case 'has_abstract':        return !!(r._abstract && r._abstract.trim().length > 10);
    case 'year_from': { const val = (req.value || '').trim(); return val ? (!r.pub_year || r.pub_year >= parseInt(val)) : true; }
    case 'year_to':   { const val = (req.value || '').trim(); return val ? (!r.pub_year || r.pub_year <= parseInt(val)) : true; }
    case 'source_type_is':      return testMultiEquals(r.source_type, req.value, op);
    case 'language_is': {
      const vals = parseValues(req.value); if (!vals.length) return true;
      const lang = (r.language || '').toLowerCase();
      return op === 'and' ? vals.every(v => lang.startsWith(v)) : vals.some(v => lang.startsWith(v));
    }
    case 'category_is': return testMultiEquals(r.category, req.value, op);
    case 'custom_text': return true;
    default: return true;
  }
}

// Sync, abstract-only — original behaviour, unchanged. Used anywhere a full-text pass isn't wanted.
export function applyRequirements(records) {
  const enabled = requirements.filter(r => r.enabled && r.type !== 'custom_text');
  if (!enabled.length) { records.forEach(r => { r._req_fail = false; r._req_fail_labels = ''; }); return; }
  records.forEach(r => {
    const failed = enabled.filter(req => !testRequirement(r, req));
    r._req_fail = failed.length > 0;
    r._req_fail_labels = failed.map(req => req.label || req.type).join('; ');
  });
}

// Async — same flag-only result, but records that fail on abstract AND have
// Europe PMC open-access full text get one fetch + re-check before being flagged.
// Records without full-text access are unaffected — falls straight back to applyRequirements' behaviour.
export async function applyRequirementsWithFullText(records, onProgress) {
  const enabled = requirements.filter(r => r.enabled && r.type !== 'custom_text');
  if (!enabled.length) { records.forEach(r => { r._req_fail = false; r._req_fail_labels = ''; }); return { fullTextFetched: 0 }; }
  let fetched = 0;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    let failed = enabled.filter(req => !testRequirement(r, req));
    if (failed.length && r.pmcid && r._isOA) {
      const full = await fetchFullTextEPMC(r.pmcid);
      fetched++;
      if (full) failed = enabled.filter(req => !testRequirement(r, req, full));
    }
    r._req_fail = failed.length > 0;
    r._req_fail_labels = failed.map(req => req.label || req.type).join('; ');
    if (onProgress) onProgress(i + 1, records.length);
  }
  return { fullTextFetched: fetched };
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
    const isMulti = MULTI_VALUE_TYPES.has(req.type);
    const opSelect = isMulti ? `<select class="req-op-select" onchange="SWDReq.setOp(${req.id},this.value)" title="How multiple values combine">
      <option value="or" ${req.op !== 'and' ? 'selected' : ''}>OR (any match)</option>
      <option value="and" ${req.op === 'and' ? 'selected' : ''}>AND (all must match)</option>
    </select>` : '';
    const valuePlaceholder = isMulti ? 'value1, value2, value3…' : 'value';
    const valCount = isMulti ? parseValues(req.value).length : 0;
    const andWarn = (isMulti && req.op === 'and' && valCount > AND_WARN_THRESHOLD)
      ? `<div class="req-and-warn">&#9888; AND with ${valCount} values means ALL must appear together in one record — that's very unlikely if these are synonyms of the same idea. If they're synonyms, switch to OR; split them into separate requirements only if they're genuinely different things that must all be present.</div>`
      : '';
    return `<div class="req-row-wrap">
      <div class="req-row ${req.enabled ? 'req-enabled' : 'req-disabled'}" id="req-row-${req.id}">
        <input type="checkbox" class="req-enable-toggle" ${req.enabled ? 'checked' : ''} onchange="SWDReq.toggle(${req.id},this.checked)" />
        <input type="text" class="req-label" value="${esc(req.label)}" placeholder="Requirement label" onchange="SWDReq.rename(${req.id},this.value)" />
        <select class="req-type-select" onchange="SWDReq.setType(${req.id},this.value)">${typeOpts}</select>
        ${needsValue ? `<input type="text" class="req-value" value="${esc(req.value || '')}" placeholder="${valuePlaceholder}" onchange="SWDReq.setValue(${req.id},this.value)" />` : ''}
        ${opSelect}
        <button class="req-remove" onclick="SWDReq.remove(${req.id})">✕</button>
      </div>
      ${andWarn}
    </div>`;
  }).join('');
}

export const SWDReq = {
  add(type, label, value) {
    const t = type || 'abstract_contains';
    const tDef = REQ_TYPES.find(x => x.value === t);
    requirements.push({ id: ++_reqId, type: t, label: label || (tDef?.label || 'New requirement'), value: value || '', op: 'or', enabled: true });
    renderRequirements();
  },
  remove(id) { requirements.splice(requirements.findIndex(r => r.id === id), 1); renderRequirements(); },
  toggle(id, val) { const r = requirements.find(r => r.id === id); if (r) { r.enabled = val; renderRequirements(); } },
  rename(id, label) { const r = requirements.find(r => r.id === id); if (r) r.label = label; },
  setType(id, type) { const r = requirements.find(r => r.id === id); if (r) { r.type = type; renderRequirements(); } },
  setValue(id, val) { const r = requirements.find(r => r.id === id); if (r) { r.value = val; renderRequirements(); } },
  setOp(id, op) { const r = requirements.find(r => r.id === id); if (r) { r.op = (op === 'and' ? 'and' : 'or'); renderRequirements(); } },
  // Appends new comma-separated terms to a requirement's value without duplicating existing ones
  appendValue(id, newTerms) {
    const r = requirements.find(r => r.id === id);
    if (!r) return 0;
    const existing = new Set(parseValues(r.value));
    const additions = newTerms.filter(t => t && !existing.has(t.trim().toLowerCase()));
    if (!additions.length) return 0;
    r.value = [r.value, ...additions].filter(Boolean).join(', ').replace(/^,\s*/, '');
    return additions.length;
  },
  serialize() { return requirements.map(r => ({ type: r.type, label: r.label, value: r.value, op: r.op || 'or', enabled: r.enabled })); },
  restore(arr) {
    if (!Array.isArray(arr)) return;
    requirements.length = 0;
    arr.forEach(r => requirements.push({ id: ++_reqId, type: r.type || 'custom_text', label: r.label || '', value: r.value || '', op: r.op === 'and' ? 'and' : 'or', enabled: r.enabled !== false }));
    renderRequirements();
  },
};

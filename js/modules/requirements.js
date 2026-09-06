// ═══════════════════════════════════════════════════════════════
// REQUIREMENTS.JS — requirement filter engine
// Multi-value OR/AND matching. Optional full-text fallback: if a record
// fails on abstract alone AND has open-access full text available, it is
// re-checked against the full text before being flagged failed. This never
// removes records — it only widens what counts as a pass. No full-text
// access → falls straight back to abstract-only behaviour, unchanged.
//
// "Requires support" matching: every term has a provenance — SEED (typed
// by hand) or AI-ADDED (from the synonym-generation flow). Seed terms match
// anywhere, as before. AI-added terms only count if they appear in the SAME
// SENTENCE as another term for that same concept — this catches cases like
// "pomace fly" (an AI synonym for Drosophila melanogaster) matching inside
// "olive pomace fly ash" with nothing else insect-related nearby: an
// isolated coincidental match, not a genuine one. Requirements created
// before this feature have no recorded provenance, so all of their terms
// are treated as seed (unchanged behaviour) until new synonyms are added.
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
// Same split, but keeps original casing — used wherever the text becomes user-visible
// (new requirement labels) or needs case-preserved comparison in isTermSupported.
export function rawValues(val) { return (val || '').split(',').map(v => v.trim()).filter(Boolean); }

// Splits text into rough sentences. Good enough for co-occurrence checking — doesn't
// need to be linguistically perfect, just consistent between requirement matching and
// relevance scoring (both import this same function).
export function splitSentences(text) {
  if (!text) return [];
  const parts = text.match(/[^.!?]+[.!?]*/g);
  return (parts && parts.length) ? parts : [text];
}

// A term matches if: it's a SEED term and appears anywhere in the haystack, OR it's an
// AI-added term (not in seedSet) and appears in the same sentence as at least one other
// term from the same concept. seedSet holding every term (or being absent) is the safe
// legacy fallback — behaves exactly like the old "match anywhere" rule.
export function isTermSupported(term, allTerms, seedSet, hayLower, sentences) {
  const tl = term.toLowerCase();
  if (!seedSet || seedSet.has(tl)) {
    return hayLower.includes(tl);
  }
  return sentences.some(s => {
    const sl = s.toLowerCase();
    if (!sl.includes(tl)) return false;
    return allTerms.some(other => other.toLowerCase() !== tl && sl.includes(other.toLowerCase()));
  });
}

function testMultiValue(haystack, req, op, fullText) {
  const terms = rawValues(req.value);
  if (!terms.length) return true;
  const seedSet = (req.seedTerms instanceof Set) ? req.seedTerms : new Set(terms.map(t => t.toLowerCase()));
  const check = (text) => {
    if (!text) return false;
    const hayLower = text.toLowerCase();
    const sentences = splitSentences(text);
    const results = terms.map(t => isTermSupported(t, terms, seedSet, hayLower, sentences));
    return op === 'and' ? results.every(Boolean) : results.some(Boolean);
  };
  if (check(haystack)) return true;
  if (!fullText) return false;
  return check(fullText);
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
    case 'abstract_contains':   return testMultiValue(r._abstract, req, op, fullText);
    case 'title_contains':      return testMultiValue(r.full_citation, req, op, fullText);
    case 'any_field_contains':  return testMultiValue(ft, req, op, fullText);
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
      ? `<div class="req-and-warn">&#9888; AND with ${valCount} values means ALL must appear together in one record — that's very unlikely if these are synonyms of the same idea.
          <button class="btn-split-req" onclick="SWDReq.splitIntoSeparate(${req.id})">Split into ${valCount} separate requirements (OR)</button>
          &mdash; use this if they're synonyms. Only keep AND if they're genuinely different things that must all be present.</div>`
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
    const v = value || '';
    // Manually entered at creation time — trusted (seed), matches anywhere.
    requirements.push({ id: ++_reqId, type: t, label: label || (tDef?.label || 'New requirement'), value: v, op: 'or', enabled: true, seedTerms: new Set(parseValues(v)) });
    renderRequirements();
  },
  remove(id) { requirements.splice(requirements.findIndex(r => r.id === id), 1); renderRequirements(); },
  toggle(id, val) { const r = requirements.find(r => r.id === id); if (r) { r.enabled = val; renderRequirements(); } },
  rename(id, label) { const r = requirements.find(r => r.id === id); if (r) r.label = label; },
  setType(id, type) { const r = requirements.find(r => r.id === id); if (r) { r.type = type; renderRequirements(); } },
  // A full manual retype/edit of the field is trusted in its entirety — the user is
  // vouching for every value currently there, so it resets to all-seed.
  setValue(id, val) { const r = requirements.find(r => r.id === id); if (r) { r.value = val; r.seedTerms = new Set(parseValues(val)); renderRequirements(); } },
  setOp(id, op) { const r = requirements.find(r => r.id === id); if (r) { r.op = (op === 'and' ? 'and' : 'or'); renderRequirements(); } },
  // Appends new comma-separated terms to a requirement's value without duplicating existing ones.
  // These additions are deliberately NOT added to seedTerms — they're AI-generated and
  // require same-sentence corroboration from another term before counting as a match.
  appendValue(id, newTerms) {
    const r = requirements.find(r => r.id === id);
    if (!r) return 0;
    const existing = new Set(parseValues(r.value));
    if (!r.seedTerms) r.seedTerms = new Set(existing); // legacy requirement: lock in current terms as seed first
    const additions = newTerms.filter(t => t && !existing.has(t.trim().toLowerCase()));
    if (!additions.length) return 0;
    r.value = [r.value, ...additions].filter(Boolean).join(', ').replace(/^,\s*/, '');
    return additions.length;
  },
  // Turns one AND field with N values into N separate OR requirements, one per value —
  // matches "option 2": separate rows = separate concepts, AND-across-rows is already
  // built into applyRequirementsWithFullText, so no new matching logic is needed.
  // Each new row's single value becomes its own seed term.
  splitIntoSeparate(id) {
    const idx = requirements.findIndex(r => r.id === id);
    if (idx === -1) return;
    const r = requirements[idx];
    const vals = rawValues(r.value);
    if (vals.length < 2) return;
    const newRows = vals.map(v => ({ id: ++_reqId, type: r.type, label: v, value: v, op: 'or', enabled: true, seedTerms: new Set([v.toLowerCase()]) }));
    requirements.splice(idx, 1, ...newRows);
    renderRequirements();
  },
  serialize() {
    return requirements.map(r => ({
      type: r.type, label: r.label, value: r.value, op: r.op || 'or', enabled: r.enabled,
      seedTerms: [...(r.seedTerms || parseValues(r.value))],
    }));
  },
  restore(arr) {
    if (!Array.isArray(arr)) return;
    requirements.length = 0;
    arr.forEach(r => requirements.push({
      id: ++_reqId, type: r.type || 'custom_text', label: r.label || '', value: r.value || '',
      op: r.op === 'and' ? 'and' : 'or', enabled: r.enabled !== false,
      seedTerms: new Set(Array.isArray(r.seedTerms) ? r.seedTerms.map(t => t.toLowerCase()) : parseValues(r.value)),
    }));
    renderRequirements();
  },
};

// ═══════════════════════════════════════════════════════════════
// EXTRACTION.JS — synonym-assisted extraction filter
// Turns the user's fixed search parameters (from Requirements) into a
// hard pass/fail check across abstract + (for OA records) full text.
// ═══════════════════════════════════════════════════════════════
import { state } from './state.js';
import { requirements } from './requirements.js';
import { fetchFullTextEPMC } from './engines.js';

const TEXT_TYPES = new Set(['abstract_contains', 'title_contains', 'any_field_contains', 'custom_text']);

// synonymStore: { [requirementId]: { label, terms: Set<string> } }
export const synonymStore = {};
let _locked = false;

function seedFieldsFromRequirements() {
  const fields = requirements.filter(r => r.enabled && TEXT_TYPES.has(r.type));
  fields.forEach(r => {
    if (!synonymStore[r.id]) synonymStore[r.id] = { label: r.label || r.type, terms: new Set() };
    synonymStore[r.id].label = r.label || r.type;
    (r.value || '').split(',').map(v => v.trim()).filter(Boolean).forEach(v => synonymStore[r.id].terms.add(v));
  });
  Object.keys(synonymStore).forEach(id => {
    if (!fields.find(f => String(f.id) === String(id))) delete synonymStore[id];
  });
  return fields;
}

export function getExtractionFields() {
  seedFieldsFromRequirements();
  return Object.entries(synonymStore).map(([id, v]) => ({ id, label: v.label, terms: [...v.terms] }));
}

export function generateSynonymPrompt() {
  const fields = getExtractionFields();
  if (!fields.length) return '';
  const lines = fields.map(f => `- ${f.label}: currently searching for "${f.terms.join('", "') || '(no terms yet)'}"`);
  return [
    'I am screening scientific papers and need to detect these concepts even when authors phrase them differently.',
    'For EACH item below, give me 5-10 alternative words/phrases/synonyms that would also indicate the same concept',
    '(example: for "GPS coordinates" also accept "sampling location name", "site description", "collection locality").',
    'Reply with exactly one line per item in this format: LABEL: term1, term2, term3, ...',
    '',
    ...lines,
  ].join('\n');
}

export function parseSynonymReply(text) {
  const fields = getExtractionFields();
  const byLabelLower = {};
  fields.forEach(f => { byLabelLower[f.label.toLowerCase()] = f.id; });
  const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  let added = 0;
  lines.forEach(line => {
    const m = line.match(/^-?\s*([^:]+):\s*(.+)$/);
    if (!m) return;
    const id = byLabelLower[m[1].trim().toLowerCase()];
    if (!id) return;
    m[2].split(',').map(v => v.trim()).filter(Boolean).forEach(v => {
      if (!synonymStore[id].terms.has(v)) { synonymStore[id].terms.add(v); added++; }
    });
  });
  return added;
}

export function addSynonym(fieldId, term) {
  const t = (term || '').trim();
  if (!t || !synonymStore[fieldId]) return;
  synonymStore[fieldId].terms.add(t);
}
export function removeSynonym(fieldId, term) {
  if (!synonymStore[fieldId]) return;
  synonymStore[fieldId].terms.delete(term);
}
export function lockSynonyms() { _locked = true; }
export function isLocked() { return _locked; }

function matchesAny(haystack, terms) {
  const hay = (haystack || '').toLowerCase();
  return terms.some(t => hay.includes(t.toLowerCase()));
}

// Runs the extraction pass over state.records.
// A record needs a match for EVERY configured parameter to be "included".
// Missing + no full-text access anywhere → "maybe" (paywall/inconclusive), kept.
// Missing + fully checked (abstract + full text where available) → removed to state.excludedRecords.
export async function runExtractionFilter(onProgress) {
  const fields = getExtractionFields();
  if (!fields.length) return { error: 'No search parameters found. Add at least one "Abstract contains", "Title contains", or "Custom rule" requirement in Configure → Search requirements first.' };
  if (fields.some(f => !f.terms.length)) return { error: 'One or more parameters has no search terms at all. Add at least one term (or generate synonyms) before running.' };

  const kept = [];
  const excluded = [];
  let fetchedFullText = 0;
  const total = state.records.length;

  for (let i = 0; i < total; i++) {
    const r = state.records[i];
    const abstractHay = [r.full_citation || '', r._abstract || '', r.excerpt || ''].join(' ');
    const matched = [];
    let unmatchedFields = [];

    fields.forEach(f => {
      if (matchesAny(abstractHay, f.terms)) matched.push(f.label);
      else unmatchedFields.push(f);
    });

    let usedFullText = false;
    if (unmatchedFields.length && r.pmcid && r._isOA) {
      const full = await fetchFullTextEPMC(r.pmcid);
      fetchedFullText++;
      if (full) {
        usedFullText = true;
        r._fulltext_checked = true;
        const stillMissing = [];
        unmatchedFields.forEach(f => {
          if (matchesAny(full, f.terms)) matched.push(f.label);
          else stillMissing.push(f);
        });
        unmatchedFields = stillMissing;
      }
    }

    r._extraction_matched = matched;
    r._extraction_unmatched = unmatchedFields.map(f => f.label);

    if (unmatchedFields.length === 0) {
      r._screen_decision = 'include';
      r._screen_reason = `Matched: ${matched.join('; ')}`;
      kept.push(r);
    } else if (usedFullText) {
      r._screen_decision = 'exclude';
      r._screen_reason = `Checked full text — missing: ${unmatchedFields.map(f => f.label).join('; ')}`;
      excluded.push(r);
    } else {
      r._screen_decision = 'maybe';
      r._screen_reason = (!r.pmcid || !r._isOA)
        ? `No full-text access — abstract only. Missing: ${unmatchedFields.map(f => f.label).join('; ')}`
        : `Full text unavailable (fetch failed). Missing: ${unmatchedFields.map(f => f.label).join('; ')}`;
      kept.push(r);
    }

    if (onProgress) onProgress(i + 1, total);
  }

  state.records = kept;
  state.excludedRecords = excluded;

  return {
    total,
    included: kept.filter(r => r._screen_decision === 'include').length,
    inconclusive: kept.filter(r => r._screen_decision === 'maybe').length,
    excluded: excluded.length,
    fetchedFullText,
  };
}

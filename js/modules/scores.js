// ═══════════════════════════════════════════════════════════════
// SCORES.JS — schema fit %, term relevance %, size warning
// ═══════════════════════════════════════════════════════════════
import { LIVE_SCHEMA, customFields } from './schema.js';
import { state } from './state.js';
import { termEntries } from './extraction.js';
import { requirements } from './requirements.js';

export function scoreSchemaFit(r) {
  const active = [...LIVE_SCHEMA, ...customFields].filter(f => f.enabled);
  if (!active.length) return 0;
  const filled = active.filter(f => {
    const v = r[f.field]; return v && v !== 'not reported' && v !== '' && v !== 'not found';
  }).length;
  return Math.round((filled / active.length) * 100);
}

function fieldLabelMap() {
  const m = new Map();
  requirements.forEach(req => m.set(req.id, req.label || 'Requirement'));
  return m;
}

// Groups terms into CONCEPTS instead of scoring every synonym as its own unit.
// A concept = one Requirement field (all its synonyms are alternatives for the
// SAME thing — matching any one is enough), plus one extra bucket for Configure's
// raw Primary/Synonym/Extra keywords. Percent = concepts matched / total concepts.
//
// This fixes the earlier flat-term version: a concept with 20 AI-generated synonyms
// no longer needs all 20 present to "count" — nor does it drag the denominator up
// and make 100% unreachable. Adding more synonyms to a concept only improves the
// odds of catching it; it never raises the bar.
//
// Also returns which concepts matched and via which exact term, so the score is
// checkable against the actual keywords the user typed/approved — not a black box.
export function scoreTermRelevanceDetail(r) {
  const hay = [(r.full_citation || ''), (r._abstract || ''), (r.excerpt || '')].join(' ').toLowerCase();
  const labelById = fieldLabelMap();
  const concepts = [];

  const s = state.lastSettings;
  const configTerms = s ? [...(s.primaryTerms || []), ...(s.synonymTerms || []), ...(s.extraTerms || [])].filter(Boolean) : [];
  if (configTerms.length) concepts.push({ label: 'Configure keywords', terms: configTerms });

  const fieldTerms = new Map();
  termEntries().forEach(e => {
    e.fieldIds.forEach(fid => {
      if (!fieldTerms.has(fid)) fieldTerms.set(fid, []);
      fieldTerms.get(fid).push(e.term);
    });
  });
  fieldTerms.forEach((terms, fid) => concepts.push({ label: labelById.get(fid) || 'Requirement', terms }));

  if (!concepts.length) return { percent: 0, concepts: [] };

  const scored = concepts.map(c => {
    const matchedTerm = c.terms.find(t => hay.includes(t.toLowerCase()));
    return { label: c.label, matched: !!matchedTerm, matchedTerm: matchedTerm || null, termCount: c.terms.length };
  });
  const matchedCount = scored.filter(c => c.matched).length;
  const percent = Math.round((matchedCount / scored.length) * 100);
  return { percent, concepts: scored };
}

export function scoreTermRelevance(r) {
  return scoreTermRelevanceDetail(r).percent;
}

export function getExportOptions() {
  return {
    includeAbstract: !!(document.getElementById('opt-abstract')?.checked),
    includeSchemaFit: !!(document.getElementById('opt-schema-fit')?.checked),
    includeTermRelevance: !!(document.getElementById('opt-term-rel')?.checked),
  };
}

export function updateSizeWarning() {
  const opts = getExportOptions();
  const n = state.records.length;
  const est = n * 300 + (opts.includeAbstract ? n * 1500 : 0);
  const el = document.getElementById('csv-size-warn');
  if (!el) return;
  if (opts.includeAbstract && est > 2097152) {
    el.classList.add('visible');
    el.innerHTML = `⚠ Estimated CSV size: <strong>${(est / 1048576).toFixed(1)} MB</strong> — may be slow in Excel.`;
  } else { el.classList.remove('visible'); }
}

export const SWDScores = { scoreSchemaFit, scoreTermRelevance, scoreTermRelevanceDetail };

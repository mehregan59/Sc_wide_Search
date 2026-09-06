// ═══════════════════════════════════════════════════════════════
// SCORES.JS — schema fit %, term relevance %, size warning
// ═══════════════════════════════════════════════════════════════
import { LIVE_SCHEMA, customFields } from './schema.js';
import { state } from './state.js';
import { requirements, TEXT_TYPES, rawValues, splitSentences, isTermSupported } from './requirements.js';

export function scoreSchemaFit(r) {
  const active = [...LIVE_SCHEMA, ...customFields].filter(f => f.enabled);
  if (!active.length) return 0;
  const filled = active.filter(f => {
    const v = r[f.field]; return v && v !== 'not reported' && v !== '' && v !== 'not found';
  }).length;
  return Math.round((filled / active.length) * 100);
}

// Groups terms into CONCEPTS instead of scoring every synonym as its own unit.
// A concept = one Requirement field (all its synonyms are alternatives for the
// SAME thing — matching any one is enough), plus one extra bucket for Configure's
// raw Primary/Synonym/Extra keywords. Percent = concepts matched / total concepts.
//
// Matching uses the same "requires support" rule as the pass/fail Requirements
// engine (see requirements.js): a concept's SEED terms match anywhere; its
// AI-added synonyms only count if they co-occur with another of the concept's
// terms in the same sentence. Configure's raw keywords are always seed (the
// user typed them directly, no AI involved at that stage).
//
// Also returns which concepts matched and via which exact term, so the score is
// checkable against the actual keywords the user typed/approved — not a black box.
export function scoreTermRelevanceDetail(r) {
  const hayFull = [(r.full_citation || ''), (r._abstract || ''), (r.excerpt || '')].join(' ');
  const hayLower = hayFull.toLowerCase();
  const sentences = splitSentences(hayFull);
  const concepts = [];

  const s = state.lastSettings;
  const configTerms = s ? [...(s.primaryTerms || []), ...(s.synonymTerms || []), ...(s.extraTerms || [])].filter(Boolean) : [];
  if (configTerms.length) concepts.push({ label: 'Configure keywords', terms: configTerms, seedSet: new Set(configTerms.map(t => t.toLowerCase())) });

  requirements.filter(req => req.enabled && TEXT_TYPES.has(req.type) && (req.label || '').trim()).forEach(req => {
    const terms = rawValues(req.value);
    if (!terms.length) return;
    const seedSet = (req.seedTerms instanceof Set) ? req.seedTerms : new Set(terms.map(t => t.toLowerCase()));
    concepts.push({ label: req.label, terms, seedSet });
  });

  if (!concepts.length) return { percent: 0, concepts: [] };

  const scored = concepts.map(c => {
    const matchedTerm = c.terms.find(t => isTermSupported(t, c.terms, c.seedSet, hayLower, sentences));
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

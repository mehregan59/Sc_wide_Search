// ═══════════════════════════════════════════════════════════════
// SCORES.JS — schema fit %, term relevance %, size warning
// ═══════════════════════════════════════════════════════════════
import { LIVE_SCHEMA, customFields } from './schema.js';
import { state } from './state.js';
import { termEntries } from './extraction.js';

export function scoreSchemaFit(r) {
  const active = [...LIVE_SCHEMA, ...customFields].filter(f => f.enabled);
  if (!active.length) return 0;
  const filled = active.filter(f => {
    const v = r[f.field]; return v && v !== 'not reported' && v !== '' && v !== 'not found';
  }).length;
  return Math.round((filled / active.length) * 100);
}

// Checks against the UNION of two term sources:
//   1. Configure's raw Primary/Synonym/Extra Terms boxes (the original search keywords)
//   2. Every term/synonym currently sitting in Requirements (termEntries from extraction.js —
//      the same list the AI synonym prompt and AI Extraction both use)
// Previously this only checked #1, so a Requirement full of AI-generated synonyms had
// no effect on this score at all. Checking both makes 0% a genuinely strong signal:
// it means none of your keywords AND none of your (possibly dozens of) synonyms appear
// anywhere in the record's citation, abstract, or excerpt.
export function scoreTermRelevance(r) {
  const s = state.lastSettings;
  const configTerms = s ? [...(s.primaryTerms || []), ...(s.synonymTerms || []), ...(s.extraTerms || [])] : [];
  const reqTerms = termEntries().map(e => e.term);
  const terms = [...new Set([...configTerms, ...reqTerms])].filter(Boolean);
  if (!terms.length) return 0;
  const hay = [(r.full_citation || ''), (r._abstract || ''), (r.excerpt || '')].join(' ').toLowerCase();
  const matched = terms.filter(t => hay.includes(t.toLowerCase())).length;
  return Math.round((matched / terms.length) * 100);
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

export const SWDScores = { scoreSchemaFit, scoreTermRelevance };

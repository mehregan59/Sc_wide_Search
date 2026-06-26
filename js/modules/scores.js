// ═══════════════════════════════════════════════════════════════
// SCORES.JS — schema fit %, term relevance %, size warning
// ═══════════════════════════════════════════════════════════════
import { LIVE_SCHEMA, customFields } from './schema.js';
import { getScreening } from './state.js';
import { state } from './state.js';

export function scoreSchemaFit(r) {
  const active = [...LIVE_SCHEMA, ...customFields].filter(f => f.enabled);
  if (!active.length) return 0;
  const filled = active.filter(f => {
    const v = r[f.field]; return v && v !== 'not reported' && v !== '' && v !== 'not found';
  }).length;
  return Math.round((filled / active.length) * 100);
}

export function scoreTermRelevance(r) {
  const s = state.lastSettings;
  if (!s) return 0;
  const terms = [...(s.primaryTerms || []), ...(s.synonymTerms || []), ...(s.extraTerms || [])].filter(Boolean);
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

// ═══════════════════════════════════════════════════════════════
// EXTRACTION.JS — AI synonym-prompt generator + merge into Requirements
// No separate filtering pass here anymore — that lives in requirements.js
// (applyRequirementsWithFullText). This module only produces the prompt
// and folds the AI's reply straight into each Requirement's value field.
// ═══════════════════════════════════════════════════════════════
import { requirements, TEXT_TYPES, SWDReq } from './requirements.js';

function textFields() {
  return requirements.filter(r => r.enabled && TEXT_TYPES.has(r.type) && (r.label || '').trim());
}

export function generateSynonymPrompt() {
  const fields = textFields();
  if (!fields.length) return '';
  const lines = fields.map(f => `- ${f.label}: currently searching for "${(f.value || '').split(',').map(v => v.trim()).filter(Boolean).join('", "') || '(no terms yet)'}"`);
  return [
    'I am screening scientific papers and need to detect these concepts even when authors phrase them differently.',
    'For EACH item below, give me 5-10 alternative words/phrases/synonyms that would also indicate the same concept',
    '(example: for "GPS coordinates" also accept "sampling location name", "site description", "collection locality").',
    'Reply with exactly one line per item in this format: LABEL: term1, term2, term3, ...',
    '',
    ...lines,
  ].join('\n');
}

// Parses the AI's reply and appends new terms directly into the matching
// Requirement's value field (comma-separated, deduplicated). Returns how many
// terms were added, so the caller can report a count without extra state.
export function parseSynonymReplyAndApply(text) {
  const fields = textFields();
  const byLabelLower = {};
  fields.forEach(f => { byLabelLower[f.label.toLowerCase()] = f.id; });
  const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  let added = 0;
  lines.forEach(line => {
    const m = line.match(/^-?\s*([^:]+):\s*(.+)$/);
    if (!m) return;
    const id = byLabelLower[m[1].trim().toLowerCase()];
    if (!id) return;
    const terms = m[2].split(',').map(v => v.trim()).filter(Boolean);
    added += SWDReq.appendValue(id, terms);
  });
  return added;
}

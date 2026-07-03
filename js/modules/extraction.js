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

// Stricter than a first attempt: names the exact count of concepts, forbids
// merging them, forces a verbatim label echo, and bans any preamble text —
// none of this guarantees compliance from an arbitrary AI, it only reduces
// how often the reply comes back unparseable.
export function generateSynonymPrompt() {
  const fields = textFields();
  if (!fields.length) return '';
  const labelListQuoted = fields.map(f => `"${f.label}"`).join(', ');
  const currentLines = fields.map(f => `- ${f.label}: currently searching for "${(f.value || '').split(',').map(v => v.trim()).filter(Boolean).join('", "') || '(no terms yet)'}"`);
  const outputTemplate = fields.map(f => `${f.label}: <synonym1>, <synonym2>, <synonym3>, ...`);
  return [
    'I am screening scientific papers and need to detect SEPARATE concepts even when authors phrase them differently.',
    `There are exactly ${fields.length} concept(s), and they are DIFFERENT from each other: ${labelListQuoted}.`,
    'Treat each concept completely independently. Do NOT merge them into one combined list.',
    '',
    'Current concepts and their existing search terms:',
    ...currentLines,
    '',
    'For EACH concept, give 5-10 alternative words or phrases that indicate that SAME concept and no other.',
    '',
    'STRICT OUTPUT FORMAT — reply with ONLY the lines below, nothing else. No preamble, no explanation, no numbering, no extra commentary before or after:',
    ...outputTemplate,
    '',
    'Worked example with two unrelated concepts, "Habitat type" and "Sample size":',
    'Habitat type: forest cover, land cover class, vegetation type, ecosystem type',
    'Sample size: number of specimens, replicate count, sampling effort, n =',
    '',
    'Rules: one line per concept. Copy each concept label exactly as given above — do not paraphrase or reword it. Do not combine two concepts on one line.',
  ].join('\n');
}

// Parses the AI's reply and appends new terms directly into the matching
// Requirement's value field (comma-separated, deduplicated). Returns how many
// terms were added, so the caller can report a count without extra state.
//
// Fallback: if no labeled lines were found but there is exactly ONE concept,
// the whole reply is unambiguous — treat it as a flat list for that one field.
// With 2+ concepts, an unlabeled reply is never auto-assigned — guessing which
// terms belong to which requirement risks silently corrupting the filter.
export function parseSynonymReplyAndApply(text) {
  const fields = textFields();
  const byLabelLower = {};
  fields.forEach(f => { byLabelLower[f.label.toLowerCase()] = f.id; });
  const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  let added = 0;
  let matchedAnyLine = false;
  lines.forEach(line => {
    const m = line.match(/^-?\s*([^:]+):\s*(.+)$/);
    if (!m) return;
    const id = byLabelLower[m[1].trim().toLowerCase()];
    if (!id) return;
    matchedAnyLine = true;
    const terms = m[2].split(',').map(v => v.trim()).filter(Boolean);
    added += SWDReq.appendValue(id, terms);
  });
  if (!matchedAnyLine && fields.length === 1 && text.trim()) {
    const terms = text.split(/[,\n]/).map(v => v.trim()).filter(Boolean);
    added += SWDReq.appendValue(fields[0].id, terms);
  }
  return added;
}

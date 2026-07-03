// ═══════════════════════════════════════════════════════════════
// EXTRACTION.JS — AI synonym-prompt generator + merge into Requirements
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
    'I am building search terms for a systematic literature review (title/abstract screening stage). I need HIGH RECALL —',
    'as many alternative words and phrases as possible for each concept below, including broader and narrower phrasings',
    'and terminology commonly used in this field\u2019s literature. Screening favours over-inclusion over missed records.',
    '',
    'For EACH item below, generate 15-30 non-overlapping alternative words/phrases that indicate that SAME concept.',
    'Do not repeat any term already listed as "currently searching for" \u2014 only give NEW terms.',
    '(example: for "GPS coordinates" also accept "sampling location name", "site description", "collection locality").',
    '',
    'Reply with exactly one line per item in this format: LABEL: term1, term2, term3, ...',
    '',
    ...lines,
  ].join('\n');
}

// Parses the AI's reply and appends new terms directly into the matching
// Requirement's value field. Handles three cases, in order of preference:
//   1. Proper "Label: term1, term2" lines — matched by exact label lookup.
//   2. Exactly one concept exists — any comma/newline-separated text is
//      unambiguous, so the whole reply is applied to that one field.
//   3. Multiple concepts, no labels, but the reply has exactly one
//      comma-separated line per concept — assigned by position, in the
//      same order the concepts were listed in the generated prompt.
// A single merged flat list across 2+ concepts, with no way to tell which
// term belongs where, is refused rather than guessed.
export function parseSynonymReplyAndApply(text) {
  const fields = textFields();
  const byLabelLower = {};
  fields.forEach(f => { byLabelLower[f.label.toLowerCase()] = f.id; });

  const rawLines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  let added = 0;
  let matchedAnyLine = false;
  const unlabeledLines = [];

  rawLines.forEach(line => {
    const m = line.match(/^-?\s*([^:]+):\s*(.+)$/);
    const id = m ? byLabelLower[m[1].trim().toLowerCase()] : null;
    if (m && id) {
      matchedAnyLine = true;
      const terms = m[2].split(',').map(v => v.trim()).filter(Boolean);
      added += SWDReq.appendValue(id, terms);
    } else {
      unlabeledLines.push(line);
    }
  });

  if (!matchedAnyLine) {
    if (fields.length === 1 && text.trim()) {
      const terms = text.split(/[,\n]/).map(v => v.trim()).filter(Boolean);
      added += SWDReq.appendValue(fields[0].id, terms);
    } else if (fields.length > 1 && unlabeledLines.length === fields.length) {
      fields.forEach((f, i) => {
        const terms = unlabeledLines[i].split(',').map(v => v.trim()).filter(Boolean);
        added += SWDReq.appendValue(f.id, terms);
      });
    }
  }
  return added;
}

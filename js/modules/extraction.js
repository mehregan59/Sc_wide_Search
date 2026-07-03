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
  const labelListQuoted = fields.map(f => `"${f.label}"`).join(', ');
  const currentLines = fields.map(f => `- ${f.label}: currently searching for "${(f.value || '').split(',').map(v => v.trim()).filter(Boolean).join('", "') || '(no terms yet)'}"`);
  const outputTemplate = fields.map(f => `${f.label}: <synonym1>, <synonym2>, <synonym3>, ...`);
  return [
    'I am screening scientific papers and need to detect SEPARATE concepts even when authors phrase them differently.',
    `There are exactly ${fields.length} concept(s), and they are DIFFERENT from each other: ${labelListQuoted}.`,
    'These concepts must NEVER be merged into one combined list, even if they seem related.',
    '',
    'Current concepts and their existing search terms:',
    ...currentLines,
    '',
    'For EACH concept, give 5-10 alternative words or phrases that indicate that SAME concept and no other.',
    '',
    'STRICT OUTPUT FORMAT (required) — reply with ONLY the lines below, nothing else. No preamble, no explanation, no numbering, no headers, no extra commentary before or after:',
    ...outputTemplate,
    '',
    'Worked example with two unrelated concepts, "Habitat type" and "Sample size":',
    'Habitat type: forest cover, land cover class, vegetation type, ecosystem type',
    'Sample size: number of specimens, replicate count, sampling effort, n =',
    '',
    'Rules, all mandatory:',
    '1. Exactly one line per concept. Never combine two concepts on one line.',
    '2. Copy each concept label exactly as given above, character for character. Do not paraphrase, translate, or reword it.',
    `3. If you cannot use the "Label: term1, term2" format for any reason, fall back to: put each concept's synonyms on its own line, comma-separated, in this EXACT order and nothing else: ${fields.map(f => f.label).join(' — then — ')}.`,
    '4. Do not add a header, title, or summary before or after the list.',
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
// Anything else (a single merged flat list across 2+ concepts, with no way
// to tell which term belongs where) is refused rather than guessed —
// silently misassigning terms would corrupt the filter, which is worse
// than asking the user to reformat.
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

// ═══════════════════════════════════════════════════════════════
// EXTRACTION.JS — AI synonym-prompt generator + merge into Requirements
// Prompt is generated per INDIVIDUAL TERM, not per Requirement field.
// A single field can hold several unrelated seed terms (e.g. one
// "Abstract contains phrase" requirement with 6 different concepts OR'd
// together) — treating the whole field as one concept starves the AI of
// the separation it needs to be exhaustive. Splitting at the term level
// fixes that without requiring the user to restructure their Requirements.
// ═══════════════════════════════════════════════════════════════
import { requirements, TEXT_TYPES, SWDReq } from './requirements.js';

function textFields() {
  return requirements.filter(r => r.enabled && TEXT_TYPES.has(r.type) && (r.label || '').trim());
}

// Flattens every field's comma-separated value into individual term entries.
// If the same term text appears in more than one field, synonyms generated
// for it get applied to all of those fields (safe superset, never a guess).
function termEntries() {
  const map = new Map();
  textFields().forEach(f => {
    (f.value || '').split(',').map(v => v.trim()).filter(Boolean).forEach(t => {
      const key = t.toLowerCase();
      if (!map.has(key)) map.set(key, { term: t, fieldIds: new Set() });
      map.get(key).fieldIds.add(f.id);
    });
  });
  return [...map.values()];
}

export function generateSynonymPrompt() {
  const entries = termEntries();
  if (!entries.length) return '';
  const lines = entries.map(e => `- ${e.term}`);
  return [
    'I am building search terms for a systematic literature review (title/abstract screening stage). I need HIGH RECALL —',
    'as many alternative words and phrases as possible for each term below, including broader and narrower phrasings',
    'and terminology commonly used in this field\u2019s literature. Screening favours over-inclusion over missed records.',
    '',
    'Treat EACH term below as a SEPARATE, independent concept \u2014 do not merge them together, even if some seem related.',
    'For EACH term, generate 15-30 non-overlapping alternative words/phrases that indicate that SAME concept.',
    'Do not repeat the original term itself, and do not repeat a synonym across two different terms.',
    '',
    'Reply with exactly one line per term in this format: TERM: synonym1, synonym2, synonym3, ...',
    '(copy each term exactly as given below \u2014 do not paraphrase it)',
    '',
    ...lines,
  ].join('\n');
}

// Parses the AI's reply and appends new terms directly into the Requirement
// field(s) that originally contained each matched term. Handles three cases:
//   1. Proper "TERM: synonym1, synonym2" lines — matched by exact term lookup.
//   2. Exactly one term exists overall — any comma/newline-separated text is
//      unambiguous, so the whole reply is applied to that one term's field(s).
//   3. Multiple terms, no labels, but the reply has exactly one comma-separated
//      line per term — assigned by position, same order as the prompt.
// A merged flat list across 2+ terms with no way to split it is refused.
export function parseSynonymReplyAndApply(text) {
  const entries = termEntries();
  const byTermLower = new Map(entries.map(e => [e.term.toLowerCase(), e]));

  const rawLines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  let added = 0;
  let matchedAnyLine = false;
  const unlabeledLines = [];

  rawLines.forEach(line => {
    const m = line.match(/^-?\s*([^:]+):\s*(.+)$/);
    const entry = m ? byTermLower.get(m[1].trim().toLowerCase()) : null;
    if (m && entry) {
      matchedAnyLine = true;
      const terms = m[2].split(',').map(v => v.trim()).filter(Boolean);
      entry.fieldIds.forEach(fid => { added += SWDReq.appendValue(fid, terms); });
    } else {
      unlabeledLines.push(line);
    }
  });

  if (!matchedAnyLine) {
    if (entries.length === 1 && text.trim()) {
      const terms = text.split(/[,\n]/).map(v => v.trim()).filter(Boolean);
      entries[0].fieldIds.forEach(fid => { added += SWDReq.appendValue(fid, terms); });
    } else if (entries.length > 1 && unlabeledLines.length === entries.length) {
      entries.forEach((e, i) => {
        const terms = unlabeledLines[i].split(',').map(v => v.trim()).filter(Boolean);
        e.fieldIds.forEach(fid => { added += SWDReq.appendValue(fid, terms); });
      });
    }
  }
  return added;
}

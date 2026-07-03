// ═══════════════════════════════════════════════════════════════
// EXTRACTOR.JS — processHit, assignCat, dedup
// ═══════════════════════════════════════════════════════════════
import { getKeywords, customFields } from './schema.js';

const EV_TYPE_KW = {
  trap: ['trap','trapping','Droso-Trap','McPhail','sticky'],
  morphology: ['morpholog','specimen','pinned','museum'],
  DNA: ['DNA','COI','ITS','barcode','sequenc','haplotype'],
  model: ['MaxEnt','BIOCLIM','SDM','niche'],
  review: ['review','meta-analysis','synthesis'],
  lab_colony: ['colony','laborator','strain','reared','isofemale'],
};
const EV_CLASS_KW = {
  primary: ['collect','trap','specimen','survey','monitor','field','wild','caught','detected','first record','first report'],
  secondary: ['cited in','according to','as reported by','pers. comm'],
  modelled: ['model','predict','project','MaxEnt'],
  'review-only': ['review','meta-analysis','synthesis'],
  'lab-strain-origin': ['colony origin','lab strain','lab population','reared from','isofemale'],
};

function extractFrom(text, list) {
  if (!text) return 'not reported';
  for (const p of list) {
    if (new RegExp('\\b' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(text)) return p;
  }
  return 'not reported';
}
function detectEvType(text) {
  if (!text) return 'observation';
  for (const [t, kws] of Object.entries(EV_TYPE_KW))
    for (const k of kws) if (text.toLowerCase().includes(k.toLowerCase())) return t;
  return 'observation';
}
function detectEvClass(text) {
  if (!text) return 'primary';
  for (const [c, kws] of Object.entries(EV_CLASS_KW))
    for (const k of kws) if (text.toLowerCase().includes(k.toLowerCase())) return c;
  return 'primary';
}
function extractCustomField(fd, text) {
  return (!fd.keywords || !fd.keywords.length) ? 'not reported' : extractFrom(text, fd.keywords);
}

export function assignCat(r) {
  if (r.pub_year && r.pub_year < 1980) return 'F';
  if (!r.country || r.country === 'not reported') return 'E';
  const ec = r.evidence_class || '';
  if (ec === 'lab-strain-origin') return 'C';
  if (ec === 'review-only' || ec === 'modelled') return 'D';
  if (ec === 'primary') return 'A';
  return 'B';
}
export function assignVerif(r) {
  if (!r.country || r.country === 'not reported') return 'No usable location';
  if (r.evidence_class === 'secondary') return 'Secondary citation only';
  if (!r.locality || r.locality === 'not reported') return 'Needs manual check';
  if (r.doi && r.doi !== 'not reported' && r.evidence_class === 'primary') return 'Verified';
  return 'Partly verified';
}

export function processHit(hit) {
  const ft = [hit.title, hit.abstract].join(' ');
  const country = hit.country || extractFrom(ft, getKeywords('country'));
  const region = hit.region || extractFrom(ft, getKeywords('region'));
  const host = hit.host_plant || extractFrom(ft, getKeywords('host'));
  const evType = hit.evidence_type || detectEvType(ft);
  const evClass = hit.evidence_class || detectEvClass(ft);
  const doi = hit.doi || 'not reported';
  const sentences = (hit.abstract || '').match(/[^.!?]+[.!?]+/g) || [];
  const excerpt = (sentences.find(s => s.toLowerCase().includes((country || '').toLowerCase())) || sentences[0] || '').trim().slice(0, 400) || 'not reported';
  const r = {
    full_citation: hit._direct
      ? `${hit.authors} (${hit.year || 'n.d.'}). ${hit.title}. ${hit.source_db}.`
      : `${hit.authors || ''} (${hit.year || 'n.d.'}). ${hit.title || 'Untitled'}. DOI: ${doi}`,
    pub_year: hit.year, source_type: hit.source_type || 'journal', language: hit.language || 'en',
    country, region, locality: hit.locality || 'not reported', coordinates: hit.coordinates || 'not reported',
    sampling_year: hit.year || 'not reported', host_plant: host,
    study_context: hit._direct ? 'Occurrence record' : (evType === 'lab_colony' ? 'Laboratory study' : 'Field study / survey'),
    evidence_type: evType, evidence_class: evClass,
    excerpt: hit._direct ? 'not reported' : excerpt,
    doi, url: hit.url || (doi !== 'not reported' ? `https://doi.org/${doi}` : 'not reported'),
    pdf_available: hit.pdf_available || 'unknown', source_db: hit.source_db,
    notes: country === 'not reported' ? 'No geographic term found — manual full-text check required.' : '',
    screening_decision: '', screening_reason: '',
    _abstract: hit.abstract || '',
    pmcid: hit.pmcid || null,
    _isOA: !!hit.isOA,
  };
  for (const f of customFields)
    r[f.field] = (f.extractFrom === 'custom' && f.keywords?.length) ? extractCustomField(f, ft) : 'not reported';
  r.category = assignCat(r);
  r.verification_status = assignVerif(r);
  return [r];
}

const _seen = new Set();
export function resetSeen() { _seen.clear(); }
export function isDuplicate(r) {
  const key = r.doi && r.doi !== 'not reported'
    ? r.doi
    : (r.full_citation || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
  if (_seen.has(key)) return true;
  _seen.add(key);
  return false;
}

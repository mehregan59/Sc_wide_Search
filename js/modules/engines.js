// ═══════════════════════════════════════════════════════════════
// ENGINES.JS — all API fetch functions
// ═══════════════════════════════════════════════════════════════

const DELAY = 200, RETRY_WAIT = 2000, MAX_RETRY = 2;
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function fetchJSON(url, signal, attempt = 0) {
  await sleep(DELAY);
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal });
    if (res.status === 429 || res.status === 503) {
      if (attempt < MAX_RETRY) { await sleep(RETRY_WAIT * (attempt + 1)); return fetchJSON(url, signal, attempt + 1); }
      return null;
    }
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { if (e.name === 'AbortError') throw e; return null; }
}

// Full text fetch for Europe PMC open-access records (used by the Extraction Filter).
// pmcid must include the "PMC" prefix as returned by Europe PMC's search API.
// Returns plain text (tags stripped) suitable for keyword matching only — NOT for display/citation.
export async function fetchFullTextEPMC(pmcid, signal) {
  if (!pmcid) return null;
  try {
    await sleep(DELAY);
    const res = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/${pmcid}/fullTextXML`, { signal });
    if (!res.ok) return null;
    const xml = await res.text();
    return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  } catch (e) { if (e.name === 'AbortError') throw e; return null; }
}

function reconstitute(inv) {
  if (!inv) return '';
  const pos = [];
  for (const [w, idxs] of Object.entries(inv)) for (const i of idxs) pos.push([i, w]);
  return pos.sort((a, b) => a[0] - b[0]).map(p => p[1]).join(' ');
}
const mapOAType = t => ({ 'journal-article': 'journal', 'dissertation': 'thesis', 'report': 'report', 'book-chapter': 'book_chapter', 'proceedings-article': 'conference', 'preprint': 'grey' }[t] || 'journal');
const mapCRType = t => ({ 'journal-article': 'journal', 'book-chapter': 'book_chapter', 'proceedings-article': 'conference', 'dissertation': 'thesis', 'report': 'report', 'posted-content': 'grey' }[t] || 'journal');

let _gbifCache = null, _inatCache = null;
export function resetEngineCache() { _gbifCache = null; _inatCache = null; }

export async function queryOpenAlex(term, s, signal, label) {
  const yr = s.yearFrom && s.yearTo ? `&filter=publication_year:${s.yearFrom}-${s.yearTo}` : '';
  const data = await fetchJSON(`https://api.openalex.org/works?search=${encodeURIComponent(term)}${yr}&per-page=100&mailto=sciwide-search@research.tool`, signal);
  if (!data) return null;
  return (data.results || []).map(p => ({
    title: p.title || '', authors: (p.authorships || []).map(a => a.author?.display_name).filter(Boolean).join(', '),
    year: p.publication_year || null, abstract: reconstitute(p.abstract_inverted_index),
    doi: p.doi ? p.doi.replace('https://doi.org/', '') : 'not reported',
    url: p.open_access?.oa_url || p.doi || 'not reported', language: p.language || '',
    source_type: mapOAType(p.type), pdf_available: p.open_access?.is_oa ? 'yes' : 'paywalled',
    source_db: label || 'OpenAlex',
  }));
}

export async function queryEuropePMC(term, s, signal) {
  const yr = s.yearFrom && s.yearTo ? ` AND (PUB_YEAR:[${s.yearFrom} TO ${s.yearTo}])` : '';
  const data = await fetchJSON(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent('"' + term + '"' + yr)}&format=json&pageSize=100&resultType=core`, signal);
  if (!data) return null;
  return ((data.resultList || {}).result || []).map(p => ({
    title: p.title || '', authors: (p.authorList?.author || []).map(a => a.fullName).join(', '),
    year: parseInt(p.pubYear) || null, abstract: p.abstractText || '',
    doi: p.doi || 'not reported', url: p.doi ? `https://doi.org/${p.doi}` : 'not reported',
    language: p.language || '', source_type: 'journal',
    pdf_available: p.isOpenAccess === 'Y' ? 'yes' : 'unknown', source_db: 'Europe PMC',
    pmcid: p.pmcid || null, isOA: p.isOpenAccess === 'Y',
  }));
}

export async function queryPubMed(term, s, signal) {
  const yr = s.yearFrom && s.yearTo ? ` AND (PUB_YEAR:[${s.yearFrom} TO ${s.yearTo}])` : '';
  const data = await fetchJSON(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent('"' + term + '" AND (SRC:MED)' + yr)}&format=json&pageSize=100&resultType=core`, signal);
  if (!data) return null;
  return ((data.resultList || {}).result || []).map(p => ({
    title: p.title || '', authors: (p.authorList?.author || []).map(a => a.fullName).join(', '),
    year: parseInt(p.pubYear) || null, abstract: p.abstractText || '',
    doi: p.doi || 'not reported',
    url: p.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/` : (p.doi ? `https://doi.org/${p.doi}` : 'not reported'),
    language: p.language || '', source_type: 'journal',
    pdf_available: p.isOpenAccess === 'Y' ? 'yes' : 'unknown', source_db: 'PubMed (via Europe PMC)',
    pmcid: p.pmcid || null, isOA: p.isOpenAccess === 'Y',
  }));
}

export async function queryBiorxiv(term, s, signal) {
  const yr = s.yearFrom && s.yearTo ? ` AND (PUB_YEAR:[${s.yearFrom} TO ${s.yearTo}])` : '';
  const data = await fetchJSON(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent('"' + term + '" AND (SRC:PPR)' + yr)}&format=json&pageSize=100&resultType=core`, signal);
  if (!data) return null;
  return ((data.resultList || {}).result || []).map(p => ({
    title: p.title || '', authors: (p.authorList?.author || []).map(a => a.fullName).join(', '),
    year: parseInt(p.pubYear) || null, abstract: p.abstractText || '',
    doi: p.doi || 'not reported', url: p.doi ? `https://doi.org/${p.doi}` : 'not reported',
    language: 'en', source_type: 'grey', pdf_available: 'yes', source_db: 'bioRxiv / medRxiv',
    pmcid: p.pmcid || null, isOA: true,
  }));
}

// arXiv note: export.arxiv.org blocks CORS from GitHub Pages (no Access-Control-Allow-Origin header).
// The fetch will fail with a TypeError — we catch it and return null so the search continues.
// arXiv preprints are covered via Europe PMC (SRC:PPR) and OpenAlex which both index arXiv.
export async function queryArxiv(term, s, signal) {
  try {
    await sleep(DELAY);
    const res = await fetch(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(term)}&start=0&max_results=100`, { signal });
    if (!res.ok) return null;
    const xml = new DOMParser().parseFromString(await res.text(), 'application/xml');
    return [...xml.querySelectorAll('entry')].map(e => {
      const doi = (e.querySelector('doi')?.textContent || '').trim();
      const id = (e.querySelector('id')?.textContent || '').replace('http://arxiv.org/abs/', '').trim();
      const yr = parseInt((e.querySelector('published')?.textContent || '').slice(0, 4)) || null;
      return {
        title: (e.querySelector('title')?.textContent || '').replace(/\s+/g, ' ').trim(),
        authors: [...e.querySelectorAll('author name')].map(n => n.textContent).join(', '),
        year: yr, abstract: (e.querySelector('summary')?.textContent || '').replace(/\s+/g, ' ').trim(),
        doi: doi || 'not reported', url: doi ? `https://doi.org/${doi}` : `https://arxiv.org/abs/${id}`,
        language: 'en', source_type: 'grey', pdf_available: 'yes', source_db: 'arXiv',
      };
    }).filter(r => (!s.yearFrom || !r.year || r.year >= s.yearFrom) && (!s.yearTo || !r.year || r.year <= s.yearTo));
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    return null;
  }
}

export async function queryCrossref(term, s, signal) {
  const f = s.yearFrom && s.yearTo ? `&filter=from-pub-date:${s.yearFrom},until-pub-date:${s.yearTo}` : '';
  const data = await fetchJSON(`https://api.crossref.org/works?query=${encodeURIComponent(term)}${f}&rows=100&mailto=sciwide-search@research.tool`, signal);
  if (!data) return null;
  return ((data.message || {}).items || []).map(p => ({
    title: Array.isArray(p.title) ? p.title[0] : (p.title || ''),
    authors: (p.author || []).map(a => [a.family, a.given].filter(Boolean).join(' ')).join('; '),
    year: p.published?.['date-parts']?.[0]?.[0] || null,
    abstract: p.abstract ? p.abstract.replace(/<[^>]+>/g, '') : '',
    doi: p.DOI || 'not reported', url: p.DOI ? `https://doi.org/${p.DOI}` : 'not reported',
    source_type: mapCRType(p.type),
    pdf_available: p.link?.find(l => l['content-type'] === 'application/pdf') ? 'yes' : 'unknown',
    source_db: 'Crossref',
  }));
}

export async function queryZenodo(term, s, signal) {
  const data = await fetchJSON(`https://zenodo.org/api/records?q=${encodeURIComponent(term)}&size=100&sort=mostrecent&type=publication`, signal);
  if (!data) return null;
  return ((data.hits || {}).hits || []).map(r => ({
    title: r.metadata?.title || '',
    authors: (r.metadata?.creators || []).map(c => c.name).join(', '),
    year: r.metadata?.publication_date ? parseInt(r.metadata.publication_date.slice(0, 4)) : null,
    abstract: r.metadata?.description || '',
    doi: r.doi || r.metadata?.doi || 'not reported',
    url: r.links?.html || 'not reported', source_type: 'grey',
    pdf_available: r.files?.length ? 'yes' : 'unknown', source_db: 'Zenodo',
  }));
}

export async function queryGBIF(signal) {
  if (!_gbifCache) {
    const data = await fetchJSON('https://api.gbif.org/v1/occurrence/search?limit=300', signal);
    _gbifCache = data ? (data.results || []) : [];
  }
  return _gbifCache.map(o => ({
    title: `GBIF occurrence #${o.key}`, authors: o.institutionCode || o.datasetName || 'GBIF',
    year: o.year || null, abstract: '', doi: 'not reported',
    url: `https://www.gbif.org/occurrence/${o.key}`,
    country: o.country || 'not reported', region: o.stateProvince || 'not reported',
    locality: o.locality || 'not reported',
    coordinates: (o.decimalLatitude && o.decimalLongitude) ? `${o.decimalLatitude}, ${o.decimalLongitude}` : 'not reported',
    host_plant: o.associatedTaxa || 'not reported', evidence_type: 'observation',
    evidence_class: 'primary', source_type: 'occurrence', pdf_available: 'unknown',
    source_db: 'GBIF', _direct: true,
  }));
}

export async function queryINat(signal) {
  if (!_inatCache) {
    const data = await fetchJSON('https://api.inaturalist.org/v1/observations?quality_grade=research&per_page=200', signal);
    _inatCache = data ? (data.results || []) : [];
  }
  return _inatCache.map(o => ({
    title: `iNaturalist #${o.id}`, authors: o.user?.login || 'iNaturalist user',
    year: o.observed_on ? parseInt(o.observed_on.slice(0, 4)) : null,
    abstract: o.description || '', doi: 'not reported',
    url: `https://www.inaturalist.org/observations/${o.id}`,
    country: o.place_guess || 'not reported', region: 'not reported',
    locality: o.place_guess || 'not reported', coordinates: o.location || 'not reported',
    evidence_type: 'observation', evidence_class: 'primary', source_type: 'occurrence',
    pdf_available: 'unknown', source_db: 'iNaturalist', _direct: true,
  }));
}

export async function engineQuery(db, term, s, signal) {
  try {
    switch (db) {
      case 'semanticscholar': return await queryOpenAlex(term, s, signal, 'Semantic Scholar (via OpenAlex)');
      case 'openalex':        return await queryOpenAlex(term, s, signal, 'OpenAlex');
      case 'europepmc':       return await queryEuropePMC(term, s, signal);
      case 'pubmed':          return await queryPubMed(term, s, signal);
      case 'biorxiv':         return await queryBiorxiv(term, s, signal);
      case 'arxiv':           return await queryArxiv(term, s, signal);
      case 'crossref':        return await queryCrossref(term, s, signal);
      case 'zenodo':          return await queryZenodo(term, s, signal);
      case 'gbif':            return await queryGBIF(signal);
      case 'inat':            return await queryINat(signal);
      default:                return [];
    }
  } catch (e) { if (e.name === 'AbortError') throw e; return null; }
}

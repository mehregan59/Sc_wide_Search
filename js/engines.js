/* js/engines.js — Real API connectors
 *
 * Live: Semantic Scholar, OpenAlex, Europe PMC, Crossref, GBIF, iNaturalist, Zenodo
 * Stub: All institutional databases — replace stubEngine() with real fetch() calls.
 */

const SWDEngines = (() => {

  const DELAY_MS  = 350;
  const RETRY_MS  = 1800;
  const MAX_RETRY = 2;

  async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function fetchJSON(url, opts={}, attempt=0) {
    try {
      await sleep(DELAY_MS);
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', ...opts.headers },
        signal: opts.signal,
      });
      if (res.status === 429 || res.status === 503) {
        if (attempt < MAX_RETRY) { await sleep(RETRY_MS*(attempt+1)); return fetchJSON(url, opts, attempt+1); }
        throw new Error(`Rate limited: ${res.status}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch(err) {
      if (err.name==='AbortError') throw err;
      throw err;
    }
  }

  // ── Semantic Scholar ────────────────────────────────────────
  async function semanticScholar(term, settings, signal) {
    const fields = 'paperId,title,authors,year,externalIds,publicationTypes,abstract,openAccessPdf';
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent('"'+term+'"')}&fields=${fields}&limit=100&year=${settings.yearFrom}-${settings.yearTo}`;
    const data = await fetchJSON(url, {signal});
    return (data.data||[]).map(p => ({
      title: p.title||'', authors: (p.authors||[]).map(a=>a.name).join(', '),
      year: p.year||null, abstract: p.abstract||'',
      doi: (p.externalIds||{}).DOI||'not reported',
      url: p.openAccessPdf?.url || (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : 'not reported'),
      source_type: mapSSType(p.publicationTypes),
      pdf_available: p.openAccessPdf ? 'yes' : 'unknown',
      source_db: 'Semantic Scholar', raw: p,
    }));
  }

  // ── OpenAlex ────────────────────────────────────────────────
  async function openAlex(term, settings, signal) {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(term)}&filter=publication_year:${settings.yearFrom}-${settings.yearTo}&per-page=100&mailto=swd-search@research.tool`;
    const data = await fetchJSON(url, {signal});
    return (data.results||[]).map(p => ({
      title: p.title||'',
      authors: (p.authorships||[]).map(a=>a.author?.display_name).filter(Boolean).join(', '),
      year: p.publication_year||null,
      abstract: reconstitute(p.abstract_inverted_index),
      doi: p.doi ? p.doi.replace('https://doi.org/','') : 'not reported',
      url: p.open_access?.oa_url||p.doi||'not reported',
      language: p.language||'',
      source_type: mapOAType(p.type),
      pdf_available: p.open_access?.is_oa ? 'yes' : 'paywalled',
      source_db: 'OpenAlex', raw: p,
    }));
  }

  function reconstitute(inv) {
    if (!inv) return '';
    const pos = [];
    for (const [w, idxs] of Object.entries(inv)) for (const i of idxs) pos.push([i,w]);
    return pos.sort((a,b)=>a[0]-b[0]).map(p=>p[1]).join(' ');
  }

  // ── Europe PMC ──────────────────────────────────────────────
  async function europePMC(term, settings, signal) {
    const q = encodeURIComponent(`"${term}" AND (PUB_YEAR:[${settings.yearFrom} TO ${settings.yearTo}])`);
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q}&format=json&pageSize=100&resultType=core`;
    const data = await fetchJSON(url, {signal});
    return ((data.resultList||{}).result||[]).map(p => ({
      title: p.title||'',
      authors: (p.authorList?.author||[]).map(a=>a.fullName).join(', '),
      year: parseInt(p.pubYear)||null, abstract: p.abstractText||'',
      doi: p.doi||'not reported',
      url: p.doi ? `https://doi.org/${p.doi}` : 'not reported',
      language: p.language||'', source_type: 'journal',
      pdf_available: p.isOpenAccess==='Y' ? 'yes' : 'unknown',
      source_db: 'Europe PMC', raw: p,
    }));
  }

  // ── Crossref ────────────────────────────────────────────────
  async function crossref(term, settings, signal) {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(term)}&filter=from-pub-date:${settings.yearFrom},until-pub-date:${settings.yearTo}&rows=100&mailto=swd-search@research.tool`;
    const data = await fetchJSON(url, {signal});
    return ((data.message||{}).items||[]).map(p => ({
      title: Array.isArray(p.title) ? p.title[0] : (p.title||''),
      authors: (p.author||[]).map(a=>[a.family,a.given].filter(Boolean).join(' ')).join('; '),
      year: p.published?.['date-parts']?.[0]?.[0]||null,
      abstract: p.abstract ? p.abstract.replace(/<[^>]+>/g,'') : '',
      doi: p.DOI||'not reported',
      url: p.DOI ? `https://doi.org/${p.DOI}` : 'not reported',
      source_type: mapCRType(p.type),
      pdf_available: p.link?.find(l=>l['content-type']==='application/pdf') ? 'yes' : 'unknown',
      source_db: 'Crossref', raw: p,
    }));
  }

  // ── GBIF ────────────────────────────────────────────────────
  async function gbif(term, settings, signal) {
    const url = `https://api.gbif.org/v1/occurrence/search?taxonKey=1455379&limit=300`;
    const data = await fetchJSON(url, {signal});
    return (data.results||[]).map(occ => ({
      title: `GBIF occurrence #${occ.key}`,
      authors: occ.institutionCode||occ.datasetName||'GBIF',
      year: occ.year||null, abstract: '',
      doi: 'not reported', url: `https://www.gbif.org/occurrence/${occ.key}`,
      country: occ.country||'not reported',
      region: occ.stateProvince||'not reported',
      locality: occ.locality||'not reported',
      coordinates: (occ.decimalLatitude&&occ.decimalLongitude) ? `${occ.decimalLatitude}, ${occ.decimalLongitude}` : 'not reported',
      host_plant: occ.associatedTaxa||'not reported',
      evidence_type: 'observation', evidence_class: 'primary',
      source_type: 'occurrence', pdf_available: 'unknown',
      source_db: 'GBIF', _direct: true, raw: occ,
    }));
  }

  // ── iNaturalist ─────────────────────────────────────────────
  async function iNaturalist(term, settings, signal) {
    const url = `https://api.inaturalist.org/v1/observations?taxon_name=Drosophila+suzukii&quality_grade=research&per_page=200&order=desc&order_by=created_at`;
    const data = await fetchJSON(url, {signal});
    return (data.results||[]).map(obs => ({
      title: `iNaturalist observation #${obs.id}`,
      authors: obs.user?.login||'iNaturalist user',
      year: obs.observed_on ? parseInt(obs.observed_on.slice(0,4)) : null,
      abstract: obs.description||'', doi: 'not reported',
      url: `https://www.inaturalist.org/observations/${obs.id}`,
      country: obs.place_guess||'not reported', region: 'not reported',
      locality: obs.place_guess||'not reported',
      coordinates: obs.location||'not reported',
      evidence_type: 'observation', evidence_class: 'primary',
      source_type: 'occurrence', pdf_available: 'unknown',
      source_db: 'iNaturalist', _direct: true, raw: obs,
    }));
  }

  // ── Zenodo ──────────────────────────────────────────────────
  async function zenodo(term, settings, signal) {
    const url = `https://zenodo.org/api/records?q=${encodeURIComponent(term)}&size=100&sort=mostrecent&type=publication`;
    const data = await fetchJSON(url, {signal});
    return ((data.hits||{}).hits||[]).map(r => ({
      title: r.metadata?.title||'',
      authors: (r.metadata?.creators||[]).map(c=>c.name).join(', '),
      year: r.metadata?.publication_date ? parseInt(r.metadata.publication_date.slice(0,4)) : null,
      abstract: r.metadata?.description||'',
      doi: r.doi||r.metadata?.doi||'not reported',
      url: r.links?.html||'not reported',
      source_type: 'grey',
      pdf_available: r.files?.length ? 'yes' : 'unknown',
      source_db: 'Zenodo', raw: r,
    }));
  }

  // ── Type mappers ────────────────────────────────────────────
  function mapSSType(types) {
    if (!types||!types.length) return 'journal';
    if (types.includes('Thesis')) return 'thesis';
    if (types.includes('Conference')) return 'conference';
    return 'journal';
  }
  function mapOAType(t) {
    return {'journal-article':'journal','dissertation':'thesis','report':'report','book-chapter':'book_chapter','proceedings-article':'conference','preprint':'grey'}[t]||'journal';
  }
  function mapCRType(t) {
    return {'journal-article':'journal','book-chapter':'book_chapter','proceedings-article':'conference','dissertation':'thesis','report':'report','posted-content':'grey'}[t]||'journal';
  }

  // ── Stub ────────────────────────────────────────────────────
  async function stubEngine(db, term, settings, signal) {
    await sleep(150);
    return []; // Replace with real connector — see README
  }

  const CONNECTORS = {
    semanticscholar, openalex, europepmc: europePMC, crossref, gbif, inat: iNaturalist, zenodo,
    unpaywall:(t,s,sig)=>stubEngine('unpaywall',t,s,sig),
    base:(t,s,sig)=>stubEngine('base',t,s,sig),
    eppo:(t,s,sig)=>stubEngine('eppo',t,s,sig),
    cabi:(t,s,sig)=>stubEngine('cabi',t,s,sig),
    usda:(t,s,sig)=>stubEngine('usda',t,s,sig),
    jki:(t,s,sig)=>stubEngine('jki',t,s,sig),
    naro:(t,s,sig)=>stubEngine('naro',t,s,sig),
    caas:(t,s,sig)=>stubEngine('caas',t,s,sig),
    rda:(t,s,sig)=>stubEngine('rda',t,s,sig),
    bold:(t,s,sig)=>stubEngine('bold',t,s,sig),
    ncbi:(t,s,sig)=>stubEngine('ncbi',t,s,sig),
    lens:(t,s,sig)=>stubEngine('lens',t,s,sig),
  };

  async function query(dbKey, term, settings, signal) {
    const fn = CONNECTORS[dbKey];
    if (!fn) throw new Error(`Unknown database: ${dbKey}`);
    return fn(term, settings, signal);
  }

  return { query, CONNECTORS };
})();

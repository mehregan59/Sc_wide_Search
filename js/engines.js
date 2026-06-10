/* js/engines.js — Real API connectors
 *
 * CORS-safe for browser / GitHub Pages (no server needed):
 *   ✅ OpenAlex          — full CORS, free, no key
 *   ✅ Europe PMC        — full CORS, free, no key
 *   ✅ Crossref          — full CORS, free, polite pool
 *   ✅ GBIF              — full CORS, free, no key
 *   ✅ iNaturalist       — full CORS, free, no key
 *   ✅ Zenodo            — full CORS, free, no key
 *   ⚠️  Semantic Scholar — CORS blocked without API key → uses OpenAlex as proxy
 *   🔧 All institutional stubs — return [] silently (not counted as errors)
 */

const SWDEngines = (() => {

  const DELAY_MS  = 200;   // polite inter-request delay
  const RETRY_MS  = 2000;  // wait after 429
  const MAX_RETRY = 2;

  // ── Helpers ─────────────────────────────────────────────────
  async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function fetchJSON(url, opts = {}, attempt = 0) {
    await sleep(DELAY_MS);
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', ...opts.headers },
        signal: opts.signal,
      });
      if (res.status === 429 || res.status === 503) {
        if (attempt < MAX_RETRY) {
          await sleep(RETRY_MS * (attempt + 1));
          return fetchJSON(url, opts, attempt + 1);
        }
        return null; // give up gracefully — caller handles null
      }
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw err; // re-throw stop signal
      // CORS / network errors — return null so caller logs a warning, not an error
      return null;
    }
  }

  // ── OpenAlex ────────────────────────────────────────────────
  // Fully CORS-open. Also used as fallback for Semantic Scholar.
  async function openAlex(term, settings, signal) {
    const url = [
      'https://api.openalex.org/works',
      `?search=${encodeURIComponent(term)}`,
      `&filter=publication_year:${settings.yearFrom}-${settings.yearTo}`,
      `&per-page=100`,
      `&mailto=swd-search@research.tool`,
    ].join('');
    const data = await fetchJSON(url, { signal });
    if (!data) return [];
    return (data.results || []).map(p => ({
      title:    p.title || '',
      authors:  (p.authorships || []).map(a => a.author?.display_name).filter(Boolean).join(', '),
      year:     p.publication_year || null,
      abstract: reconstitute(p.abstract_inverted_index),
      doi:      p.doi ? p.doi.replace('https://doi.org/', '') : 'not reported',
      url:      p.open_access?.oa_url || p.doi || 'not reported',
      language: p.language || '',
      source_type:   mapOAType(p.type),
      pdf_available: p.open_access?.is_oa ? 'yes' : 'paywalled',
      source_db: 'OpenAlex',
    }));
  }

  // Semantic Scholar is CORS-blocked from browsers without an API key.
  // We route it through an additional OpenAlex query with a title-focused filter
  // so users who select "Semantic Scholar" still get results.
  async function semanticScholar(term, settings, signal) {
    const url = [
      'https://api.openalex.org/works',
      `?search=${encodeURIComponent(term)}`,
      `&filter=publication_year:${settings.yearFrom}-${settings.yearTo}`,
      `&per-page=100`,
      `&sort=cited_by_count:desc`,
      `&mailto=swd-search@research.tool`,
    ].join('');
    const data = await fetchJSON(url, { signal });
    if (!data) return [];
    return (data.results || []).map(p => ({
      title:    p.title || '',
      authors:  (p.authorships || []).map(a => a.author?.display_name).filter(Boolean).join(', '),
      year:     p.publication_year || null,
      abstract: reconstitute(p.abstract_inverted_index),
      doi:      p.doi ? p.doi.replace('https://doi.org/', '') : 'not reported',
      url:      p.open_access?.oa_url || p.doi || 'not reported',
      language: p.language || '',
      source_type:   mapOAType(p.type),
      pdf_available: p.open_access?.is_oa ? 'yes' : 'paywalled',
      // label clearly so users know the CORS fallback was used
      source_db: 'Semantic Scholar (via OpenAlex)',
    }));
  }

  function reconstitute(inv) {
    if (!inv) return '';
    const pos = [];
    for (const [w, idxs] of Object.entries(inv)) for (const i of idxs) pos.push([i, w]);
    return pos.sort((a, b) => a[0] - b[0]).map(p => p[1]).join(' ');
  }

  // ── Europe PMC ──────────────────────────────────────────────
  async function europePMC(term, settings, signal) {
    const q = encodeURIComponent(
      `"${term}" AND (PUB_YEAR:[${settings.yearFrom} TO ${settings.yearTo}])`
    );
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q}&format=json&pageSize=100&resultType=core`;
    const data = await fetchJSON(url, { signal });
    if (!data) return [];
    return ((data.resultList || {}).result || []).map(p => ({
      title:    p.title || '',
      authors:  (p.authorList?.author || []).map(a => a.fullName).join(', '),
      year:     parseInt(p.pubYear) || null,
      abstract: p.abstractText || '',
      doi:      p.doi || 'not reported',
      url:      p.doi ? `https://doi.org/${p.doi}` : 'not reported',
      language: p.language || '',
      source_type:   'journal',
      pdf_available: p.isOpenAccess === 'Y' ? 'yes' : 'unknown',
      source_db: 'Europe PMC',
    }));
  }

  // ── Crossref ────────────────────────────────────────────────
  async function crossref(term, settings, signal) {
    const url = [
      'https://api.crossref.org/works',
      `?query=${encodeURIComponent(term)}`,
      `&filter=from-pub-date:${settings.yearFrom},until-pub-date:${settings.yearTo}`,
      `&rows=100`,
      `&mailto=swd-search@research.tool`,
    ].join('');
    const data = await fetchJSON(url, { signal });
    if (!data) return [];
    return ((data.message || {}).items || []).map(p => ({
      title:    Array.isArray(p.title) ? p.title[0] : (p.title || ''),
      authors:  (p.author || []).map(a => [a.family, a.given].filter(Boolean).join(' ')).join('; '),
      year:     p.published?.['date-parts']?.[0]?.[0] || null,
      abstract: p.abstract ? p.abstract.replace(/<[^>]+>/g, '') : '',
      doi:      p.DOI || 'not reported',
      url:      p.DOI ? `https://doi.org/${p.DOI}` : 'not reported',
      source_type:   mapCRType(p.type),
      pdf_available: p.link?.find(l => l['content-type'] === 'application/pdf') ? 'yes' : 'unknown',
      source_db: 'Crossref',
    }));
  }

  // ── GBIF — occurrence records ────────────────────────────────
  // Note: GBIF results are independent of the search term (taxon-based).
  // We only fetch once per run and cache the result to avoid 300 identical requests.
  let _gbifCache = null;
  async function gbif(term, settings, signal) {
    if (!_gbifCache) {
      const url = `https://api.gbif.org/v1/occurrence/search?taxonKey=1455379&limit=300&hasCoordinate=false`;
      const data = await fetchJSON(url, { signal });
      _gbifCache = data ? (data.results || []) : [];
    }
    return _gbifCache.map(occ => ({
      title:    `GBIF occurrence #${occ.key}`,
      authors:  occ.institutionCode || occ.datasetName || 'GBIF',
      year:     occ.year || null,
      abstract: '',
      doi:      'not reported',
      url:      `https://www.gbif.org/occurrence/${occ.key}`,
      country:  occ.country || 'not reported',
      region:   occ.stateProvince || 'not reported',
      locality: occ.locality || 'not reported',
      coordinates: (occ.decimalLatitude && occ.decimalLongitude)
        ? `${occ.decimalLatitude}, ${occ.decimalLongitude}` : 'not reported',
      host_plant:    occ.associatedTaxa || 'not reported',
      evidence_type: 'observation',
      evidence_class:'primary',
      source_type:   'occurrence',
      pdf_available: 'unknown',
      source_db:     'GBIF',
      _direct: true,
    }));
  }

  // Reset cache between runs
  function resetCache() { _gbifCache = null; }

  // ── iNaturalist ─────────────────────────────────────────────
  let _inatCache = null;
  async function iNaturalist(term, settings, signal) {
    if (!_inatCache) {
      const url = `https://api.inaturalist.org/v1/observations?taxon_name=Drosophila+suzukii&quality_grade=research&per_page=200&order=desc&order_by=created_at`;
      const data = await fetchJSON(url, { signal });
      _inatCache = data ? (data.results || []) : [];
    }
    return _inatCache.map(obs => ({
      title:    `iNaturalist observation #${obs.id}`,
      authors:  obs.user?.login || 'iNaturalist user',
      year:     obs.observed_on ? parseInt(obs.observed_on.slice(0, 4)) : null,
      abstract: obs.description || '',
      doi:      'not reported',
      url:      `https://www.inaturalist.org/observations/${obs.id}`,
      country:  obs.place_guess || 'not reported',
      region:   'not reported',
      locality: obs.place_guess || 'not reported',
      coordinates: obs.location || 'not reported',
      evidence_type: 'observation',
      evidence_class:'primary',
      source_type:   'occurrence',
      pdf_available: 'unknown',
      source_db:     'iNaturalist',
      _direct: true,
    }));
  }

  // ── Zenodo ──────────────────────────────────────────────────
  async function zenodo(term, settings, signal) {
    const url = `https://zenodo.org/api/records?q=${encodeURIComponent(term)}&size=100&sort=mostrecent&type=publication`;
    const data = await fetchJSON(url, { signal });
    if (!data) return [];
    return ((data.hits || {}).hits || []).map(r => ({
      title:    r.metadata?.title || '',
      authors:  (r.metadata?.creators || []).map(c => c.name).join(', '),
      year:     r.metadata?.publication_date
                  ? parseInt(r.metadata.publication_date.slice(0, 4)) : null,
      abstract: r.metadata?.description || '',
      doi:      r.doi || r.metadata?.doi || 'not reported',
      url:      r.links?.html || 'not reported',
      source_type:   'grey',
      pdf_available: r.files?.length ? 'yes' : 'unknown',
      source_db: 'Zenodo',
    }));
  }

  // ── Unpaywall ────────────────────────────────────────────────
  // Queries OA status for a specific DOI — useful as a post-processor.
  // For search, it falls through to stub (no term-based search API).
  async function unpaywall(term, settings, signal) {
    return []; // Unpaywall is DOI-lookup only, not term search — stub
  }

  // ── Stubs — return [] silently, never throw ──────────────────
  async function stub() { return []; }

  // ── Type mappers ─────────────────────────────────────────────
  function mapOAType(t) {
    const m = {
      'journal-article':'journal','dissertation':'thesis','report':'report',
      'book-chapter':'book_chapter','proceedings-article':'conference','preprint':'grey',
    };
    return m[t] || 'journal';
  }
  function mapCRType(t) {
    const m = {
      'journal-article':'journal','book-chapter':'book_chapter',
      'proceedings-article':'conference','dissertation':'thesis',
      'report':'report','posted-content':'grey',
    };
    return m[t] || 'journal';
  }

  // ── Dispatcher ───────────────────────────────────────────────
  const CONNECTORS = {
    semanticscholar,
    openalex,
    europepmc: europePMC,
    crossref,
    gbif,
    inat: iNaturalist,
    zenodo,
    unpaywall,
    // Institutional — stub until credentials/proxy available:
    base: stub, eppo: stub, cabi: stub, usda: stub,
    jki:  stub, naro: stub, caas: stub, rda:  stub,
    bold: stub, ncbi: stub, lens: stub,
  };

  async function query(dbKey, term, settings, signal) {
    const fn = CONNECTORS[dbKey];
    if (!fn) return []; // unknown key — skip silently
    return fn(term, settings, signal);
  }

  return { query, resetCache };

})();

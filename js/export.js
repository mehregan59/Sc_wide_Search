/* js/export.js — Export to CSV, JSON, BibTeX, GeoJSON, missing-sources TXT, paywalled DOI list */

const SWDExport = (() => {

  function recs(cat) {
    const all = window._SWDRecords || [];
    return cat === 'all' ? all : all.filter(r => r.category === cat);
  }

  // ── CSV ──────────────────────────────────────────────────────
  function csv(cat) {
    const data = recs(cat);
    if (!data.length) { alert('No records to export. Run a search first.'); return; }
    const cols = SWDConfig.SCHEMA.map(s => s.field);
    const rows = data.map(r => cols.map(c => `"${String(r[c]||'').replace(/"/g,'""').replace(/\n/g,' ')}"`).join(','));
    download([cols.join(','), ...rows].join('\r\n'),
      `drosophila_suzukii_records${cat!=='all'?'_cat'+cat:''}_${stamp()}.csv`,
      'text/csv;charset=utf-8;');
  }

  // ── JSON ─────────────────────────────────────────────────────
  function json() {
    const data = recs('all');
    if (!data.length) { alert('No records to export.'); return; }
    download(JSON.stringify(data,null,2), `drosophila_suzukii_records_${stamp()}.json`, 'application/json');
  }

  // ── BibTeX ───────────────────────────────────────────────────
  function bibtex() {
    const data = recs('all').filter(r => r.doi && r.doi !== 'not reported');
    if (!data.length) { alert('No records with DOIs to export.'); return; }
    const entries = data.map((r,i) => {
      const key = `suzukii${r.pub_year||'nd'}_${i+1}`;
      const au  = r.full_citation.split('(')[0].trim().replace(/,\s*$/,'');
      const m   = r.full_citation.match(/\.\s+(.+?)\.\s+DOI:/);
      return `@article{${key},\n  author = {${au}},\n  year   = {${r.pub_year||''}},\n  title  = {${m?m[1]:'Drosophila suzukii study'}},\n  doi    = {${r.doi}},\n  note   = {Category: ${r.category}; Country: ${r.country}}\n}`;
    });
    download(entries.join('\n\n'), `drosophila_suzukii_${stamp()}.bib`, 'text/plain;charset=utf-8;');
  }

  // ── GeoJSON ──────────────────────────────────────────────────
  function geojson() {
    const data = recs('all').filter(r => r.coordinates && r.coordinates !== 'not reported');
    if (!data.length) { alert('No records with coordinates to export.'); return; }
    const features = data.map(r => {
      const [lat, lon] = r.coordinates.split(',').map(s => parseFloat(s.trim()));
      return { type:'Feature', geometry:{type:'Point',coordinates:[lon,lat]},
        properties:{ category:r.category, country:r.country, region:r.region,
          locality:r.locality, pub_year:r.pub_year, sampling_year:r.sampling_year,
          host_plant:r.host_plant, evidence_type:r.evidence_type,
          verification_status:r.verification_status, doi:r.doi } };
    });
    download(JSON.stringify({type:'FeatureCollection',features},null,2),
      `drosophila_suzukii_geo_${stamp()}.geojson`, 'application/json');
  }

  // ── Missing sources TXT ──────────────────────────────────────
  function missing() {
    const lines = [
      'Drosophila suzukii — Likely missing or hard-to-access sources',
      '═══════════════════════════════════════════════════════════════',
      'Generated: ' + new Date().toISOString(), '',
      ...SWDConfig.MISSING_SOURCES.map((s,i) => `${i+1}. ${s}`), '',
      'Note: Manual retrieval via institutional libraries, direct author contact,',
      'or national agricultural information centres is recommended.',
    ];
    download(lines.join('\n'), `swd_missing_sources_${stamp()}.txt`, 'text/plain;charset=utf-8;');
  }

  // ── Paywalled DOI list TXT ───────────────────────────────────
  function paywallTxt() {
    const data = getPaywalled();
    if (!data.length) { alert('No paywalled records with DOIs found. Run a search first.'); return; }
    const lines = [
      'Drosophila suzukii — Paywalled papers: DOI list for access requests',
      '════════════════════════════════════════════════════════════════════',
      `Generated: ${new Date().toISOString()}`,
      `Total: ${data.length} papers`,
      '',
      'HOW TO USE THIS LIST:',
      '  1. Email the corresponding author (search name + "ResearchGate" or "Google Scholar")',
      '  2. Request via your institutional library interlibrary loan (ILL)',
      '  3. Check if a preprint exists: https://europepmc.org or https://www.semanticscholar.org',
      '  4. Try Unpaywall browser extension for automatic OA version detection',
      '',
      '─'.repeat(68),
      '',
      ...data.map((r,i) => [
        `[${i+1}] DOI: ${r.doi}`,
        `    Authors: ${(r.full_citation||'').split('(')[0].trim().slice(0,100)}`,
        `    Year:    ${r.pub_year||'n.d.'}`,
        `    Title:   ${extractTitle(r.full_citation)}`,
        `    Country: ${r.country} | Category: ${r.category} | Access: ${r.pdf_available}`,
        `    Direct link: https://doi.org/${r.doi}`,
        '',
      ].join('\n')),
    ];
    download(lines.join('\n'), `swd_paywalled_dois_${stamp()}.txt`, 'text/plain;charset=utf-8;');
  }

  // ── Paywalled DOI list CSV ───────────────────────────────────
  function paywallCsv() {
    const data = getPaywalled();
    if (!data.length) { alert('No paywalled records with DOIs found. Run a search first.'); return; }
    const cols = ['doi','pub_year','authors','title','country','category','pdf_available','doi_url'];
    const rows = data.map(r => {
      const au = (r.full_citation||'').split('(')[0].trim().slice(0,120);
      return cols.map(c => {
        const v = c==='authors'?au : c==='title'?extractTitle(r.full_citation) : c==='doi_url'?`https://doi.org/${r.doi}` : (r[c]||'');
        return `"${String(v).replace(/"/g,'""')}"`;
      }).join(',');
    });
    download([cols.join(','),...rows].join('\r\n'), `swd_paywalled_dois_${stamp()}.csv`, 'text/csv;charset=utf-8;');
  }

  // ── Render paywalled DOI panel (called from app.js) ──────────
  function renderPaywallPanel() {
    const el = document.getElementById('paywall-list');
    if (!el) return;
    const data = getPaywalled();

    if (!data.length) {
      el.innerHTML = `<div class="paywall-empty">No paywalled papers with DOIs found. Run a search first — paywalled records will appear here automatically.</div>`;
      document.getElementById('paywall-count').textContent = '';
      return;
    }

    document.getElementById('paywall-count').textContent = `${data.length} papers`;

    el.innerHTML = data.map((r,i) => {
      const au    = (r.full_citation||'').split('(')[0].trim().slice(0,80);
      const title = extractTitle(r.full_citation);
      const doi   = r.doi;
      const gsUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(doi)}`;
      const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(doi)}`;
      const epUrl = `https://europepmc.org/search?query=${encodeURIComponent(doi)}`;
      return `
        <div class="paywall-row" id="prow-${i}">
          <div class="paywall-index">${i+1}</div>
          <div class="paywall-body">
            <div class="paywall-title">${esc(title)}</div>
            <div class="paywall-meta">${esc(au)} &middot; ${r.pub_year||'n.d.'} &middot; <span class="cat-pill cat-${(r.category||'e').toLowerCase()}" style="width:auto;padding:0 6px;font-size:10px">${r.category}</span> &middot; ${esc(r.country||'—')}</div>
            <div class="paywall-doi">
              <code class="doi-code" id="doi-code-${i}">${esc(doi)}</code>
              <button class="btn btn-sm paywall-copy" onclick="SWDExport.copyDOI('${esc(doi)}','doi-code-${i}')">Copy DOI</button>
            </div>
            <div class="paywall-actions">
              <a class="paywall-action-link" href="https://doi.org/${esc(doi)}" target="_blank" rel="noopener">Publisher &rarr;</a>
              <a class="paywall-action-link" href="${gsUrl}" target="_blank" rel="noopener">Google Scholar &rarr;</a>
              <a class="paywall-action-link" href="${epUrl}" target="_blank" rel="noopener">Europe PMC &rarr;</a>
              <a class="paywall-action-link" href="https://unpaywall.org/${esc(doi)}" target="_blank" rel="noopener">Unpaywall &rarr;</a>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function copyDOI(doi, codeId) {
    navigator.clipboard.writeText(doi).then(() => {
      const el = document.getElementById(codeId);
      if (el) { el.style.background='var(--accent-lt)'; setTimeout(()=>el.style.background='',1200); }
    });
  }

  // ── Helpers ──────────────────────────────────────────────────
  function getPaywalled() {
    return (window._SWDRecords||[]).filter(r =>
      r.doi && r.doi !== 'not reported' &&
      (r.pdf_available === 'paywalled' || r.pdf_available === 'no' || r.pdf_available === 'unknown')
    );
  }

  function extractTitle(citation) {
    if (!citation) return 'Title not available';
    const m = citation.match(/\)\.\s+(.+?)\.\s+DOI:/);
    return m ? m[1].trim().slice(0,200) : citation.slice(0,120);
  }

  function stamp() { return new Date().toISOString().slice(0,10); }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function download(content, filename, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+content],{type:mime}));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return { csv, json, bibtex, geojson, missing, paywallTxt, paywallCsv, renderPaywallPanel, copyDOI };
})();

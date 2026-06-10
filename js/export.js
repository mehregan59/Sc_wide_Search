/* js/export.js — Export to CSV, JSON, BibTeX, GeoJSON, missing-sources TXT */

const SWDExport = (() => {

  function recs(cat) {
    const all = window._SWDRecords || [];
    return cat === 'all' ? all : all.filter(r => r.category === cat);
  }

  function csv(cat) {
    const data = recs(cat);
    if (!data.length) { alert('No records to export. Run a search first.'); return; }
    const cols = SWDConfig.SCHEMA.map(s => s.field);
    const rows = data.map(r => cols.map(c => `"${String(r[c]||'').replace(/"/g,'""').replace(/\n/g,' ')}"`).join(','));
    download([cols.join(','), ...rows].join('\r\n'),
      `drosophila_suzukii_records${cat!=='all'?'_cat'+cat:''}_${stamp()}.csv`,
      'text/csv;charset=utf-8;');
  }

  function json() {
    const data = recs('all');
    if (!data.length) { alert('No records to export.'); return; }
    download(JSON.stringify(data,null,2), `drosophila_suzukii_records_${stamp()}.json`, 'application/json');
  }

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

  function stamp() { return new Date().toISOString().slice(0,10); }

  function download(content, filename, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+content],{type:mime}));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return { csv, json, bibtex, geojson, missing };
})();

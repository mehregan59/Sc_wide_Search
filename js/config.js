/* js/config.js — Search configuration & shared constants */

const SWDConfig = (() => {

  const SCHEMA = [
    { field: 'full_citation',       type: 'string',  desc: 'Full reference string (APA-style)' },
    { field: 'pub_year',            type: 'integer', desc: 'Year of publication' },
    { field: 'source_type',         type: 'enum',    desc: 'journal | thesis | report | conference | grey | book_chapter' },
    { field: 'language',            type: 'string',  desc: 'ISO 639-1 language code of the source' },
    { field: 'country',             type: 'string',  desc: 'Country where specimen / record originates' },
    { field: 'region',              type: 'string',  desc: 'State / province / region' },
    { field: 'locality',            type: 'string',  desc: 'Exact site or locality name' },
    { field: 'coordinates',         type: 'string',  desc: 'Decimal lat/lon or "not reported"' },
    { field: 'sampling_year',       type: 'string',  desc: 'Year of collection / detection (may differ from pub_year)' },
    { field: 'host_plant',          type: 'string',  desc: 'Host plant or crop, if stated' },
    { field: 'study_context',       type: 'string',  desc: 'Brief description of study type' },
    { field: 'evidence_type',       type: 'enum',    desc: 'trap | morphology | DNA | observation | model | review | lab_colony' },
    { field: 'evidence_class',      type: 'enum',    desc: 'primary | secondary | modelled | review-only | lab-strain-origin' },
    { field: 'category',            type: 'enum',    desc: 'A | B | C | D | E | F (output category)' },
    { field: 'excerpt',             type: 'string',  desc: 'Exact sentence or table cell mentioning the location' },
    { field: 'doi',                 type: 'string',  desc: 'DOI or "not reported"' },
    { field: 'url',                 type: 'string',  desc: 'Accessible URL or "not reported"' },
    { field: 'pdf_available',       type: 'enum',    desc: 'yes | no | paywalled | unknown' },
    { field: 'verification_status', type: 'enum',    desc: 'Verified | Partly verified | Needs manual check | Secondary citation only | No usable location' },
    { field: 'notes',               type: 'string',  desc: 'Caveats, uncertainties, or flags' },
    { field: 'source_db',           type: 'string',  desc: 'Database where this record was found' },
  ];

  const MISSING_SOURCES = [
    'Pre-1990 Japanese agricultural bulletins (NARO series — 農業・食品産業技術総合研究機構)',
    'Chinese provincial plant protection station annual reports (植保站年报) — not indexed online',
    'Korean RDA research bulletins on fruit flies (농촌진흥청 연구보고서)',
    'Regional Italian "Bollettino di Zoologia Agraria e di Bachicoltura" older issues',
    'FAO/IAEA technical reports on fruit fly control (non-indexed grey literature)',
    'Swiss Agroscope technical bulletins on Kirschessigfliege (2008–2012 early reports)',
    'Austrian Laimburg Research Centre internal reports',
    'Taiwanese BAPHIQ quarantine interception records',
    'Slovenian and Croatian phytosanitary authority field reports',
    'Canadian CFIA first-detection internal dossiers',
    'Chilean SAG (Servicio Agricola y Ganadero) phytosanitary bulletins',
    'IOBC-WPRS fruit fly working group conference proceedings (various years)',
    'EPPO Panel on Phytosanitary Measures meeting minutes citing detection data',
    'Portuguese DGAV phytosanitary surveillance reports',
    'Turkish GKGM plant protection directorate bulletins',
    'Serbian and Hungarian agricultural extension first-detection reports',
    'Older Taiwanese and South Korean university dissertations (pre-2005)',
    'Regional French DRAAF annual phytosanitary reports',
  ];

  const DB_LABELS = {
    semanticscholar:'Semantic Scholar', openalex:'OpenAlex', europepmc:'Europe PMC',
    crossref:'Crossref', unpaywall:'Unpaywall', base:'BASE', zenodo:'Zenodo',
    eppo:'EPPO Global DB', cabi:'CABI Compendium', usda:'USDA / NAL',
    jki:'JKI Germany', naro:'NARO Japan', caas:'CAAS China', rda:'RDA Korea',
    gbif:'GBIF', inat:'iNaturalist', bold:'BOLD', ncbi:'NCBI', lens:'Lens.org',
  };

  const VERIF_CLASS = {
    'Verified':'verif-verified', 'Partly verified':'verif-partly',
    'Needs manual check':'verif-manual', 'Secondary citation only':'verif-secondary',
    'No usable location':'verif-noloc',
  };

  function getSettings() {
    return {
      speciesTerms: getLines('cfg-species'),
      commonTerms:  getLines('cfg-common'),
      extraTerms:   getLines('cfg-extra'),
      excludeTerms: getLines('cfg-exclude'),
      yearFrom:     parseInt(document.getElementById('cfg-yr-from').value) || 1900,
      yearTo:       parseInt(document.getElementById('cfg-yr-to').value)   || 2025,
      maxPerQuery:  parseInt(document.getElementById('cfg-max').value)     || 500,
      languages:    document.getElementById('cfg-langs').value.split(',').map(s=>s.trim()).filter(Boolean),
      geoReq:       parseInt(document.getElementById('cfg-geo-req').value) || 0,
      databases:    getChecked('#chips-academic input, #chips-gov input, #chips-bio input'),
      scope:        getChecked('#chips-scope input'),
    };
  }

  function getLines(id) {
    return (document.getElementById(id).value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  }
  function getChecked(sel) {
    return [...document.querySelectorAll(sel)].filter(e=>e.checked).map(e=>e.value);
  }

  function resetDefaults() {
    document.getElementById('cfg-yr-from').value='1900';
    document.getElementById('cfg-yr-to').value='2025';
    document.getElementById('cfg-max').value='500';
    document.getElementById('cfg-geo-req').value='0';
    document.getElementById('cfg-extra').value='';
    document.getElementById('cfg-exclude').value='';
    document.querySelectorAll('#chips-scope input').forEach(e=>{e.checked=true;});
  }

  return { SCHEMA, MISSING_SOURCES, DB_LABELS, VERIF_CLASS, getSettings, resetDefaults };
})();

/* js/extractor.js — Location extraction, evidence classification, deduplication */

const SWDExtractor = (() => {

  const COUNTRY_PATTERNS = [
    'Japan','China','Korea','Taiwan','United States','USA','Canada','Mexico',
    'Germany','France','Italy','Spain','Portugal','Switzerland','Austria',
    'Belgium','Netherlands','United Kingdom','UK','Poland','Czech Republic',
    'Hungary','Slovenia','Croatia','Serbia','Romania','Bulgaria','Greece','Turkey',
    'Chile','Brazil','Argentina','Uruguay','Colombia','Peru',
    'Australia','New Zealand','South Africa','Morocco','Tunisia','Israel',
    'India','Thailand','Vietnam','Malaysia','Indonesia','Philippines',
    'Finland','Sweden','Norway','Denmark','Ireland','Scotland',
  ];

  const REGION_PATTERNS = [
    'Baden-Württemberg','Bavaria','Rhineland','North Rhine','Saxony','Thuringia',
    'Trentino','Alto Adige','Lombardy','Friuli','Veneto','Piedmont','Tuscany',
    'Nagano','Yamanashi','Hokkaido','Aomori','Yamagata','Iwate','Fukushima',
    'California','Oregon','Washington','Michigan','New York','Florida','Georgia',
    'British Columbia','Ontario','Quebec','Nova Scotia',
    'Catalonia','Aragon','Navarra','Basque Country','Valencia','Andalusia',
    'Rhone-Alpes','Occitanie','Provence','Burgundy','Alsace',
    'Valais','Vaud','Ticino','Graubuenden',
    'Styria','Tyrol','Carinthia','Lower Austria','Upper Austria',
    'Flanders','Wallonia','Podkarpacie','Silesia','Alentejo','Minho','Algarve',
  ];

  const HOST_PATTERNS = [
    'Prunus avium','Prunus cerasus','sweet cherry','sour cherry','cherry',
    'Vaccinium corymbosum','Vaccinium myrtillus','blueberry','bilberry',
    'Rubus idaeus','Rubus fruticosus','raspberry','blackberry',
    'Fragaria','strawberry','Sambucus nigra','elderberry',
    'Vitis vinifera','grape','Prunus persica','peach','nectarine',
    'Ficus carica','fig','Rosa','rosehip','Lonicera','honeysuckle',
    'Actinidia','kiwi','Arbutus','strawberry tree','Morus','mulberry',
  ];

  const EVIDENCE_KEYWORDS = {
    trap:        ['trap','trapping','Rebell','Droso-Trap','Scentry','McPhail','Olipe','sticky'],
    morphology:  ['morpholog','identif','specimen','pinned','museum','collection'],
    DNA:         ['DNA','COI','ITS','barcode','sequenc','mitochondri','phylogen','haplotype'],
    observation: ['observ','record','encounter','sight','survey','monitor'],
    model:       ['model','MaxEnt','BIOCLIM','SDM','niche','projection'],
    review:      ['review','meta-analysis','synthesis','overview','compil'],
    lab_colony:  ['colony','laborator','strain','population','reared','isofemale','cage'],
  };

  const EVIDENCE_CLASS_KEYWORDS = {
    primary:             ['collect','trap','specimen','survey','monitor','field','wild','caught','detected','first record','first report','first detection'],
    secondary:           ['cited in','according to','as reported by','personal comm','pers. comm','unpubl'],
    modelled:            ['model','predict','project','potential range','MaxEnt'],
    'review-only':       ['review','meta-analysis','synthesis','compil'],
    'lab-strain-origin': ['colony origin','field-collected','lab strain','lab population','reared from','isofemale'],
  };

  function assignCategory(r) {
    if (r.pub_year && r.pub_year < 1980) return 'F';
    if (!r.country || r.country === 'not reported') return 'E';
    const ec = r.evidence_class || '';
    if (ec === 'lab-strain-origin') return 'C';
    if (ec === 'review-only' || ec === 'modelled') return 'D';
    if (ec === 'primary') return 'A';
    return 'B';
  }

  function assignVerification(r) {
    if (!r.country || r.country === 'not reported') return 'No usable location';
    if (r.evidence_class === 'secondary') return 'Secondary citation only';
    if (!r.locality || r.locality === 'not reported') return 'Needs manual check';
    if (r.doi !== 'not reported' && r.evidence_class === 'primary') return 'Verified';
    return 'Partly verified';
  }

  function extract(text, patterns) {
    if (!text) return 'not reported';
    for (const p of patterns) {
      if (new RegExp('\\b' + p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b','i').test(text)) return p;
    }
    return 'not reported';
  }

  function detectEvidenceType(text) {
    if (!text) return 'observation';
    for (const [type, kws] of Object.entries(EVIDENCE_KEYWORDS))
      for (const kw of kws) if (text.toLowerCase().includes(kw.toLowerCase())) return type;
    return 'observation';
  }

  function detectEvidenceClass(text) {
    if (!text) return 'primary';
    for (const [cls, kws] of Object.entries(EVIDENCE_CLASS_KEYWORDS))
      for (const kw of kws) if (text.toLowerCase().includes(kw.toLowerCase())) return cls;
    return 'primary';
  }

  function extractExcerpt(abstract, country) {
    if (!abstract) return 'not reported';
    const sentences = abstract.match(/[^.!?]+[.!?]+/g) || [abstract];
    const cl = (country||'').toLowerCase();
    const rel = sentences.find(s => s.toLowerCase().includes(cl) || s.toLowerCase().includes('suzukii') || s.toLowerCase().includes('collect') || s.toLowerCase().includes('record'));
    return (rel || sentences[0] || '').trim().slice(0, 400);
  }

  function processHit(hit) {
    const fullText = [hit.title, hit.abstract].join(' ');

    if (hit._direct) {
      const rec = {
        full_citation: `${hit.authors} (${hit.year||'n.d.'}). ${hit.title}. ${hit.source_db}.`,
        pub_year: hit.year, source_type: hit.source_type||'occurrence', language: 'en',
        country: hit.country||extract(fullText,COUNTRY_PATTERNS),
        region:  hit.region ||extract(fullText,REGION_PATTERNS),
        locality: hit.locality||'not reported', coordinates: hit.coordinates||'not reported',
        sampling_year: hit.year||'not reported', host_plant: hit.host_plant||extract(fullText,HOST_PATTERNS),
        study_context: 'Occurrence record', evidence_type: hit.evidence_type||'observation',
        evidence_class: hit.evidence_class||'primary', excerpt: 'not reported',
        doi: hit.doi, url: hit.url, pdf_available: hit.pdf_available||'unknown',
        source_db: hit.source_db, notes: '',
      };
      rec.category = assignCategory(rec);
      rec.verification_status = assignVerification(rec);
      return [rec];
    }

    const country  = extract(fullText, COUNTRY_PATTERNS);
    const region   = extract(fullText, REGION_PATTERNS);
    const host     = extract(fullText, HOST_PATTERNS);
    const evType   = detectEvidenceType(fullText);
    const evClass  = detectEvidenceClass(fullText);
    const doi      = hit.doi || 'not reported';

    const rec = {
      full_citation: `${hit.authors||''} (${hit.year||'n.d.'}). ${hit.title||'Untitled'}. DOI: ${doi}`,
      pub_year: hit.year, source_type: hit.source_type||'journal', language: hit.language||'en',
      country, region, locality: 'not reported', coordinates: 'not reported',
      sampling_year: 'not reported', host_plant: host,
      study_context: evType==='lab_colony' ? 'Laboratory study' : 'Field study / survey',
      evidence_type: evType, evidence_class: evClass,
      excerpt: extractExcerpt(hit.abstract, country),
      doi, url: hit.url||(doi!=='not reported'?`https://doi.org/${doi}`:'not reported'),
      pdf_available: hit.pdf_available||'unknown', source_db: hit.source_db,
      notes: country==='not reported' ? 'No geographic term in title/abstract — manual full-text check required.' : '',
    };
    rec.category = assignCategory(rec);
    rec.verification_status = assignVerification(rec);
    return [rec];
  }

  const seen = new Set();
  function resetSeen() { seen.clear(); }
  function isDuplicate(rec) {
    const doi = rec.doi;
    if (doi && doi !== 'not reported') {
      if (seen.has(doi)) return true;
      seen.add(doi); return false;
    }
    const fp = (rec.full_citation||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,80);
    if (seen.has(fp)) return true;
    seen.add(fp); return false;
  }

  return { processHit, isDuplicate, resetSeen };
})();

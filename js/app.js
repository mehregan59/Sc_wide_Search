/**
 * SWD Search — single-file bundle
 * All modules inlined in dependency order inside DOMContentLoaded.
 * No inter-script race conditions possible.
 */
document.addEventListener('DOMContentLoaded', () => {

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════
const SCHEMA = [
  { field:'full_citation',       type:'string',  desc:'Full reference string (APA-style)' },
  { field:'pub_year',            type:'integer', desc:'Year of publication' },
  { field:'source_type',         type:'enum',    desc:'journal | thesis | report | conference | grey | book_chapter' },
  { field:'language',            type:'string',  desc:'ISO 639-1 language code' },
  { field:'country',             type:'string',  desc:'Country where specimen / record originates' },
  { field:'region',              type:'string',  desc:'State / province / region' },
  { field:'locality',            type:'string',  desc:'Exact site or locality name' },
  { field:'coordinates',         type:'string',  desc:'Decimal lat/lon or "not reported"' },
  { field:'sampling_year',       type:'string',  desc:'Year of collection / detection' },
  { field:'host_plant',          type:'string',  desc:'Host plant or crop, if stated' },
  { field:'study_context',       type:'string',  desc:'Brief description of study type' },
  { field:'evidence_type',       type:'enum',    desc:'trap | morphology | DNA | observation | model | review | lab_colony' },
  { field:'evidence_class',      type:'enum',    desc:'primary | secondary | modelled | review-only | lab-strain-origin' },
  { field:'category',            type:'enum',    desc:'A | B | C | D | E | F' },
  { field:'excerpt',             type:'string',  desc:'Sentence mentioning the location' },
  { field:'doi',                 type:'string',  desc:'DOI or "not reported"' },
  { field:'url',                 type:'string',  desc:'URL or "not reported"' },
  { field:'pdf_available',       type:'enum',    desc:'yes | no | paywalled | unknown' },
  { field:'verification_status', type:'enum',    desc:'Verified | Partly verified | Needs manual check | Secondary citation only | No usable location' },
  { field:'notes',               type:'string',  desc:'Caveats and flags' },
  { field:'source_db',           type:'string',  desc:'Source database' },
];

const MISSING_SOURCES = [
  'Pre-1990 Japanese agricultural bulletins (NARO series)',
  'Chinese provincial plant protection station annual reports (植保站年报)',
  'Korean RDA research bulletins on fruit flies (농촌진흥청 연구보고서)',
  'Regional Italian "Bollettino di Zoologia Agraria e di Bachicoltura" older issues',
  'FAO/IAEA technical reports on fruit fly control (grey literature)',
  'Swiss Agroscope technical bulletins on Kirschessigfliege (2008–2012)',
  'Austrian Laimburg Research Centre internal reports',
  'Taiwanese BAPHIQ quarantine interception records',
  'Slovenian and Croatian phytosanitary authority field reports',
  'Canadian CFIA first-detection internal dossiers',
  'Chilean SAG phytosanitary bulletins',
  'IOBC-WPRS fruit fly working group conference proceedings',
  'EPPO Panel on Phytosanitary Measures meeting minutes',
  'Portuguese DGAV phytosanitary surveillance reports',
  'Turkish GKGM plant protection directorate bulletins',
  'Serbian and Hungarian agricultural extension first-detection reports',
  'Older Taiwanese and South Korean university dissertations (pre-2005)',
  'Regional French DRAAF annual phytosanitary reports',
];

const DB_LABELS = {
  semanticscholar:'Semantic Scholar', openalex:'OpenAlex', europepmc:'Europe PMC',
  crossref:'Crossref', unpaywall:'Unpaywall', base:'BASE', zenodo:'Zenodo',
  eppo:'EPPO Global DB', cabi:'CABI', usda:'USDA/NAL',
  jki:'JKI Germany', naro:'NARO Japan', caas:'CAAS China', rda:'RDA Korea',
  gbif:'GBIF', inat:'iNaturalist', bold:'BOLD', ncbi:'NCBI', lens:'Lens.org',
};

const VERIF_CLASS = {
  'Verified':'verif-verified','Partly verified':'verif-partly',
  'Needs manual check':'verif-manual','Secondary citation only':'verif-secondary',
  'No usable location':'verif-noloc',
};

function getSettings() {
  const lines = id => (document.getElementById(id).value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const checked = sel => [...document.querySelectorAll(sel)].filter(e=>e.checked).map(e=>e.value);
  return {
    speciesTerms: lines('cfg-species'), commonTerms: lines('cfg-common'),
    extraTerms:   lines('cfg-extra'),   excludeTerms: lines('cfg-exclude'),
    yearFrom: parseInt(document.getElementById('cfg-yr-from').value)||1900,
    yearTo:   parseInt(document.getElementById('cfg-yr-to').value)||2025,
    maxPerQuery: parseInt(document.getElementById('cfg-max').value)||500,
    languages: document.getElementById('cfg-langs').value.split(',').map(s=>s.trim()).filter(Boolean),
    geoReq: parseInt(document.getElementById('cfg-geo-req').value)||0,
    databases: checked('#chips-academic input,#chips-gov input,#chips-bio input'),
    scope: checked('#chips-scope input'),
  };
}

function resetDefaults() {
  document.getElementById('cfg-yr-from').value='1900';
  document.getElementById('cfg-yr-to').value='2025';
  document.getElementById('cfg-max').value='500';
  document.getElementById('cfg-geo-req').value='0';
  document.getElementById('cfg-extra').value='';
  document.getElementById('cfg-exclude').value='';
  document.querySelectorAll('#chips-scope input').forEach(e=>e.checked=true);
}

// ═══════════════════════════════════════════════════════════════
// ENGINES
// ═══════════════════════════════════════════════════════════════
const DELAY = 200, RETRY_WAIT = 2000, MAX_RETRY = 2;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url, signal, attempt=0) {
  await sleep(DELAY);
  try {
    const res = await fetch(url, { headers:{'Accept':'application/json'}, signal });
    if (res.status===429||res.status===503) {
      if (attempt<MAX_RETRY) { await sleep(RETRY_WAIT*(attempt+1)); return fetchJSON(url,signal,attempt+1); }
      return null;
    }
    if (!res.ok) return null;
    return await res.json();
  } catch(e) {
    if (e.name==='AbortError') throw e;
    return null;
  }
}

function reconstitute(inv) {
  if (!inv) return '';
  const pos=[];
  for (const [w,idxs] of Object.entries(inv)) for (const i of idxs) pos.push([i,w]);
  return pos.sort((a,b)=>a[0]-b[0]).map(p=>p[1]).join(' ');
}

function mapOAType(t) {
  return {'journal-article':'journal','dissertation':'thesis','report':'report','book-chapter':'book_chapter','proceedings-article':'conference','preprint':'grey'}[t]||'journal';
}
function mapCRType(t) {
  return {'journal-article':'journal','book-chapter':'book_chapter','proceedings-article':'conference','dissertation':'thesis','report':'report','posted-content':'grey'}[t]||'journal';
}

// Cache for once-per-run DBs
let _gbifCache=null, _inatCache=null;
function resetEngineCache() { _gbifCache=null; _inatCache=null; }

async function queryOpenAlex(term, s, signal, label) {
  const url=`https://api.openalex.org/works?search=${encodeURIComponent(term)}&filter=publication_year:${s.yearFrom}-${s.yearTo}&per-page=100&mailto=swd-search@research.tool`;
  const data=await fetchJSON(url,signal);
  if(!data) return null;
  return (data.results||[]).map(p=>({
    title:p.title||'', authors:(p.authorships||[]).map(a=>a.author?.display_name).filter(Boolean).join(', '),
    year:p.publication_year||null, abstract:reconstitute(p.abstract_inverted_index),
    doi:p.doi?p.doi.replace('https://doi.org/',''):'not reported',
    url:p.open_access?.oa_url||p.doi||'not reported', language:p.language||'',
    source_type:mapOAType(p.type), pdf_available:p.open_access?.is_oa?'yes':'paywalled',
    source_db:label||'OpenAlex',
  }));
}

async function queryEuropePMC(term, s, signal) {
  const q=encodeURIComponent(`"${term}" AND (PUB_YEAR:[${s.yearFrom} TO ${s.yearTo}])`);
  const data=await fetchJSON(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q}&format=json&pageSize=100&resultType=core`,signal);
  if(!data) return null;
  return ((data.resultList||{}).result||[]).map(p=>({
    title:p.title||'', authors:(p.authorList?.author||[]).map(a=>a.fullName).join(', '),
    year:parseInt(p.pubYear)||null, abstract:p.abstractText||'',
    doi:p.doi||'not reported', url:p.doi?`https://doi.org/${p.doi}`:'not reported',
    language:p.language||'', source_type:'journal',
    pdf_available:p.isOpenAccess==='Y'?'yes':'unknown', source_db:'Europe PMC',
  }));
}

async function queryCrossref(term, s, signal) {
  const url=`https://api.crossref.org/works?query=${encodeURIComponent(term)}&filter=from-pub-date:${s.yearFrom},until-pub-date:${s.yearTo}&rows=100&mailto=swd-search@research.tool`;
  const data=await fetchJSON(url,signal);
  if(!data) return null;
  return ((data.message||{}).items||[]).map(p=>({
    title:Array.isArray(p.title)?p.title[0]:(p.title||''),
    authors:(p.author||[]).map(a=>[a.family,a.given].filter(Boolean).join(' ')).join('; '),
    year:p.published?.['date-parts']?.[0]?.[0]||null,
    abstract:p.abstract?p.abstract.replace(/<[^>]+>/g,''):'',
    doi:p.DOI||'not reported', url:p.DOI?`https://doi.org/${p.DOI}`:'not reported',
    source_type:mapCRType(p.type),
    pdf_available:p.link?.find(l=>l['content-type']==='application/pdf')?'yes':'unknown',
    source_db:'Crossref',
  }));
}

async function queryZenodo(term, s, signal) {
  const data=await fetchJSON(`https://zenodo.org/api/records?q=${encodeURIComponent(term)}&size=100&sort=mostrecent&type=publication`,signal);
  if(!data) return null;
  return ((data.hits||{}).hits||[]).map(r=>({
    title:r.metadata?.title||'', authors:(r.metadata?.creators||[]).map(c=>c.name).join(', '),
    year:r.metadata?.publication_date?parseInt(r.metadata.publication_date.slice(0,4)):null,
    abstract:r.metadata?.description||'',
    doi:r.doi||r.metadata?.doi||'not reported', url:r.links?.html||'not reported',
    source_type:'grey', pdf_available:r.files?.length?'yes':'unknown', source_db:'Zenodo',
  }));
}

async function queryGBIF(signal) {
  if (!_gbifCache) {
    const data=await fetchJSON('https://api.gbif.org/v1/occurrence/search?taxonKey=1455379&limit=300',signal);
    _gbifCache=data?(data.results||[]):[];
  }
  return _gbifCache.map(o=>({
    title:`GBIF occurrence #${o.key}`, authors:o.institutionCode||o.datasetName||'GBIF',
    year:o.year||null, abstract:'', doi:'not reported',
    url:`https://www.gbif.org/occurrence/${o.key}`,
    country:o.country||'not reported', region:o.stateProvince||'not reported',
    locality:o.locality||'not reported',
    coordinates:(o.decimalLatitude&&o.decimalLongitude)?`${o.decimalLatitude}, ${o.decimalLongitude}`:'not reported',
    host_plant:o.associatedTaxa||'not reported', evidence_type:'observation',
    evidence_class:'primary', source_type:'occurrence', pdf_available:'unknown',
    source_db:'GBIF', _direct:true,
  }));
}

async function queryINat(signal) {
  if (!_inatCache) {
    const data=await fetchJSON('https://api.inaturalist.org/v1/observations?taxon_name=Drosophila+suzukii&quality_grade=research&per_page=200',signal);
    _inatCache=data?(data.results||[]):[];
  }
  return _inatCache.map(o=>({
    title:`iNaturalist #${o.id}`, authors:o.user?.login||'iNaturalist user',
    year:o.observed_on?parseInt(o.observed_on.slice(0,4)):null,
    abstract:o.description||'', doi:'not reported',
    url:`https://www.inaturalist.org/observations/${o.id}`,
    country:o.place_guess||'not reported', region:'not reported',
    locality:o.place_guess||'not reported', coordinates:o.location||'not reported',
    evidence_type:'observation', evidence_class:'primary',
    source_type:'occurrence', pdf_available:'unknown',
    source_db:'iNaturalist', _direct:true,
  }));
}

// Single dispatcher
async function engineQuery(db, term, s, signal) {
  try {
    switch(db) {
      case 'semanticscholar': return await queryOpenAlex(term,s,signal,'Semantic Scholar (via OpenAlex)');
      case 'openalex':        return await queryOpenAlex(term,s,signal,'OpenAlex');
      case 'europepmc':       return await queryEuropePMC(term,s,signal);
      case 'crossref':        return await queryCrossref(term,s,signal);
      case 'zenodo':          return await queryZenodo(term,s,signal);
      case 'gbif':            return await queryGBIF(signal);
      case 'inat':            return await queryINat(signal);
      default:                return []; // stub
    }
  } catch(e) {
    if (e.name==='AbortError') throw e;
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// EXTRACTOR
// ═══════════════════════════════════════════════════════════════
const COUNTRIES=['Japan','China','Korea','Taiwan','United States','USA','Canada','Mexico','Germany','France','Italy','Spain','Portugal','Switzerland','Austria','Belgium','Netherlands','United Kingdom','UK','Poland','Czech Republic','Hungary','Slovenia','Croatia','Serbia','Romania','Bulgaria','Greece','Turkey','Chile','Brazil','Argentina','Uruguay','Colombia','Peru','Australia','New Zealand','South Africa','Morocco','Tunisia','Israel','India','Thailand','Vietnam','Malaysia','Indonesia','Philippines','Finland','Sweden','Norway','Denmark','Ireland','Scotland'];
const REGIONS=['Baden-Württemberg','Bavaria','Rhineland','Saxony','Thuringia','Trentino','Alto Adige','Lombardy','Friuli','Veneto','Piedmont','Tuscany','Nagano','Yamanashi','Hokkaido','Aomori','California','Oregon','Washington','Michigan','British Columbia','Ontario','Quebec','Catalonia','Aragon','Navarra','Valencia','Andalusia','Occitanie','Provence','Alsace','Valais','Vaud','Ticino','Styria','Tyrol','Carinthia','Flanders','Wallonia','Silesia','Alentejo','Algarve'];
const HOSTS=['Prunus avium','Prunus cerasus','sweet cherry','sour cherry','cherry','Vaccinium corymbosum','Vaccinium myrtillus','blueberry','bilberry','Rubus idaeus','Rubus fruticosus','raspberry','blackberry','Fragaria','strawberry','Sambucus nigra','elderberry','Vitis vinifera','grape','Prunus persica','peach','nectarine','Ficus carica','fig','Rosa','Lonicera','Actinidia','kiwi','Morus','mulberry'];
const EV_TYPE={trap:['trap','trapping','Droso-Trap','McPhail','sticky'],morphology:['morpholog','specimen','pinned','museum'],DNA:['DNA','COI','ITS','barcode','sequenc','haplotype'],model:['MaxEnt','BIOCLIM','SDM','niche'],review:['review','meta-analysis','synthesis'],lab_colony:['colony','laborator','strain','reared','isofemale']};
const EV_CLASS={primary:['collect','trap','specimen','survey','monitor','field','wild','caught','detected','first record','first report'],secondary:['cited in','according to','as reported by','pers. comm'],modelled:['model','predict','project','MaxEnt'],'review-only':['review','meta-analysis','synthesis'],'lab-strain-origin':['colony origin','lab strain','lab population','reared from','isofemale']};

function extractFrom(text, list) {
  if (!text) return 'not reported';
  for (const p of list) { if (new RegExp('\\b'+p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(text)) return p; }
  return 'not reported';
}
function detectEvType(text) {
  if (!text) return 'observation';
  for (const [t,kws] of Object.entries(EV_TYPE)) for (const k of kws) if (text.toLowerCase().includes(k.toLowerCase())) return t;
  return 'observation';
}
function detectEvClass(text) {
  if (!text) return 'primary';
  for (const [c,kws] of Object.entries(EV_CLASS)) for (const k of kws) if (text.toLowerCase().includes(k.toLowerCase())) return c;
  return 'primary';
}
function assignCat(r) {
  if (r.pub_year&&r.pub_year<1980) return 'F';
  if (!r.country||r.country==='not reported') return 'E';
  const ec=r.evidence_class||'';
  if (ec==='lab-strain-origin') return 'C';
  if (ec==='review-only'||ec==='modelled') return 'D';
  if (ec==='primary') return 'A';
  return 'B';
}
function assignVerif(r) {
  if (!r.country||r.country==='not reported') return 'No usable location';
  if (r.evidence_class==='secondary') return 'Secondary citation only';
  if (!r.locality||r.locality==='not reported') return 'Needs manual check';
  if (r.doi&&r.doi!=='not reported'&&r.evidence_class==='primary') return 'Verified';
  return 'Partly verified';
}
function processHit(hit) {
  const ft=[hit.title,hit.abstract].join(' ');
  if (hit._direct) {
    const r={
      full_citation:`${hit.authors} (${hit.year||'n.d.'}). ${hit.title}. ${hit.source_db}.`,
      pub_year:hit.year, source_type:hit.source_type||'occurrence', language:'en',
      country:hit.country||extractFrom(ft,COUNTRIES), region:hit.region||extractFrom(ft,REGIONS),
      locality:hit.locality||'not reported', coordinates:hit.coordinates||'not reported',
      sampling_year:hit.year||'not reported', host_plant:hit.host_plant||extractFrom(ft,HOSTS),
      study_context:'Occurrence record', evidence_type:hit.evidence_type||'observation',
      evidence_class:hit.evidence_class||'primary', excerpt:'not reported',
      doi:hit.doi, url:hit.url, pdf_available:hit.pdf_available||'unknown',
      source_db:hit.source_db, notes:'',
    };
    r.category=assignCat(r); r.verification_status=assignVerif(r); return [r];
  }
  const country=extractFrom(ft,COUNTRIES), region=extractFrom(ft,REGIONS), host=extractFrom(ft,HOSTS);
  const evType=detectEvType(ft), evClass=detectEvClass(ft), doi=hit.doi||'not reported';
  const sentences=(hit.abstract||'').match(/[^.!?]+[.!?]+/g)||[];
  const excerpt=(sentences.find(s=>s.toLowerCase().includes((country||'').toLowerCase())||s.includes('suzukii'))||sentences[0]||'').trim().slice(0,400)||'not reported';
  const r={
    full_citation:`${hit.authors||''} (${hit.year||'n.d.'}). ${hit.title||'Untitled'}. DOI: ${doi}`,
    pub_year:hit.year, source_type:hit.source_type||'journal', language:hit.language||'en',
    country, region, locality:'not reported', coordinates:'not reported',
    sampling_year:'not reported', host_plant:host,
    study_context:evType==='lab_colony'?'Laboratory study':'Field study / survey',
    evidence_type:evType, evidence_class:evClass, excerpt,
    doi, url:hit.url||(doi!=='not reported'?`https://doi.org/${doi}`:'not reported'),
    pdf_available:hit.pdf_available||'unknown', source_db:hit.source_db,
    notes:country==='not reported'?'No geographic term found — manual full-text check required.':'',
  };
  r.category=assignCat(r); r.verification_status=assignVerif(r); return [r];
}

const _seen=new Set();
function resetSeen() { _seen.clear(); }
function isDuplicate(r) {
  const key=r.doi&&r.doi!=='not reported'?r.doi:(r.full_citation||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,80);
  if (_seen.has(key)) return true;
  _seen.add(key); return false;
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════
const stamp=()=>new Date().toISOString().slice(0,10);
function dlFile(content,name,mime) {
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:mime}));
  a.download=name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function exportCSV(cat) {
  const data=(window._SWDRecords||[]).filter(r=>cat==='all'||r.category===cat);
  if (!data.length){alert('No records. Run a search first.');return;}
  const cols=SCHEMA.map(s=>s.field);
  const rows=data.map(r=>cols.map(c=>`"${String(r[c]||'').replace(/"/g,'""').replace(/\n/g,' ')}"`).join(','));
  dlFile([cols.join(','),...rows].join('\r\n'),`swd_records${cat!=='all'?'_cat'+cat:''}_${stamp()}.csv`,'text/csv;charset=utf-8;');
}
function exportJSON() {
  const data=window._SWDRecords||[];
  if(!data.length){alert('No records.');return;}
  dlFile(JSON.stringify(data,null,2),`swd_records_${stamp()}.json`,'application/json');
}
function exportBibtex() {
  const data=(window._SWDRecords||[]).filter(r=>r.doi&&r.doi!=='not reported');
  if(!data.length){alert('No records with DOIs.');return;}
  const entries=data.map((r,i)=>{
    const key=`suzukii${r.pub_year||'nd'}_${i+1}`;
    const au=(r.full_citation||'').split('(')[0].trim().replace(/,\s*$/,'');
    const m=r.full_citation.match(/\)\.\s+(.+?)\.\s+DOI:/);
    return `@article{${key},\n  author={${au}},\n  year={${r.pub_year||''}},\n  title={${m?m[1]:'Drosophila suzukii study'}},\n  doi={${r.doi}}\n}`;
  });
  dlFile(entries.join('\n\n'),`swd_${stamp()}.bib`,'text/plain;charset=utf-8;');
}
function exportGeoJSON() {
  const data=(window._SWDRecords||[]).filter(r=>r.coordinates&&r.coordinates!=='not reported');
  if(!data.length){alert('No records with coordinates.');return;}
  const features=data.map(r=>{
    const [lat,lon]=r.coordinates.split(',').map(s=>parseFloat(s.trim()));
    return {type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties:{category:r.category,country:r.country,doi:r.doi}};
  });
  dlFile(JSON.stringify({type:'FeatureCollection',features},null,2),`swd_geo_${stamp()}.geojson`,'application/json');
}
function exportMissing() {
  const lines=['Drosophila suzukii — Missing / hard-to-access sources','═'.repeat(56),'Generated: '+new Date().toISOString(),'',...MISSING_SOURCES.map((s,i)=>`${i+1}. ${s}`)];
  dlFile(lines.join('\n'),`swd_missing_sources_${stamp()}.txt`,'text/plain;charset=utf-8;');
}

function getPaywalled() {
  return (window._SWDRecords||[]).filter(r=>r.doi&&r.doi!=='not reported'&&(r.pdf_available==='paywalled'||r.pdf_available==='no'||r.pdf_available==='unknown'));
}
function exportPaywallTxt() {
  const data=getPaywalled();
  if(!data.length){alert('No paywalled records. Run a search first.');return;}
  const lines=[
    'Drosophila suzukii — Paywalled papers DOI list','═'.repeat(50),
    `Generated: ${new Date().toISOString()}`,`Total: ${data.length} papers`,'',
    'HOW TO ACCESS:',
    '  1. Email the corresponding author (search name on Google Scholar or ResearchGate)',
    '  2. Request via interlibrary loan (ILL) at your institution — usually free, 24-48h',
    '  3. Check Unpaywall: https://unpaywall.org/<DOI>',
    '  4. Check Europe PMC: https://europepmc.org/search?query=<DOI>','',
    '─'.repeat(60),'',
    ...data.map((r,i)=>[
      `[${i+1}] DOI: ${r.doi}`,
      `    Authors: ${(r.full_citation||'').split('(')[0].trim().slice(0,100)}`,
      `    Year:    ${r.pub_year||'n.d.'}`,
      `    Country: ${r.country} | Category: ${r.category}`,
      `    Link:    https://doi.org/${r.doi}`,
      `    Unpaywall: https://unpaywall.org/${r.doi}`,
      '',
    ].join('\n')),
  ];
  dlFile(lines.join('\n'),`swd_paywalled_dois_${stamp()}.txt`,'text/plain;charset=utf-8;');
}
function exportPaywallCsv() {
  const data=getPaywalled();
  if(!data.length){alert('No paywalled records.');return;}
  const cols=['doi','pub_year','authors','country','category','doi_url','unpaywall_url'];
  const rows=data.map(r=>{
    const au=(r.full_citation||'').split('(')[0].trim().slice(0,120);
    return [`"${r.doi}"`,`"${r.pub_year||''}"`,`"${au.replace(/"/g,'""')}"`,`"${r.country}"`,`"${r.category}"`,`"https://doi.org/${r.doi}"`,`"https://unpaywall.org/${r.doi}"`].join(',');
  });
  dlFile([cols.join(','),...rows].join('\r\n'),`swd_paywalled_dois_${stamp()}.csv`,'text/csv;charset=utf-8;');
}

function copyDOI(doi,codeId) {
  navigator.clipboard.writeText(doi).then(()=>{
    const el=document.getElementById(codeId);
    if(el){el.style.background='var(--accent-lt)';setTimeout(()=>el.style.background='',1200);}
  });
}
window.copyDOI=copyDOI; // expose for inline onclick

function renderPaywallPanel() {
  const el=document.getElementById('paywall-list');
  const countEl=document.getElementById('paywall-count');
  if(!el) return;
  const q=(document.getElementById('paywall-search')?.value||'').toLowerCase();
  let data=getPaywalled();
  if(q) data=data.filter(r=>[r.full_citation,r.country,String(r.pub_year||'')].join(' ').toLowerCase().includes(q));
  if(countEl) countEl.textContent=data.length?`${data.length} papers`:'';
  if(!data.length){
    el.innerHTML='<div class="paywall-empty">No paywalled papers with DOIs found. Run a search first.</div>';
    return;
  }
  el.innerHTML=data.map((r,i)=>{
    const au=(r.full_citation||'').split('(')[0].trim().slice(0,80);
    const titleMatch=r.full_citation.match(/\)\.\s+(.+?)\.\s+DOI:/);
    const title=titleMatch?titleMatch[1].slice(0,200):(r.full_citation||'').slice(0,120);
    return `<div class="paywall-row">
      <div class="paywall-index">${i+1}</div>
      <div class="paywall-body">
        <div class="paywall-title">${esc(title)}</div>
        <div class="paywall-meta">${esc(au)} &middot; ${r.pub_year||'n.d.'} &middot; ${esc(r.country||'—')}</div>
        <div class="paywall-doi">
          <code class="doi-code" id="doi-code-${i}">${esc(r.doi)}</code>
          <button class="btn btn-sm paywall-copy" onclick="copyDOI('${r.doi}','doi-code-${i}')">Copy DOI</button>
        </div>
        <div class="paywall-actions">
          <a class="paywall-action-link" href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener">Publisher &rarr;</a>
          <a class="paywall-action-link" href="https://scholar.google.com/scholar?q=${encodeURIComponent(r.doi)}" target="_blank" rel="noopener">Google Scholar &rarr;</a>
          <a class="paywall-action-link" href="https://europepmc.org/search?query=${encodeURIComponent(r.doi)}" target="_blank" rel="noopener">Europe PMC &rarr;</a>
          <a class="paywall-action-link" href="https://unpaywall.org/${esc(r.doi)}" target="_blank" rel="noopener">Unpaywall &rarr;</a>
        </div>
      </div>
    </div>`;
  }).join('');
}

// Expose export functions for HTML onclick attributes
window.SWDExportFn = { csv:exportCSV, json:exportJSON, bibtex:exportBibtex, geojson:exportGeoJSON, missing:exportMissing, paywallTxt:exportPaywallTxt, paywallCsv:exportPaywallCsv };

// ═══════════════════════════════════════════════════════════════
// APP / UI
// ═══════════════════════════════════════════════════════════════
window._SWDRecords=[];
let isRunning=false, abortCtrl=null, midTerms=[], currentCat='all';
let stats={queries:0,raw:0,dedup:0,records:0,noloc:0,errors:0,skipped:0};
const catCounts={A:0,B:0,C:0,D:0,E:0,F:0};

const STUB_DBS=new Set(['unpaywall','base','eppo','cabi','usda','jki','naro','caas','rda','bold','ncbi','lens']);
const ONCE_DBS=new Set(['gbif','inat']);

// Tab nav
document.querySelectorAll('.nav-tab').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));

// Buttons
document.getElementById('btn-start-from-config').addEventListener('click',()=>{switchTab('run');startSearch();});
document.getElementById('btn-reset-config').addEventListener('click',resetDefaults);
document.getElementById('btn-run').addEventListener('click',startSearch);
document.getElementById('btn-stop').addEventListener('click',()=>{if(abortCtrl)abortCtrl.abort();});
document.getElementById('btn-add-term').addEventListener('click',addMidTerm);
document.getElementById('mid-term').addEventListener('keydown',e=>{if(e.key==='Enter')addMidTerm();});
document.getElementById('btn-apply-yr').addEventListener('click',()=>{
  const f=document.getElementById('mid-yr-from').value,t=document.getElementById('mid-yr-to').value;
  if(f) document.getElementById('cfg-yr-from').value=f;
  if(t) document.getElementById('cfg-yr-to').value=t;
  logMsg(`Year range updated: ${f||'—'}–${t||'—'}`,'warn');
});
document.getElementById('btn-add-db').addEventListener('click',()=>{
  const db=document.getElementById('mid-db-select').value; if(!db)return;
  logMsg(`Database queued: ${DB_LABELS[db]||db}`,'ok');
  const el=document.querySelector(`input[value="${db}"]`); if(el)el.checked=true;
});

// Results filters
document.getElementById('res-search').addEventListener('input',renderTable);
document.getElementById('res-verif').addEventListener('change',renderTable);
document.getElementById('res-sort').addEventListener('change',renderTable);
document.querySelectorAll('.cat-filter-btn').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.cat-filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); currentCat=btn.dataset.cat; renderTable();
}));
const pwSearch=document.getElementById('paywall-search');
if(pwSearch) pwSearch.addEventListener('input',renderPaywallPanel);

// Schema table
document.getElementById('schema-tbody').innerHTML=SCHEMA.map(s=>`<tr><td class="field-name">${s.field}</td><td class="field-type">${s.type}</td><td style="font-size:12.5px;color:var(--ink-2)">${s.desc}</td></tr>`).join('');

// Missing sources
document.getElementById('missing-list').innerHTML=MISSING_SOURCES.map(s=>`<div class="missing-item">${s}</div>`).join('');

// ── Search ────────────────────────────────────────────────────
async function startSearch() {
  if(isRunning)return;
  isRunning=true;
  abortCtrl=new AbortController();
  window._SWDRecords=[];
  resetSeen(); resetEngineCache();
  stats={queries:0,raw:0,dedup:0,records:0,noloc:0,errors:0,skipped:0};
  Object.keys(catCounts).forEach(k=>catCounts[k]=0);

  document.getElementById('log-box').innerHTML='';
  setProgress(0,'Initialising…'); setStatus('running','Running');
  document.getElementById('btn-run').disabled=true;
  document.getElementById('btn-stop').disabled=false;

  const s=getSettings();
  const allTerms=[...s.speciesTerms,...s.commonTerms,...s.extraTerms,...midTerms].filter(Boolean);
  const signal=abortCtrl.signal;
  const searchDBs=s.databases.filter(db=>!STUB_DBS.has(db)&&!ONCE_DBS.has(db));
  const occDBs=s.databases.filter(db=>ONCE_DBS.has(db));
  const stubDBs=s.databases.filter(db=>STUB_DBS.has(db));
  const total=(searchDBs.length*allTerms.length)+occDBs.length;
  let done=0;

  logMsg(`Search started — ${searchDBs.length} search DBs × ${allTerms.length} terms + ${occDBs.length} occurrence DBs`);
  if(stubDBs.length) logMsg(`${stubDBs.length} institutional DBs (stub — not yet wired): ${stubDBs.map(d=>DB_LABELS[d]||d).join(', ')}`,'warn');
  logMsg(`Year range: ${s.yearFrom}–${s.yearTo}`);

  // Occurrence DBs — once per run
  for(const db of occDBs){
    if(signal.aborted)break;
    const label=DB_LABELS[db]||db;
    logMsg(`Fetching ${label} occurrences…`);
    stats.queries++;
    try{
      const hits=await engineQuery(db,'',s,signal);
      if(hits===null){logMsg(`  ⚠ ${label} unreachable`,'warn');stats.skipped++;}
      else{
        stats.raw+=hits.length; let n=0;
        for(const h of hits) for(const r of processHit(h)){
          if(isDuplicate(r))continue;
          window._SWDRecords.push(r); n++; stats.dedup++;
          if(r.category==='E')stats.noloc++; else{stats.records++;catCounts[r.category]=(catCounts[r.category]||0)+1;}
        }
        logMsg(`  → ${hits.length} occurrences · ${n} new`,hits.length?'ok':'warn');
      }
    }catch(e){if(e.name==='AbortError')break;stats.errors++;logMsg(`  ✖ ${label}: ${e.message}`,'err');}
    updateStats(); done++; setProgress((done/total)*100,label);
  }

  // Search DBs — once per term
  for(const db of searchDBs){
    if(signal.aborted)break;
    const label=DB_LABELS[db]||db;
    for(const term of allTerms){
      if(signal.aborted)break;
      logMsg(`${label} ← "${term.slice(0,55)}${term.length>55?'…':''}"`);
      stats.queries++; updateStats();
      try{
        const hits=await engineQuery(db,term,s,signal);
        if(hits===null){logMsg(`  ⚠ ${label} unreachable (CORS/network) — skipped`,'warn');stats.skipped++;}
        else{
          stats.raw+=hits.length; let n=0;
          for(const h of hits) for(const r of processHit(h)){
            if(isDuplicate(r))continue;
            window._SWDRecords.push(r); n++; stats.dedup++;
            if(r.category==='E')stats.noloc++; else{stats.records++;catCounts[r.category]=(catCounts[r.category]||0)+1;}
          }
          if(hits.length===0)logMsg(`  → 0 results`,'warn');
          else logMsg(`  → ${hits.length} hits · ${n} new · ${hits.length-n} dupes`,'ok');
        }
      }catch(e){if(e.name==='AbortError')break;stats.errors++;logMsg(`  ✖ ${label}: ${e.message}`,'err');}
      updateStats(); done++; setProgress((done/total)*100,`${label} · "${term.slice(0,28)}"`);
    }
  }

  const stopped=signal.aborted;
  setProgress(stopped?null:100,stopped?'Stopped':'Complete');
  setStatus(stopped?'stopped':'done',stopped?'Stopped':'Done');
  logMsg(stopped?`Stopped. ${window._SWDRecords.length} records.`:`Complete — ${window._SWDRecords.length} records · ${stats.errors} errors · ${stats.skipped} skipped`,stopped?'warn':'ok');

  isRunning=false;
  document.getElementById('btn-run').disabled=false;
  document.getElementById('btn-stop').disabled=true;

  const badge=document.getElementById('badge-results');
  badge.textContent=window._SWDRecords.length; badge.hidden=!window._SWDRecords.length;
  const pwBadge=document.getElementById('badge-paywall');
  if(pwBadge){const n=getPaywalled().length;pwBadge.textContent=n;pwBadge.hidden=!n;}

  renderTable(); renderPaywallPanel();
  if(!stopped)switchTab('results');
}

function addMidTerm(){
  const inp=document.getElementById('mid-term'), t=inp.value.trim(); if(!t)return;
  midTerms.push(t); inp.value='';
  const chip=document.createElement('label'); chip.className='chip'; chip.style.cursor='pointer';
  chip.innerHTML=`${esc(t)} <span style="opacity:.5;margin-left:4px">×</span>`;
  chip.addEventListener('click',()=>{midTerms=midTerms.filter(x=>x!==t);chip.remove();});
  document.getElementById('mid-term-list').appendChild(chip);
  logMsg(`Added term: "${t}"`);
}

function renderTable(){
  const q=(document.getElementById('res-search').value||'').toLowerCase();
  const v=document.getElementById('res-verif').value;
  const sort=document.getElementById('res-sort').value;
  let data=(window._SWDRecords||[]).filter(r=>{
    if(currentCat!=='all'&&r.category!==currentCat)return false;
    if(v&&r.verification_status!==v)return false;
    if(q){const h=[r.country,r.region,r.locality,r.host_plant,r.full_citation,r.language,r.source_type,r.source_db].join(' ').toLowerCase();if(!h.includes(q))return false;}
    return true;
  });
  if(sort==='year_desc')data.sort((a,b)=>(b.pub_year||0)-(a.pub_year||0));
  if(sort==='year_asc') data.sort((a,b)=>(a.pub_year||0)-(b.pub_year||0));
  if(sort==='country_asc')data.sort((a,b)=>(a.country||'').localeCompare(b.country||''));
  if(sort==='verif')data.sort((a,b)=>(a.verification_status||'').localeCompare(b.verification_status||''));
  const tbody=document.getElementById('results-tbody');
  if(!data.length){
    tbody.innerHTML=`<tr class="empty-row"><td colspan="11">${window._SWDRecords.length===0?'Run a search to see results.':'No records match the filter.'}</td></tr>`;
    document.getElementById('table-footer').textContent=''; return;
  }
  const MAX=500;
  tbody.innerHTML=data.slice(0,MAX).map(r=>{
    const vc=VERIF_CLASS[r.verification_status]||'verif-secondary';
    const doiCell=r.doi&&r.doi!=='not reported'?`<a class="doi-link" href="https://doi.org/${r.doi}" target="_blank" rel="noopener">DOI →</a>`:r.url&&r.url!=='not reported'?`<a class="doi-link" href="${esc(r.url)}" target="_blank" rel="noopener">URL →</a>`:'—';
    const au=(r.full_citation||'').split('(')[0].trim().slice(0,40);
    return `<tr>
      <td><span class="cat-pill cat-${(r.category||'e').toLowerCase()}">${r.category||'?'}</span></td>
      <td>${r.pub_year||'—'}</td><td class="truncate" title="${esc(r.full_citation)}">${esc(au)}</td>
      <td>${esc(r.country||'—')}</td><td class="truncate">${esc(r.region||'—')}</td>
      <td class="truncate">${esc(r.locality||'—')}</td><td>${esc(r.sampling_year||'—')}</td>
      <td class="truncate">${esc(r.host_plant||'—')}</td>
      <td style="font-size:11px;color:var(--ink-3)">${esc(r.evidence_type||'—')}</td>
      <td><span class="verif-badge ${vc}">${esc(r.verification_status||'')}</span></td>
      <td>${doiCell}</td></tr>`;
  }).join('');
  document.getElementById('table-footer').textContent=`Showing ${Math.min(data.length,MAX)} of ${data.length} records${data.length>MAX?` (first ${MAX} shown)`:''}`;
}

// Helpers
function logMsg(msg,cls=''){
  const box=document.getElementById('log-box'),p=document.createElement('p');
  if(cls)p.className=`log-${cls}`;
  p.textContent=`[${new Date().toLocaleTimeString()}] ${msg}`;
  box.appendChild(p); box.scrollTop=box.scrollHeight;
}
function setProgress(pct,label){
  if(pct!==null)document.getElementById('prog-fill').style.width=Math.min(100,pct)+'%';
  document.getElementById('prog-label').textContent=label||'';
  document.getElementById('prog-pct').textContent=pct!==null?Math.round(pct)+'%':'';
}
function setStatus(state,text){const el=document.getElementById('run-status-label');el.className=`run-status ${state}`;el.textContent=text;}
function updateStats(){
  document.getElementById('s-queries').textContent=stats.queries;
  document.getElementById('s-raw').textContent=stats.raw;
  document.getElementById('s-dedup').textContent=stats.dedup;
  document.getElementById('s-records').textContent=stats.records;
  document.getElementById('s-noloc').textContent=stats.noloc;
  document.getElementById('s-errors').textContent=stats.errors;
  for(const k of Object.keys(catCounts)){const el=document.getElementById(`cat-${k.toLowerCase()}`);if(el)el.textContent=catCounts[k]||0;}
}
function switchTab(id){
  document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  const btn=document.querySelector(`.nav-tab[data-tab="${id}"]`); if(btn)btn.classList.add('active');
  const panel=document.getElementById(`panel-${id}`); if(panel)panel.classList.add('active');
  if(id==='paywall')renderPaywallPanel();
}

}); // end DOMContentLoaded
